import "server-only";
import { prisma } from "./prisma";
import { featuresDaEmpresa } from "./permissoes";
import { emitirParaEmpresa } from "./nfse/emitir";
import type { PeriodicidadeContrato } from "@/lib/generated/prisma/client";

// Contratos de serviço recorrentes: o cadastro guarda uma NFS-e pronta e a
// régua de repetição. Um robô diário emite o que venceu.
//
// Datas ficam ancoradas no fuso de Brasília: "dia 5" tem que ser o dia 5 aqui,
// não o dia 4 às 21h em UTC.

export const MESES_POR_PERIODO: Record<PeriodicidadeContrato, number> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

const FALHAS_ATE_PAUSAR = 3;

// Data (ano/mês/dia) no fuso de Brasília.
export function partesBrasilia(d: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" })
    .format(d)
    .split("-")
    .map(Number);
  return { ano, mes, dia };
}

// Meia-noite de Brasília de um dia — guardado como instante UTC (03:00Z).
export function diaBrasilia(ano: number, mes: number, dia: number): Date {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes - 1, Math.min(dia, ultimo), 3, 0, 0));
}

export function hojeBrasilia(): Date {
  const { ano, mes, dia } = partesBrasilia(new Date());
  return diaBrasilia(ano, mes, dia);
}

// yyyy-mm-dd de uma data já ancorada em Brasília — é o formato que a emissão
// espera para a competência.
export function isoBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(d);
}

// Próxima data depois de `base`, respeitando a periodicidade e o dia escolhido.
// Dia 31 em mês curto cai no último dia do mês.
export function avancar(base: Date, periodicidade: PeriodicidadeContrato, diaEmissao: number): Date {
  const { ano, mes } = partesBrasilia(base);
  const meses = MESES_POR_PERIODO[periodicidade];
  const total = mes - 1 + meses;
  return diaBrasilia(ano + Math.floor(total / 12), (total % 12) + 1, diaEmissao);
}

// Primeira emissão a partir de hoje: se o dia do mês já passou, joga para o
// próximo período.
export function primeiraEmissao(periodicidade: PeriodicidadeContrato, diaEmissao: number): Date {
  const hoje = hojeBrasilia();
  const { ano, mes } = partesBrasilia(hoje);
  const candidata = diaBrasilia(ano, mes, diaEmissao);
  return candidata >= hoje ? candidata : avancar(candidata, periodicidade, diaEmissao);
}

export type ResultadoRotina = {
  processados: number;
  emitidas: number;
  falharam: number;
  pausados: number;
  detalhes: { contratoId: string; nome: string; ok: boolean; erro?: string; numero?: number }[];
};

// Emite tudo que venceu. Sem sessão: é chamada pelo cron.
// `empresaId` limita a uma empresa (usado pelo botão "emitir agora").
export async function processarContratosVencidos(opcoes?: {
  empresaId?: string;
  contratoId?: string;
  // Ignora a data — força a emissão do contrato agora.
  forcar?: boolean;
}): Promise<ResultadoRotina> {
  const hoje = hojeBrasilia();
  const contratos = await prisma.contratoServico.findMany({
    where: {
      ativo: true,
      ...(opcoes?.empresaId ? { emitenteId: opcoes.empresaId } : {}),
      ...(opcoes?.contratoId ? { id: opcoes.contratoId } : {}),
      ...(opcoes?.forcar ? {} : { proximaEmissao: { lte: hoje } }),
      OR: [{ fim: null }, { fim: { gte: hoje } }],
    },
    orderBy: { proximaEmissao: "asc" },
  });

  const r: ResultadoRotina = { processados: 0, emitidas: 0, falharam: 0, pausados: 0, detalhes: [] };
  // Uma empresa por vez no cache de features — a consulta é a mesma para todos
  // os contratos dela.
  const features = new Map<string, Set<string>>();

  for (const c of contratos) {
    r.processados++;

    if (!features.has(c.emitenteId)) features.set(c.emitenteId, await featuresDaEmpresa(c.emitenteId));
    if (!features.get(c.emitenteId)!.has("emitir_nfse")) {
      await prisma.contratoServico.update({
        where: { id: c.id },
        data: { ativo: false, ultimoErro: "Plano sem emissão de NFS-e — contrato pausado." },
      });
      r.pausados++;
      r.falharam++;
      r.detalhes.push({ contratoId: c.id, nome: c.nome, ok: false, erro: "Plano sem emissão de NFS-e." });
      continue;
    }

    // Competência é o mês da data prevista, não o dia em que o robô rodou —
    // um contrato atrasado ainda pertence ao mês dele.
    const competencia = isoBrasilia(c.proximaEmissao);

    const emissao = await emitirParaEmpresa(
      c.emitenteId,
      {
        clienteId: c.clienteId,
        servicoId: c.servicoId,
        descricao: c.descricaoServico,
        cTribNac: c.cTribNac,
        cNBS: c.cNBS ?? "",
        valorServico: Number(c.valorServico),
        aliqISS: c.aliqISS == null ? 0 : Number(c.aliqISS),
        tribISSQN: c.tribISSQN,
        tpImunidade: c.tpImunidade,
        issRetido: c.issRetido,
        codMunicipioPrestacao: c.codMunicipioPrestacao,
        competencia,
        informacoesAdicionais: c.informacoesAdicionais ?? "",
      },
      c.id,
    );

    if (emissao.ok) {
      await prisma.contratoServico.update({
        where: { id: c.id },
        data: {
          proximaEmissao: avancar(c.proximaEmissao, c.periodicidade, c.diaEmissao),
          ultimaEmissaoEm: new Date(),
          ultimoErro: null,
          falhas: 0,
          notasGeradas: { increment: 1 },
        },
      });
      r.emitidas++;
      r.detalhes.push({ contratoId: c.id, nome: c.nome, ok: true, numero: emissao.numero });
      continue;
    }

    // Falhou: a data não avança (tenta de novo amanhã), mas três seguidas
    // pausam o contrato — senão o robô queima numeração todo dia.
    const falhas = c.falhas + 1;
    const pausar = falhas >= FALHAS_ATE_PAUSAR;
    await prisma.contratoServico.update({
      where: { id: c.id },
      data: { falhas, ultimoErro: emissao.erro.slice(0, 500), ...(pausar ? { ativo: false } : {}) },
    });
    r.falharam++;
    if (pausar) r.pausados++;
    r.detalhes.push({ contratoId: c.id, nome: c.nome, ok: false, erro: emissao.erro });
  }

  return r;
}
