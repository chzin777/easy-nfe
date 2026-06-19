"use client";

import { useRef, useState } from "react";
import { buscarNcm, type NcmSugestao } from "./actions";
import LightningLoader from "@/app/ui/LightningLoader";
import Modal from "@/app/ui/Modal";

// Formata 8 dígitos como 0000.00.00 para exibição.
function fmt(ncm: string) {
  const d = ncm.replace(/\D/g, "");
  if (d.length !== 8) return ncm;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
}

// Campo de NCM com busca pelo nome do produto (BrasilAPI), em modal.
export default function NcmPicker({
  value,
  onChange,
  nomeProduto,
}: {
  value: string;
  onChange: (v: string) => void;
  nomeProduto: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [res, setRes] = useState<NcmSugestao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Agenda a busca com debounce (chamado a partir de eventos, não de effect).
  function agendar(q: string) {
    if (timer.current) clearTimeout(timer.current);
    const termoLimpo = q.trim();
    if (termoLimpo.length < 2) { setRes([]); setBuscou(false); setCarregando(false); return; }
    setCarregando(true);
    const id = ++reqId.current;
    timer.current = setTimeout(async () => {
      const r = await buscarNcm(termoLimpo);
      if (id !== reqId.current) return; // ignora resposta obsoleta
      setRes(r);
      setBuscou(true);
      setCarregando(false);
    }, 450);
  }

  function aoDigitar(v: string) {
    setTermo(v);
    agendar(v);
  }

  function abrir() {
    const t = nomeProduto.trim();
    setTermo(t);
    setAberto(true);
    agendar(t);
  }

  const inputBase =
    "w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none transition-all " +
    "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)] hover:border-slate-300";

  return (
    <>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
          inputMode="numeric"
          placeholder="00000000"
          className={inputBase + " flex-1"}
        />
        <button
          type="button"
          onClick={abrir}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 text-sm font-medium text-[var(--primary)] transition hover:bg-violet-100"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          Buscar
        </button>
      </div>

      <Modal aberto={aberto} onFechar={() => setAberto(false)} titulo="Buscar NCM pelo nome" largura="max-w-lg">
        <input
          autoFocus
          value={termo}
          onChange={(e) => aoDigitar(e.target.value)}
          placeholder="Descreva o produto (ex.: camiseta algodão)"
          className={inputBase}
        />

        <div className="mt-3 min-h-[180px]">
          {carregando ? (
            <LightningLoader size={40} texto="Buscando NCMs…" />
          ) : res.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              {buscou ? "Nenhum NCM encontrado. Tente outro termo." : "Digite um termo para buscar."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {res.map((n) =>
                n.completo ? (
                  <li key={n.codigo}>
                    <button
                      type="button"
                      onClick={() => { onChange(n.codigo); setAberto(false); }}
                      className={
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 " +
                        (n.codigo === value ? "bg-[var(--primary-soft)]" : "")
                      }
                    >
                      <span className="shrink-0 font-mono text-sm font-semibold text-[var(--primary)]">{fmt(n.codigo)}</span>
                      <span className="text-xs text-[var(--muted)]">{n.descricao}</span>
                    </button>
                  </li>
                ) : (
                  <li key={n.codigo} className="flex items-start gap-3 px-3 py-2 opacity-70">
                    <span className="shrink-0 font-mono text-xs font-medium text-slate-500">{n.codigo}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {n.descricao}
                      <span className="ml-1 italic text-slate-400">· posição geral, refine o termo</span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-[var(--muted)]">
          Sugestões da tabela oficial NCM. Confira o código antes de salvar — a classificação fiscal é de responsabilidade do emitente.
        </p>
      </Modal>
    </>
  );
}
