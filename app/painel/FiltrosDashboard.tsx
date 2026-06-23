"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/app/ui/primitives";

const PERIODOS = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "ano", label: "Este ano" },
  { value: "tudo", label: "Todo o período" },
];
const MODELOS = [
  { value: "", label: "Todos os modelos" },
  { value: "55", label: "NF-e (modelo 55)" },
  { value: "65", label: "NFC-e (modelo 65)" },
];

// Filtros do dashboard. Atualizam a query string → a página (server component)
// recalcula o resumo conforme período e modelo.
export default function FiltrosDashboard({ periodo, modelo }: { periodo: string; modelo: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  function muda(chave: string, valor: string) {
    const p = new URLSearchParams(sp.toString());
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    router.push(`/painel?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-44">
        <Select opcoes={PERIODOS} value={periodo} onChange={(e) => muda("periodo", e.target.value)} />
      </div>
      <div className="w-48">
        <Select opcoes={MODELOS} value={modelo} onChange={(e) => muda("modelo", e.target.value)} />
      </div>
    </div>
  );
}
