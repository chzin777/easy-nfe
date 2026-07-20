"use client";

import { useEffect, useRef, useState } from "react";
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
import { parseNFe, type NfeItem, type ParsedNFe } from "@/lib/nfe-parser";
import {
  listarProdutos,
  importarEntradaXml,
  importarNotaSaida,
  analisarChavesImport,
} from "@/app/produtos/actions";
import type { Produto } from "@/lib/types";

type Tipo = "entrada" | "saida";
// tipo null = ainda analisando (sistema decidindo entrada x saída)
type StatusNota = "pendente" | "importando" | "ok" | "jaImportada" | "erro";

type NotaCarregada = {
  id: string;
  arquivo: string;
  nfe: ParsedNFe | null;
  erro: string | null;
  tipo: Tipo | null;
  status: StatusNota;
  aberta: boolean;
  resultado: { criados: number; atualizados: number; ignorados: number } | null;
  outcome: string | null; // texto de sucesso (importação de saída)
};

let seq = 0;
function novoId() {
  seq += 1;
  return `nota-${seq}`;
}

export default function ImportarPage() {
  const [notas, setNotas] = useState<NotaCarregada[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [catalogo, setCatalogo] = useState<Produto[]>([]);
  const [importandoLote, setImportandoLote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function recarregarCatalogo() {
    setCatalogo(await listarProdutos());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregarCatalogo();
  }, []);

  // GTINs/nomes já no catálogo (marca item como "novo" ou "existente").
  const catalogoGtin = new Set(catalogo.map((p) => p.codigoBarras).filter(Boolean));
  const catalogoNome = new Set(catalogo.map((p) => p.nome.toLowerCase()));

  function existeNoCatalogo(it: NfeItem): boolean {
    if (it.cEAN && catalogoGtin.has(it.cEAN)) return true;
    return catalogoNome.has(it.xProd.toLowerCase());
  }

  // Lê + parseia vários arquivos, ignorando duplicados já na fila.
  async function processarArquivos(files: File[]) {
    const chavesNaFila = new Set(
      notas.map((n) => n.nfe?.chave).filter(Boolean) as string[],
    );
    const novas: NotaCarregada[] = [];
    for (const file of files) {
      if (!/\.xml$/i.test(file.name) && !file.type.includes("xml")) continue;
      const base: NotaCarregada = {
        id: novoId(),
        arquivo: file.name,
        nfe: null,
        erro: null,
        tipo: null,
        status: "pendente",
        aberta: false,
        resultado: null,
        outcome: null,
      };
      try {
        const nfe = parseNFe(await file.text());
        if (nfe.chave && chavesNaFila.has(nfe.chave)) continue; // já na fila
        if (nfe.chave) chavesNaFila.add(nfe.chave);
        base.nfe = nfe;
      } catch (e) {
        base.erro = e instanceof Error ? e.message : "Falha ao ler o XML.";
        base.status = "erro";
      }
      novas.push(base);
    }
    if (!novas.length) return;
    setNotas((prev) => [...prev, ...novas]);

    // Sistema reconhece o tipo (entrada x saída) e marca já importadas.
    const itens = novas
      .filter((n) => n.nfe?.chave)
      .map((n) => ({ chave: n.nfe!.chave, emitenteDoc: n.nfe!.emitente.documento }));
    if (itens.length) {
      try {
        const analise = await analisarChavesImport(itens);
        setNotas((prev) =>
          prev.map((n) => {
            if (!n.nfe?.chave || (n.status !== "pendente")) return n;
            const a = analise[n.nfe.chave.replace(/\D/g, "")];
            if (!a) return n;
            return {
              ...n,
              tipo: a.tipo,
              status: a.jaImportada ? ("jaImportada" as StatusNota) : n.status,
            };
          }),
        );
      } catch {
        // se a análise falhar, o backend ainda classifica/bloqueia na importação
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) void processarArquivos(files);
  }

  function patch(id: string, campos: Partial<NotaCarregada>) {
    setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, ...campos } : n)));
  }

  // Importa UMA nota conforme o tipo reconhecido pelo sistema.
  async function importarUma(nota: NotaCarregada) {
    const nfe = nota.nfe;
    // só (re)lança pendente ou que falhou; já reconhecida como jaImportada trava
    if (!nfe || (nota.status !== "pendente" && nota.status !== "erro")) return;
    if (!nota.tipo) return; // ainda analisando
    patch(nota.id, { status: "importando", erro: null });

    if (nota.tipo === "entrada") {
      const r = await importarEntradaXml({
        chave: nfe.chave || "",
        numero: nfe.numero ? String(nfe.numero) : undefined,
        serie: nfe.serie ? String(nfe.serie) : undefined,
        modelo: nfe.modelo || undefined,
        fornecedorNome: nfe.emitente.nome || undefined,
        fornecedorDoc: nfe.emitente.documento || undefined,
        valorTotal: nfe.valorNota,
        criarFaltantes: true,
        itens: nfe.itens.map((it) => ({
          cEAN: it.cEAN || undefined,
          xProd: it.xProd,
          ncm: it.ncm || undefined,
          uCom: it.uCom || undefined,
          qCom: it.qCom,
          vUnCom: it.vUnCom,
        })),
      });
      if (r.ok) {
        patch(nota.id, {
          status: "ok",
          resultado: { criados: r.criados, atualizados: r.atualizados, ignorados: r.ignorados },
        });
      } else if (r.jaImportada) {
        patch(nota.id, { status: "jaImportada" });
      } else {
        patch(nota.id, { status: "erro", erro: r.erro });
      }
      if (r.ok) await recarregarCatalogo();
      return;
    }

    // tipo === "saida": traz a NF emitida em outro sistema como nota autorizada.
    const r = await importarNotaSaida({
      chave: nfe.chave || "",
      numero: nfe.numero,
      serie: nfe.serie,
      modelo: nfe.modelo,
      natOp: nfe.natOp || undefined,
      emitenteDoc: nfe.emitente.documento,
      autorizada: nfe.autorizada,
      protocolo: nfe.protocolo || undefined,
      autorizadaEm: nfe.autorizadaEm || undefined,
      xml: nfe.xml,
      valorTotal: nfe.valorNota,
      destinatario: {
        documento: nfe.destinatario.documento,
        nome: nfe.destinatario.nome,
        ie: nfe.destinatario.ie || undefined,
        telefone: nfe.destinatario.telefone || undefined,
        cep: nfe.destinatario.cep || undefined,
        logradouro: nfe.destinatario.logradouro || undefined,
        numero: nfe.destinatario.numero || undefined,
        bairro: nfe.destinatario.bairro || undefined,
        municipio: nfe.destinatario.municipio || undefined,
        uf: nfe.destinatario.uf || undefined,
      },
      itens: nfe.itens.map((it) => ({
        xProd: it.xProd,
        ncm: it.ncm || undefined,
        cfop: it.cfop || undefined,
        uCom: it.uCom || undefined,
        qCom: it.qCom,
        vUnCom: it.vUnCom,
        vProd: it.vProd,
      })),
    });
    if (r.ok) {
      patch(nota.id, {
        status: "ok",
        outcome: r.clienteCriado ? "Nota importada · cliente cadastrado" : "Nota importada",
      });
    } else if (r.jaImportada) {
      patch(nota.id, { status: "jaImportada" });
    } else {
      patch(nota.id, { status: "erro", erro: r.erro });
    }
  }

  // Importa todas as pendentes, uma a uma (sequencial p/ não sobrecarregar).
  async function importarTodas() {
    setImportandoLote(true);
    const pendentes = notas.filter((n) => n.nfe && n.tipo && n.status === "pendente");
    for (const nota of pendentes) {
      await importarUma(nota);
    }
    await recarregarCatalogo();
    setImportandoLote(false);
  }

  function removerNota(id: string) {
    setNotas((prev) => prev.filter((n) => n.id !== id));
  }

  function limparTudo() {
    setNotas([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validas = notas.filter((n) => n.nfe);
  const prontasCount = validas.filter((n) => n.tipo && n.status === "pendente").length;
  const entradaCount = validas.filter((n) => n.tipo === "entrada").length;
  const saidaCount = validas.filter((n) => n.tipo === "saida").length;
  const okCount = notas.filter((n) => n.status === "ok").length;
  const valorTotalLote = validas.reduce((s, n) => s + (n.nfe?.valorNota ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Importar XML / DANFE"
        subtitulo="Arraste os XMLs — o sistema reconhece sozinho se é entrada (compra recebida) ou saída (nota que você emitiu em outro sistema)."
        acao={notas.length ? <Button variante="secondary" onClick={limparTudo}>Limpar tudo</Button> : undefined}
      />

      {/* Dropzone — sempre visível para ir somando arquivos à fila */}
      <Card
        className={
          "border-2 border-dashed transition-colors " +
          (arrastando ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)]")
        }
      >
        <label
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={onDrop}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 px-6 py-12 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-lg">
            {/* lucide: file-up */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M12 12v6" />
              <path d="m15 15-3-3-3 3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Arraste os arquivos XML aqui ou clique para selecionar</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Pode selecionar vários de uma vez · NF-e (modelo 55) ou NFC-e (modelo 65)</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) void processarArquivos(fs);
              e.target.value = "";
            }}
          />
        </label>
      </Card>

      {notas.length > 0 && (
        <>
          {/* Barra de resumo + ação em lote */}
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <span className="font-semibold">{validas.length} nota(s)</span>
              <span className="text-[var(--muted)]">
                {" · "}{entradaCount} entrada · {saidaCount} saída · {okCount} importada(s) · total {formatBRL(valorTotalLote)}
              </span>
            </div>
            <Button onClick={importarTodas} disabled={importandoLote || prontasCount === 0}>
              {importandoLote ? "Importando…" : `Importar todas (${prontasCount})`}
            </Button>
          </Card>

          {notas.map((nota) => (
            <NotaCard
              key={nota.id}
              nota={nota}
              existeNoCatalogo={existeNoCatalogo}
              onImportar={() => void importarUma(nota)}
              onToggle={() => patch(nota.id, { aberta: !nota.aberta })}
              onRemover={() => removerNota(nota.id)}
              ocupado={importandoLote}
            />
          ))}
        </>
      )}
    </div>
  );
}

function NotaCard({
  nota,
  existeNoCatalogo,
  onImportar,
  onToggle,
  onRemover,
  ocupado,
}: {
  nota: NotaCarregada;
  existeNoCatalogo: (it: NfeItem) => boolean;
  onImportar: () => void;
  onToggle: () => void;
  onRemover: () => void;
  ocupado: boolean;
}) {
  const { nfe, erro, status, tipo } = nota;

  if (erro && !nfe) {
    return (
      <Card className="border-[var(--danger)]/30 bg-[var(--danger-soft)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--danger)]">Erro em “{nota.arquivo}”</p>
            <p className="mt-1 text-sm text-slate-600">{erro}</p>
          </div>
          <Button variante="secondary" onClick={onRemover}>Remover</Button>
        </div>
      </Card>
    );
  }
  if (!nfe) return null;

  const entrada = tipo === "entrada";
  const analisando = tipo === null && status === "pendente";
  const novosCount = nfe.itens.filter((it) => !existeNoCatalogo(it)).length;
  const importando = status === "importando";
  const feito = status === "ok" || status === "jaImportada";

  const colunas: Coluna<NfeItem & { id: string }>[] = [
    { chave: "cod", cabecalho: "Cód.", render: (it) => <span className="font-mono text-xs">{it.cProd}</span> },
    {
      chave: "prod",
      cabecalho: "Produto",
      render: (it) => (
        <div>
          <p className="font-medium">{it.xProd}</p>
          <p className="text-xs text-[var(--muted)]">GTIN {it.cEAN || "—"} · NCM {it.ncm || "—"} · CFOP {it.cfop || "—"}</p>
        </div>
      ),
    },
    { chave: "un", cabecalho: "Un.", render: (it) => it.uCom },
    { chave: "qtd", cabecalho: "Qtd.", alinhar: "right", render: (it) => it.qCom.toLocaleString("pt-BR") },
    { chave: "vun", cabecalho: "Vlr. unit.", alinhar: "right", render: (it) => formatBRL(it.vUnCom) },
    { chave: "vtot", cabecalho: "Total", alinhar: "right", render: (it) => <span className="font-medium">{formatBRL(it.vProd)}</span> },
    // Coluna novo/já cadastrado só faz sentido na entrada (produtos são criados).
    ...(entrada
      ? [{
          chave: "status",
          cabecalho: "",
          alinhar: "center" as const,
          render: (it: NfeItem) =>
            existeNoCatalogo(it) ? <Badge tom="neutral">já cadastrado</Badge> : <Badge tom="success">novo</Badge>,
        }]
      : []),
  ];
  const dadosTabela = nfe.itens.map((it) => ({ ...it, id: String(it.nItem) }));

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho compacto da nota */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={"shrink-0 text-[var(--muted)] transition-transform " + (nota.aberta ? "rotate-90" : "")}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-semibold">
              <TipoBadge tipo={tipo} />
              {(entrada ? nfe.emitente.nome : nfe.destinatario.nome) || nfe.emitente.nome || nota.arquivo}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              NF {nfe.numero || "—"}/{nfe.serie || "—"} · {nfe.itens.length} item(ns)
              {entrada ? ` · ${novosCount} novo(s)` : ""} · {formatBRL(nfe.valorNota)}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} tipo={tipo} />
          {!feito && (
            <Button onClick={onImportar} disabled={importando || ocupado || analisando}>
              {importando ? "Importando…" : analisando ? "Analisando…" : entrada ? "Dar entrada" : "Importar"}
            </Button>
          )}
          {!feito && !importando && (
            <Button variante="secondary" onClick={onRemover}>Remover</Button>
          )}
        </div>
      </div>

      {nota.aberta && (
        <>
          <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] p-4 text-sm sm:grid-cols-4">
            {entrada ? (
              <Info rotulo="Fornecedor" valor={`${nfe.emitente.nome || "—"} · ${nfe.emitente.documento || "—"}`} className="sm:col-span-2" />
            ) : (
              <Info rotulo="Cliente" valor={`${nfe.destinatario.nome || "—"} · ${nfe.destinatario.documento || "—"}`} className="sm:col-span-2" />
            )}
            <Info rotulo="Modelo" valor={nfe.modelo || "—"} />
            <Info rotulo="Emissão" valor={nfe.dhEmi ? formatData(nfe.dhEmi) : "—"} />
            <Info rotulo="Chave de acesso" valor={nfe.chave || "—"} mono className="col-span-2 sm:col-span-4" />
          </div>
          <Tabela
            colunas={colunas}
            dados={dadosTabela}
            vazio={<EmptyState titulo="Sem itens" descricao="A nota não possui produtos." />}
          />
        </>
      )}

      {status === "ok" && nota.resultado && (
        <div className="border-t border-[var(--border)] bg-[var(--success-soft)] px-4 py-3 text-sm text-slate-600">
          {nota.resultado.atualizados} atualizado(s) · {nota.resultado.criados} criado(s)
          {nota.resultado.ignorados > 0 && ` · ${nota.resultado.ignorados} ignorado(s)`}
        </div>
      )}
      {status === "ok" && nota.outcome && (
        <div className="border-t border-[var(--border)] bg-[var(--success-soft)] px-4 py-3 text-sm text-slate-600">
          {nota.outcome}
        </div>
      )}
      {status === "jaImportada" && (
        <div className="border-t border-[var(--border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
          {entrada
            ? "Esta nota já teve entrada lançada — não foi lançada de novo (evita duplicar)."
            : "Esta nota já foi importada — não foi trazida de novo (evita duplicar)."}
        </div>
      )}
      {status === "erro" && erro && (
        <div className="border-t border-[var(--border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {erro}
        </div>
      )}
    </Card>
  );
}

function TipoBadge({ tipo }: { tipo: Tipo | null }) {
  if (tipo === "entrada") return <Badge tom="primary">entrada</Badge>;
  if (tipo === "saida") return <Badge tom="primary">saída</Badge>;
  return <Badge tom="neutral">analisando…</Badge>;
}

function StatusBadge({ status, tipo }: { status: StatusNota; tipo: Tipo | null }) {
  const entrada = tipo === "entrada";
  if (status === "ok") return <Badge tom="success">{entrada ? "lançada" : "importada"}</Badge>;
  if (status === "jaImportada") return <Badge tom="warning">já importada</Badge>;
  if (status === "erro") return <Badge tom="danger">erro</Badge>;
  if (status === "importando") return <Badge tom="neutral">importando…</Badge>;
  return null; // pendente/analisando já sinalizado pelo TipoBadge + botão
}

function Info({
  rotulo,
  valor,
  mono,
  className = "",
}: {
  rotulo: string;
  valor: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{rotulo}</p>
      <p className={"mt-0.5 break-all font-medium " + (mono ? "font-mono text-xs" : "")}>{valor}</p>
    </div>
  );
}
