"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

// Campo de edição em massa: só entra no patch quando marcado. Sem a marcação,
// o valor atual de cada registro fica intacto.
//
// O conteúdo abre e fecha animado: marcar um campo aqui tem consequência real
// (vai sobrescrever N registros de uma vez), então o movimento serve de
// confirmação visual em vez de o controle simplesmente aparecer do nada.
export default function CampoMassa({
  label,
  ativo,
  onAtivo,
  children,
}: {
  label: string;
  ativo: boolean;
  onAtivo: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      layout
      // Um pulso curto ao marcar: confirma o clique sem competir com a
      // abertura do conteúdo logo abaixo.
      animate={ativo ? { scale: [1, 1.015, 1] } : { scale: 1 }}
      transition={{ layout: { type: "spring", stiffness: 400, damping: 32 }, duration: 0.28 }}
      className={
        "overflow-hidden rounded-lg border p-3 transition-colors " +
        (ativo ? "border-[var(--primary)] bg-[var(--primary-soft)]/30" : "border-[var(--border)]")
      }
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => onAtivo(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
        />
        <span className={"transition-colors " + (ativo ? "text-[var(--primary)]" : "")}>{label}</span>
        <span className="ml-auto text-xs font-normal text-[var(--muted)]">
          {ativo ? "será alterado" : "alterar este campo"}
        </span>
      </label>

      <AnimatePresence initial={false}>
        {ativo && (
          <motion.div
            key="conteudo"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 420, damping: 34 },
              opacity: { duration: 0.15 },
            }}
            className="overflow-hidden"
          >
            {/* Padding no filho: animar a altura de um nó que também tem padding
                faz o conteúdo saltar no fim da transição. */}
            <div className="pt-2.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
