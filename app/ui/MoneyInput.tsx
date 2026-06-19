"use client";

import { formatBRL } from "@/lib/format";

// Campo de dinheiro (BRL). Digita-se só números, preenchendo da direita pra
// esquerda em centavos — igual maquininha/banco. Valor sai como number em reais.
export default function MoneyInput({
  value,
  onChange,
  className = "",
  placeholder = "R$ 0,00",
  ...rest
}: {
  value: number;
  onChange: (valor: number) => void;
  className?: string;
  placeholder?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const display = value > 0 ? formatBRL(value) : "";

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const digitos = e.target.value.replace(/\D/g, "");
    onChange(digitos ? Number(digitos) / 100 : 0);
  }

  const base =
    "w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm tabular-nums " +
    "text-[var(--foreground)] placeholder:text-slate-400 outline-none transition-all " +
    "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)] hover:border-slate-300";

  return (
    <input
      inputMode="numeric"
      value={display}
      onChange={handle}
      placeholder={placeholder}
      className={base + " " + className}
      {...rest}
    />
  );
}
