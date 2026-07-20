"use client";

import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { formatBRL } from "@/lib/format";
import Bloco from "./Bloco";
import { num } from "./exportar";

type Serie = { mes: string; notas: number; faturado: number; lucro: number };
type Status = { status: string; qtd: number };
type TopProduto = { nome: string; lucro: number; receita: number };
type TopCliente = { nome: string; faturado: number; notas: number };
type PorModelo = { modelo: string; qtd: number; faturado: number };

// Paleta categórica validada (scripts/validate_palette.js, light, surface #fff):
// lightness band, chroma, separação para daltonismo e contraste — tudo PASS.
// A ordem é fixa: a série 1 é sempre roxo, a 2 sempre verde. Cor segue a
// entidade, nunca a posição no ranking.
const SERIE = {
  faturado: "#5227ff",
  lucro: "#008300",
  volume: "#2a78d6",
  destaque: "#eda100",
};

// Status é paleta reservada, separada da categórica: descreve estado, não
// identidade. Cancelada é ação deliberada do usuário — cinza, não vermelho;
// vermelho fica para o que de fato deu errado (rejeitada).
const COR_STATUS: Record<string, string> = {
  autorizada: "#15803d",
  cancelada: "#64748b",
  rejeitada: "#dc2626",
  denegada: "#b45309",
  rascunho: "#cbd5e1",
};
const ROTULO_STATUS: Record<string, string> = {
  autorizada: "Autorizada",
  cancelada: "Cancelada",
  rejeitada: "Rejeitada",
  denegada: "Denegada",
  rascunho: "Rascunho",
};

const EIXO = { fontSize: 11, stroke: "#94a3b8" };
const GRID = "#eef0f4";
const compacto = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));
const cortar = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

// Tooltip único para todos os gráficos — mesma caixa, mesma tipografia.
// O texto usa tokens de tinta; a cor da série vive no marcador ao lado.
function Dica({
  active,
  payload,
  label,
  formatar,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string | number; value?: number | string; color?: string }[];
  label?: string | number;
  formatar: (v: number, chave: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-semibold text-[var(--foreground)]">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-1.5 text-[var(--muted)]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="text-[var(--foreground)] tabular-nums">{formatar(Number(p.value), String(p.dataKey))}</b>
        </p>
      ))}
    </div>
  );
}

function Vazio({ texto, altura = 240 }: { texto: string; altura?: number }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)]" style={{ height: altura }}>
      {texto}
    </div>
  );
}

export default function Graficos({
  serieMensal,
  distribuicaoStatus,
  topProdutosLucro = [],
  topClientes = [],
  porModelo = [],
}: {
  serieMensal: Serie[];
  distribuicaoStatus: Status[];
  topProdutosLucro?: TopProduto[];
  topClientes?: TopCliente[];
  porModelo?: PorModelo[];
}) {
  const temStatus = distribuicaoStatus.some((s) => s.qtd > 0);
  const temLucro = serieMensal.some((s) => s.lucro !== 0);
  const temTop = topProdutosLucro.some((p) => p.lucro !== 0);
  const temClientes = topClientes.length > 0;
  const temNotas = serieMensal.some((s) => s.notas > 0);

  const statusOrdenado = [...distribuicaoStatus].sort((a, b) => b.qtd - a.qtd);
  const totalStatus = statusOrdenado.reduce((s, x) => s + x.qtd, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Faturamento x lucro — duas séries na MESMA unidade (R$), um só eixo. */}
      <Bloco
        id="bloco-faturamento"
        className="lg:col-span-2"
        titulo="Faturamento e lucro por mês"
        subtitulo="Faturamento das notas autorizadas e lucro bruto (receita − custo dos itens com custo cadastrado)."
        nomeArquivo="faturamento-e-lucro"
        linhas={serieMensal.map((s) => ({
          Mês: s.mes,
          Faturado: num(s.faturado),
          Lucro: num(s.lucro),
          Notas: s.notas,
        }))}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={serieMensal} margin={{ left: 4, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="gFaturado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIE.faturado} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIE.faturado} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gLucro" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIE.lucro} stopOpacity={0.22} />
                <stop offset="100%" stopColor={SERIE.lucro} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} {...EIXO} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compacto} {...EIXO} />
            <Tooltip
              content={<Dica formatar={(v) => formatBRL(v)} />}
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
            />
            {temLucro && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />}
            <Area
              type="monotone" dataKey="faturado" name="Faturado"
              stroke={SERIE.faturado} strokeWidth={2} fill="url(#gFaturado)"
              dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            />
            {temLucro && (
              <Area
                type="monotone" dataKey="lucro" name="Lucro"
                stroke={SERIE.lucro} strokeWidth={2} fill="url(#gLucro)"
                dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </Bloco>

      {/* Status: barras ordenadas em vez de rosca — com 5 fatias de valores
          próximos, a rosca vira adivinhação. */}
      <Bloco
        id="bloco-status"
        titulo="Notas por status"
        subtitulo="Situação das notas no período."
        nomeArquivo="notas-por-status"
        linhas={statusOrdenado.map((s) => ({
          Status: ROTULO_STATUS[s.status] ?? s.status,
          Quantidade: s.qtd,
          "% do total": totalStatus ? num((s.qtd / totalStatus) * 100) : 0,
        }))}
      >
        {temStatus ? (
          <ul className="space-y-3 pt-1">
            {statusOrdenado.map((s) => {
              const pct = totalStatus ? (s.qtd / totalStatus) * 100 : 0;
              return (
                <li key={s.status}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_STATUS[s.status] ?? "#94a3b8" }} />
                      {ROTULO_STATUS[s.status] ?? s.status}
                    </span>
                    <span className="tabular-nums text-[var(--muted)]">
                      <b className="text-[var(--foreground)]">{s.qtd}</b> · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(pct, s.qtd > 0 ? 2 : 0)}%`, background: COR_STATUS[s.status] ?? "#94a3b8" }}
                    />
                  </div>
                </li>
              );
            })}
            {porModelo.length > 0 && (
              <li className="border-t border-[var(--border)] pt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Por modelo</p>
                {porModelo.map((m) => (
                  <p key={m.modelo} className="flex justify-between text-xs text-[var(--muted)]">
                    {m.modelo === "65" ? "NFC-e (65)" : "NF-e (55)"}
                    <span className="tabular-nums">
                      <b className="text-[var(--foreground)]">{m.qtd}</b> · {formatBRL(m.faturado)}
                    </span>
                  </p>
                ))}
              </li>
            )}
          </ul>
        ) : (
          <Vazio texto="Sem notas no período." />
        )}
      </Bloco>

      {/* Volume mensal — contagem, não dinheiro; por isso gráfico separado. */}
      <Bloco
        id="bloco-volume"
        className="lg:col-span-3"
        titulo="Notas emitidas por mês"
        subtitulo="Quantidade de notas transmitidas no período, independente do resultado."
        nomeArquivo="notas-por-mes"
        linhas={serieMensal.map((s) => ({ Mês: s.mes, Notas: s.notas }))}
      >
        {temNotas ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serieMensal} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} {...EIXO} />
              <YAxis tickLine={false} axisLine={false} width={34} allowDecimals={false} {...EIXO} />
              <Tooltip
                content={<Dica formatar={(v) => `${v} nota(s)`} />}
                cursor={{ fill: "rgba(82,39,255,0.05)" }}
              />
              <Bar dataKey="notas" name="Emitidas" fill={SERIE.volume} radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Vazio texto="Nenhuma nota emitida no período." altura={220} />
        )}
      </Bloco>

      {/* Rankings: barra horizontal — nome de produto/cliente é longo e não
          cabe girado no eixo x. */}
      {temTop && (
        <Bloco
          id="bloco-top-produtos"
          className="lg:col-span-3 xl:col-span-3"
          titulo="Produtos mais lucrativos"
          subtitulo="Lucro bruto por produto no período (só itens com preço de custo cadastrado)."
          nomeArquivo="produtos-mais-lucrativos"
          linhas={topProdutosLucro.map((p) => ({
            Produto: p.nome,
            Lucro: num(p.lucro),
            Receita: num(p.receita),
            "Margem %": p.receita > 0 ? num((p.lucro / p.receita) * 100) : 0,
          }))}
        >
          <ResponsiveContainer width="100%" height={Math.max(170, topProdutosLucro.length * 44)}>
            <BarChart data={topProdutosLucro} layout="vertical" margin={{ left: 8, right: 56, top: 4 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compacto} {...EIXO} />
              <YAxis
                type="category" dataKey="nome" tickLine={false} axisLine={false} width={190}
                tick={{ fontSize: 12, fill: "#475467" }}
                tickFormatter={(v) => cortar(String(v), 28)}
              />
              <Tooltip
                content={<Dica formatar={(v) => formatBRL(v)} />}
                cursor={{ fill: "rgba(0,131,0,0.05)" }}
              />
              <Bar dataKey="lucro" name="Lucro" fill={SERIE.lucro} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Bloco>
      )}

      {temClientes && (
        <Bloco
          id="bloco-top-clientes"
          className="lg:col-span-3"
          titulo="Clientes que mais compraram"
          subtitulo="Faturamento por cliente nas notas autorizadas do período."
          nomeArquivo="top-clientes"
          linhas={topClientes.map((c) => ({
            Cliente: c.nome,
            Faturado: num(c.faturado),
            Notas: c.notas,
            "Ticket médio": c.notas > 0 ? num(c.faturado / c.notas) : 0,
          }))}
        >
          <ResponsiveContainer width="100%" height={Math.max(170, topClientes.length * 44)}>
            <BarChart data={topClientes} layout="vertical" margin={{ left: 8, right: 56, top: 4 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compacto} {...EIXO} />
              <YAxis
                type="category" dataKey="nome" tickLine={false} axisLine={false} width={190}
                tick={{ fontSize: 12, fill: "#475467" }}
                tickFormatter={(v) => cortar(String(v), 28)}
              />
              <Tooltip
                content={<Dica formatar={(v) => formatBRL(v)} />}
                cursor={{ fill: "rgba(82,39,255,0.05)" }}
              />
              {/* Uma cor só: o ranking já está no comprimento da barra e na
                  ordem. Pintar o 1º diferente seria cor por posição — a cor
                  mudaria de dono a cada troca de filtro. */}
              <Bar dataKey="faturado" name="Faturado" fill={SERIE.faturado} radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Bloco>
      )}
    </div>
  );
}
