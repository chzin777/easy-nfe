"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Badge, Button, Card, Field, Input } from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import { formatBRL } from "@/lib/format";
import {
  ROTULO_METODO,
  TAXAS_PADRAO,
  estimarTaxa,
  percentEfetivo,
  valorParaTaxaAbaixoDe,
  type MetodoTaxa,
  type TabelaTaxas,
} from "@/lib/taxas-calc";
import { obterTaxas, resumoFaturamento, salvarTaxas, sincronizarTaxasAsaas, type ResumoFaturamento } from "./faturamento-actions";

const COR = {
  bruto: "#5227ff",
  liquido: "#008300",
  taxa: "#dc2626",
  eixo: "#94a3b8",
  grid: "#eef0f4",
};

const PERIODOS = [3, 6, 12, 24];

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

// Rótulo "jul/2026" a partir de "2026-07".
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rotuloCompetencia(comp: string): string {
  const [ano, mes] = comp.split("-");
  return `${MESES_ABREV[Number(mes) - 1] ?? mes}/${ano}`;
}

// ----------------------------------------------------------------------------
// Cartões de KPI
// ----------------------------------------------------------------------------
function Variacao({ atual, anterior, invertido }: { atual: number; anterior: number; invertido?: boolean }) {
  if (!anterior) return <span className="text-[11px] text-[var(--muted)]">sem período anterior</span>;
  const delta = ((atual - anterior) / Math.abs(anterior)) * 100;
  const parado = Math.abs(delta) < 0.05;
  const bom = invertido ? delta < 0 : delta > 0;
  const cor = parado
    ? "text-[var(--muted)] bg-slate-100"
    : bom
      ? "text-[var(--success)] bg-[var(--success-soft)]"
      : "text-[var(--danger)] bg-[var(--danger-soft)]";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={"inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums " + cor}>
        {parado ? "=" : delta > 0 ? "▲" : "▼"}
        {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </span>
      <span className="text-[11px] text-[var(--muted)]">vs. período anterior</span>
    </span>
  );
}

function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  if (valores.length < 2) return null;
  const max = Math.max(...valores);
  const min = Math.min(...valores, 0);
  const amplitude = max - min || 1;
  const pontos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * 100;
    const y = 28 - ((v - min) / amplitude) * 28;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline points={`0,28 ${pontos.join(" ")} 100,28`} fill={cor} fillOpacity="0.10" stroke="none" />
      <polyline points={pontos.join(" ")} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiDestaque({ titulo, valor, anterior, serie, cor, sub, invertido }: {
  titulo: string; valor: number; anterior: number; serie: number[]; cor: string; sub?: string; invertido?: boolean;
}) {
  return (
    <Card className="flex flex-col justify-between p-5">
      <div>
        <p className="text-sm text-[var(--muted)]">{titulo}</p>
        <p className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight tabular-nums" style={{ color: cor }}>
          {formatBRL(valor)}
        </p>
        <div className="mt-1.5"><Variacao atual={valor} anterior={anterior} invertido={invertido} /></div>
        {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
      </div>
      <div className="mt-3"><Sparkline valores={serie} cor={cor} /></div>
    </Card>
  );
}

function Kpi({ titulo, valor, sub, destaque }: { titulo: string; valor: string; sub?: string; destaque?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{titulo}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums" style={destaque ? { color: destaque } : undefined}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </Card>
  );
}

// ----------------------------------------------------------------------------
export default function Faturamento() {
  const [meses, setMeses] = useState(6);
  const [recarga, setRecarga] = useState(0);
  const [dados, setDados] = useState<ResumoFaturamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  // Trocar de período dispara uma consulta nova; `vivo` descarta a resposta de
  // um período que o admin já abandonou.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await resumoFaturamento(meses);
      if (!vivo) return;
      setDados(r);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [meses, recarga]);

  function recarregar() {
    setCarregando(true);
    setRecarga((n) => n + 1);
  }

  async function sincronizar() {
    setSincronizando(true);
    setMsg(null);
    const r = await sincronizarTaxasAsaas();
    setSincronizando(false);
    if (!r.ok) { setMsg({ tom: "erro", texto: r.erro }); return; }
    setMsg({
      tom: "ok",
      texto: `${r.atualizadas} de ${r.consultadas} fatura(s) com a taxa real do Asaas${r.falhas ? ` · ${r.falhas} falha(s)` : ""}.`,
    });
    recarregar();
  }

  if (carregando && !dados) return <LightningLoader texto="Calculando faturamento…" />;
  if (!dados) return null;

  const serieBruto = dados.serie.map((s) => s.bruto);
  const serieTaxa = dados.serie.map((s) => s.taxa);
  const serieLiquido = dados.serie.map((s) => s.liquido);
  const grafico = dados.serie.map((s) => ({
    ...s,
    percent: percentEfetivo(s.bruto, s.taxa),
  }));

  return (
    <div className="space-y-5">
      {/* Período + ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {PERIODOS.map((m) => (
            <button
              key={m}
              onClick={() => { setMeses(m); setCarregando(true); }}
              className={"rounded-md px-3 py-1 transition " + (meses === m ? "bg-white text-[var(--primary)] shadow-sm" : "text-slate-500")}
            >
              {m} meses
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {carregando && <span className="text-xs text-[var(--muted)]">atualizando…</span>}
          <Button variante="secondary" onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? "Consultando Asaas…" : "Sincronizar taxas reais"}
          </Button>
        </div>
      </div>

      {msg && <p className={"text-sm font-medium " + (msg.tom === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]")}>{msg.texto}</p>}

      {/* Qualidade do dado — sem isso o admin não sabe se está lendo taxa real
          ou estimativa da tabela. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
        <Badge tom="success">{dados.comTaxaReal} com taxa real do Asaas</Badge>
        <Badge tom="warning">{dados.comTaxaEstimada} estimadas pela tabela</Badge>
        {dados.semTaxa > 0 && <Badge tom="neutral">{dados.semTaxa} sem taxa registrada</Badge>}
        <span>A taxa real vem do <code className="font-mono">netValue</code> do Asaas; use “Sincronizar taxas reais” para trocar estimativa por valor de fato.</span>
      </div>

      {/* Mês corrente — parte do mesmo bruto que a aba "Usuários & Licenças"
          mostra e desce até o que sobra por sócio depois da taxa. */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">Caixa de {rotuloCompetencia(dados.competencia)}</h3>
          <p className="text-xs text-[var(--muted)]">
            Mesma base do KPI de receita em “Usuários &amp; Licenças”: assinantes ativos, contas internas de fora.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Recebido (bruto)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatBRL(dados.recebidoMes)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">− Taxas do gateway</p>
            <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: COR.taxa }}>{formatBRL(dados.taxaMes)}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{pct(percentEfetivo(dados.recebidoMes, dados.taxaMes))} do bruto</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">= Líquido</p>
            <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: COR.liquido }}>{formatBRL(dados.recebidoMesLiquido)}</p>
          </div>
          <div className="rounded-xl border-2 border-[var(--primary)] bg-[var(--primary-soft)] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Por sócio ({(100 / dados.socios).toFixed(0)}%) · líquido
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--primary)]">{formatBRL(dados.recebidoMesLiquido / dados.socios)}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">bruto: {formatBRL(dados.recebidoMes / dados.socios)}</p>
          </div>
        </div>
      </Card>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiDestaque titulo="Receita bruta recebida" valor={dados.bruto} anterior={dados.brutoAnterior} serie={serieBruto} cor={COR.bruto} sub={`${dados.qtdPagas} fatura(s) paga(s) em ${dados.meses} meses`} />
        <KpiDestaque titulo="Taxas do gateway" valor={dados.taxas} anterior={dados.taxasAnterior} serie={serieTaxa} cor={COR.taxa} invertido sub={`${pct(dados.percentTaxa)} do bruto · ${formatBRL(dados.taxaMedia)} por cobrança`} />
        <KpiDestaque titulo="Receita líquida" valor={dados.liquido} anterior={dados.liquidoAnterior} serie={serieLiquido} cor={COR.liquido} sub="O que de fato caiu na conta" />
      </div>

      {/* KPIs de assinatura e recebíveis */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="MRR líquido" valor={formatBRL(dados.mrrLiquido)} destaque={COR.liquido} sub={`Bruto ${formatBRL(dados.mrr)} − taxa ${formatBRL(dados.mrrTaxa)}/mês`} />
        <Kpi titulo="Custo anual em taxas" valor={formatBRL(dados.custoAnualProjetado)} destaque={COR.taxa} sub="Projeção do MRR atual em 12 meses" />
        <Kpi titulo="Assinantes ativos" valor={String(dados.assinantesAtivos)} sub={`${dados.trials} em trial · ARPU ${formatBRL(dados.arpu)}`} />
        <Kpi titulo="Taxa efetiva" valor={pct(dados.percentTaxa)} destaque={COR.taxa} sub="Peso da tarifa sobre o bruto recebido" />
        <Kpi titulo="Ticket médio bruto" valor={formatBRL(dados.ticketBruto)} sub={`Líquido ${formatBRL(dados.ticketLiquido)}`} />
        <Kpi titulo="A receber" valor={formatBRL(dados.pendenteValor)} sub={`${dados.pendenteQtd} fatura(s) em aberto no prazo`} />
        <Kpi titulo="Em atraso" valor={formatBRL(dados.atrasadoValor)} destaque={COR.taxa} sub={`${dados.atrasadoQtd} fatura(s) vencida(s)`} />
        <Kpi titulo="Inadimplência" valor={pct(dados.inadimplenciaPercent)} sub="Vencido ÷ (vencido + recebido)" />
      </div>

      {/* Evolução mensal */}
      <Card className="p-5">
        <div className="mb-3">
          <h3 className="text-base font-semibold">Líquido e taxas por mês</h3>
          <p className="text-sm text-[var(--muted)]">Barras empilhadas somam o bruto recebido; a linha é o peso da taxa sobre o bruto do mês.</p>
        </div>
        {dados.qtdPagas === 0 ? (
          <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
            Nenhuma fatura paga no período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={grafico} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid stroke={COR.grid} vertical={false} />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: COR.eixo }} />
              <YAxis yAxisId="r" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: COR.eixo }} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <YAxis yAxisId="p" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: COR.eixo }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                formatter={(v, nome) => (nome === "Taxa efetiva" ? pct(Number(v)) : formatBRL(Number(v)))}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="r" dataKey="liquido" name="Líquido" stackId="a" fill={COR.liquido} radius={[0, 0, 0, 0]} />
              <Bar yAxisId="r" dataKey="taxa" name="Taxa" stackId="a" fill={COR.taxa} radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="percent" name="Taxa efetiva" stroke={COR.bruto} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Por método */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-base font-semibold">Custo por meio de pagamento</h3>
          <p className="text-sm text-[var(--muted)]">Últimos {dados.meses} meses. A tarifa do Pix e do boleto é fixa por cobrança — quanto menor o ticket, maior a mordida.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-2.5">Método</th>
              <th className="px-4 py-2.5 text-center">Cobranças</th>
              <th className="px-4 py-2.5 text-right">Ticket médio</th>
              <th className="px-4 py-2.5 text-right">Bruto</th>
              <th className="px-4 py-2.5 text-right">Taxa</th>
              <th className="px-4 py-2.5 text-right">Líquido</th>
              <th className="px-4 py-2.5 text-right">% efetivo</th>
            </tr>
          </thead>
          <tbody>
            {dados.porMetodo.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">Nenhuma fatura paga no período.</td></tr>
            ) : dados.porMetodo.map((m) => (
              <tr key={m.metodo} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-medium">{ROTULO_METODO[m.metodo] ?? m.metodo}</td>
                <td className="px-4 py-3 text-center tabular-nums">{m.qtd}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatBRL(m.ticket)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatBRL(m.bruto)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--danger)]">{formatBRL(m.taxa)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatBRL(m.liquido)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{pct(m.percent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Projecao dados={dados} />
      <Simulador tabela={dados.tabela} />
      <TabelaTaxasCard inicial={dados.tabela} onSalvo={() => recarregar()} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Projeção — para onde o run-rate atual leva nos próximos 12 meses
// ----------------------------------------------------------------------------
function Projecao({ dados }: { dados: ResumoFaturamento }) {
  const [crescimento, setCrescimento] = useState("0");
  const g = Number(crescimento.replace(",", ".")) || 0;

  // Base = MRR de hoje. Sem cenário de crescimento (0%) isto é run-rate puro:
  // "se nada mudar, é isso". A taxa acompanha a receita porque o custo por
  // assinante é o mesmo — o mix de métodos é o de hoje.
  const [ano, mes] = dados.competencia.split("-").map(Number);
  const linhas = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(ano, mes - 1 + i + 1, 1);
    const fator = Math.pow(1 + g / 100, i + 1);
    const bruto = dados.mrr * fator;
    const taxa = dados.mrrTaxa * fator;
    return {
      rotulo: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
      bruto,
      taxa,
      liquido: bruto - taxa,
    };
  });

  const totalBruto = linhas.reduce((s, l) => s + l.bruto, 0);
  const totalTaxa = linhas.reduce((s, l) => s + l.taxa, 0);
  const totalLiquido = totalBruto - totalTaxa;

  // Histórico realizado + projeção no mesmo eixo: séries separadas para a linha
  // projetada sair tracejada e não se confundir com o que já aconteceu.
  const ultimoReal = dados.serie.length - 1;
  const grafico = [
    // O último mês realizado também alimenta a série projetada — sem isso a
    // linha tracejada começa solta, sem ligação com o histórico.
    ...dados.serie.map((s, i) => ({
      rotulo: s.rotulo,
      real: s.liquido as number | null,
      proj: i === ultimoReal ? s.liquido : (null as number | null),
    })),
    ...linhas.map((l) => ({ rotulo: l.rotulo, real: null as number | null, proj: l.liquido })),
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Projeção — próximos 12 meses</h3>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            Parte do MRR atual ({formatBRL(dados.mrr)}/mês, {dados.assinantesAtivos} assinante(s)) e desconta a taxa do
            gateway. Com 0% é run-rate puro: o que entra se nada mudar.
          </p>
        </div>
        <Field label="Crescimento (% ao mês)" className="w-44">
          <Input value={crescimento} onChange={(e) => setCrescimento(e.target.value)} inputMode="decimal" />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Bruto em 12 meses</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatBRL(totalBruto)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">− Taxas</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: COR.taxa }}>{formatBRL(totalTaxa)}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{pct(percentEfetivo(totalBruto, totalTaxa))} do bruto</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">= Líquido em 12 meses</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: COR.liquido }}>{formatBRL(totalLiquido)}</p>
        </div>
        <div className="rounded-xl border-2 border-[var(--primary)] bg-[var(--primary-soft)] p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Por sócio ({(100 / dados.socios).toFixed(0)}%) · líquido
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--primary)]">{formatBRL(totalLiquido / dados.socios)}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">média de {formatBRL(totalLiquido / dados.socios / 12)}/mês</p>
        </div>
      </div>

      <div className="mt-5">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={grafico} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid stroke={COR.grid} vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: COR.eixo }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: COR.eixo }} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
            <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line dataKey="real" name="Líquido realizado" stroke={COR.liquido} strokeWidth={2} dot={false} connectNulls={false} />
            <Line dataKey="proj" name="Líquido projetado" stroke={COR.bruto} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
              <th className="py-2 pr-4">Mês</th>
              <th className="py-2 pr-4 text-right">Bruto</th>
              <th className="py-2 pr-4 text-right">Taxa</th>
              <th className="py-2 pr-4 text-right">Líquido</th>
              <th className="py-2 text-right">Por sócio</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-4 font-medium">{l.rotulo}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatBRL(l.bruto)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-[var(--danger)]">{formatBRL(l.taxa)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatBRL(l.liquido)}</td>
                <td className="py-2 text-right tabular-nums font-semibold">{formatBRL(l.liquido / dados.socios)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-[var(--muted)]">
        Projeção não considera churn nem renovação de anuais fora do ciclo — é o MRR de hoje projetado adiante. Trials
        ({dados.trials}) só entram quando viram assinatura.
      </p>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Simulador — responde "quanto sobra se eu cobrar X por este método"
// ----------------------------------------------------------------------------
const METODOS_SIM: { chave: MetodoTaxa; rotulo: string; parcelas?: number }[] = [
  { chave: "pix", rotulo: "Pix" },
  { chave: "boleto", rotulo: "Boleto" },
  { chave: "cartao", rotulo: "Crédito à vista", parcelas: 1 },
  { chave: "cartao", rotulo: "Crédito 2–6x", parcelas: 6 },
  { chave: "cartao", rotulo: "Crédito 7–12x", parcelas: 12 },
  { chave: "debito", rotulo: "Débito" },
];

function Simulador({ tabela }: { tabela: TabelaTaxas }) {
  const [valor, setValor] = useState("69.90");
  const v = Math.max(0, Number(valor.replace(",", ".")) || 0);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Simulador de taxa</h3>
          <p className="text-sm text-[var(--muted)]">Quanto sobra de uma cobrança em cada meio de pagamento, pela tabela configurada.</p>
        </div>
        <Field label="Valor da cobrança (R$)" className="w-40">
          <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METODOS_SIM.map((m) => {
          const taxa = estimarTaxa(m.chave, v, tabela, m.parcelas ?? 1);
          const p = percentEfetivo(v, taxa);
          const alto = p >= 10;
          return (
            <div key={m.rotulo} className="rounded-xl border border-[var(--border)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{m.rotulo}</p>
                <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums " + (alto ? "bg-[var(--danger-soft)] text-[var(--danger)]" : "bg-slate-100 text-slate-600")}>
                  {pct(p)}
                </span>
              </div>
              <p className="mt-1.5 text-lg font-semibold tabular-nums" style={{ color: COR.liquido }}>{formatBRL(Math.max(0, v - taxa))}</p>
              <p className="text-xs text-[var(--muted)]">taxa {formatBRL(taxa)}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {(() => {
                  const alvo = valorParaTaxaAbaixoDe(m.chave, 5, tabela, m.parcelas ?? 1);
                  return alvo ? `taxa < 5% a partir de ${formatBRL(alvo)}` : "percentual já passa de 5%";
                })()}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Tabela de taxas configurável
// ----------------------------------------------------------------------------
const CAMPOS: { chave: keyof TabelaTaxas; rotulo: string; sufixo: "R$" | "%"; hint?: string }[] = [
  { chave: "pixFixo", rotulo: "Pix — fixo", sufixo: "R$", hint: "Por cobrança Pix recebida." },
  { chave: "pixPercent", rotulo: "Pix — percentual", sufixo: "%" },
  { chave: "boletoFixo", rotulo: "Boleto — fixo", sufixo: "R$", hint: "Por boleto pago." },
  { chave: "boletoPercent", rotulo: "Boleto — percentual", sufixo: "%" },
  { chave: "cartaoFixo", rotulo: "Crédito — fixo", sufixo: "R$" },
  { chave: "cartaoPercent", rotulo: "Crédito — à vista", sufixo: "%" },
  { chave: "cartaoPercent2a6", rotulo: "Crédito — 2 a 6x", sufixo: "%" },
  { chave: "cartaoPercent7a12", rotulo: "Crédito — 7 a 12x", sufixo: "%" },
  { chave: "cartaoPercent13a21", rotulo: "Crédito — 13 a 21x", sufixo: "%" },
  { chave: "debitoFixo", rotulo: "Débito — fixo", sufixo: "R$" },
  { chave: "debitoPercent", rotulo: "Débito — percentual", sufixo: "%" },
  { chave: "extraPorCobranca", rotulo: "Extra por cobrança", sufixo: "R$", hint: "Notificações e afins somados a qualquer método." },
  { chave: "transferenciaFixo", rotulo: "TED / saque", sufixo: "R$", hint: "Informativo — não entra no custo da fatura." },
];

function TabelaTaxasCard({ inicial, onSalvo }: { inicial: TabelaTaxas; onSalvo: () => void }) {
  const [t, setT] = useState<TabelaTaxas>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function recarregarDoServidor() { setT(await obterTaxas()); }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const r = await salvarTaxas(t);
    setSalvando(false);
    setMsg(r.ok ? "Tabela de taxas salva." : r.erro);
    if (r.ok) { void recarregarDoServidor(); onSalvo(); }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Tabela de taxas do gateway</h3>
          <p className="max-w-2xl text-sm text-[var(--muted)]">
            Usada só para <b>estimar</b> o custo de faturas sem retorno do Asaas e alimentar o simulador. Fatura já paga usa
            sempre a taxa real. Padrões = tabela pública do Asaas.
          </p>
        </div>
        <Button variante="ghost" onClick={() => setT({ ...TAXAS_PADRAO })}>Restaurar padrão</Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CAMPOS.map((c) => (
          <Field key={c.chave} label={`${c.rotulo} (${c.sufixo})`} hint={c.hint}>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={t[c.chave]}
              onChange={(e) => setT((s) => ({ ...s, [c.chave]: Number(e.target.value) }))}
            />
          </Field>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
        {msg ? <p className="text-sm font-medium text-[var(--muted)]">{msg}</p> : <span />}
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar taxas"}</Button>
      </div>
    </Card>
  );
}
