"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export type Aba = { id: string; label: string; content: ReactNode };

export default function Tabs({
  abas,
  idInicial,
  alturaConteudo,
}: {
  abas: Aba[];
  idInicial?: string;
  /** Altura fixa da área de conteúdo (ex.: "360px"). Mantém o modal estável entre abas. */
  alturaConteudo?: string;
}) {
  const [ativa, setAtiva] = useState(idInicial ?? abas[0]?.id);
  const indice = abas.findIndex((a) => a.id === ativa);

  return (
    <div>
      <div className="relative flex gap-1 border-b border-[var(--border)]">
        {abas.map((a) => {
          const sel = a.id === ativa;
          return (
            <button
              key={a.id}
              onClick={() => setAtiva(a.id)}
              className={
                "relative cursor-pointer px-4 py-2.5 text-sm font-medium transition-colors " +
                (sel ? "text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]")
              }
            >
              {a.label}
              {sel && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        className="relative overflow-y-auto overflow-x-hidden pt-5"
        style={alturaConteudo ? { height: alturaConteudo } : undefined}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={ativa}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
          >
            {abas[indice]?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
