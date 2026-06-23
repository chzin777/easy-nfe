"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/format";
import type { OrcamentoCompleto, StatusOrcamentoUI } from "./actions";

// Colunas do funil (kanban). "cancelado" fica fora do quadro (terminal).
const COLUNAS: { status: StatusOrcamentoUI; titulo: string; cor: string }[] = [
  { status: "rascunho", titulo: "Rascunho", cor: "bg-slate-400" },
  { status: "enviado", titulo: "Enviado", cor: "bg-sky-500" },
  { status: "negociacao", titulo: "Em negociação", cor: "bg-amber-500" },
  { status: "aprovado", titulo: "Aprovado", cor: "bg-violet-500" },
  { status: "fechado", titulo: "Fechado", cor: "bg-emerald-500" },
  { status: "perdido", titulo: "Perdido", cor: "bg-rose-500" },
];

export default function Kanban({
  orcamentos,
  onMover,
  onAbrir,
}: {
  orcamentos: OrcamentoCompleto[];
  onMover: (id: string, status: StatusOrcamentoUI) => void;
  onAbrir: (o: OrcamentoCompleto) => void;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [over, setOver] = useState<StatusOrcamentoUI | null>(null);

  function soltar(status: StatusOrcamentoUI) {
    setOver(null);
    const id = arrastando;
    setArrastando(null);
    if (id) onMover(id, status);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUNAS.map((col) => {
        const cards = orcamentos.filter((o) => o.status === col.status);
        const total = cards.reduce((s, o) => s + o.valorTotal, 0);
        return (
          <div
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); setOver(col.status); }}
            onDragLeave={() => setOver((v) => (v === col.status ? null : v))}
            onDrop={() => soltar(col.status)}
            className={
              "flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50/60 " +
              (over === col.status ? "border-[var(--primary)] ring-2 ring-[var(--primary-soft)]" : "border-[var(--border)]")
            }
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={"h-2.5 w-2.5 rounded-full " + col.cor} />
                <span className="text-sm font-semibold">{col.titulo}</span>
                <span className="rounded-full bg-slate-200 px-1.5 text-xs text-slate-600">{cards.length}</span>
              </div>
              <span className="text-[11px] text-[var(--muted)]">{formatBRL(total)}</span>
            </div>

            <div className="flex min-h-[120px] flex-col gap-2 px-2 pb-3">
              {cards.map((o) => (
                <button
                  key={o.id}
                  draggable
                  onDragStart={() => setArrastando(o.id)}
                  onDragEnd={() => { setArrastando(null); setOver(null); }}
                  onClick={() => onAbrir(o)}
                  className={
                    "cursor-grab rounded-lg border border-[var(--border)] bg-white p-3 text-left shadow-sm transition hover:shadow-md active:cursor-grabbing " +
                    (arrastando === o.id ? "opacity-40" : "")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--muted)]">#{o.numero}</span>
                    <span className="text-sm font-bold text-[var(--primary)]">{formatBRL(o.valorTotal)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{o.clienteNome}</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {o.itens.length} {o.itens.length === 1 ? "item" : "itens"}
                    {o.validade ? ` · vence ${o.validade.split("-").reverse().join("/")}` : ""}
                  </p>
                </button>
              ))}
              {cards.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-[var(--muted)]">Arraste aqui</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
