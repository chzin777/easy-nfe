"use client";

import { useRef, useState } from "react";
import Flutuante from "@/app/ui/Flutuante";
import { formatBRL } from "@/lib/format";
import type { Produto } from "@/lib/types";
import NovoProdutoModal from "@/app/produtos/NovoProdutoModal";

export default function ProdutoPicker({
  produtos,
  value,
  onChange,
  onCriado,
}: {
  produtos: Produto[];
  value: string;
  onChange: (id: string) => void;
  onCriado: (p: Produto) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const sel = produtos.find((p) => p.id === value);
  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? produtos.filter((p) => p.nome.toLowerCase().includes(q) || p.codigoBarras.toLowerCase().includes(q) || p.ncm.includes(q) || String(p.codigoInterno).includes(q))
    : produtos;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          "flex w-full items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-left text-sm transition " +
          (aberto ? "border-[var(--primary)]" : "border-[var(--border)] hover:border-slate-300")
        }
      >
        <span className={sel ? "font-medium" : "text-slate-400"}>
          {sel ? `${sel.codigoInterno} · ${sel.nome}` : "Selecione ou pesquise o produto…"}
        </span>
        <svg className={"shrink-0 text-slate-400 transition-transform " + (aberto ? "rotate-180" : "")} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      <Flutuante anchorRef={btnRef} aberto={aberto} onFechar={() => setAberto(false)}>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-xl">
          <div className="border-b border-[var(--border)] p-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, GTIN, NCM ou código…"
              className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-[var(--muted)]">Nenhum produto encontrado.</li>
            ) : (
              filtrados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(p.id); setAberto(false); setBusca(""); }}
                    className={"flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 " + (p.id === value ? "bg-[var(--primary-soft)]" : "")}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{p.codigoInterno} · {p.nome}</span>
                      <span className="text-xs text-[var(--muted)]">NCM {p.ncm || "—"}</span>
                    </span>
                    <span className="text-xs font-medium">{formatBRL(p.preco)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => { setModal(true); setAberto(false); }}
            className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Cadastrar novo produto
          </button>
        </div>
      </Flutuante>

      {modal && <NovoProdutoModal onFechar={() => setModal(false)} onCriado={(p) => { setModal(false); onCriado(p); }} />}
    </div>
  );
}
