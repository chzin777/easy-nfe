"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  Tabela,
  formatBRL,
  formatData,
  type Coluna,
} from "@/app/ui/primitives";
import { parseNFe, type NfeItem, type ParsedNFe } from "@/lib/nfe-parser";
import { listarProdutos, importarEntradaXml } from "@/app/produtos/actions";
import type { Produto } from "@/lib/types";

export default function ImportarPage() {
  const [nfe, setNfe] = useState<ParsedNFe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [catalogo, setCatalogo] = useState<Produto[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<
    { criados: number; atualizados: number; ignorados: number } | null
  >(null);
  const [jaImportada, setJaImportada] = useState(false);
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

  async function processarArquivo(file: File) {
    setErro(null);
    setNfe(null);
    setResultado(null);
    setJaImportada(false);
    setArquivo(file.name);
    try {
      const texto = await file.text();
      setNfe(parseNFe(texto));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler o XML.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const file = e.dataTransfer.files[0];
    if (file) processarArquivo(file);
  }

  // Dá entrada no estoque: casa por GTIN/nome, cria os que faltam, soma a qtd.
  async function darEntrada() {
    if (!nfe) return;
    setImportando(true);
    setErro(null);
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
    setImportando(false);
    if (r.ok) {
      setResultado({ criados: r.criados, atualizados: r.atualizados, ignorados: r.ignorados });
      await recarregarCatalogo();
    } else if (r.jaImportada) {
      setJaImportada(true);
    } else {
      setErro(r.erro);
    }
  }

  function limpar() {
    setNfe(null);
    setErro(null);
    setArquivo(null);
    setResultado(null);
    setJaImportada(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const novosCount = nfe ? nfe.itens.filter((it) => !existeNoCatalogo(it)).length : 0;

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
    {
      chave: "status",
      cabecalho: "",
      alinhar: "center",
      render: (it) =>
        existeNoCatalogo(it) ? (
          <Badge tom="neutral">já cadastrado</Badge>
        ) : (
          <Badge tom="success">novo</Badge>
        ),
    },
  ];

  const dadosTabela = nfe?.itens.map((it) => ({ ...it, id: String(it.nItem) })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Importar XML / DANFE"
        subtitulo="Leia o XML de uma NF-e recebida para cadastrar produtos e gerar nota de entrada."
        acao={nfe ? <Button variante="secondary" onClick={limpar}>Importar outro</Button> : undefined}
      />

      {!nfe && !erro && (
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
            className="flex cursor-pointer flex-col items-center justify-center gap-3 px-6 py-16 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-lg">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">Arraste o arquivo XML aqui ou clique para selecionar</p>
              <p className="mt-1 text-sm text-[var(--muted)]">XML de NF-e (modelo 55) ou NFC-e (modelo 65)</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processarArquivo(f); }}
            />
          </label>
        </Card>
      )}

      {erro && (
        <Card className="border-[var(--danger)]/30 bg-[var(--danger-soft)] p-5">
          <p className="text-sm font-medium text-[var(--danger)]">Erro ao importar {arquivo && `“${arquivo}”`}</p>
          <p className="mt-1 text-sm text-slate-600">{erro}</p>
          <Button variante="secondary" className="mt-3" onClick={limpar}>Tentar outro arquivo</Button>
        </Card>
      )}

      {nfe && (
        <>
          {/* Cabeçalho da NF-e */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionTitle>NF-e recebida</SectionTitle>
                <p className="text-lg font-semibold">{nfe.emitente.nome || "—"}</p>
                <p className="text-sm text-[var(--muted)]">
                  {nfe.emitente.documento} · {nfe.emitente.municipio}/{nfe.emitente.uf}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Valor total</p>
                <p className="text-2xl font-semibold text-[var(--primary)]">{formatBRL(nfe.valorNota)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-4">
              <Info rotulo="Número / Série" valor={`${nfe.numero || "—"} / ${nfe.serie || "—"}`} />
              <Info rotulo="Modelo" valor={nfe.modelo || "—"} />
              <Info rotulo="Emissão" valor={nfe.dhEmi ? formatData(nfe.dhEmi) : "—"} />
              <Info rotulo="Itens" valor={String(nfe.itens.length)} />
              <Info rotulo="Natureza da operação" valor={nfe.natOp || "—"} className="sm:col-span-2" />
              <Info rotulo="Chave de acesso" valor={nfe.chave || "—"} mono className="sm:col-span-2" />
            </div>
          </Card>

          {/* Itens */}
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <p className="text-sm font-semibold">
                Produtos da nota{" "}
                <span className="font-normal text-[var(--muted)]">
                  · {novosCount} novo(s), {nfe.itens.length - novosCount} já cadastrado(s)
                </span>
              </p>
              <Button onClick={darEntrada} disabled={importando || jaImportada}>
                {importando ? "Lançando…" : jaImportada ? "Já lançada" : "Dar entrada no estoque"}
              </Button>
            </div>
            <Tabela
              colunas={colunas}
              dados={dadosTabela}
              vazio={<EmptyState titulo="Sem itens" descricao="A nota não possui produtos." />}
            />
          </Card>

          {/* Resultado da entrada */}
          {resultado && (
            <Card className="border-[var(--success)]/30 bg-[var(--success-soft)] p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Entrada lançada no estoque
              </p>
              <p className="mt-1.5 text-sm text-slate-600">
                {resultado.atualizados} produto(s) atualizado(s) · {resultado.criados} criado(s)
                {resultado.ignorados > 0 && ` · ${resultado.ignorados} ignorado(s)`}
              </p>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Produtos sem cadastro foram criados com controle de estoque ativo. Reimportar esta
                nota não duplica o estoque.
              </p>
            </Card>
          )}

          {jaImportada && (
            <Card className="border-[var(--warning)]/30 bg-[var(--warning-soft)] p-5">
              <p className="text-sm font-medium text-[var(--warning)]">
                Esta nota já teve entrada lançada no estoque — não foi lançada de novo (evita duplicar).
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
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
