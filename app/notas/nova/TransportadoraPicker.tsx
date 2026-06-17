"use client";

import { useRef, useState } from "react";
import Flutuante from "@/app/ui/Flutuante";
import type { Transportadora } from "@/lib/types";
import NovaTransportadoraModal from "@/app/transportadoras/NovaTransportadoraModal";

export default function TransportadoraPicker({
  transportadoras,
  value,
  onChange,
  onCriado,
  permitirNenhum = true,
}: {
  transportadoras: Transportadora[];
  value: string;
  onChange: (id: string) => void;
  onCriado: (t: Transportadora) => void;
  permitirNenhum?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const sel = transportadoras.find((t) => t.id === value);
  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? transportadoras.filter((t) => t.nome.toLowerCase().includes(q) || t.documento.toLowerCase().includes(q) || String(t.codigoInterno).includes(q))
    : transportadoras;

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
          {sel ? `${sel.codigoInterno} · ${sel.nome}` : permitirNenhum ? "Sem transporte / retirada" : "Selecione uma transportadora…"}
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
              placeholder="Buscar por nome, CPF/CNPJ ou código…"
              className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {permitirNenhum && (
              <li>
                <button
                  type="button"
                  onClick={() => { onChange(""); setAberto(false); setBusca(""); }}
                  className={"flex w-full px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-slate-50 " + (value === "" ? "bg-[var(--primary-soft)]" : "")}
                >
                  Sem transporte / retirada
                </button>
              </li>
            )}
            {filtrados.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => { onChange(t.id); setAberto(false); setBusca(""); }}
                  className={"flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 " + (t.id === value ? "bg-[var(--primary-soft)]" : "")}
                >
                  <span className="font-medium">{t.codigoInterno} · {t.nome}</span>
                  <span className="text-xs text-[var(--muted)]">{t.documento || "sem documento"}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => { setModal(true); setAberto(false); }}
            className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Cadastrar nova transportadora
          </button>
        </div>
      </Flutuante>

      {modal && <NovaTransportadoraModal onFechar={() => setModal(false)} onCriado={(t) => { setModal(false); onCriado(t); }} />}
    </div>
  );
}
