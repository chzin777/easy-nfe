"use server";

import { prisma } from "@/lib/prisma";
import { hashSenha, criarSessao } from "@/lib/auth";

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export type CadastroResultado = { erro: string } | { ok: true; destino: string };
export type LeadResultado = { erro: string } | { ok: true };
export type AssinaturaResultado =
  | { erro: string }
  | { ok: true; destino: string; invoiceUrl: string | null };

// Self-serve: cria conta + licença TRIAL de 7 dias no plano escolhido (sem cartão)
// e já abre sessão. Cai no /configuracoes para cadastrar a primeira empresa.
export async function cadastrarTrial(
  _prev: CadastroResultado | null,
  formData: FormData,
): Promise<CadastroResultado> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const telefone = String(formData.get("telefone") ?? "").trim();

  try {
    if (!nome) return { erro: "Informe seu nome." };
    if (!emailValido(email)) return { erro: "E-mail inválido." };
    if (senha.length < 8) return { erro: "A senha deve ter ao menos 8 caracteres." };

    const existe = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existe) return { erro: "Já existe uma conta com este e-mail. Faça login." };

    // Trial no plano marcado como "libera teste grátis" no admin (menor ordem se houver vários).
    const plano = await prisma.plano.findFirst({
      where: { ativo: true, sobConsulta: false, permiteTrial: true },
      orderBy: { ordem: "asc" },
      select: { id: true },
    });

    const validadeEm = new Date();
    validadeEm.setDate(validadeEm.getDate() + 7);

    const user = await prisma.user.create({
      data: {
        nome,
        email,
        telefone: telefone || null,
        senhaHash: await hashSenha(senha),
        role: "USER",
        licenca: {
          create: {
            planoId: plano?.id ?? null,
            status: "TRIAL",
            validadeEm,
          },
        },
      },
    });

    await criarSessao(user.id, user.role);
    // Sem empresa ainda → configura a primeira.
    return { ok: true, destino: "/configuracoes" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint/i.test(msg)) return { erro: "Já existe uma conta com este e-mail. Faça login." };
    return { erro: msg };
  }
}

// Self-serve PAGO: cria conta + licença ATIVA no plano escolhido e gera um link
// de pagamento no Asaas (Pix/boleto/cartão). A conta já entra; o acesso segue
// liberado até a fatura vencer (tolerância). O webhook do Asaas confirma o
// pagamento e estende a validade.
export async function cadastrarAssinatura(
  _prev: AssinaturaResultado | null,
  formData: FormData,
): Promise<AssinaturaResultado> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const telefone = String(formData.get("telefone") ?? "").trim();
  const cpfCnpj = String(formData.get("cpfCnpj") ?? "").replace(/\D/g, "");
  const planoId = String(formData.get("planoId") ?? "").trim();

  try {
    if (!nome) return { erro: "Informe seu nome." };
    if (!emailValido(email)) return { erro: "E-mail inválido." };
    if (senha.length < 8) return { erro: "A senha deve ter ao menos 8 caracteres." };
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) return { erro: "Informe um CPF ou CNPJ válido." };

    const plano = await prisma.plano.findFirst({
      where: { id: planoId, ativo: true, sobConsulta: false },
      select: { id: true, nome: true, preco: true, periodicidade: true },
    });
    if (!plano) return { erro: "Plano inválido. Volte e escolha um plano." };
    const valor = Number(plano.preco);
    if (!(valor > 0)) return { erro: "Plano sem preço definido. Fale com a equipe." };

    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return { erro: "Já existe uma conta com este e-mail. Faça login." };
    }

    // Vencimento da 1ª cobrança: 3 dias (mantém o acesso enquanto paga).
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 3);
    const validade = new Date(vencimento);
    validade.setDate(validade.getDate() + 7); // validade da licença = vencimento + tolerância

    const user = await prisma.user.create({
      data: {
        nome,
        email,
        telefone: telefone || null,
        cpfCnpj,
        senhaHash: await hashSenha(senha),
        role: "USER",
        licenca: { create: { planoId: plano.id, status: "ATIVA", validadeEm: validade } },
      },
    });
    await criarSessao(user.id, user.role);

    // Gera o link de pagamento no Asaas. Se o Asaas falhar (ex.: chave ausente
    // em dev), a conta já existe — o admin pode gerar a cobrança depois.
    const competencia = `${vencimento.getFullYear()}-${String(vencimento.getMonth() + 1).padStart(2, "0")}`;
    const dueDate = vencimento.toISOString().slice(0, 10);
    try {
      const { criarOuAtualizarCliente, criarCobrancaLink } = await import("@/lib/asaas");
      const cliente = await criarOuAtualizarCliente({
        nome,
        cpfCnpj,
        email,
        telefone,
        externalReference: user.id,
      });
      const cobranca = await criarCobrancaLink({
        customer: cliente.id,
        value: valor,
        dueDate,
        description: `${plano.nome} — assinatura Easy-NFe (${competencia})`,
        externalReference: `${user.id}:${competencia}`,
      });
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { asaasCustomerId: cliente.id } }),
        prisma.fatura.create({
          data: {
            userId: user.id,
            planoNome: plano.nome,
            competencia,
            valor,
            vencimento,
            status: "PENDENTE",
            asaasPaymentId: cobranca.id,
            bankSlipUrl: cobranca.bankSlipUrl,
            invoiceUrl: cobranca.invoiceUrl,
          },
        }),
      ]);
      return { ok: true, destino: "/configuracoes", invoiceUrl: cobranca.invoiceUrl };
    } catch (e) {
      console.error("cadastrarAssinatura: falha no Asaas", e);
      // Conta criada; segue sem link (cobrança pode ser gerada depois).
      return { ok: true, destino: "/configuracoes", invoiceUrl: null };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint/i.test(msg)) return { erro: "Já existe uma conta com este e-mail. Faça login." };
    return { erro: msg };
  }
}

// Captura de lead (planos sob consulta ou quem prefere falar com vendas).
// Não cria conta — fica na tabela leads para o time comercial dar sequência.
export async function criarLead(
  _prev: LeadResultado | null,
  formData: FormData,
): Promise<LeadResultado> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefone = String(formData.get("telefone") ?? "").trim();
  const empresa = String(formData.get("empresa") ?? "").trim();
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const planoId = String(formData.get("planoId") ?? "").trim() || null;
  const planoNome = String(formData.get("planoNome") ?? "").trim() || null;

  try {
    if (!nome) return { erro: "Informe seu nome." };
    if (!emailValido(email)) return { erro: "E-mail inválido." };
    if (!telefone) return { erro: "Informe um telefone para contato." };

    await prisma.lead.create({
      data: {
        nome,
        email,
        telefone,
        empresa: empresa || null,
        mensagem: mensagem || null,
        planoId,
        planoNome,
      },
    });
    return { ok: true };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}
