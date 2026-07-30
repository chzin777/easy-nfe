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
  Paginacao,
  paginar,
  formatBRL,
  formatData,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Danfe from "@/app/ui/Danfe";
import DanfeNFCe from "@/app/ui/DanfeNFCe";
import Danfse from "@/app/ui/Danfse";
import LightningLoader from "@/app/ui/LightningLoader";
import { baixarDanfePdf } from "@/app/ui/danfePdf";
import { STATUS_NOTA, TIPOS_NOTA, rotulo, rotuloTipoCurto } from "@/lib/mock-data";
import { formatCpfCnpj } from "@/lib/format";
import type { StatusNota } from "@/lib/types";
import { listarNotas, cancelarNota, obterXmlNota, type NotaCompleta } from "./actions";
import {
  baixarXmlNotaServico,
  cancelarNotaServico,
  listarNotasServico,
  obterNotaServico,
  recuperarNotaServico,
  type NotaServicoCompleta,
  type NotaServicoUI,
} from "@/app/notas-servico/actions";
import { MOTIVOS_CANCELAMENTO, type MotivoCancelamento } from "@/lib/nfse/evento";
import DevolucaoModal from "./DevolucaoModal";

// Notas de produto (NF-e/NFC-e) e de serviço (NFS-e) na mesma lista. São
// documentos diferentes em bases diferentes, então a tabela trabalha com uma
// linha unificada e cada tipo abre o seu próprio espelho.
type Origem = "todas" | "produto" | "servico";

const ORIGENS: { valor: Origem; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "produto", label: "De venda" },
  { valor: "servico", label: "De serviço" },
];

type Linha = {
  id: string;
  origem: "produto" | "servico";
  numero: number;
  nome: string;
  sub: string;
  tipoLabel: string;
  emitidaEm: string;
  valor: number;
  status: StatusNota;
  ambiente: "producao" | "homologacao";
  produto?: NotaCompleta;
  servico?: NotaServicoUI;
};

const STATUS_SERVICO: Record<string, StatusNota> = {
  AUTORIZADA: "autorizada",
  CANCELADA: "cancelada",
  REJEITADA: "rejeitada",
  DENEGADA: "denegada",
  RASCUNHO: "rascunho",
};

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
  const [notasServico, setNotasServico] = useState<NotaServicoUI[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [origem, setOrigem] = useState<Origem>("todas");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [evento, setEvento] = useState<AcaoEvento | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [visualizar, setVisualizar] = useState<NotaCompleta | null>(null);
  const [devolver, setDevolver] = useState<NotaCompleta | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erroEvento, setErroEvento] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Serviço: espelho aberto e cancelamento (que tem motivo próprio da NFS-e).
  const [verServico, setVerServico] = useState<NotaServicoCompleta | null>(null);
  const [cancelarServ, setCancelarServ] = useState<NotaServicoCompleta | null>(null);
  const [motivoServ, setMotivoServ] = useState<MotivoCancelamento>("1");

  async function recarregar() {
    const [lista, servico] = await Promise.all([listarNotas(), listarNotasServico()]);
    setNotas(lista);
    setNotasServico(servico);
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

  async function baixarPdfServico(nota: NotaServicoCompleta) {
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

  const linhas = useMemo<Linha[]>(() => {
    const deProduto: Linha[] = notas.map((n) => ({
      id: n.id,
      origem: "produto",
      numero: n.numero,
      nome: n.clienteNome,
      sub: n.chaveAcesso,
      tipoLabel: rotuloTipoCurto(n.tipoNota),
      emitidaEm: n.emitidaEm,
      valor: n.valorTotal,
      status: n.status,
      ambiente: n.ambiente,
      produto: n,
    }));
    const deServico: Linha[] = notasServico.map((s) => ({
      id: s.id,
      origem: "servico",
      numero: s.numero,
      nome: s.clienteNome,
      sub: s.chaveAcesso || s.descricaoServico,
      tipoLabel: "NFS-e",
      emitidaEm: s.emitidaEm,
      valor: s.valorServico,
      status: STATUS_SERVICO[s.status] ?? "rascunho",
      ambiente: s.ambienteUI,
      servico: s,
    }));
    return [...deProduto, ...deServico].sort((a, b) => b.emitidaEm.localeCompare(a.emitidaEm));
  }, [notas, notasServico]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (origem !== "todas" && l.origem !== origem) return false;
      if (filtroStatus && l.status !== filtroStatus) return false;
      // O tipo é só das notas de produto; escolher um deixa serviço de fora.
      if (filtroTipo && (l.origem !== "produto" || l.produto?.tipoNota !== filtroTipo)) return false;
      if (q && !l.nome.toLowerCase().includes(q) && !String(l.numero).includes(q) && !l.sub.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [linhas, origem, busca, filtroStatus, filtroTipo]);

  const pag = paginar(filtradas, pagina, porPagina);

  // KPIs calculados sobre o conjunto filtrado (acompanham busca/filtros).
  const kpis = useMemo(() => {
    const aut = filtradas.filter((n) => n.status === "autorizada");
    const canceladas = filtradas.filter((n) => n.status === "cancelada").length;
    const rejeitadas = filtradas.filter((n) => n.status === "rejeitada" || n.status === "denegada").length;
    const valorAut = aut.reduce((s, n) => s + n.valor, 0);
    const agora = new Date();
    const valorMes = aut.reduce((s, n) => {
      const d = new Date(n.emitidaEm);
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear() ? s + n.valor : s;
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
    const cabecalho = ["Numero", "Documento", "Tipo", "Cliente", "Status", "Emissao", "Total", "Chave"];
    const linhas = filtradas.map((l) => [
      l.numero,
      l.origem === "servico" ? "NFS-e" : "NF-e/NFC-e",
      l.origem === "servico" ? "NFS-e" : rotulo(TIPOS_NOTA, l.produto!.tipoNota),
      l.nome,
      l.status,
      formatData(l.emitidaEm),
      l.valor.toFixed(2).replace(".", ","),
      l.origem === "servico" ? l.servico!.chaveAcesso : l.produto!.chaveAcesso,
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

  // Abre o espelho: nota de produto já vem inteira da lista; a de serviço
  // precisa buscar emitente e endereço do tomador.
  async function abrirLinha(l: Linha) {
    if (l.origem === "produto") {
      setVisualizar(l.produto!);
      return;
    }
    const r = await obterNotaServico(l.id);
    if (!r.ok) { setToast(r.erro); return; }
    setVerServico(r.nota);
  }

  async function baixarXmlServico(nota: NotaServicoCompleta) {
    const r = await baixarXmlNotaServico(nota.id);
    if (!r.ok) { setToast(r.erro); return; }
    const url = URL.createObjectURL(new Blob([r.xml], { type: "application/xml;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = r.nome; a.click();
    URL.revokeObjectURL(url);
  }

  async function recuperarServico(nota: NotaServicoCompleta) {
    const r = await recuperarNotaServico(nota.id);
    setToast(r.ok ? "Nota recuperada — estava autorizada no fisco." : r.erro);
    setVerServico(null);
    await recarregar();
  }

  async function confirmarCancelamentoServico() {
    if (!cancelarServ) return;
    setProcessando(true);
    setErroEvento(null);
    const r = await cancelarNotaServico({
      id: cancelarServ.id,
      motivo: motivoServ,
      descricaoMotivo: justificativa,
    });
    setProcessando(false);
    if (!r.ok) { setErroEvento(r.erro); return; }
    setCancelarServ(null);
    await recarregar();
  }

  const colunas: Coluna<Linha>[] = [
    {
      chave: "numero",
      cabecalho: "Nº",
      render: (l) => <span className="font-mono text-xs">{l.numero}</span>,
    },
    {
      chave: "cliente",
      cabecalho: "Cliente",
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{l.nome}</p>
          <p className="truncate font-mono text-[11px] text-[var(--muted)]">{l.sub}</p>
        </div>
      ),
    },
    {
      chave: "tipo",
      cabecalho: "Tipo",
      render: (l) => (
        <Badge tom={l.origem === "servico" ? "primary" : "neutral"}>{l.tipoLabel}</Badge>
      ),
    },
    {
      chave: "emissao",
      cabecalho: "Emissão",
      render: (l) => formatData(l.emitidaEm),
    },
    {
      chave: "total",
      cabecalho: "Total",
      alinhar: "right",
      render: (l) => <span className="font-medium">{formatBRL(l.valor)}</span>,
    },
    {
      chave: "status",
      cabecalho: "Status",
      alinhar: "center",
      render: (l) => <Badge tom={tomStatus[l.status]}>{l.status}</Badge>,
    },
    {
      chave: "ambiente",
      cabecalho: "Ambiente",
      alinhar: "center",
      render: (l) => (
        <Badge tom={l.ambiente === "homologacao" ? "warning" : "neutral"}>
          {l.ambiente === "homologacao" ? "homologação" : "produção"}
        </Badge>
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
        <div className="flex flex-wrap gap-1 border-b border-[var(--border)] p-3">
          {ORIGENS.map((o) => {
            const ativo = origem === o.valor;
            const quantas =
              o.valor === "todas" ? linhas.length : linhas.filter((l) => l.origem === o.valor).length;
            return (
              <button
                key={o.valor}
                type="button"
                onClick={() => { setOrigem(o.valor); setPagina(1); }}
                aria-pressed={ativo}
                className={
                  "rounded-lg px-3 py-2 text-sm font-medium transition " +
                  (ativo
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--foreground)]")
                }
              >
                {o.label}
                <span className={"ml-1.5 text-xs " + (ativo ? "text-white/70" : "text-[var(--muted)]")}>
                  {quantas}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_200px_200px]">
          <Input
            placeholder="Buscar por nº, cliente ou chave…"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
          />
          <Select
            opcoes={STATUS_NOTA}
            value={filtroStatus}
            onChange={(e) => { setFiltroStatus(e.target.value); setPagina(1); }}
            placeholder="Todos os status"
          />
          <Select
            opcoes={TIPOS_NOTA}
            value={filtroTipo}
            onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1); }}
            placeholder="Todos os tipos"
          />
        </div>
        <Tabela
          colunas={colunas}
          dados={pag.fatia}
          onRowClick={(l) => void abrirLinha(l)}
          vazio={
            carregando
              ? <LightningLoader texto="Carregando notas…" />
              : <EmptyState titulo="Nenhuma nota encontrada" descricao="Ajuste os filtros ou emita uma nova nota." />
          }
        />
        {/* Total do conjunto filtrado inteiro, não só da página — senão o número
            mudaria a cada virada de página. */}
        <div className="border-t border-[var(--border)] px-4 pt-3 text-xs text-[var(--muted)]">
          Total filtrado: <b className="text-[var(--foreground)]">{formatBRL(filtradas.reduce((s, l) => s + l.valor, 0))}</b>
        </div>
        <Paginacao
          total={filtradas.length}
          pagina={pag.pagina}
          paginas={pag.paginas}
          porPagina={porPagina}
          onPagina={setPagina}
          onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
          rotulo="nota"
        />
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
              <>
                <Button
                  variante="warning"
                  onClick={() => { if (!visualizar) return; const n = visualizar; setVisualizar(null); abrirEvento(n, "cce"); }}
                >
                  CC-e
                </Button>
                <Button
                  variante="secondary"
                  onClick={() => { if (!visualizar) return; const n = visualizar; setVisualizar(null); setDevolver(n); }}
                >
                  Devolução
                </Button>
                <Button
                  variante="dangerSoft"
                  onClick={() => { if (!visualizar) return; const n = visualizar; setVisualizar(null); abrirEvento(n, "cancelamento"); }}
                >
                  Cancelar
                </Button>
                <Button variante="secondary" onClick={() => visualizar && baixarXml(visualizar)}>Salvar XML</Button>
              </>
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

      {/* Espelho da NFS-e — mesmos botões do DANFE, no leiaute de serviço. */}
      <Modal
        aberto={verServico !== null}
        onFechar={() => setVerServico(null)}
        titulo={`DANFSe · NFS-e nº ${verServico?.numero ?? ""}`}
        largura="max-w-4xl"
        rodape={
          <>
            <Button variante="secondary" onClick={() => setVerServico(null)}>Fechar</Button>
            {/* Rascunho = transmitiu e não veio resposta. Pode estar autorizada
                no fisco; reemitir criaria duplicidade. */}
            {verServico?.status === "RASCUNHO" && (
              <Button variante="secondary" onClick={() => verServico && void recuperarServico(verServico)}>
                Consultar no fisco
              </Button>
            )}
            {verServico?.status === "AUTORIZADA" && (
              <>
                <Button
                  variante="dangerSoft"
                  onClick={() => {
                    if (!verServico) return;
                    const n = verServico;
                    setVerServico(null);
                    setJustificativa("");
                    setMotivoServ("1");
                    setErroEvento(null);
                    setCancelarServ(n);
                  }}
                >
                  Cancelar
                </Button>
                <Button variante="secondary" onClick={() => verServico && void baixarXmlServico(verServico)}>
                  Salvar XML
                </Button>
              </>
            )}
            <Button
              onClick={() => verServico && baixarPdfServico(verServico)}
              disabled={gerandoPdf}
            >
              {gerandoPdf ? "Gerando PDF…" : "Baixar PDF"}
            </Button>
          </>
        }
      >
        {verServico && (
          <div id="danfe-print">
            <Danfse nota={verServico} />
          </div>
        )}
      </Modal>

      {/* Cancelamento da NFS-e — motivo é código da SEFIN, não texto livre. */}
      <Modal
        aberto={cancelarServ !== null}
        onFechar={() => setCancelarServ(null)}
        titulo="Cancelar nota de serviço"
        largura="max-w-lg"
        rodape={
          <>
            <Button variante="secondary" onClick={() => setCancelarServ(null)} disabled={processando}>
              Voltar
            </Button>
            <Button
              variante="danger"
              disabled={justificativa.trim().length < 15 || processando}
              onClick={confirmarCancelamentoServico}
            >
              {processando ? "Enviando à SEFIN…" : "Confirmar cancelamento"}
            </Button>
          </>
        }
      >
        {cancelarServ && (
          <div className="space-y-4 text-sm">
            <p className="text-[var(--muted)]">
              NFS-e nº <span className="font-medium text-[var(--foreground)]">{cancelarServ.numero}</span> ·{" "}
              {cancelarServ.clienteNome}
              {cancelarServ.clienteDocumento ? ` · ${formatCpfCnpj(cancelarServ.clienteDocumento)}` : ""}
            </p>
            <Field label="Motivo" required>
              <Select
                opcoes={MOTIVOS_CANCELAMENTO}
                value={motivoServ}
                onChange={(e) => setMotivoServ(e.target.value as MotivoCancelamento)}
              />
            </Field>
            <Field label="Descrição do motivo" required hint="Mínimo 15 caracteres.">
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="O que aconteceu…"
              />
            </Field>
            {erroEvento && (
              <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {erroEvento}
              </p>
            )}
            <p className="text-xs text-[var(--muted)]">
              O prazo de cancelamento é da prefeitura. Fora dele a própria SEFIN recusa, e a nota
              precisa ser substituída em vez de cancelada.
            </p>
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
