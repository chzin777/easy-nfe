"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import Modal from "@/app/ui/Modal";
import { Button } from "@/app/ui/primitives";

export type ColunaModelo = {
  key: string;
  header: string;
  obrigatorio: boolean;
  exemplo: string;
  aliases?: string[];
};

export type LinhaValidada<T> = {
  linha: number;
  item: T;
  erros: string[];
  avisos: string[];
};

export type ColunaPreview<T> = {
  label: string;
  alinhar?: "right";
  render: (item: T) => ReactNode;
};

type Props<T> = {
  titulo: string;
  nomeModelo: string; // ex.: "modelo-produtos"
  nomePlanilha: string; // aba do xlsx, ex.: "Produtos"
  // URL do modelo oficial (.xlsx em /public). Se setado, o botão "Modelo .xlsx" baixa esse arquivo.
  modeloUrl?: string;
  colunas: ColunaModelo[];
  // chave que precisa existir no cabeçalho p/ aceitar o arquivo (ex.: "nome").
  headerObrigatorio: string;
  validar: (bruto: Record<string, string>, linha: number) => LinhaValidada<T>;
  preview: ColunaPreview<T>[];
  obrigatoriasLabel: ReactNode; // descrição das colunas obrigatórias
  onImportar: (itens: T[]) => Promise<{ criados: number; ignorados: number; erros: string[] }>;
  onImportado: () => void;
  onFechar: () => void;
};

type Fase = "inicio" | "lendo" | "preview" | "importando" | "fim";

// Normaliza cabeçalho/valor p/ comparação (sem acento, sem símbolos decorativos, minúsculo).
function norm(s: string): string {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "") // remove ★, ⚡, *, etc.
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Linha de banner/instrução/rodapé do modelo oficial (não é dado).
function ehLinhaDecorativa(linha: unknown[]): boolean {
  const texto = linha.map((c) => String(c)).join(" ");
  return /easy-nfe/i.test(texto) || /★\s*=/.test(texto) || /campo obrigat[óo]rio/i.test(texto);
}

export default function ImportarPlanilhaModal<T>({
  titulo,
  nomeModelo,
  nomePlanilha,
  modeloUrl,
  colunas,
  headerObrigatorio,
  validar,
  preview,
  obrigatoriasLabel,
  onImportar,
  onImportado,
  onFechar,
}: Props<T>) {
  const [fase, setFase] = useState<Fase>("inicio");
  const [linhas, setLinhas] = useState<LinhaValidada<T>[]>([]);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [resultado, setResultado] = useState<{ criados: number; ignorados: number; erros: string[] } | null>(null);
  const [colsAberto, setColsAberto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validas = linhas.filter((l) => l.erros.length === 0);
  const comErro = linhas.length - validas.length;

  // Mapa headerNormalizado -> key (header, key e aliases).
  function mapaColunas(): Map<string, string> {
    const m = new Map<string, string>();
    for (const c of colunas) {
      m.set(norm(c.header), c.key);
      m.set(norm(c.key), c.key);
      for (const a of c.aliases ?? []) m.set(norm(a), c.key);
    }
    return m;
  }

  // ---- Modelo (download) ------------------------------------------------
  async function baixarModelo(tipo: "xlsx" | "csv") {
    // Modelo oficial: baixa o arquivo de /public direto.
    if (tipo === "xlsx" && modeloUrl) {
      const a = document.createElement("a");
      a.href = modeloUrl;
      a.download = `${nomeModelo}.xlsx`;
      a.click();
      return;
    }
    const XLSX = await import("xlsx");
    const headers = colunas.map((c) => c.header);
    const exemplo = colunas.map((c) => c.exemplo);
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    if (tipo === "xlsx") {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, nomePlanilha);
      XLSX.writeFile(wb, `${nomeModelo}.xlsx`);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nomeModelo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
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
      // Seleciona a aba pelo nome (ex.: "Produtos"); cai p/ a 1ª se não achar.
      const nomeAba =
        wb.SheetNames.find((n) => norm(n) === norm(nomePlanilha)) ?? wb.SheetNames[0];
      const ws = wb.Sheets[nomeAba];
      if (!ws) throw new Error("Planilha vazia.");
      const matriz = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false, blankrows: false });

      const mapa = mapaColunas();
      // Acha a linha de cabeçalho (o modelo oficial tem banner antes dela).
      let headerRow = -1;
      let cabecalho: (string | null)[] = [];
      for (let i = 0; i < matriz.length; i++) {
        const keys = (matriz[i] ?? []).map((h) => mapa.get(norm(String(h))) ?? null);
        if (keys.includes(headerObrigatorio)) {
          headerRow = i;
          cabecalho = keys;
          break;
        }
      }
      if (headerRow < 0) {
        throw new Error('Cabeçalho não reconhecido. Use o modelo padrão (precisa ao menos a coluna "Nome").');
      }

      const validadas: LinhaValidada<T>[] = [];
      for (let r = headerRow + 1; r < matriz.length; r++) {
        const linha = matriz[r];
        if (!linha || linha.every((c) => String(c).trim() === "")) continue;
        if (ehLinhaDecorativa(linha)) continue; // rodapé/instrução do modelo oficial
        const bruto: Record<string, string> = {};
        cabecalho.forEach((key, col) => {
          if (key) bruto[key] = String(linha[col] ?? "");
        });
        validadas.push(validar(bruto, validadas.length + 1));
      }
      if (!validadas.length) throw new Error("Nenhuma linha encontrada.");
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
    const r = await onImportar(validas.map((l) => l.item));
    setResultado(r);
    setFase("fim");
  }

  const rodape =
    fase === "preview" ? (
      <div className="flex w-full items-center justify-between">
        <Button variante="secondary" onClick={() => { setFase("inicio"); setLinhas([]); }}>Trocar arquivo</Button>
        <Button onClick={importar} disabled={validas.length === 0}>
          Importar {validas.length} registro{validas.length === 1 ? "" : "s"}
        </Button>
      </div>
    ) : fase === "fim" ? (
      <Button onClick={() => { onImportado(); onFechar(); }}>Concluir</Button>
    ) : undefined;

  return (
    <Modal aberto onFechar={fase === "importando" ? () => {} : onFechar} titulo={titulo} largura="max-w-3xl" rodape={rodape}>
      {fase === "inicio" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4 text-sm">
            <p className="font-semibold">1. Baixe o modelo padrão</p>
            <p className="mt-1 text-[var(--muted)]">Preencha uma linha por registro. Colunas obrigatórias: {obrigatoriasLabel}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variante="secondary" onClick={() => baixarModelo("xlsx")}>⬇ Modelo .xlsx</Button>
              <Button variante="secondary" onClick={() => baixarModelo("csv")}>⬇ Modelo .csv</Button>
            </div>
          </div>

          <div className="rounded-xl border-2 border-dashed border-[var(--border)] p-6 text-center">
            <p className="text-sm font-semibold">2. Envie o arquivo preenchido</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Aceita .xlsx, .xls ou .csv</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolher(f); }} />
            <Button className="mt-3" onClick={() => inputRef.current?.click()}>Escolher arquivo</Button>
            {erroArquivo && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{erroArquivo}</p>}
          </div>

          <div className="text-xs text-[var(--muted)]">
            <button type="button" onClick={() => setColsAberto((v) => !v)} aria-expanded={colsAberto} className="flex items-center gap-1.5 font-medium transition hover:text-[var(--foreground)]">
              <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" animate={{ rotate: colsAberto ? 90 : 0 }} transition={{ duration: 0.2 }}>
                <path d="m9 18 6-6-6-6" />
              </motion.svg>
              Colunas do modelo
            </button>
            <AnimatePresence initial={false}>
              {colsAberto && (
                <motion.div key="cols" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                    {colunas.map((c) => (
                      <li key={c.key}><b>{c.header}</b>{c.obrigatorio ? " *" : ""}{c.exemplo ? ` — ex.: ${c.exemplo}` : ""}</li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
                  {preview.map((c) => (
                    <th key={c.label} className={"px-3 py-2 " + (c.alinhar === "right" ? "text-right" : "")}>{c.label}</th>
                  ))}
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const ok = l.erros.length === 0;
                  return (
                    <tr key={l.linha} className={"border-b border-[var(--border)] last:border-0 " + (ok ? "" : "bg-[var(--danger-soft)]/40")}>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">{l.linha}</td>
                      {preview.map((c) => (
                        <td key={c.label} className={"px-3 py-2 " + (c.alinhar === "right" ? "text-right" : "")}>{c.render(l.item)}</td>
                      ))}
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
          Importando…
        </div>
      )}

      {fase === "fim" && resultado && (
        <div className="space-y-3 py-2 text-sm">
          <div className="flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-3 py-2.5 font-medium text-[var(--success)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {resultado.criados} registro(s) importado(s).
          </div>
          {resultado.ignorados > 0 && <p className="text-[var(--muted)]">{resultado.ignorados} linha(s) ignorada(s) por erro.</p>}
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
