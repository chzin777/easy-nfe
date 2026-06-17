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
import { STATUS_NOTA, TIPOS_NOTA, rotulo } from "@/lib/mock-data";
import type { StatusNota } from "@/lib/types";
import { listarNotas, cancelarNota, type NotaCompleta } from "./actions";

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
  const [processando, setProcessando] = useState(false);
  const [erroEvento, setErroEvento] = useState<string | null>(null);

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

  function imprimir() {
    window.print();
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
      render: (n) => <span className="text-xs">{rotulo(TIPOS_NOTA, n.tipoNota)}</span>,
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
      chave: "acoes",
      cabecalho: "",
      alinhar: "right",
      render: (n) => (
        <div className="flex justify-end gap-1">
          <Button
            variante="ghost"
            disabled={n.status !== "autorizada"}
            onClick={(e) => { e.stopPropagation(); abrirEvento(n, "cce"); }}
          >
            CC-e
          </Button>
          <Button
            variante="ghost"
            className="text-[var(--danger)]"
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
      <PageHeader
        titulo="Notas emitidas"
        subtitulo="Histórico de notas com filtros, eventos e exportação."
        acao={<Button variante="secondary" onClick={exportarCsv}>Exportar CSV</Button>}
      />

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
              ? <EmptyState titulo="Carregando…" descricao="Buscando notas no banco." />
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
            <Button onClick={imprimir}>Imprimir / Salvar PDF</Button>
          </>
        }
      >
        {visualizar && (
          <div id="danfe-print">
            <Danfe nota={visualizar} />
          </div>
        )}
      </Modal>
    </div>
  );
}
