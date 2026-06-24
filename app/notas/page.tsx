"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Tabela,
  Textarea,
  EmptyState,
  formatBRL,
  formatData,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Danfe from "@/app/ui/Danfe";
import DanfeNFCe from "@/app/ui/DanfeNFCe";
import LightningLoader from "@/app/ui/LightningLoader";
import { baixarDanfePdf } from "@/app/ui/danfePdf";
import { STATUS_NOTA, TIPOS_NOTA, rotulo, rotuloTipoCurto } from "@/lib/mock-data";
import type { StatusNota } from "@/lib/types";
import { listarNotas, cancelarNota, obterXmlNota, type NotaCompleta } from "./actions";
import DevolucaoModal from "./DevolucaoModal";

const tomStatus: Record<StatusNota, "success" | "danger" | "warning" | "neutral" | "primary"> = {
  autorizada: "success",
  cancelada: "danger",
  rejeitada: "danger",
  denegada: "warning",
  rascunho: "neutral",
};

type AcaoEvento = { nota: NotaCompleta; tipo: "cancelamento" | "cce" };

export default function NotasEmitidasPage() {
  const [notas, setNotas] = useState<NotaCompleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [evento, setEvento] = useState<AcaoEvento | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [visualizar, setVisualizar] = useState<NotaCompleta | null>(null);
  const [devolver, setDevolver] = useState<NotaCompleta | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroEvento, setErroEvento] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function recarregar() {
    const lista = await listarNotas();
    setNotas(lista);
    setCarregando(false);
  }

  useEffect(() => {
    // Carga inicial do histórico (setState ocorre após o await, fora do corpo síncrono).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Gera o PDF do DANFE renderizado (#danfe-print) e baixa o arquivo.
  async function baixarPdf(nota: NotaCompleta) {
    setGerandoPdf(true);
    try {
      await baixarDanfePdf("danfe-print", nota.numero);
    } catch {
      setToast("Falha ao gerar o PDF. Tente novamente.");
    } finally {
      setGerandoPdf(false);
    }
  }

  async function baixarXml(nota: NotaCompleta) {
    const r = await obterXmlNota(nota.id);
    if (!r.ok) { setToast(r.erro); return; }
    const blob = new Blob([r.xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.nome; a.click();
    URL.revokeObjectURL(url);
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return notas.filter((n) => {
      if (filtroStatus && n.status !== filtroStatus) return false;
      if (filtroTipo && n.tipoNota !== filtroTipo) return false;
      if (q && !n.clienteNome.toLowerCase().includes(q) && !String(n.numero).includes(q) && !n.chaveAcesso.includes(q))
        return false;
      return true;
    });
  }, [notas, busca, filtroStatus, filtroTipo]);

  // KPIs calculados sobre o conjunto filtrado (acompanham busca/filtros).
  const kpis = useMemo(() => {
    const aut = filtradas.filter((n) => n.status === "autorizada");
    const canceladas = filtradas.filter((n) => n.status === "cancelada").length;
    const rejeitadas = filtradas.filter((n) => n.status === "rejeitada" || n.status === "denegada").length;
    const valorAut = aut.reduce((s, n) => s + n.valorTotal, 0);
    const agora = new Date();
    const valorMes = aut.reduce((s, n) => {
      const d = new Date(n.emitidaEm);
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear() ? s + n.valorTotal : s;
    }, 0);
    return {
      total: filtradas.length,
      autorizadas: aut.length,
      canceladas,
      rejeitadas,
      valorAut,
      valorMes,
      ticket: aut.length ? valorAut / aut.length : 0,
    };
  }, [filtradas]);

  function abrirEvento(nota: NotaCompleta, tipo: AcaoEvento["tipo"]) {
    setEvento({ nota, tipo });
    setJustificativa("");
    setErroEvento(null);
  }

  async function confirmarEvento() {
    if (!evento) return;

    // CC-e: protótipo apenas registra a justificativa (não altera status).
    if (evento.tipo === "cce") {
      setEvento(null);
      return;
    }

    // Cancelamento real na SEFAZ (evento 110111) + atualização no banco.
    if (!evento.nota.protocolo) {
      setErroEvento("Nota sem protocolo de autorização — não pode ser cancelada.");
      return;
    }

    setProcessando(true);
    setErroEvento(null);
    const r = await cancelarNota({ justificativa, notaId: evento.nota.id });
    setProcessando(false);

    if ("erro" in r) {
      setErroEvento(r.erro);
      return;
    }
    if (!r.ok) {
      setErroEvento(`SEFAZ recusou (cStat ${r.cStat}): ${r.xMotivo ?? "—"}`);
      return;
    }
    setEvento(null);
    await recarregar();
  }

  function exportarCsv() {
    const cabecalho = ["Numero", "Tipo", "Cliente", "Status", "Emissao", "Total", "Chave"];
    const linhas = filtradas.map((n) => [
      n.numero,
      rotulo(TIPOS_NOTA, n.tipoNota),
      n.clienteNome,
      n.status,
      formatData(n.emitidaEm),
      n.valorTotal.toFixed(2).replace(".", ","),
      n.chaveAcesso,
    ]);
    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notas-emitidas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const colunas: Coluna<NotaCompleta>[] = [
    {
      chave: "numero",
      cabecalho: "Nº",
      render: (n) => <span className="font-mono text-xs">{n.numero}</span>,
    },
    {
      chave: "cliente",
      cabecalho: "Cliente",
      render: (n) => (
        <div>
          <p className="font-medium">{n.clienteNome}</p>
          <p className="font-mono text-[11px] text-[var(--muted)]">{n.chaveAcesso}</p>
        </div>
      ),
    },
    {
      chave: "tipo",
      cabecalho: "Tipo",
      render: (n) => <span className="text-xs">{rotuloTipoCurto(n.tipoNota)}</span>,
    },
    {
      chave: "emissao",
      cabecalho: "Emissão",
      render: (n) => formatData(n.emitidaEm),
    },
    {
      chave: "total",
      cabecalho: "Total",
      alinhar: "right",
      render: (n) => <span className="font-medium">{formatBRL(n.valorTotal)}</span>,
    },
    {
      chave: "status",
      cabecalho: "Status",
      alinhar: "center",
      render: (n) => <Badge tom={tomStatus[n.status]}>{n.status}</Badge>,
    },
    {
      chave: "ambiente",
      cabecalho: "Ambiente",
      alinhar: "center",
      render: (n) => (
        <Badge tom={n.ambiente === "homologacao" ? "warning" : "neutral"}>
          {n.ambiente === "homologacao" ? "homologação" : "produção"}
        </Badge>
      ),
    },
    {
      chave: "acoes",
      cabecalho: "",
      alinhar: "right",
      render: (n) => (
        <div className="flex justify-end gap-1">
          <Button
            variante="warning"
            disabled={n.status !== "autorizada"}
            onClick={(e) => { e.stopPropagation(); abrirEvento(n, "cce"); }}
          >
            CC-e
          </Button>
          <Button
            variante="secondary"
            disabled={n.status !== "autorizada"}
            onClick={(e) => { e.stopPropagation(); setDevolver(n); }}
          >
            Devolução
          </Button>
          <Button
            variante="dangerSoft"
            disabled={n.status !== "autorizada"}
            onClick={(e) => { e.stopPropagation(); abrirEvento(n, "cancelamento"); }}
          >
            Cancelar
          </Button>
        </div>
      ),
    },
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
      <PageHeader
        titulo="Notas emitidas"
        subtitulo="Histórico de notas com filtros, eventos e exportação."
        acao={<Button variante="secondary" onClick={exportarCsv}>Exportar CSV</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Notas (filtro atual)" valor={String(kpis.total)} sub={`${kpis.autorizadas} autorizadas`} />
        <Kpi rotulo="Valor autorizado" valor={formatBRL(kpis.valorAut)} sub={`ticket médio ${formatBRL(kpis.ticket)}`} tom="success" />
        <Kpi rotulo="Faturado no mês" valor={formatBRL(kpis.valorMes)} sub="notas autorizadas neste mês" tom="primary" />
        <Kpi rotulo="Canceladas / rejeitadas" valor={`${kpis.canceladas} / ${kpis.rejeitadas}`} sub="no filtro atual" tom={kpis.canceladas + kpis.rejeitadas > 0 ? "danger" : "neutral"} />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_200px_200px]">
          <Input
            placeholder="Buscar por nº, cliente ou chave…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Select
            opcoes={STATUS_NOTA}
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            placeholder="Todos os status"
          />
          <Select
            opcoes={TIPOS_NOTA}
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            placeholder="Todos os tipos"
          />
        </div>
        <Tabela
          colunas={colunas}
          dados={filtradas}
          onRowClick={(n) => setVisualizar(n)}
          vazio={
            carregando
              ? <LightningLoader texto="Carregando notas…" />
              : <EmptyState titulo="Nenhuma nota encontrada" descricao="Ajuste os filtros ou emita uma nova nota." />
          }
        />
        <div className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
          {filtradas.length} nota(s) · Total exibido:{" "}
          {formatBRL(filtradas.reduce((s, n) => s + n.valorTotal, 0))}
        </div>
      </Card>

      <Modal
        aberto={evento !== null}
        onFechar={() => setEvento(null)}
        titulo={evento?.tipo === "cancelamento" ? "Cancelar nota" : "Carta de correção (CC-e)"}
        largura="max-w-lg"
        rodape={
          <>
            <Button variante="secondary" onClick={() => setEvento(null)} disabled={processando}>Voltar</Button>
            <Button
              variante={evento?.tipo === "cancelamento" ? "danger" : "primary"}
              disabled={justificativa.trim().length < 15 || processando}
              onClick={confirmarEvento}
            >
              {processando
                ? "Enviando à SEFAZ…"
                : evento?.tipo === "cancelamento"
                  ? "Confirmar cancelamento"
                  : "Registrar CC-e"}
            </Button>
          </>
        }
      >
        {evento && (
          <div className="space-y-4 text-sm">
            <p className="text-[var(--muted)]">
              Nota nº <span className="font-medium text-[var(--foreground)]">{evento.nota.numero}</span> ·{" "}
              {evento.nota.clienteNome}
            </p>
            <Field
              label="Justificativa"
              required
              hint="Mínimo 15 caracteres (exigência SEFAZ)."
            >
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={
                  evento.tipo === "cancelamento"
                    ? "Motivo do cancelamento…"
                    : "Correção a ser registrada na CC-e…"
                }
              />
            </Field>
            {erroEvento && (
              <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {erroEvento}
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              {evento.tipo === "cancelamento"
                ? "Gera o XML do evento 110111, assina com o certificado da sessão e envia à SEFAZ. A nota é marcada como cancelada no banco."
                : "Protótipo: a CC-e é apenas registrada localmente (evento ainda não transmitido)."}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        aberto={visualizar !== null}
        onFechar={() => setVisualizar(null)}
        titulo={`DANFE · Nota nº ${visualizar?.numero ?? ""}`}
        largura="max-w-4xl"
        rodape={
          <>
            <Button variante="secondary" onClick={() => setVisualizar(null)}>Fechar</Button>
            {visualizar?.status === "autorizada" && (
              <Button variante="secondary" onClick={() => visualizar && baixarXml(visualizar)}>Salvar XML</Button>
            )}
            <Button onClick={() => visualizar && baixarPdf(visualizar)} disabled={gerandoPdf}>{gerandoPdf ? "Gerando PDF…" : "Baixar PDF"}</Button>
          </>
        }
      >
        {visualizar && (
          <div id="danfe-print">
            {visualizar.modelo === "65" ? (
              <DanfeNFCe nota={visualizar} />
            ) : (
              <Danfe nota={visualizar} />
            )}
          </div>
        )}
      </Modal>

      {devolver && (
        <DevolucaoModal
          notaId={devolver.id}
          numero={devolver.numero}
          onFechar={() => setDevolver(null)}
          onConcluido={() => { setDevolver(null); setToast("Devolução registrada — itens devolvidos ao estoque."); }}
        />
      )}
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  sub,
  tom = "neutral",
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  tom?: "neutral" | "success" | "primary" | "danger";
}) {
  const cor = {
    neutral: "text-[var(--foreground)]",
    success: "text-[var(--success)]",
    primary: "text-[var(--primary)]",
    danger: "text-[var(--danger)]",
  }[tom];
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{rotulo}</p>
      <p className={"mt-1 text-2xl font-bold tabular-nums " + cor}>{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </Card>
  );
}
