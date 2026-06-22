"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Overlay para modais baseados em <Stepper>: o próprio card do Stepper é o
 * painel do modal (sem card-dentro-de-card). Fornece backdrop, botão fechar,
 * tecla Esc e trava de scroll do body.
 */
export default function StepperModal({
  onFechar,
  children,
  largura = "max-w-2xl",
}: {
  onFechar: () => void;
  children: ReactNode;
  largura?: string;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onFechar]);

  if (!montado) return null;

  // Portal no body: escapa de ancestrais com transform/overflow (ex.: abas
  // animadas), que quebrariam o position:fixed do overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className={"relative my-auto w-full " + largura}>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
