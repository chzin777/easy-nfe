"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/ui/Modal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Tabela,
  formatBRL,
  formatData,
  type Coluna,
} from "@/app/ui/primitives";
import { formatCpfCnpj } from "@/lib/format";
import {
  listarServicosRecebidos,
  obterXmlServicoRecebido,
  sincronizarServicosRecebidos,
  type ResumoSincNfse,
  type ServicoRecebidoUI,
} from "./actions";

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  return `${formatData(iso)} ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function ServicosRecebidosPage() {
  const [docs, setDocs] = useState<ServicoRecebidoUI[]>([]);
  const [resumo, setResumo] = useState<ResumoSincNfse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [detalhe, setDetalhe] = useState<ServicoRecebidoUI | null>(null);

  async function recarregar() {
    const r = await listarServicosRecebidos();
    setDocs(r.docs);
    setResumo(r.resumo);
    setCarregando(false);
  }

  useEffect(() => {
    listarServicosRecebidos()
      .then((r) => {
        setDocs(r.docs);
        setResumo(r.resumo);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function buscar() {
    setBuscando(true);
    setAviso(null);
    const r = await sincronizarServicosRecebidos();
    if (!r.ok) {
      setAviso({ tom: "erro", texto: r.erro });
    } else {
      // Fila vazia é resultado normal, não erro — a mensagem reflete isso.
      const texto = r.novas
        ? `${r.novas} ${r.novas === 1 ? "documento novo" : "documentos novos"}.`
        : "Nada novo por enquanto.";
      setAviso({
        tom: "ok",
        texto: r.completo ? texto : `${texto} Ainda há mais na fila — busque de novo.`,
      });
      await recarregar();
    }
    setBuscando(false);
  }

  async function baixarXml(doc: ServicoRecebidoUI) {
    const r = await obterXmlServicoRecebido(doc.id);
    if (!r.ok) {
      setAviso({ tom: "erro", texto: r.erro });
      return;
    }
    const url = URL.createObjectURL(new Blob([r.xml], { type: "application/xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  const colunas: Coluna<ServicoRecebidoUI>[] = [
    {
      chave: "prestador",
      cabecalho: "Prestador",
      valor: (d) => d.prestadorNome,
      render: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium">
            {d.tipo === "evento" ? "Acontecimento avulso" : d.prestadorNome}
          </div>
          {d.prestadorCnpj && (
            <div className="text-xs text-[var(--muted)]">{formatCpfCnpj(d.prestadorCnpj)}</div>
          )}
        </div>
      ),
    },
    {
      chave: "descricao",
      cabecalho: "Serviço",
      valor: (d) => d.descricao,
      render: (d) => (
        <span className="line-clamp-2 text-sm text-[var(--muted)]">{d.descricao ?? "—"}</span>
      ),
    },
    {
      chave: "emitidaEm",
      cabecalho: "Data",
      valor: (d) => d.emitidaEm,
      render: (d) => (d.emitidaEm ? formatData(d.emitidaEm) : "—"),
    },
    {
      chave: "valor",
      cabecalho: "Valor",
      alinhar: "right",
      valor: (d) => d.valor,
      render: (d) => (d.valor === null ? "—" : formatBRL(d.valor)),
    },
    {
      chave: "situacao",
      cabecalho: "Situação",
      valor: (d) => d.situacao,
      render: (d) =>
        d.situacao ? <Badge tom={d.situacaoTom}>{d.situacao}</Badge> : <span className="text-[var(--muted)]">—</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Serviços recebidos"
        subtitulo="Notas de serviço que outras empresas emitiram contra o seu CNPJ."
        acao={
          <Button onClick={buscar} disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar novas"}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 text-sm">
          <span className="text-[var(--muted)]">
            {resumo?.sincronizadaEm
              ? `Última busca: ${dataHora(resumo.sincronizadaEm)}`
              : "Nunca buscado."}
          </span>
          {aviso && (
            <span className={aviso.tom === "erro" ? "text-[var(--danger)]" : "text-[var(--success)]"}>
              {aviso.texto}
            </span>
          )}
        </div>

        {carregando ? (
          <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">Carregando…</div>
        ) : (
          <Tabela
            colunas={colunas}
            dados={docs}
            onRowClick={setDetalhe}
            vazio={
              <EmptyState
                titulo="Nenhuma nota de serviço recebida"
                descricao="Quando alguém emitir uma nota de serviço contra o seu CNPJ, ela aparece aqui. Use “Buscar novas” para conferir agora."
              />
            }
          />
        )}
      </Card>

      <Modal
        aberto={!!detalhe}
        onFechar={() => setDetalhe(null)}
        titulo={detalhe?.tipo === "evento" ? "Acontecimento" : "Nota de serviço recebida"}
        rodape={
          detalhe && (
            <Button variante="secondary" onClick={() => void baixarXml(detalhe)}>
              Baixar documento
            </Button>
          )
        }
      >
        {detalhe && (
          <div className="space-y-4 text-sm">
            {detalhe.tipo === "nfse" && (
              <>
                <Linha rotulo="Prestador" valor={detalhe.prestadorNome} />
                {detalhe.prestadorCnpj && (
                  <Linha rotulo="CNPJ/CPF" valor={formatCpfCnpj(detalhe.prestadorCnpj)} />
                )}
                <Linha rotulo="Valor" valor={detalhe.valor === null ? "—" : formatBRL(detalhe.valor)} />
              </>
            )}
            <Linha rotulo="Emitida em" valor={dataHora(detalhe.emitidaEm)} />
            {detalhe.descricao && <Linha rotulo="Descrição" valor={detalhe.descricao} />}
            {detalhe.chaveAcesso && (
              <Linha rotulo="Chave" valor={<span className="break-all font-mono text-xs">{detalhe.chaveAcesso}</span>} />
            )}

            {detalhe.eventos.length > 0 && (
              <div className="border-t border-[var(--border)] pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  O que aconteceu com esta nota
                </div>
                <ul className="space-y-1.5">
                  {detalhe.eventos.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span>{e.rotulo}</span>
                      <span className="text-xs text-[var(--muted)]">{dataHora(e.em)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-28 shrink-0 text-xs uppercase tracking-wider text-[var(--muted)]">{rotulo}</span>
      <span className="min-w-0">{valor}</span>
    </div>
  );
}
