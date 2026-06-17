"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

// Renderiza um painel flutuante ancorado a um elemento, via portal no body.
// Escapa de containers com overflow:hidden / stacking (ex.: Stepper).
export default function Flutuante({
  anchorRef,
  aberto,
  onFechar,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const atualizar = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    };
    atualizar();
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);
    function fora(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onFechar();
    }
    document.addEventListener("mousedown", fora);
    return () => {
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
      document.removeEventListener("mousedown", fora);
    };
  }, [aberto, anchorRef, onFechar]);

  if (!aberto || !rect) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 1000 }}
    >
      {children}
    </div>,
    document.body,
  );
}
