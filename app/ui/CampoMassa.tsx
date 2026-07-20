"use client";

import type { ReactNode } from "react";

// Campo de edição em massa: só entra no patch quando marcado. Sem a marcação,
// o valor atual de cada registro fica intacto.
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
    <div
      className={
        "rounded-lg border p-3 transition-colors " +
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
        {label}
        <span className="ml-auto text-xs font-normal text-[var(--muted)]">alterar este campo</span>
      </label>
      {ativo && <div className="mt-2.5">{children}</div>}
    </div>
  );
}
