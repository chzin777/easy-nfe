import Link from "next/link";
import { Badge, Card } from "../ui/primitives";
import CountUp from "../ui/CountUp";
import { formatBRL, formatData } from "@/lib/format";
import { TIPOS_NOTA, rotulo } from "@/lib/mock-data";
import type { ReactNode } from "react";
import type { StatusNota } from "@/lib/types";
import { resumoDashboard, type PeriodoFiltro } from "../dashboard-actions";
import Graficos from "./Graficos";
import FiltrosDashboard from "./FiltrosDashboard";

const PERIODOS_VALIDOS = ["30d", "90d", "6m", "12m", "ano", "tudo"];

const tomStatus: Record<StatusNota, "success" | "danger" | "warning" | "neutral" | "primary"> = {
  autorizada: "success",
  cancelada: "danger",
  rejeitada: "danger",
  denegada: "warning",
  rascunho: "neutral",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; modelo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = (PERIODOS_VALIDOS.includes(sp.periodo ?? "") ? sp.periodo : "6m") as PeriodoFiltro;
  const modelo = (sp.modelo === "55" || sp.modelo === "65" ? sp.modelo : "") as "" | "55" | "65";

  const resumo = await resumoDashboard({ periodo, modelo });
  const faturado = resumo.faturado;

  const cards: { titulo: string; valor: number; href: string; icon: ReactNode; cor: string }[] = [
    { titulo: "Produtos", valor: resumo.produtos, href: "/produtos", icon: <IBox />, cor: "from-violet-500 to-purple-600" },
    { titulo: "Clientes", valor: resumo.clientes, href: "/clientes", icon: <IUser />, cor: "from-blue-500 to-indigo-600" },
    { titulo: "Transportadoras", valor: resumo.transportadoras, href: "/transportadoras", icon: <ITruck />, cor: "from-emerald-500 to-teal-600" },
    { titulo: "Notas autorizadas", valor: resumo.notasAutorizadas, href: "/notas", icon: <IFile />, cor: "from-amber-500 to-orange-600" },
  ];

  const recentes = resumo.recentes;
  const temCusto = resumo.receitaComCusto > 0 || resumo.valorEstoqueCusto > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="animate-fade-up">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">Visão geral do sistema de emissão de NF-e.</p>
          </div>
          <Link
            href="/notas/nova"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(82,39,255,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(82,39,255,0.45)]"
          >
            + Emitir nova nota
          </Link>
        </div>
        <FiltrosDashboard periodo={periodo} modelo={modelo} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Link key={c.titulo} href={c.href} className="animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            <Card className="group p-5 transition-all hover:-translate-y-1 hover:shadow-[0_12px_32px_-8px_rgba(82,39,255,0.25)]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--muted)]">{c.titulo}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${c.cor} text-white shadow-sm transition-transform group-hover:scale-110`}>
                  {c.icon}
                </div>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                <CountUp to={c.valor} duration={1.2} delay={i * 0.07} separator="." />
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Indicadores financeiros */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FinCard titulo="Faturamento bruto" valor={faturado} sub="notas autorizadas no período" tom="success" />
        <FinCard
          titulo="Lucro bruto"
          valor={resumo.lucroBruto}
          sub={temCusto ? `margem ${resumo.margem.toFixed(1)}%` : "cadastre o custo dos produtos"}
          tom="primary"
        />
        <FinCard titulo="Ticket médio" valor={resumo.ticketMedio} sub="por nota autorizada" />
        <FinCard
          titulo="Estoque (a custo)"
          valor={resumo.valorEstoqueCusto}
          sub={resumo.valorEstoqueVenda > 0 ? `${formatBRL(resumo.valorEstoqueVenda)} a preço de venda` : "produtos que controlam estoque"}
        />
      </div>

      {resumo.itensSemCusto > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-[var(--warning-soft,#fef3c7)] px-4 py-3 text-sm text-[var(--warning)]">
          <span className="mt-0.5">⚠</span>
          <p>
            {resumo.itensSemCusto} item(ns) vendido(s) no período <b>sem preço de custo</b> cadastrado — o lucro
            e a margem consideram só os itens com custo. Cadastre o custo em <b>Produtos</b> para apurar tudo.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden p-5 lg:col-span-1">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-[var(--primary)]/10 to-[var(--primary-2)]/10 blur-xl" />
          <p className="text-sm text-[var(--muted)]">Custo da mercadoria vendida (CMV)</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            <CountUp to={resumo.cmv} prefix="R$ " separator="." duration={1.6} delay={0.2} />
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Custo dos produtos vendidos (itens com custo cadastrado).</p>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <p className="text-sm font-semibold">Notas recentes</p>
            <Link href="/notas" className="text-sm font-medium text-[var(--primary)] transition hover:underline">Ver todas</Link>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {recentes.map((n, i) => (
              <li
                key={n.id}
                className="flex animate-fade-up items-center justify-between px-5 py-3 transition-colors hover:bg-slate-50/70"
                style={{ animationDelay: `${150 + i * 60}ms` }}
              >
                <div>
                  <p className="text-sm font-medium">Nº {n.numero} · {n.clienteNome}</p>
                  <p className="text-xs text-[var(--muted)]">{rotulo(TIPOS_NOTA, n.tipoNota)} · {formatData(n.emitidaEm)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{formatBRL(n.valorTotal)}</span>
                  <Badge tom={tomStatus[n.status]}>{n.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Graficos serieMensal={resumo.serieMensal} distribuicaoStatus={resumo.distribuicaoStatus} topProdutosLucro={resumo.topProdutosLucro} />
    </div>
  );
}

function FinCard({
  titulo,
  valor,
  sub,
  tom = "neutral",
}: {
  titulo: string;
  valor: number;
  sub?: string;
  tom?: "neutral" | "success" | "primary";
}) {
  const cor = {
    neutral: "text-[var(--foreground)]",
    success: "text-[var(--success)]",
    primary: "text-[var(--primary)]",
  }[tom];
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{titulo}</p>
      <p className={"mt-2 text-2xl font-semibold tracking-tight tabular-nums " + cor}>
        <CountUp to={valor} prefix="R$ " separator="." duration={1.4} delay={0.15} />
      </p>
      {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
    </Card>
  );
}

function IBox() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>;
}
function IUser() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function ITruck() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>;
}
function IFile() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v6h6" /></svg>;
}
