"use client";

import { useState } from "react";
import type { DescontoTipo } from "@/app/notas/actions";

// Componentes de item de nota/orçamento reutilizados na emissão e nos orçamentos.

// Seletor de quantidade: botões ± grandes + campo central editável que aceita
// decimais (vírgula). `casas` define quantas casas após a vírgula.
export function QtyStepper({
  valor,
  onChange,
  casas,
  compacto,
}: {
  valor: number;
  onChange: (valor: number) => void;
  casas: number;
  compacto?: boolean;
}) {
  const [foco, setFoco] = useState(false);
  const [txt, setTxt] = useState("");
  const passo = 1;
  const menor = casas > 0 ? Number(Math.pow(10, -casas).toFixed(casas)) : 1;
  const arr = (v: number) => Number(v.toFixed(casas));

  // Converte texto BR ("1,5" / "1.5") em número.
  function parse(s: string) {
    let c = s.replace(/[^\d.,]/g, "").replace(/\./g, ",");
    const p = c.split(",");
    c = p.shift()! + (p.length ? "," + p.join("") : "");
    c = c.replace(",", ".");
    return c === "" || c === "." ? 0 : Number(c);
  }

  const display = foco
    ? txt
    : valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

  const btn = compacto ? "h-8 w-8" : "h-12 w-12 sm:h-[46px] sm:w-11";
  const larguraNum = compacto ? "w-12" : "w-16";

  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(menor, arr(valor - passo)))}
        disabled={valor <= menor}
        aria-label="Diminuir"
        className={"flex items-center justify-center text-lg font-medium text-[var(--foreground)] transition hover:bg-slate-50 disabled:opacity-30 " + btn}
      >
        −
      </button>
      <input
        type="text"
        inputMode={casas > 0 ? "decimal" : "numeric"}
        value={display}
        onFocus={() => {
          setFoco(true);
          setTxt(valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas }));
        }}
        onChange={(e) => { setTxt(e.target.value); onChange(arr(parse(e.target.value))); }}
        onBlur={() => { setFoco(false); onChange(Math.max(menor, arr(parse(txt)))); }}
        className={"border-x border-[var(--border)] py-2 text-center text-sm font-semibold tabular-nums outline-none focus:bg-[var(--primary-soft)]/40 " + larguraNum}
      />
      <button
        type="button"
        onClick={() => onChange(arr(valor + passo))}
        aria-label="Aumentar"
        className={"flex items-center justify-center text-lg font-medium text-[var(--foreground)] transition hover:bg-slate-50 " + btn}
      >
        +
      </button>
    </div>
  );
}

// Desconto (R$ ou %) — botão alterna o tipo e o campo aceita decimais (vírgula BR).
export function DescInput({
  tipo,
  valor,
  onTipo,
  onValor,
}: {
  tipo: DescontoTipo;
  valor: number;
  onTipo: (t: DescontoTipo) => void;
  onValor: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white">
      <button
        type="button"
        onClick={() => onTipo(tipo === "valor" ? "percent" : "valor")}
        title="Alternar entre R$ e %"
        className="px-2.5 py-2 text-xs font-bold text-[var(--primary)] transition hover:bg-slate-50"
      >
        {tipo === "valor" ? "R$" : "%"}
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={valor ? String(valor).replace(".", ",") : ""}
        onChange={(e) => onValor(Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0)}
        placeholder="0"
        className="w-16 border-l border-[var(--border)] py-2 text-center text-sm tabular-nums outline-none focus:bg-[var(--primary-soft)]/40"
      />
    </div>
  );
}
