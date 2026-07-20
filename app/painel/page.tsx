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
import Bloco from "./Bloco";
import { KpiDestaque, KpiSimples } from "./Kpis";
import { num } from "./exportar";

const PERIODOS_VALIDOS = ["30d", "90d", "6m", "12m", "ano", "tudo"];

const tomStatus: Record<StatusNota, "success" | "danger" | "warning" | "neutral" | "primary"> = {
  autorizada: "success",
  cancelada: "neutral",
  rejeitada: "danger",
  denegada: "warning",
  rascunho: "neutral",
};

// Mesma paleta validada usada nos gráficos (ver Graficos.tsx).
const COR = { faturado: "#5227ff", lucro: "#008300", alerta: "#b45309" };

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
  const temCusto = resumo.receitaComCusto > 0 || resumo.valorEstoqueCusto > 0;

  const cards: { titulo: string; valor: number; href: string; icon: ReactNode; cor: string }[] = [
    { titulo: "Produtos", valor: resumo.produtos, href: "/produtos", icon: <IBox />, cor: "from-violet-500 to-purple-600" },
    { titulo: "Clientes", valor: resumo.clientes, href: "/clientes", icon: <IUser />, cor: "from-blue-500 to-indigo-600" },
    { titulo: "Transportadoras", valor: resumo.transportadoras, href: "/transportadoras", icon: <ITruck />, cor: "from-emerald-500 to-teal-600" },
    { titulo: "Notas autorizadas", valor: resumo.notasAutorizadas, href: "/notas", icon: <IFile />, cor: "from-amber-500 to-orange-600" },
  ];

  const serieFaturado = resumo.serieMensal.map((s) => s.faturado);
  const serieLucro = resumo.serieMensal.map((s) => s.lucro);
  const serieNotas = resumo.serieMensal.map((s) => s.notas);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="animate-fade-up">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Visão geral do negócio. Cada bloco exporta os próprios dados em PDF ou planilha.
            </p>
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

      {/* Linha 1 — dinheiro. Os três números que respondem "como foi o período". */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiDestaque
          titulo="Faturamento bruto"
          valor={faturado}
          anterior={resumo.anterior.faturado}
          serie={serieFaturado}
          cor={COR.faturado}
          sub="notas autorizadas no período"
        />
        <KpiDestaque
          titulo="Lucro bruto"
          valor={resumo.lucroBruto}
          anterior={resumo.anterior.lucro}
          serie={serieLucro}
          cor={COR.lucro}
          sub={temCusto ? `margem de ${resumo.margem.toFixed(1)}%` : "cadastre o custo dos produtos"}
        />
        <KpiDestaque
          titulo="Ticket médio"
          valor={resumo.ticketMedio}
          anterior={resumo.anterior.ticketMedio}
          serie={serieFaturado.map((v, i) => (serieNotas[i] > 0 ? v / serieNotas[i] : 0))}
          cor="#2a78d6"
          sub="por nota autorizada"
        />
      </div>

      {/* Linha 2 — operação e caixa. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiSimples
          titulo="Notas autorizadas"
          valor={resumo.notasAutorizadas}
          atualPara={resumo.notasAutorizadas}
          anterior={resumo.anterior.notas}
          sub={`${resumo.emitidasNoPeriodo} transmitida(s) à SEFAZ`}
        />
        <KpiSimples
          titulo="Taxa de aprovação"
          valor={Number(resumo.taxaAprovacao.toFixed(1))}
          sufixo="%"
          sub="do que foi transmitido, quanto a SEFAZ aceitou"
          destaque={resumo.taxaAprovacao >= 95 ? COR.lucro : resumo.taxaAprovacao > 0 ? COR.alerta : undefined}
        />
        <KpiSimples
          titulo="Vendas sem nota"
          valor={resumo.vendasSemNota.total}
          moeda
          sub={`${resumo.vendasSemNota.qtd} venda(s) fora do faturamento fiscal`}
        />
        <KpiSimples
          titulo="Fiado em aberto"
          valor={resumo.fiadoEmAberto.saldo}
          moeda
          sub={`${resumo.fiadoEmAberto.clientes} cliente(s) devendo`}
          destaque={resumo.fiadoEmAberto.saldo > 0 ? COR.alerta : undefined}
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

      {/* Linha 3 — estoque e custo. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-[var(--muted)]">Custo da mercadoria vendida</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
            <CountUp to={resumo.cmv} prefix="R$ " separator="." duration={1.4} delay={0.15} />
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Custo dos produtos vendidos no período (itens com custo).</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--muted)]">Estoque a preço de custo</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
            <CountUp to={resumo.valorEstoqueCusto} prefix="R$ " separator="." duration={1.4} delay={0.15} />
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {resumo.valorEstoqueVenda > 0
              ? `${formatBRL(resumo.valorEstoqueVenda)} a preço de venda`
              : "produtos que controlam estoque"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--muted)]">Lucro potencial do estoque</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums" style={{ color: COR.lucro }}>
            <CountUp
              to={Math.max(0, resumo.valorEstoqueVenda - resumo.valorEstoqueCusto)}
              prefix="R$ " separator="." duration={1.4} delay={0.15}
            />
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Se todo o estoque atual for vendido pelo preço de tabela.</p>
        </Card>
      </div>

      <Graficos
        serieMensal={resumo.serieMensal}
        distribuicaoStatus={resumo.distribuicaoStatus}
        topProdutosLucro={resumo.topProdutosLucro}
        topClientes={resumo.topClientes}
        porModelo={resumo.porModelo}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco
          id="bloco-recentes"
          titulo="Notas recentes"
          subtitulo="Últimas notas emitidas nesta empresa."
          nomeArquivo="notas-recentes"
          linhas={resumo.recentes.map((n) => ({
            Número: n.numero,
            Cliente: n.clienteNome,
            Tipo: rotulo(TIPOS_NOTA, n.tipoNota),
            Emitida: formatData(n.emitidaEm),
            Valor: num(n.valorTotal),
            Status: n.status,
          }))}
          acao={
            <Link href="/notas" className="mr-1 text-xs font-medium text-[var(--primary)] transition hover:underline">
              Ver todas
            </Link>
          }
        >
          {resumo.recentes.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">Nenhuma nota emitida ainda.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {resumo.recentes.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">Nº {n.numero} · {n.clienteNome}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {rotulo(TIPOS_NOTA, n.tipoNota)} · {formatData(n.emitidaEm)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">{formatBRL(n.valorTotal)}</span>
                    <Badge tom={tomStatus[n.status]}>{n.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco
          id="bloco-estoque-critico"
          titulo="Estoque no limite"
          subtitulo="Produtos no mínimo ou abaixo dele. Só entram os que têm mínimo cadastrado."
          nomeArquivo="estoque-critico"
          linhas={resumo.estoqueCritico.map((p) => ({
            Produto: p.nome,
            Saldo: p.saldo,
            Mínimo: p.minimo,
            Faltam: num(Math.max(0, p.minimo - p.saldo)),
          }))}
          acao={
            <Link href="/estoque" className="mr-1 text-xs font-medium text-[var(--primary)] transition hover:underline">
              Ver estoque
            </Link>
          }
        >
          {resumo.estoqueCritico.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              Nenhum produto no limite. Defina o estoque mínimo em Produtos para monitorar aqui.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {resumo.estoqueCritico.map((p) => {
                const zerado = p.saldo <= 0;
                return (
                  <li key={p.nome} className="flex items-center justify-between gap-3 py-2.5">
                    <p className="min-w-0 truncate text-sm font-medium">{p.nome}</p>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="tabular-nums text-[var(--muted)]">
                        saldo <b className="text-[var(--foreground)]">{p.saldo}</b> · mín. {p.minimo}
                      </span>
                      <Badge tom={zerado ? "danger" : "warning"}>{zerado ? "zerado" : "no limite"}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>
      </div>

      {/* Cadastros — atalhos de contagem. */}
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
    </div>
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
