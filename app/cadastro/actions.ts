"use server";

import { prisma } from "@/lib/prisma";
import { hashSenha, criarSessao } from "@/lib/auth";

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export type CadastroResultado = { erro: string } | { ok: true; destino: string };
export type LeadResultado = { erro: string } | { ok: true };

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
  const planoId = String(formData.get("planoId") ?? "").trim() || null;

  try {
    if (!nome) return { erro: "Informe seu nome." };
    if (!emailValido(email)) return { erro: "E-mail inválido." };
    if (senha.length < 8) return { erro: "A senha deve ter ao menos 8 caracteres." };

    const existe = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existe) return { erro: "Já existe uma conta com este e-mail. Faça login." };

    let plano: { id: string; sobConsulta: boolean } | null = null;
    if (planoId) {
      plano = await prisma.plano.findUnique({ where: { id: planoId }, select: { id: true, sobConsulta: true } });
      if (plano?.sobConsulta) return { erro: "Este plano é sob consulta. Use o formulário de contato." };
    }

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
