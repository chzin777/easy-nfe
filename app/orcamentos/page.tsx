"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Button, Badge, Input, Select, Tabela, EmptyState, SectionTitle, type Coluna } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Tabs from "@/app/ui/Tabs";
import { formatBRL } from "@/lib/format";
import type { Cliente, Produto, Transportadora } from "@/lib/types";
import { listarClientes } from "@/app/clientes/actions";
import { listarProdutos } from "@/app/produtos/actions";
import { listarTransportadoras } from "@/app/transportadoras/actions";
import { obterCasasDecimaisQtd, obterEmpresaAtiva, type EmpresaDados } from "@/app/configuracoes/actions";
import { baixarElementoPdf } from "@/app/ui/danfePdf";
import OrcamentoModal from "./OrcamentoModal";
import OrcamentoPdf from "./OrcamentoPdf";
import Kanban from "./Kanban";
import {
  listarOrcamentos, moverStatus, cancelarOrcamento, marcarPerdido, excluirOrcamento, converterEmNota,
  type OrcamentoCompleto, type StatusOrcamentoUI,
} from "./actions";

const STATUS_LABEL: Record<StatusOrcamentoUI, string> = {
  rascunho: "Rascunho", enviado: "Enviado", negociacao: "Em negociação",
  aprovado: "Aprovado", fechado: "Fechado", perdido: "Perdido", cancelado: "Cancelado",
};
const STATUS_TOM: Record<StatusOrcamentoUI, "neutral" | "primary" | "warning" | "success" | "danger"> = {
  rascunho: "neutral", enviado: "primary", negociacao: "warning",
  aprovado: "primary", fechado: "success", perdido: "danger", cancelado: "danger",
};
const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoCompleto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [casas, setCasas] = useState(2);
  const [empresa, setEmpresa] = useState<EmpresaDados | null>(null);
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");

  const [editar, setEditar] = useState<OrcamentoCompleto | null>(null);
  const [criando, setCriando] = useState(false);
  const [detalhe, setDetalhe] = useState<OrcamentoCompleto | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function recarregar() {
    setOrcamentos(await listarOrcamentos());
  }
  useEffect(() => {
    (async () => {
      const [o, c, p, t, cd, emp] = await Promise.all([listarOrcamentos(), listarClientes(), listarProdutos(), listarTransportadoras(), obterCasasDecimaisQtd(), obterEmpresaAtiva()]);
      setOrcamentos(o); setClientes(c); setProdutos(p); setTransportadoras(t); setCasas(cd); setEmpresa(emp);
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return orcamentos.filter((o) =>
      (!filtroStatus || o.status === filtroStatus) &&
      (!q || o.clienteNome.toLowerCase().includes(q) || String(o.numero).includes(q)),
    );
  }, [orcamentos, busca, filtroStatus]);

  const kpis = useMemo(() => {
    const abertos = orcamentos.filter((o) => !["fechado", "perdido", "cancelado"].includes(o.status));
    const valorAberto = abertos.reduce((s, o) => s + o.valorTotal, 0);
    const fechados = orcamentos.filter((o) => o.status === "fechado");
    return { abertos: abertos.length, valorAberto, fechados: fechados.length };
  }, [orcamentos]);

  async function mover(id: string, status: StatusOrcamentoUI) {
    const anterior = orcamentos;
    setOrcamentos((l) => l.map((o) => (o.id === id ? { ...o, status } : o))); // otimista
    try {
      await moverStatus(id, status);
    } catch (e) {
      setOrcamentos(anterior); // reverte
      setToast(e instanceof Error ? e.message : String(e));
    }
  }

  const colunas: Coluna<OrcamentoCompleto>[] = [
    { chave: "numero", cabecalho: "Nº", render: (o) => <span className="font-mono text-xs">#{o.numero}</span> },
    { chave: "cliente", cabecalho: "Cliente", render: (o) => <span className="font-medium">{o.clienteNome}</span> },
    { chave: "status", cabecalho: "Status", render: (o) => <Badge tom={STATUS_TOM[o.status]}>{STATUS_LABEL[o.status]}</Badge> },
    { chave: "itens", cabecalho: "Itens", alinhar: "center", render: (o) => o.itens.length },
    { chave: "validade", cabecalho: "Validade", render: (o) => fmtData(o.validade) },
    { chave: "total", cabecalho: "Total", alinhar: "right", render: (o) => <span className="font-semibold">{formatBRL(o.valorTotal)}</span> },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--danger)] bg-white px-4 py-3 text-sm shadow-lg">
            <span className="text-[var(--danger)]">⚠</span>
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-[var(--muted)] hover:text-[var(--foreground)]">✕</button>
          </div>
        </div>
      )}
      <PageHeader titulo="Orçamentos" subtitulo="Funil de vendas — crie, negocie e feche em NF-e." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi titulo="Em aberto" valor={String(kpis.abertos)} />
        <Kpi titulo="Valor em aberto" valor={formatBRL(kpis.valorAberto)} />
        <Kpi titulo="Fechados (vendas)" valor={String(kpis.fechados)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar cliente ou nº…" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56" />
          <Select
            opcoes={[{ value: "", label: "Todos os status" }, ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))]}
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] p-0.5">
            <button onClick={() => setView("lista")} className={"rounded-md px-3 py-1.5 text-sm font-medium " + (view === "lista" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--muted)]")}>Lista</button>
            <button onClick={() => setView("kanban")} className={"rounded-md px-3 py-1.5 text-sm font-medium " + (view === "kanban" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--muted)]")}>Kanban</button>
          </div>
          <Button onClick={() => setCriando(true)}>+ Novo orçamento</Button>
        </div>
      </div>

      {view === "lista" ? (
        <Tabela
          colunas={colunas}
          dados={filtrados}
          onRowClick={(o) => setDetalhe(o)}
          vazio={<EmptyState titulo="Nenhum orçamento" descricao="Crie o primeiro orçamento para começar o funil." />}
        />
      ) : (
        <Kanban orcamentos={orcamentos} onMover={mover} onAbrir={(o) => setDetalhe(o)} />
      )}

      {(criando || editar) && (
        <OrcamentoModal
          inicial={editar}
          clientes={clientes}
          produtos={produtos}
          transportadoras={transportadoras}
          casas={casas}
          onClientes={(c) => setClientes((l) => [c, ...l.filter((x) => x.id !== c.id)])}
          onProdutos={(p) => setProdutos((l) => [p, ...l.filter((x) => x.id !== p.id)])}
          onSalvo={(o) => { setCriando(false); setEditar(null); recarregar(); }}
          onFechar={() => { setCriando(false); setEditar(null); }}
        />
      )}

      {detalhe && (
        <DetalheOrcamento
          orc={detalhe}
          empresa={empresa}
          onFechar={() => setDetalhe(null)}
          onEditar={() => { setEditar(detalhe); setDetalhe(null); }}
          onMudou={() => { recarregar(); setDetalhe(null); }}
        />
      )}
    </div>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{titulo}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
    </div>
  );
}

// ---- Detalhe + ações -------------------------------------------------------

function DetalheOrcamento({
  orc, empresa, onFechar, onEditar, onMudou,
}: {
  orc: OrcamentoCompleto;
  empresa: EmpresaDados | null;
  onFechar: () => void;
  onEditar: () => void;
  onMudou: () => void;
}) {
  const [proc, setProc] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [dialog, setDialog] = useState<null | "fechar" | "cancelar" | "perdido" | "excluir">(null);
  const [motivo, setMotivo] = useState("");
  const terminal = orc.status === "fechado" || orc.status === "cancelado";

  async function fecharVenda() {
    setProc(true); setMsg(null); setDialog(null);
    try {
      const r = await converterEmNota(orc.id);
      if (r.ok && r.autorizada) { setMsg({ tipo: "ok", texto: `NF-e autorizada (nº ${r.numero}).` }); setTimeout(onMudou, 1200); }
      else if (r.ok) setMsg({ tipo: "erro", texto: `Recusada pela SEFAZ (${r.cStat}): ${r.xMotivo ?? ""}` });
      else setMsg({ tipo: "erro", texto: r.erro });
    } finally { setProc(false); }
  }
  async function executar(fn: () => Promise<void>) {
    setProc(true); setDialog(null);
    try { await fn(); onMudou(); } catch (e) { setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) }); setProc(false); }
  }
  async function salvarPdf() {
    setGerandoPdf(true); setMsg(null);
    try {
      await baixarElementoPdf(`orc-pdf-${orc.id}`, `orcamento-${orc.numero}`);
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally { setGerandoPdf(false); }
  }

  const rodape = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variante="secondary" onClick={salvarPdf} disabled={proc || gerandoPdf}>
          <IconPdf /> {gerandoPdf ? "Gerando…" : "Salvar PDF"}
        </Button>
        {!terminal && (
          <Button variante="secondary" onClick={onEditar} disabled={proc}>
            <IconLapis /> Editar
          </Button>
        )}
        {!terminal && orc.status !== "perdido" && (
          <Button variante="warning" onClick={() => { setMotivo(""); setDialog("perdido"); }} disabled={proc}>Marcar perdido</Button>
        )}
        {!terminal && (
          <Button variante="dangerSoft" onClick={() => setDialog("cancelar")} disabled={proc}>Cancelar</Button>
        )}
        {orc.status !== "fechado" && (
          <Button variante="danger" onClick={() => setDialog("excluir")} disabled={proc}><IconLixeira /> Excluir</Button>
        )}
      </div>
      {!terminal && (
        <Button onClick={() => setDialog("fechar")} disabled={proc}>
          {proc ? "Emitindo…" : <><IconRaio /> Fechar venda (gerar NF-e)</>}
        </Button>
      )}
    </div>
  );

  const dialogs = {
    fechar: { titulo: "Fechar venda", msg: "Isto gera uma NF-e na SEFAZ a partir deste orçamento e fecha a venda. Continuar?", botao: "Fechar venda", tom: "primary" as const, run: fecharVenda },
    cancelar: { titulo: "Cancelar orçamento", msg: "O orçamento sai do funil e fica marcado como cancelado.", botao: "Cancelar orçamento", tom: "dangerSoft" as const, run: () => executar(() => cancelarOrcamento(orc.id)) },
    perdido: { titulo: "Marcar como perdido", msg: "Registra que a venda não foi fechada.", botao: "Marcar perdido", tom: "warning" as const, run: () => executar(() => marcarPerdido(orc.id, motivo)) },
    excluir: { titulo: "Excluir orçamento", msg: "Esta ação não pode ser desfeita.", botao: "Excluir", tom: "danger" as const, run: () => executar(() => excluirOrcamento(orc.id)) },
  };
  const d = dialog ? dialogs[dialog] : null;

  return (
    <>
    <Modal aberto onFechar={onFechar} titulo={`Orçamento #${orc.numero}`} largura="max-w-xl" rodape={rodape}>
      {/* Hero: status + total (sempre visível) */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Badge tom={STATUS_TOM[orc.status]}>{STATUS_LABEL[orc.status]}</Badge>
          {orc.notaId && (
            <a href="/notas" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)] hover:underline">
              <IconCheck /> virou NF-e
            </a>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Total</p>
          <p className="text-xl font-bold text-[var(--primary)]">{formatBRL(orc.valorTotal)}</p>
        </div>
      </div>

      {msg && (
        <p className={"mb-4 rounded-lg px-3 py-2.5 text-sm font-medium " + (msg.tipo === "ok" ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft,#fee2e2)] text-[var(--danger)]")}>{msg.texto}</p>
      )}

      <Tabs
        alturaConteudo="320px"
        abas={[
          {
            id: "resumo",
            label: "Resumo",
            content: (
              <>
                <SectionTitle>Dados do orçamento</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Info rotulo="Cliente" valor={orc.clienteNome} />
                  <Info rotulo="Validade" valor={fmtData(orc.validade)} />
                  <Info rotulo="Modelo" valor={orc.tipoNota.startsWith("65") ? "NFC-e (65)" : "NF-e (55)"} />
                  <Info rotulo="Criado em" valor={fmtData(orc.criadoEm.slice(0, 10))} />
                  <Info rotulo="Itens" valor={`${orc.itens.length}`} />
                  <Info rotulo="Total" valor={formatBRL(orc.valorTotal)} />
                </div>
                {orc.observacoes && (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Observações</p>
                    <p className="mt-0.5 text-sm">{orc.observacoes}</p>
                  </div>
                )}
                {orc.motivoPerda && (
                  <p className="mt-3 rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm text-[var(--danger)]">Motivo da perda: {orc.motivoPerda}</p>
                )}
              </>
            ),
          },
          {
            id: "produtos",
            label: `Produtos (${orc.itens.length})`,
            content: (
              <>
                <SectionTitle>Itens do orçamento</SectionTitle>
                <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                        <th className="px-4 py-2.5">Produto</th>
                        <th className="px-4 py-2.5 text-right">Qtd</th>
                        <th className="px-4 py-2.5 text-right">Preço un.</th>
                        <th className="px-4 py-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orc.itens.map((i) => (
                        <tr key={i.id} className="border-t border-[var(--border)]">
                          <td className="px-4 py-2.5 font-medium">{i.nome}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{i.quantidade}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(i.precoUnitario)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatBRL(i.valorTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[var(--border)] bg-slate-50 font-semibold">
                        <td className="px-4 py-2.5" colSpan={3}>Total</td>
                        <td className="px-4 py-2.5 text-right text-[var(--primary)]">{formatBRL(orc.valorTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ),
          },
        ]}
      />
    </Modal>

    {d && (
      <Modal
        aberto
        onFechar={() => setDialog(null)}
        titulo={d.titulo}
        largura="max-w-sm"
        rodape={
          <div className="flex w-full justify-end gap-2">
            <Button variante="secondary" onClick={() => setDialog(null)} disabled={proc}>Voltar</Button>
            <Button variante={d.tom} onClick={d.run} disabled={proc}>{proc ? "Processando…" : d.botao}</Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--muted)]">{d.msg}</p>
        {dialog === "perdido" && (
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            className="mt-3 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
          />
        )}
      </Modal>
    )}

    {/* Layout imprimível (fora da tela) capturado pelo botão Salvar PDF */}
    <OrcamentoPdf id={`orc-pdf-${orc.id}`} orc={orc} empresa={empresa} />
    </>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{rotulo}</p>
      <p className="truncate text-sm font-medium" title={valor}>{valor}</p>
    </div>
  );
}

function IconRaio() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="-ml-0.5"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>;
}
function IconLapis() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}
function IconLixeira() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
}
function IconPdf() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6" /><path d="M9 18h6" /></svg>;
}
function IconCheck() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}
