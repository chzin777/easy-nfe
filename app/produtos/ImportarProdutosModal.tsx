"use client";

import { useRef, useState } from "react";
import Modal from "@/app/ui/Modal";
import { Button } from "@/app/ui/primitives";
import { formatBRL } from "@/lib/format";
import {
  COLUNAS_MODELO,
  mapaColunas,
  norm,
  validarLinha,
  type LinhaValidada,
  type ProdutoImport,
} from "@/lib/produtos-modelo";
import { importarProdutos } from "./actions";

type Fase = "inicio" | "lendo" | "preview" | "importando" | "fim";

export default function ImportarProdutosModal({
  onFechar,
  onImportado,
}: {
  onFechar: () => void;
  onImportado: () => void;
}) {
  const [fase, setFase] = useState<Fase>("inicio");
  const [linhas, setLinhas] = useState<LinhaValidada[]>([]);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [resultado, setResultado] = useState<{ criados: number; ignorados: number; erros: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validas = linhas.filter((l) => l.erros.length === 0);
  const comErro = linhas.length - validas.length;

  // ---- Modelo (download) ------------------------------------------------
  async function baixarModelo(tipo: "xlsx" | "csv") {
    const XLSX = await import("xlsx");
    const headers = COLUNAS_MODELO.map((c) => c.header);
    const exemplo = COLUNAS_MODELO.map((c) => c.exemplo);
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    if (tipo === "xlsx") {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Produtos");
      XLSX.writeFile(wb, "modelo-produtos.xlsx");
    } else {
      // CSV com ; (padrão BR) e BOM para o Excel respeitar acentos.
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      baixarBlob(blob, "modelo-produtos.csv");
    }
  }

  function baixarBlob(blob: Blob, nome: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Leitura do arquivo ----------------------------------------------
  async function aoEscolher(file: File) {
    setErroArquivo(null);
    setNomeArquivo(file.name);
    setFase("lendo");
    try {
      const XLSX = await import("xlsx");
      const ehCsv = /\.csv$/i.test(file.name);
      let wb;
      if (ehCsv) {
        const texto = await file.text();
        wb = XLSX.read(texto, { type: "string", raw: false });
      } else {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type: "array", raw: false });
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia.");
      const matriz = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false, blankrows: false });
      if (matriz.length < 2) throw new Error("Arquivo sem linhas de dados (precisa do cabeçalho + ao menos 1 produto).");

      const mapa = mapaColunas();
      const cabecalho = matriz[0].map((h) => mapa.get(norm(String(h))) ?? null);
      if (!cabecalho.some((k) => k === "nome")) {
        throw new Error('Cabeçalho não reconhecido. Use o modelo padrão (precisa ter ao menos a coluna "Nome").');
      }

      const validadas: LinhaValidada[] = [];
      for (let r = 1; r < matriz.length; r++) {
        const linha = matriz[r];
        if (!linha || linha.every((c) => String(c).trim() === "")) continue; // pula vazias
        const bruto: Partial<Record<keyof ProdutoImport, string>> = {};
        cabecalho.forEach((key, col) => {
          if (key) bruto[key] = String(linha[col] ?? "");
        });
        validadas.push(validarLinha(bruto, validadas.length + 1));
      }
      if (!validadas.length) throw new Error("Nenhuma linha de produto encontrada.");
      setLinhas(validadas);
      setFase("preview");
    } catch (e) {
      setErroArquivo(e instanceof Error ? e.message : String(e));
      setFase("inicio");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // ---- Importar ---------------------------------------------------------
  async function importar() {
    setFase("importando");
    const r = await importarProdutos(validas.map((l) => l.produto));
    setResultado(r);
    setFase("fim");
  }

  // ---- UI ---------------------------------------------------------------
  const rodape =
    fase === "preview" ? (
      <div className="flex w-full items-center justify-between">
        <Button variante="secondary" onClick={() => { setFase("inicio"); setLinhas([]); }}>Trocar arquivo</Button>
        <Button onClick={importar} disabled={validas.length === 0}>
          Importar {validas.length} produto{validas.length === 1 ? "" : "s"}
        </Button>
      </div>
    ) : fase === "fim" ? (
      <Button onClick={() => { onImportado(); onFechar(); }}>Concluir</Button>
    ) : undefined;

  return (
    <Modal
      aberto
      onFechar={fase === "importando" ? () => {} : onFechar}
      titulo="Importar produtos"
      largura="max-w-3xl"
      rodape={rodape}
    >
      {fase === "inicio" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4 text-sm">
            <p className="font-semibold">1. Baixe o modelo padrão</p>
            <p className="mt-1 text-[var(--muted)]">Preencha uma linha por produto. Colunas obrigatórias: <b>Nome</b>, <b>Unidade</b>, <b>NCM</b>, <b>Origem</b> e <b>Preço</b>.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variante="secondary" onClick={() => baixarModelo("xlsx")}>⬇ Modelo .xlsx</Button>
              <Button variante="secondary" onClick={() => baixarModelo("csv")}>⬇ Modelo .csv</Button>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm font-semibold">2. Envie o arquivo preenchido</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Aceita .xlsx, .xls ou .csv</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolher(f); }}
            />
            <Button className="mt-3" onClick={() => inputRef.current?.click()}>Escolher arquivo</Button>
            {erroArquivo && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{erroArquivo}</p>}
          </div>

          <details className="text-xs text-[var(--muted)]">
            <summary className="cursor-pointer font-medium">Colunas do modelo</summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {COLUNAS_MODELO.map((c) => (
                <li key={c.key}>
                  <b>{c.header}</b>{c.obrigatorio ? " *" : ""}{c.exemplo ? ` — ex.: ${c.exemplo}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {fase === "lendo" && (
        <div className="flex items-center gap-3 py-10 text-sm text-[var(--muted)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          Lendo {nomeArquivo}…
        </div>
      )}

      {fase === "preview" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{nomeArquivo}</span>
            <span className="rounded-full bg-[var(--success-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--success)]">{validas.length} prontos</span>
            {comErro > 0 && <span className="rounded-full bg-[var(--danger-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--danger)]">{comErro} com erro</span>}
          </div>

          <div className="max-h-[360px] overflow-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Un.</th>
                  <th className="px-3 py-2">NCM</th>
                  <th className="px-3 py-2 text-right">Preço</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const ok = l.erros.length === 0;
                  return (
                    <tr key={l.linha} className={"border-b border-[var(--border)] last:border-0 " + (ok ? "" : "bg-[var(--danger-soft)]/40")}>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{l.linha}</td>
                      <td className="px-3 py-2 font-medium">{l.produto.nome || <span className="text-[var(--danger)]">(vazio)</span>}</td>
                      <td className="px-3 py-2">{l.produto.unidade}</td>
                      <td className="px-3 py-2 font-mono text-xs">{l.produto.ncm || "—"}</td>
                      <td className="px-3 py-2 text-right">{formatBRL(l.produto.preco)}</td>
                      <td className="px-3 py-2 text-xs">
                        {ok ? (
                          l.avisos.length ? (
                            <span className="text-[var(--warning)]" title={l.avisos.join(" ")}>⚠ {l.avisos.length} aviso(s)</span>
                          ) : (
                            <span className="text-[var(--success)]">✓ ok</span>
                          )
                        ) : (
                          <span className="text-[var(--danger)]">{l.erros.join(" ")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {comErro > 0 && <p className="text-xs text-[var(--muted)]">Linhas com erro serão ignoradas na importação.</p>}
        </div>
      )}

      {fase === "importando" && (
        <div className="flex items-center gap-3 py-10 text-sm text-[var(--muted)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          Importando produtos…
        </div>
      )}

      {fase === "fim" && resultado && (
        <div className="space-y-3 py-2 text-sm">
          <div className="flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-3 py-2.5 font-medium text-[var(--success)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {resultado.criados} produto(s) importado(s).
          </div>
          {resultado.ignorados > 0 && (
            <p className="text-[var(--muted)]">{resultado.ignorados} linha(s) ignorada(s) por erro.</p>
          )}
          {resultado.erros.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--border)] p-3 text-xs text-[var(--danger)]">
              {resultado.erros.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
