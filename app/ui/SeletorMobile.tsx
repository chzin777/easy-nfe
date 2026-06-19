"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

// Bottom-sheet de seleção (mobile): busca no topo, lista de cards rolável,
// botão de cadastrar fixo no rodapé.
export default function SeletorMobile({
  aberto,
  onFechar,
  titulo,
  busca,
  onBusca,
  placeholder,
  children,
  onCadastrar,
  cadastrarLabel,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  busca: string;
  onBusca: (v: string) => void;
  placeholder: string;
  children: ReactNode;
  onCadastrar: () => void;
  cadastrarLabel: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <AnimatePresence>
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
          onClick={onFechar}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[85vh] flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl"
          >
            <div className="shrink-0 px-4 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{titulo}</h2>
                <button
                  onClick={onFechar}
                  aria-label="Fechar"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
              <input
                autoFocus
                value={busca}
                onChange={(e) => onBusca(e.target.value)}
                placeholder={placeholder}
                className="mt-3 w-full rounded-lg border border-[var(--border)] px-3.5 py-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)]"
              />
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">{children}</div>

            <div className="shrink-0 border-t border-[var(--border)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onCadastrar}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)] transition hover:bg-violet-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                {cadastrarLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Card de item reutilizado nos sheets (selecionável, com check).
export function CardItem({
  selecionado,
  onClick,
  titulo,
  subtitulo,
  direita,
}: {
  selecionado: boolean;
  onClick: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  direita?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition " +
        (selecionado ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] bg-white active:bg-slate-50")
      }
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo}</p>
        {subtitulo && <p className="truncate text-xs text-[var(--muted)]">{subtitulo}</p>}
      </div>
      {direita}
      {selecionado && (
        <svg className="shrink-0 text-[var(--primary)]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      )}
    </button>
  );
}
