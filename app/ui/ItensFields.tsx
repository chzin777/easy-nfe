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

// Preço unitário editável na própria linha do item. O preço do cadastro é só o
// ponto de partida: quem emite ajusta na hora (mercado com preço volátil) sem
// precisar sair para editar o produto.
export function PrecoInput({
  valor,
  original,
  onChange,
  compacto,
}: {
  valor: number;
  original: number;
  onChange: (v: number) => void;
  compacto?: boolean;
}) {
  const [foco, setFoco] = useState(false);
  const [txt, setTxt] = useState("");
  const alterado = Number(valor.toFixed(2)) !== Number(original.toFixed(2));

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parse = (s: string) => {
    const limpo = s.replace(/[^\d.,]/g, "").replace(/\./g, ",").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <div
        className={
          "inline-flex items-center rounded-lg border bg-white transition " +
          (alterado ? "border-[var(--primary)] ring-2 ring-[var(--primary-soft)]" : "border-[var(--border)]")
        }
      >
        <span className="px-2 py-2 text-xs font-bold text-[var(--muted)]">R$</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Preço unitário"
          value={foco ? txt : fmt(valor)}
          onFocus={(e) => { setFoco(true); setTxt(fmt(valor)); e.currentTarget.select(); }}
          onChange={(e) => { setTxt(e.target.value); onChange(parse(e.target.value)); }}
          onBlur={() => { setFoco(false); onChange(Math.max(0, Number(parse(txt).toFixed(2)))); }}
          className={
            "border-l border-[var(--border)] py-2 text-right text-sm font-semibold tabular-nums outline-none focus:bg-[var(--primary-soft)]/40 " +
            (compacto ? "w-20 pr-2" : "w-24 pr-2.5")
          }
        />
      </div>
      {alterado && (
        <button
          type="button"
          onClick={() => onChange(original)}
          title="Voltar ao preço do cadastro"
          className="text-[10px] text-[var(--muted)] transition hover:text-[var(--primary)]"
        >
          cadastro: <span className="line-through">{fmt(original)}</span> · desfazer
        </button>
      )}
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
