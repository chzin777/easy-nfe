"use client";

import { useRef, useState } from "react";
import Flutuante from "@/app/ui/Flutuante";
import SeletorMobile, { CardItem } from "@/app/ui/SeletorMobile";
import { useIsMobile } from "@/app/ui/useIsMobile";
import type { Cliente } from "@/lib/types";
import NovoClienteModal from "@/app/clientes/NovoClienteModal";

export default function ClientePicker({
  clientes,
  value,
  onChange,
  onCriado,
}: {
  clientes: Cliente[];
  value: string;
  onChange: (id: string) => void;
  onCriado: (c: Cliente) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const sel = clientes.find((c) => c.id === value);
  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? clientes.filter((c) => c.nome.toLowerCase().includes(q) || c.documento.toLowerCase().includes(q) || String(c.codigoInterno).includes(q))
    : clientes;

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
          {sel ? `${sel.codigoInterno} · ${sel.nome}` : "Selecione ou pesquise o cliente…"}
        </span>
        <svg className={"shrink-0 text-slate-400 transition-transform " + (aberto ? "rotate-180" : "")} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {/* Desktop: popover ancorado */}
      {!isMobile && (
        <Flutuante anchorRef={btnRef} aberto={aberto} onFechar={() => setAberto(false)}>
          <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-xl">
            <div className="border-b border-[var(--border)] p-2">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CPF/CNPJ ou código…"
                className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtrados.length === 0 ? (
                <li className="px-3 py-3 text-center text-xs text-[var(--muted)]">Nenhum cliente encontrado.</li>
              ) : (
                filtrados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(c.id); setAberto(false); setBusca(""); }}
                      className={"flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 " + (c.id === value ? "bg-[var(--primary-soft)]" : "")}
                    >
                      <span className="font-medium">{c.codigoInterno} · {c.nome}</span>
                      <span className="text-xs text-[var(--muted)]">{c.documento || "sem documento"}</span>
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
              Cadastrar novo cliente
            </button>
          </div>
        </Flutuante>
      )}

      {/* Mobile: bottom-sheet com cards */}
      {isMobile && (
        <SeletorMobile
          aberto={aberto}
          onFechar={() => setAberto(false)}
          titulo="Selecionar cliente"
          busca={busca}
          onBusca={setBusca}
          placeholder="Buscar por nome, CPF/CNPJ ou código…"
          onCadastrar={() => { setModal(true); setAberto(false); }}
          cadastrarLabel="Cadastrar novo cliente"
        >
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">Nenhum cliente encontrado.</p>
          ) : (
            filtrados.map((c) => (
              <CardItem
                key={c.id}
                selecionado={c.id === value}
                onClick={() => { onChange(c.id); setAberto(false); setBusca(""); }}
                titulo={`${c.codigoInterno} · ${c.nome}`}
                subtitulo={c.documento || "sem documento"}
              />
            ))
          )}
        </SeletorMobile>
      )}

      {modal && (
        <NovoClienteModal
          onFechar={() => setModal(false)}
          onCriado={(c) => { setModal(false); onCriado(c); }}
        />
      )}
    </div>
  );
}
