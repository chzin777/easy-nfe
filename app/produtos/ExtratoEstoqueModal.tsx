"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/ui/Modal";
import { Badge, EmptyState, formatData } from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import { listarMovimentosEstoque, type MovimentoEstoqueRow } from "./actions";

const ROTULO: Record<MovimentoEstoqueRow["tipo"], { label: string; tom: "success" | "danger" | "warning" | "neutral"; sinal: string }> = {
  ENTRADA: { label: "Entrada", tom: "success", sinal: "+" },
  DEVOLUCAO: { label: "Devolução", tom: "success", sinal: "+" },
  SAIDA: { label: "Saída", tom: "danger", sinal: "−" },
  AJUSTE: { label: "Ajuste", tom: "warning", sinal: "" },
};

export default function ExtratoEstoqueModal({
  produtoId,
  nome,
  onFechar,
}: {
  produtoId: string;
  nome: string;
  onFechar: () => void;
}) {
  const [movs, setMovs] = useState<MovimentoEstoqueRow[] | null>(null);

  useEffect(() => {
    void listarMovimentosEstoque(produtoId).then(setMovs);
  }, [produtoId]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

  return (
    <Modal aberto onFechar={onFechar} titulo={`Extrato de estoque · ${nome}`} largura="max-w-2xl">
      {movs === null ? (
        <div className="flex justify-center py-10"><LightningLoader /></div>
      ) : movs.length === 0 ? (
        <EmptyState titulo="Sem movimentações" descricao="Ainda não há entradas, saídas ou ajustes para este produto." />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {movs.map((m) => {
            const r = ROTULO[m.tipo];
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tom={r.tom}>{r.label}</Badge>
                    <span className="truncate text-sm text-[var(--muted)]">{m.motivo || "—"}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{formatData(m.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={"font-medium " + (m.tipo === "SAIDA" ? "text-[var(--danger)]" : m.tipo === "AJUSTE" ? "text-[var(--warning)]" : "text-[var(--success)]")}>
                    {r.sinal}{fmt(m.quantidade)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">saldo {fmt(m.saldoApos)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
