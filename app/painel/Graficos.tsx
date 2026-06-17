"use client";

import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Card } from "@/app/ui/primitives";
import { formatBRL } from "@/lib/format";

type Serie = { mes: string; notas: number; faturado: number };
type Status = { status: string; qtd: number };

const CORES_STATUS: Record<string, string> = {
  autorizada: "#15803d",
  cancelada: "#dc2626",
  rejeitada: "#ea580c",
  denegada: "#d97706",
  rascunho: "#94a3b8",
};

export default function Graficos({
  serieMensal,
  distribuicaoStatus,
}: {
  serieMensal: Serie[];
  distribuicaoStatus: Status[];
}) {
  const temStatus = distribuicaoStatus.some((s) => s.qtd > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Faturamento por mês */}
      <Card className="p-5 lg:col-span-2">
        <p className="text-sm font-semibold">Faturamento (últimos 6 meses)</p>
        <p className="mb-4 text-xs text-[var(--muted)]">Soma das notas autorizadas por mês.</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={serieMensal} margin={{ left: 4, right: 8, top: 4 }}>
            <defs>
              <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
            <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={60}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
            <Tooltip
              formatter={(v) => [formatBRL(Number(v)), "Faturado"]}
              contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
            />
            <Area type="monotone" dataKey="faturado" stroke="var(--primary)" strokeWidth={2.5} fill="url(#gradFat)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Distribuição por status */}
      <Card className="p-5">
        <p className="text-sm font-semibold">Notas por status</p>
        <p className="mb-4 text-xs text-[var(--muted)]">Distribuição total.</p>
        {temStatus ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={distribuicaoStatus} dataKey="qtd" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {distribuicaoStatus.map((s) => (
                  <Cell key={s.status} fill={CORES_STATUS[s.status] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [`${Number(v)} nota(s)`, String(n)]}
                contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-[var(--muted)]">Sem notas ainda.</div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {distribuicaoStatus.map((s) => (
            <span key={s.status} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES_STATUS[s.status] ?? "#94a3b8" }} />
              {s.status} ({s.qtd})
            </span>
          ))}
        </div>
      </Card>

      {/* Notas emitidas por mês */}
      <Card className="p-5 lg:col-span-3">
        <p className="text-sm font-semibold">Notas emitidas por mês</p>
        <p className="mb-4 text-xs text-[var(--muted)]">Quantidade de notas nos últimos 6 meses.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={serieMensal} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
            <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={32} allowDecimals={false} />
            <Tooltip
              formatter={(v) => [`${Number(v)} nota(s)`, "Emitidas"]}
              contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }}
              cursor={{ fill: "rgba(82,39,255,0.06)" }}
            />
            <Bar dataKey="notas" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
