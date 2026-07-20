"use client";

import type { ReactNode } from "react";
import Modal from "@/app/ui/Modal";
import { Button } from "@/app/ui/primitives";

// Confirmação padrão do app (Sim / Não). Usado antes de qualquer ação
// destrutiva — exclusão individual ou em massa.
export default function ConfirmDialog({
  aberto,
  titulo = "Tem certeza?",
  mensagem,
  detalhe,
  confirmarLabel = "Sim, excluir",
  cancelarLabel = "Não",
  perigo = true,
  processando = false,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean;
  titulo?: string;
  mensagem: ReactNode;
  detalhe?: ReactNode;
  confirmarLabel?: string;
  cancelarLabel?: string;
  perigo?: boolean;
  processando?: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  return (
    <Modal
      aberto={aberto}
      onFechar={processando ? () => {} : onFechar}
      titulo={titulo}
      largura="max-w-md"
      camada="z-[60]"
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar} disabled={processando}>
            {cancelarLabel}
          </Button>
          <Button
            variante={perigo ? "danger" : "primary"}
            onClick={onConfirmar}
            disabled={processando}
            autoFocus
          >
            {processando ? "Aguarde…" : confirmarLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {perigo && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4" /><path d="M12 17h.01" />
            </svg>
          </div>
        )}
        <div className="space-y-1.5 pt-0.5">
          <p className="text-sm text-[var(--foreground)]">{mensagem}</p>
          {detalhe && <div className="text-xs text-[var(--muted)]">{detalhe}</div>}
          <p className="text-xs text-[var(--muted)]">Esta ação não pode ser desfeita.</p>
        </div>
      </div>
    </Modal>
  );
}
