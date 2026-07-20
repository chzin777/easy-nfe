"use client";

import { Card } from "@/app/ui/primitives";
import CountUp from "@/app/ui/CountUp";

// Um número sozinho não diz se está bom. Todo KPI sensível a período carrega a
// variação contra o período anterior de mesma duração.
function Variacao({ atual, anterior, invertido }: { atual: number; anterior: number; invertido?: boolean }) {
  // Sem base de comparação (primeiro período, ou filtro "tudo") não inventamos
  // um "+100%" — dizemos que não há com o que comparar.
  if (!anterior) {
    return <span className="text-[11px] text-[var(--muted)]">sem período anterior</span>;
  }
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
      <span className="text-[11px] text-[var(--muted)]">vs. anterior</span>
    </span>
  );
}

// Sparkline: tendência da série, sem eixo nem rótulo — é contexto, não leitura
// precisa. SVG puro para não carregar biblioteca de gráfico dentro de um KPI.
function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  if (valores.length < 2) return null;
  const max = Math.max(...valores);
  const min = Math.min(...valores, 0);
  const amplitude = max - min || 1;
  const larg = 100;
  const alt = 28;
  const pontos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * larg;
    const y = alt - ((v - min) / amplitude) * alt;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${larg} ${alt}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline points={`0,${alt} ${pontos.join(" ")} ${larg},${alt}`} fill={cor} fillOpacity="0.10" stroke="none" />
      <polyline points={pontos.join(" ")} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiDestaque({
  titulo,
  valor,
  anterior,
  serie,
  cor,
  sub,
  invertido,
}: {
  titulo: string;
  valor: number;
  anterior: number;
  serie: number[];
  cor: string;
  sub?: string;
  invertido?: boolean;
}) {
  return (
    <Card className="flex flex-col justify-between p-5">
      <div>
        <p className="text-sm text-[var(--muted)]">{titulo}</p>
        <p className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight tabular-nums" style={{ color: cor }}>
          <CountUp to={valor} prefix="R$ " separator="." duration={1.3} delay={0.1} />
        </p>
        <div className="mt-1.5">
          <Variacao atual={valor} anterior={anterior} invertido={invertido} />
        </div>
        {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
      </div>
      <div className="mt-3">
        <Sparkline valores={serie} cor={cor} />
      </div>
    </Card>
  );
}

export function KpiSimples({
  titulo,
  valor,
  sufixo,
  moeda,
  sub,
  atualPara,
  anterior,
  invertido,
  destaque,
}: {
  titulo: string;
  valor: number;
  sufixo?: string;
  moeda?: boolean;
  sub?: string;
  // Quando informado, mostra a variação; senão o KPI é só um retrato do agora.
  atualPara?: number;
  anterior?: number;
  invertido?: boolean;
  destaque?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{titulo}</p>
      <p
        className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums"
        style={destaque ? { color: destaque } : undefined}
      >
        {moeda ? (
          <CountUp to={valor} prefix="R$ " separator="." duration={1.2} delay={0.1} />
        ) : (
          <>
            <CountUp to={valor} separator="." duration={1.2} delay={0.1} />
            {sufixo}
          </>
        )}
      </p>
      {anterior !== undefined && atualPara !== undefined ? (
        <div className="mt-1.5">
          <Variacao atual={atualPara} anterior={anterior} invertido={invertido} />
        </div>
      ) : (
        sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>
      )}
      {anterior !== undefined && sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </Card>
  );
}
