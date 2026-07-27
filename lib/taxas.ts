import "server-only";
import { prisma } from "./prisma";
import {
  TAXAS_PADRAO,
  arred,
  estimarTaxa,
  metodoTarifado,
  type TabelaTaxas,
} from "./taxas-calc";

// Persistência da tabela de taxas do gateway + gravação do custo real de cada
// fatura. A matemática vive em ./taxas-calc (compartilhada com o cliente).

export * from "./taxas-calc";

const CHAVE = "taxas-asaas";

// Lê a tabela configurada, completando com os padrões o que estiver faltando.
export async function lerTabelaTaxas(): Promise<TabelaTaxas> {
  const row = await prisma.configSistema.findUnique({ where: { chave: CHAVE } });
  if (!row) return { ...TAXAS_PADRAO };
  try {
    const dados = JSON.parse(row.valor) as Partial<TabelaTaxas>;
    const saida = { ...TAXAS_PADRAO };
    for (const k of Object.keys(TAXAS_PADRAO) as (keyof TabelaTaxas)[]) {
      const v = dados[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) saida[k] = v;
    }
    return saida;
  } catch {
    return { ...TAXAS_PADRAO };
  }
}

export async function salvarTabelaTaxas(t: TabelaTaxas): Promise<void> {
  const valor = JSON.stringify(t);
  await prisma.configSistema.upsert({
    where: { chave: CHAVE },
    update: { valor },
    create: { chave: CHAVE, valor },
  });
}

// Grava o custo da transação na fatura. Prefere o líquido real do Asaas; sem
// ele, estima pela tabela. Recebimento fora do gateway fica zerado (custo
// nenhum) em vez de ganhar uma estimativa falsa.
export async function registrarCustoFatura(
  faturaId: string,
  p: { valor: number; metodo?: string | null; netValue?: number | null; viaAsaas: boolean },
): Promise<void> {
  let taxa: number;
  let origem: string;

  if (typeof p.netValue === "number" && Number.isFinite(p.netValue) && p.netValue > 0) {
    taxa = arred(Math.max(0, p.valor - p.netValue));
    origem = "asaas";
  } else if (p.viaAsaas) {
    const metodo = metodoTarifado(p.metodo);
    if (!metodo) return; // método desconhecido: melhor sem número do que com um errado
    taxa = estimarTaxa(metodo, p.valor, await lerTabelaTaxas());
    origem = "estimada";
  } else {
    taxa = 0;
    origem = "estimada";
  }

  await prisma.fatura.update({
    where: { id: faturaId },
    data: { taxa, valorLiquido: arred(p.valor - taxa), taxaOrigem: origem },
  });
}
