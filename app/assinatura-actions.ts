"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { lerSessaoCompleta } from "@/lib/auth";
import { exigirUsuario } from "@/lib/empresa";
import { precoComDesconto } from "@/lib/assinatura";

export type EstadoTrial = {
  mostrar: boolean;
  diasRestantes: number;
  expirado: boolean;
  planoNome: string;
  tipo: "trial" | "renovacao";
};

// Estado do aviso de cobrança do usuário logado. Cobre dois casos:
//  - TRIAL: aviso a partir do 4º dia de um trial de 7 dias (→ 4 dias ou menos).
//  - ATIVA não-cartão (pix/boleto, sem assinatura recorrente): renovação manual.
//    Gera a fatura do próximo ciclo 7 dias antes do vencimento e exibe o aviso a
//    partir de 3 dias antes. Cartão renova sozinho (Asaas Subscriptions), sem aviso.
export async function estadoTrial(): Promise<EstadoTrial> {
  const vazio: EstadoTrial = { mostrar: false, diasRestantes: 0, expirado: false, planoNome: "", tipo: "trial" };
  const s = await lerSessaoCompleta();
  if (!s || s.role !== "USER") return vazio;

  const lic = await prisma.licenca.findUnique({ where: { userId: s.uid }, include: { plano: true } });
  if (!lic || !lic.validadeEm) return vazio;

  const preco = precoComDesconto(Number(lic.plano?.preco ?? 0), lic.descontoTipo, Number(lic.descontoValor));
  if (!(preco > 0)) return vazio; // sem preço (ou 100% descontado) não há como cobrar

  const ms = lic.validadeEm.getTime() - Date.now();
  const dias = Math.ceil(ms / 86_400_000);
  const planoNome = lic.plano?.nome ?? "";

  if (lic.status === "TRIAL") {
    return { mostrar: dias <= 4, diasRestantes: Math.max(0, dias), expirado: ms <= 0, planoNome, tipo: "trial" };
  }

  // ATIVA sem assinatura no cartão → renovação manual por pix/boleto.
  if (lic.status === "ATIVA" && !lic.asaasSubscriptionId) {
    if (dias <= 7) {
      await garantirFaturaRenovacao(lic.userId, planoNome, preco, lic.validadeEm);
    }
    return { mostrar: dias <= 3, diasRestantes: Math.max(0, dias), expirado: ms <= 0, planoNome, tipo: "renovacao" };
  }

  return vazio;
}

// Cria (idempotente) a fatura PENDENTE do próximo ciclo p/ renovação manual, com
// vencimento na data de validade da licença. O usuário paga via /pagar/[token]
// (a cobrança Asaas é gerada lá, no método escolhido). Competência = mês da
// validade, evitando colisão com a fatura do ciclo já pago.
async function garantirFaturaRenovacao(userId: string, planoNome: string, preco: number, validadeEm: Date): Promise<void> {
  const competencia = `${validadeEm.getFullYear()}-${String(validadeEm.getMonth() + 1).padStart(2, "0")}`;
  const existente = await prisma.fatura.findUnique({ where: { userId_competencia: { userId, competencia } }, select: { id: true } });
  if (existente) return;
  await prisma.fatura.create({
    data: {
      userId,
      planoNome,
      competencia,
      valor: preco,
      vencimento: validadeEm,
      status: "PENDENTE",
      tokenPublico: randomUUID().replace(/-/g, ""),
    },
  });
}

// Garante uma fatura pendente com token público p/ o usuário pagar e devolve o
// token (rota /pagar/[token]). Reaproveita uma fatura aberta se já existir.
export async function iniciarPagamentoAssinatura(): Promise<{ token: string } | { erro: string }> {
  try {
    const uid = await exigirUsuario();
    const user = await prisma.user.findUnique({ where: { id: uid }, include: { licenca: { include: { plano: true } } } });
    const lic = user?.licenca;
    const plano = lic?.plano;
    if (!plano) return { erro: "Você ainda não tem um plano definido. Fale com o suporte." };
    const preco = precoComDesconto(Number(plano.preco), lic.descontoTipo, Number(lic.descontoValor));
    if (!(preco > 0)) return { erro: "Seu plano não tem valor a cobrar. Fale com o suporte." };

    // Reaproveita uma fatura aberta com token.
    const aberta = await prisma.fatura.findFirst({
      where: { userId: uid, status: { in: ["PENDENTE", "ATRASADA"] }, tokenPublico: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (aberta?.tokenPublico) return { token: aberta.tokenPublico };

    const venc = new Date();
    venc.setDate(venc.getDate() + 3);
    const competencia = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}`;
    const token = randomUUID().replace(/-/g, "");

    const fatura = await prisma.fatura.upsert({
      where: { userId_competencia: { userId: uid, competencia } },
      update: { tokenPublico: token },
      create: {
        userId: uid,
        planoNome: plano.nome,
        competencia,
        valor: preco,
        vencimento: venc,
        status: "PENDENTE",
        tokenPublico: token,
      },
    });
    return { token: fatura.tokenPublico ?? token };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}
