"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/app/ui/Modal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Paginacao,
  Tabela,
  formatBRL,
  formatData,
  paginar,
  type Coluna,
} from "@/app/ui/primitives";
import { formatCpfCnpj } from "@/lib/format";
import {
  baixarXmlEntrada,
  listarEntradas,
  sincronizarEntradas,
  type EntradaUI,
  type ResumoEntradas,
} from "./actions";

type Filtro = "todos" | "produto" | "servico";

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  return `${formatData(iso)} ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function NotasRecebidasPage() {
  const [docs, setDocs] = useState<EntradaUI[]>([]);
  const [resumo, setResumo] = useState<ResumoEntradas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [detalhe, setDetalhe] = useState<EntradaUI | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const filtrados = useMemo(
    () => (filtro === "todos" ? docs : docs.filter((d) => d.origem === filtro)),
    [docs, filtro],
  );
  const pag = paginar(filtrados, pagina, porPagina);

  async function recarregar() {
    const r = await listarEntradas();
    setDocs(r.docs);
    setResumo(r.resumo);
    // O que chegou entra no topo da lista — volta para a primeira página.
    setPagina(1);
  }

  useEffect(() => {
    listarEntradas()
      .then((r) => {
        setDocs(r.docs);
        setResumo(r.resumo);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function buscar() {
    setBuscando(true);
    setAviso(null);
    const r = await sincronizarEntradas();
    await recarregar();
    setBuscando(false);

    const falhas = [
      !r.produto.ok ? `produto: ${r.produto.erro}` : null,
      !r.servico.ok ? `serviço: ${r.servico.erro}` : null,
    ].filter(Boolean);
    const novas = r.produto.novas + r.servico.novas;

    if (falhas.length === 2) {
      setAviso({ tom: "erro", texto: falhas.join(" | ") });
      return;
    }
    // Fila vazia é resultado normal, não erro.
    const base = novas
      ? `${novas} ${novas === 1 ? "documento novo" : "documentos novos"}.`
      : "Nada novo por enquanto.";
    setAviso(
      falhas.length
        ? { tom: "erro", texto: `${base} Falhou em ${falhas.join("")}` }
        : { tom: "ok", texto: base },
    );
  }

  async function baixarXml(doc: EntradaUI) {
    const r = await baixarXmlEntrada(doc.id);
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

  const colunas: Coluna<EntradaUI>[] = [
    {
      chave: "origem",
      cabecalho: "Tipo",
      valor: (d) => d.origem,
      render: (d) => (
        <Badge tom={d.origem === "servico" ? "primary" : "neutral"}>
          {d.origem === "servico" ? "Serviço" : "Produto"}
        </Badge>
      ),
    },
    {
      chave: "contraparte",
      cabecalho: "Quem emitiu",
      valor: (d) => d.contraparteNome,
      render: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium">
            {d.avulso ? "Acontecimento avulso" : d.contraparteNome}
          </div>
          {d.contraparteDoc && (
            <div className="text-xs text-[var(--muted)]">{formatCpfCnpj(d.contraparteDoc)}</div>
          )}
        </div>
      ),
    },
    {
      chave: "descricao",
      cabecalho: "Descrição",
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
        d.situacao ? (
          <Badge tom={d.situacaoTom}>{d.situacao}</Badge>
        ) : (
          <span className="text-[var(--muted)]">—</span>
        ),
    },
  ];

  const abas: { chave: Filtro; rotulo: string; conta?: number }[] = [
    { chave: "todos", rotulo: "Tudo", conta: docs.length },
    { chave: "produto", rotulo: "Produto", conta: resumo?.produtos },
    { chave: "servico", rotulo: "Serviço", conta: resumo?.servicos },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notas recebidas"
        subtitulo="Notas de produto e de serviço emitidas contra o seu CNPJ."
        acao={
          <Button onClick={buscar} disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar novas"}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="flex gap-1">
            {abas.map((a) => (
              <button
                key={a.chave}
                onClick={() => { setFiltro(a.chave); setPagina(1); }}
                className={
                  "cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (filtro === a.chave
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "text-[var(--muted)] hover:bg-slate-50")
                }
              >
                {a.rotulo}
                {a.conta !== undefined && <span className="ml-1.5 text-xs opacity-70">{a.conta}</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {aviso && (
              <span className={aviso.tom === "erro" ? "text-[var(--danger)]" : "text-[var(--success)]"}>
                {aviso.texto}
              </span>
            )}
            <span className="text-[var(--muted)]">
              {resumo?.sincronizadaEm
                ? `Última busca: ${dataHora(resumo.sincronizadaEm)}`
                : "Nunca buscado."}
            </span>
          </div>
        </div>

        {carregando ? (
          <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">Carregando…</div>
        ) : (
          <>
            <Tabela
              colunas={colunas}
              dados={pag.fatia}
              onRowClick={setDetalhe}
              vazio={
                <EmptyState
                  titulo="Nenhuma nota recebida"
                  descricao="Quando alguém emitir uma nota contra o seu CNPJ, ela aparece aqui. Use “Buscar novas” para conferir agora."
                />
              }
            />
            <Paginacao
              total={filtrados.length}
              pagina={pag.pagina}
              paginas={pag.paginas}
              porPagina={porPagina}
              onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
              rotulo="documento"
            />
          </>
        )}
      </Card>

      <Modal
        aberto={!!detalhe}
        onFechar={() => setDetalhe(null)}
        titulo={
          detalhe?.avulso
            ? "Acontecimento"
            : detalhe?.origem === "servico"
              ? "Nota de serviço recebida"
              : "Nota de produto recebida"
        }
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
            {!detalhe.avulso && (
              <>
                <Linha rotulo="Quem emitiu" valor={detalhe.contraparteNome} />
                {detalhe.contraparteDoc && (
                  <Linha rotulo="CNPJ/CPF" valor={formatCpfCnpj(detalhe.contraparteDoc)} />
                )}
                <Linha rotulo="Valor" valor={detalhe.valor === null ? "—" : formatBRL(detalhe.valor)} />
              </>
            )}
            <Linha rotulo="Emitida em" valor={dataHora(detalhe.emitidaEm)} />
            {detalhe.descricao && <Linha rotulo="Descrição" valor={detalhe.descricao} />}
            {detalhe.chaveAcesso && (
              <Linha
                rotulo="Chave"
                valor={<span className="break-all font-mono text-xs">{detalhe.chaveAcesso}</span>}
              />
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
