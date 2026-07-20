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

  // Como o painel é position:fixed, o que passar do viewport fica inacessível
  // (rolar a página só reposiciona a âncora). Então: escolhe o lado com mais
  // espaço e limita a altura ao que sobra, deixando o próprio painel rolar.
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const margem = 12;
  const abaixo = vh - rect.bottom - margem;
  const acima = rect.top - margem;
  const paraCima = abaixo < 240 && acima > abaixo;

  return createPortal(
    <div
      ref={panelRef}
      className="overscroll-contain"
      style={{
        position: "fixed",
        left: rect.left,
        width: rect.width,
        zIndex: 1000,
        maxHeight: Math.max(160, paraCima ? acima : abaixo),
        overflowY: "auto",
        ...(paraCima ? { bottom: vh - rect.top + 4 } : { top: rect.bottom + 4 }),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
