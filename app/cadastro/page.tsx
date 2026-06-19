import { prisma, comRetry } from "@/lib/prisma";
import CadastroForm from "./CadastroForm";

export const metadata = { title: "Criar conta · Easy-NFe" };

export type PlanoOpcao = { id: string; nome: string; sobConsulta: boolean };

async function carregarPlanos(): Promise<PlanoOpcao[]> {
  try {
    const rows = await comRetry(() => prisma.plano.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true, sobConsulta: true },
    }));
    return rows;
  } catch (e) {
    console.error("cadastro: falha ao carregar planos", e);
    return [];
  }
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const { plano: planoId } = await searchParams;
  const planos = await carregarPlanos();
  const selecionado = planoId ? planos.find((p) => p.id === planoId) ?? null : null;

  return <CadastroForm selecionado={selecionado} />;
}
