"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { lerSessaoCompleta } from "@/lib/auth";
import { exigirUsuario } from "@/lib/empresa";

export type EstadoTrial = {
  mostrar: boolean;
  diasRestantes: number;
  expirado: boolean;
  planoNome: string;
};

// Estado do trial do usuário logado p/ o aviso de expiração (a partir do 5º dia
// de um trial de 7 dias → 2 dias ou menos restantes). Só p/ role USER c/ plano pago.
export async function estadoTrial(): Promise<EstadoTrial> {
  const vazio: EstadoTrial = { mostrar: false, diasRestantes: 0, expirado: false, planoNome: "" };
  const s = await lerSessaoCompleta();
  if (!s || s.role !== "USER") return vazio;

  const lic = await prisma.licenca.findUnique({ where: { userId: s.uid }, include: { plano: true } });
  if (!lic || lic.status !== "TRIAL" || !lic.validadeEm) return vazio;

  const preco = Number(lic.plano?.preco ?? 0);
  if (!(preco > 0)) return vazio; // sem preço não há como cobrar

  const ms = lic.validadeEm.getTime() - Date.now();
  const dias = Math.ceil(ms / 86_400_000);
  const mostrar = dias <= 2; // 5º dia em diante (trial de 7 dias)

  return {
    mostrar,
    diasRestantes: Math.max(0, dias),
    expirado: ms <= 0,
    planoNome: lic.plano?.nome ?? "",
  };
}

// Garante uma fatura pendente com token público p/ o usuário pagar e devolve o
// token (rota /pagar/[token]). Reaproveita uma fatura aberta se já existir.
export async function iniciarPagamentoAssinatura(): Promise<{ token: string } | { erro: string }> {
  try {
    const uid = await exigirUsuario();
    const user = await prisma.user.findUnique({ where: { id: uid }, include: { licenca: { include: { plano: true } } } });
    const plano = user?.licenca?.plano;
    if (!plano) return { erro: "Você ainda não tem um plano definido. Fale com o suporte." };
    const preco = Number(plano.preco);
    if (!(preco > 0)) return { erro: "Seu plano não tem preço definido. Fale com o suporte." };

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
