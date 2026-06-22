"use server";

import { prisma } from "@/lib/prisma";
import { ativarPorPagamento } from "@/lib/assinatura";

// Pagamento público por token (sem login). O token da fatura é o segredo.

export type FaturaPublica = {
  ok: true;
  planoNome: string;
  valor: number;
  vencimento: string;
  status: string;
  metodo: string | null;
} | { erro: string };

export type DadosPagamento =
  | {
      ok: true;
      metodo: "pix" | "boleto";
      pixCopiaECola?: string | null;
      pixQrImage?: string | null;
      bankSlipUrl?: string | null;
      linhaDigitavel?: string | null;
    }
  | { erro: string };

export async function obterFaturaPublica(token: string): Promise<FaturaPublica> {
  const f = await prisma.fatura.findUnique({ where: { tokenPublico: token } });
  if (!f) return { erro: "Cobrança não encontrada." };
  return {
    ok: true,
    planoNome: f.planoNome,
    valor: Number(f.valor),
    vencimento: f.vencimento.toISOString(),
    status: f.status,
    metodo: f.metodo,
  };
}

// Gera (ou reaproveita) a cobrança no Asaas para o método escolhido.
export async function gerarCobrancaFatura(token: string, metodo: "pix" | "boleto"): Promise<DadosPagamento> {
  try {
    const f = await prisma.fatura.findUnique({ where: { tokenPublico: token }, include: { user: true } });
    if (!f) return { erro: "Cobrança não encontrada." };
    if (f.status === "PAGA") return { erro: "Esta cobrança já foi paga." };

    const asaas = await import("@/lib/asaas");

    // Garante o cliente Asaas (pode não ter sido criado no cadastro).
    let customerId = f.user.asaasCustomerId;
    if (!customerId) {
      const cpf = (f.user.cpfCnpj ?? "").replace(/\D/g, "");
      if (cpf.length !== 11 && cpf.length !== 14) return { erro: "CPF/CNPJ do assinante ausente ou inválido." };
      const cli = await asaas.criarOuAtualizarCliente({
        nome: f.user.nome || f.user.email,
        cpfCnpj: cpf,
        email: f.user.email,
        telefone: f.user.telefone,
        externalReference: f.user.id,
      });
      customerId = cli.id;
      await prisma.user.update({ where: { id: f.user.id }, data: { asaasCustomerId: customerId } });
    }

    const dueDate = f.vencimento.toISOString().slice(0, 10);
    const descricao = `${f.planoNome} — assinatura Easy-NFe (${f.competencia})`;
    const ref = `${f.user.id}:${f.competencia}`;

    // Já existe cobrança do MESMO método? Reaproveita os dados salvos.
    if (f.asaasPaymentId && f.metodo === metodo) {
      if (metodo === "pix") return { ok: true, metodo, pixCopiaECola: f.pixCopiaECola, pixQrImage: f.pixQrImage };
      return { ok: true, metodo, bankSlipUrl: f.bankSlipUrl, linhaDigitavel: f.linhaDigitavel };
    }
    // Trocou de método: remove a cobrança anterior (best-effort).
    if (f.asaasPaymentId && f.metodo !== metodo) {
      await asaas.cancelarCobranca(f.asaasPaymentId);
    }

    if (metodo === "pix") {
      const cob = await asaas.criarCobrancaPix({ customer: customerId, value: Number(f.valor), dueDate, description: descricao, externalReference: ref });
      const qr = await asaas.obterPixQrCode(cob.id);
      await prisma.fatura.update({
        where: { id: f.id },
        data: { asaasPaymentId: cob.id, metodo: "pix", pixCopiaECola: qr.payload, pixQrImage: qr.encodedImage, bankSlipUrl: null, linhaDigitavel: null },
      });
      return { ok: true, metodo, pixCopiaECola: qr.payload, pixQrImage: qr.encodedImage };
    }

    // boleto
    const cob = await asaas.criarCobrancaBoleto({ customer: customerId, value: Number(f.valor), dueDate, description: descricao, externalReference: ref });
    let linha: string | null = null;
    try { linha = (await asaas.obterLinhaDigitavel(cob.id)).identificationField; } catch { /* pode demorar */ }
    await prisma.fatura.update({
      where: { id: f.id },
      data: { asaasPaymentId: cob.id, metodo: "boleto", bankSlipUrl: cob.bankSlipUrl, linhaDigitavel: linha, pixCopiaECola: null, pixQrImage: null },
    });
    return { ok: true, metodo, bankSlipUrl: cob.bankSlipUrl, linhaDigitavel: linha };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

// Verifica no Asaas se a cobrança foi paga; se sim, ativa a licença.
export async function conferirPagamento(token: string): Promise<{ status: "paga" | "pendente" | "erro"; msg?: string }> {
  try {
    const f = await prisma.fatura.findUnique({ where: { tokenPublico: token } });
    if (!f) return { status: "erro", msg: "Cobrança não encontrada." };
    if (f.status === "PAGA") return { status: "paga" };
    if (!f.asaasPaymentId) return { status: "pendente" };

    const { consultarCobranca } = await import("@/lib/asaas");
    const cob = await consultarCobranca(f.asaasPaymentId);
    const pagos = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
    if (pagos.includes((cob.status ?? "").toUpperCase())) {
      await ativarPorPagamento(f.id, f.metodo ?? "asaas", new Date());
      return { status: "paga" };
    }
    return { status: "pendente" };
  } catch (e) {
    return { status: "erro", msg: e instanceof Error ? e.message : String(e) };
  }
}
