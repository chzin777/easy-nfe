import { prisma, comRetry } from "@/lib/prisma";
import CadastroForm from "./CadastroForm";

export const metadata = { title: "Criar conta · Easy-NFe" };

export type PlanoOpcao = {
  id: string;
  nome: string;
  sobConsulta: boolean;
  permiteTrial: boolean;
  preco: number;
  periodicidade: string;
};

async function carregarPlanos(): Promise<PlanoOpcao[]> {
  try {
    const rows = await comRetry(() => prisma.plano.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true, sobConsulta: true, permiteTrial: true, preco: true, periodicidade: true },
    }));
    return rows.map((p) => ({
      id: p.id,
      nome: p.nome,
      sobConsulta: p.sobConsulta,
      permiteTrial: p.permiteTrial,
      preco: Number(p.preco),
      periodicidade: p.periodicidade,
    }));
  } catch (e) {
    console.error("cadastro: falha ao carregar planos", e);
    return [];
  }
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; trial?: string }>;
}) {
  const { plano: planoId, trial } = await searchParams;
  const planos = await carregarPlanos();
  const selecionado = planoId ? planos.find((p) => p.id === planoId) ?? null : null;
  // Trial só vale quando o plano libera teste grátis (?trial=1 vindo da landing).
  const querTrial = trial === "1" && !!selecionado?.permiteTrial;

  return <CadastroForm planos={planos} selecionado={selecionado} querTrial={querTrial} />;
}
