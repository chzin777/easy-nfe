"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdmin, exigirAdminMaster } from "@/lib/admin";
import { precoComDesconto } from "@/lib/assinatura";
import { consultarCobranca } from "@/lib/asaas";
import {
  TAXAS_PADRAO,
  arred,
  estimarTaxa,
  lerTabelaTaxas,
  metodoTarifado,
  percentEfetivo,
  registrarCustoFatura,
  salvarTabelaTaxas,
  type TabelaTaxas,
} from "@/lib/taxas";

type Resultado = { ok: true } | { ok: false; erro: string };

// ----------------------------------------------------------------------------
// Tabela de taxas
// ----------------------------------------------------------------------------
export async function obterTaxas(): Promise<TabelaTaxas> {
  await exigirAdmin();
  return lerTabelaTaxas();
}

export async function salvarTaxas(t: TabelaTaxas): Promise<Resultado> {
  try {
    await exigirAdminMaster();
    const limpo = { ...TAXAS_PADRAO };
    for (const k of Object.keys(TAXAS_PADRAO) as (keyof TabelaTaxas)[]) {
      const v = Number(t[k]);
      limpo[k] = Number.isFinite(v) && v >= 0 ? arred(v) : TAXAS_PADRAO[k];
    }
    await salvarTabelaTaxas(limpo);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao salvar taxas." };
  }
}

// ----------------------------------------------------------------------------
// Resumo / KPIs
// ----------------------------------------------------------------------------
export type SerieMes = { mes: string; rotulo: string; bruto: number; taxa: number; liquido: number; qtd: number };
export type LinhaMetodo = {
  metodo: string;
  qtd: number;
  bruto: number;
  taxa: number;
  liquido: number;
  percent: number;
  ticket: number;
};

export type ResumoFaturamento = {
  meses: number;
  bruto: number;
  taxas: number;
  liquido: number;
  qtdPagas: number;
  percentTaxa: number;
  ticketBruto: number;
  ticketLiquido: number;
  taxaMedia: number;

  // Período anterior de mesma duração — sem isso um número sozinho não diz nada.
  brutoAnterior: number;
  taxasAnterior: number;
  liquidoAnterior: number;
  qtdPagasAnterior: number;

  serie: SerieMes[];
  porMetodo: LinhaMetodo[];

  // Recebíveis em aberto
  pendenteValor: number;
  pendenteQtd: number;
  atrasadoValor: number;
  atrasadoQtd: number;
  inadimplenciaPercent: number;

  // Assinatura
  mrr: number;
  mrrTaxa: number;
  mrrLiquido: number;
  assinantesAtivos: number;
  trials: number;
  arpu: number;
  custoAnualProjetado: number;

  // Mês corrente — mesma base do KPI de receita da aba "Usuários & Licenças"
  // (assinantes ativos, contas internas fora), agora com a taxa descontada.
  // O bruto daqui TEM que bater com o de lá; o que muda é a camada de custo.
  competencia: string;
  recebidoMes: number;
  taxaMes: number;
  recebidoMesLiquido: number;
  socios: number;

  // Confiabilidade do dado
  comTaxaReal: number;
  comTaxaEstimada: number;
  semTaxa: number;

  tabela: TabelaTaxas;
};

// Rateio da sociedade — mesmo número usado no KPI de receita da aba
// "Usuários & Licenças".
const SOCIOS = 2;

const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const rotuloMes = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");

// Custo de uma fatura paga: o real gravado quando existe; senão a estimativa
// pelo método (só quando a cobrança passou pelo Asaas).
function custoFatura(
  f: { valor: unknown; taxa: unknown; metodo: string | null; asaasPaymentId: string | null },
  tabela: TabelaTaxas,
): { bruto: number; taxa: number } {
  const bruto = Number(f.valor);
  if (f.taxa !== null && f.taxa !== undefined) return { bruto, taxa: Number(f.taxa) };
  if (!f.asaasPaymentId) return { bruto, taxa: 0 };
  const m = metodoTarifado(f.metodo);
  return { bruto, taxa: m ? estimarTaxa(m, bruto, tabela) : 0 };
}

export async function resumoFaturamento(meses = 6): Promise<ResumoFaturamento> {
  await exigirAdmin();
  const janela = Math.min(Math.max(Math.trunc(meses) || 6, 1), 36);
  const tabela = await lerTabelaTaxas();

  const agora = new Date();
  const inicio = new Date(agora);
  inicio.setMonth(inicio.getMonth() - janela);
  const inicioAnterior = new Date(agora);
  inicioAnterior.setMonth(inicioAnterior.getMonth() - janela * 2);

  // Contas internas (ADMIN/SUPORTE) ficam de fora — mesmo recorte do KPI de
  // receita da aba "Usuários & Licenças", para os dois números conversarem.
  const semContasInternas = { user: { role: { notIn: ["ADMIN" as const, "SUPORTE" as const] } } };

  const [faturas, licencas] = await Promise.all([
    prisma.fatura.findMany({
      where: semContasInternas,
      select: {
        userId: true,
        valor: true, taxa: true, taxaOrigem: true, status: true,
        pagaEm: true, vencimento: true, metodo: true, asaasPaymentId: true,
      },
    }),
    prisma.licenca.findMany({
      where: { status: { in: ["ATIVA", "TRIAL"] }, ...semContasInternas },
      select: {
        userId: true,
        status: true,
        descontoTipo: true,
        descontoValor: true,
        plano: { select: { preco: true, periodicidade: true } },
        user: { select: { faturas: { where: { status: "PAGA" }, orderBy: { pagaEm: "desc" }, take: 1, select: { metodo: true } } } },
      },
    }),
  ]);

  const pagas = faturas.filter((f) => f.status === "PAGA" && f.pagaEm);

  // ---- séries mensais (sempre a janela inteira, mês a mês) ------------------
  const mapaSerie = new Map<string, SerieMes>();
  for (let i = janela - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    mapaSerie.set(chaveMes(d), { mes: chaveMes(d), rotulo: rotuloMes(d), bruto: 0, taxa: 0, liquido: 0, qtd: 0 });
  }

  let bruto = 0, taxas = 0, qtdPagas = 0;
  let brutoAnterior = 0, taxasAnterior = 0, qtdPagasAnterior = 0;
  let comTaxaReal = 0, comTaxaEstimada = 0, semTaxa = 0;
  const porMetodo = new Map<string, LinhaMetodo>();

  for (const f of pagas) {
    const quando = f.pagaEm as Date;
    const { bruto: b, taxa: t } = custoFatura(f, tabela);

    const linha = mapaSerie.get(chaveMes(quando));
    if (linha) {
      linha.bruto = arred(linha.bruto + b);
      linha.taxa = arred(linha.taxa + t);
      linha.liquido = arred(linha.liquido + (b - t));
      linha.qtd += 1;
    }

    if (quando >= inicio) {
      bruto += b; taxas += t; qtdPagas += 1;
      if (f.taxaOrigem === "asaas") comTaxaReal += 1;
      else if (f.taxa !== null) comTaxaEstimada += 1;
      else semTaxa += 1;

      const chave = f.metodo?.toLowerCase() || "_sem";
      const m = porMetodo.get(chave) ?? { metodo: chave, qtd: 0, bruto: 0, taxa: 0, liquido: 0, percent: 0, ticket: 0 };
      m.qtd += 1; m.bruto += b; m.taxa += t; m.liquido += b - t;
      porMetodo.set(chave, m);
    } else if (quando >= inicioAnterior) {
      brutoAnterior += b; taxasAnterior += t; qtdPagasAnterior += 1;
    }
  }

  const metodos = [...porMetodo.values()]
    .map((m) => ({
      ...m,
      bruto: arred(m.bruto),
      taxa: arred(m.taxa),
      liquido: arred(m.liquido),
      percent: percentEfetivo(m.bruto, m.taxa),
      ticket: m.qtd ? arred(m.bruto / m.qtd) : 0,
    }))
    .sort((a, b) => b.bruto - a.bruto);

  // ---- em aberto -----------------------------------------------------------
  const hoje = new Date();
  let pendenteValor = 0, pendenteQtd = 0, atrasadoValor = 0, atrasadoQtd = 0;
  for (const f of faturas) {
    if (f.status === "PENDENTE" || f.status === "ATRASADA") {
      const v = Number(f.valor);
      const vencida = f.status === "ATRASADA" || f.vencimento < hoje;
      if (vencida) { atrasadoValor += v; atrasadoQtd += 1; }
      else { pendenteValor += v; pendenteQtd += 1; }
    }
  }

  // ---- MRR -----------------------------------------------------------------
  let mrr = 0, mrrTaxa = 0, assinantesAtivos = 0, trials = 0;
  // Assinantes que sustentam o MRR — mesma lista que a aba "Usuários & Licenças"
  // usa para o recebido do mês.
  const assinanteIds = new Set<string>();
  for (const l of licencas) {
    if (l.status === "TRIAL") { trials += 1; continue; }
    const p = l.plano;
    if (!p) continue;
    // Plano "sob consulta" tem preço negociado por licença; o valor efetivo é
    // receita real. Só fica de fora quando zera.
    const cobranca = precoComDesconto(Number(p.preco), l.descontoTipo, Number(l.descontoValor));
    if (cobranca <= 0) continue;
    assinantesAtivos += 1;
    assinanteIds.add(l.userId);
    const anual = p.periodicidade === "anual";
    // O método da última fatura paga é o melhor palpite do próximo ciclo.
    const metodo = metodoTarifado(l.user?.faturas[0]?.metodo) ?? "pix";
    const taxaCiclo = estimarTaxa(metodo, cobranca, tabela);
    mrr += anual ? cobranca / 12 : cobranca;
    mrrTaxa += anual ? taxaCiclo / 12 : taxaCiclo;
  }
  mrr = arred(mrr);
  mrrTaxa = arred(mrrTaxa);

  // ---- mês corrente (espelha kpisReceita, + taxa) --------------------------
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioProxMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  let recebidoMes = 0, taxaMes = 0;
  for (const f of pagas) {
    const quando = f.pagaEm as Date;
    if (quando < inicioMes || quando >= inicioProxMes) continue;
    if (!assinanteIds.has(f.userId)) continue;
    const { bruto: b, taxa: t } = custoFatura(f, tabela);
    recebidoMes += b;
    taxaMes += t;
  }
  recebidoMes = arred(recebidoMes);
  taxaMes = arred(taxaMes);

  const brutoRecebido = arred(bruto);
  const totalTaxas = arred(taxas);
  const baseInadimplencia = brutoRecebido + atrasadoValor;

  return {
    meses: janela,
    bruto: brutoRecebido,
    taxas: totalTaxas,
    liquido: arred(brutoRecebido - totalTaxas),
    qtdPagas,
    percentTaxa: percentEfetivo(brutoRecebido, totalTaxas),
    ticketBruto: qtdPagas ? arred(brutoRecebido / qtdPagas) : 0,
    ticketLiquido: qtdPagas ? arred((brutoRecebido - totalTaxas) / qtdPagas) : 0,
    taxaMedia: qtdPagas ? arred(totalTaxas / qtdPagas) : 0,

    brutoAnterior: arred(brutoAnterior),
    taxasAnterior: arred(taxasAnterior),
    liquidoAnterior: arred(brutoAnterior - taxasAnterior),
    qtdPagasAnterior,

    serie: [...mapaSerie.values()],
    porMetodo: metodos,

    pendenteValor: arred(pendenteValor),
    pendenteQtd,
    atrasadoValor: arred(atrasadoValor),
    atrasadoQtd,
    inadimplenciaPercent: baseInadimplencia > 0 ? percentEfetivo(baseInadimplencia, atrasadoValor) : 0,

    mrr,
    mrrTaxa,
    mrrLiquido: arred(mrr - mrrTaxa),
    assinantesAtivos,
    trials,
    arpu: assinantesAtivos ? arred(mrr / assinantesAtivos) : 0,
    custoAnualProjetado: arred(mrrTaxa * 12),

    competencia: chaveMes(agora),
    recebidoMes,
    taxaMes,
    recebidoMesLiquido: arred(recebidoMes - taxaMes),
    socios: SOCIOS,

    comTaxaReal,
    comTaxaEstimada,
    semTaxa,

    tabela,
  };
}

// ----------------------------------------------------------------------------
// Sincronização com o Asaas — troca estimativa por taxa real
// ----------------------------------------------------------------------------
export type SincronizacaoTaxas = { ok: true; consultadas: number; atualizadas: number; falhas: number } | { ok: false; erro: string };

// Busca o netValue de cada fatura paga pelo Asaas que ainda não tem a taxa real
// e regrava taxa/líquido. Sequencial de propósito: a API do Asaas limita
// requisições e este botão é manual, não um cron.
export async function sincronizarTaxasAsaas(limite = 120): Promise<SincronizacaoTaxas> {
  try {
    await exigirAdmin();
    const alvo = await prisma.fatura.findMany({
      where: {
        status: "PAGA",
        asaasPaymentId: { not: null },
        OR: [{ taxaOrigem: { not: "asaas" } }, { taxaOrigem: null }],
      },
      orderBy: { pagaEm: "desc" },
      take: Math.min(Math.max(Math.trunc(limite) || 120, 1), 500),
      select: { id: true, valor: true, metodo: true, asaasPaymentId: true },
    });

    let atualizadas = 0;
    let falhas = 0;
    for (const f of alvo) {
      try {
        const cob = await consultarCobranca(f.asaasPaymentId as string);
        await registrarCustoFatura(f.id, {
          valor: Number(cob.value ?? f.valor),
          metodo: f.metodo,
          netValue: cob.netValue,
          viaAsaas: true,
        });
        atualizadas += 1;
      } catch {
        falhas += 1;
      }
    }

    return { ok: true, consultadas: alvo.length, atualizadas, falhas };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao sincronizar taxas." };
  }
}
