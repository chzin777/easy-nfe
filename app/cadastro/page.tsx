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
  beneficios: string[];
};

async function carregarPlanos(): Promise<PlanoOpcao[]> {
  try {
    const rows = await comRetry(() => prisma.plano.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      select: {
        id: true, nome: true, sobConsulta: true, permiteTrial: true, preco: true,
        periodicidade: true, ordem: true,
        beneficios: { orderBy: { ordem: "asc" }, select: { chave: true, nome: true } },
      },
    }));

    const anterior = (ordem: number) => rows.filter((x) => x.ordem < ordem).sort((a, b) => b.ordem - a.ordem)[0];
    // Resolve "tudo_anterior" e esconde benefícios já cobertos pelo plano de baixo.
    const labels = (p: (typeof rows)[number]): string[] => {
      const temTudo = p.beneficios.some((b) => b.chave === "tudo_anterior");
      const ant = anterior(p.ordem);
      const cobertos = new Set((ant?.beneficios ?? []).map((b) => b.chave));
      return p.beneficios
        .filter((b) => b.chave === "tudo_anterior" || !(temTudo && cobertos.has(b.chave)))
        .map((b) => (b.chave === "tudo_anterior" ? `Tudo do ${ant?.nome ?? "plano anterior"}` : b.nome));
    };

    return rows.map((p) => ({
      id: p.id,
      nome: p.nome,
      sobConsulta: p.sobConsulta,
      permiteTrial: p.permiteTrial,
      preco: Number(p.preco),
      periodicidade: p.periodicidade,
      beneficios: labels(p),
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
