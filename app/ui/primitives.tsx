"use client";

// Primitivos de UI reutilizáveis (animados). Tailwind v4 + motion.
import type { ReactNode, SelectHTMLAttributes } from "react";
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ButtonHTMLAttributes,
} from "react";
import { motion } from "motion/react";
import type { Opcao } from "@/lib/types";

export { formatBRL, formatData } from "@/lib/format";

const inputBase =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm " +
  "text-[var(--foreground)] placeholder:text-slate-400 outline-none transition-all " +
  "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)] " +
  "hover:border-slate-300 disabled:bg-slate-50 disabled:text-slate-400";

export function PageHeader({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {subtitulo && (
          <p className="mt-1.5 text-sm text-[var(--muted)]">{subtitulo}</p>
        )}
      </div>
      {acao}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] " +
        "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.10)] " +
        className
      }
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
      <span className="inline-block h-3.5 w-1 rounded-full bg-gradient-to-b from-[var(--primary)] to-[var(--primary-2)]" />
      {children}
    </h2>
  );
}

export function Field({
  label,
  children,
  required,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={"flex flex-col gap-1.5 " + className}>
      <span className="text-sm font-medium text-[var(--foreground)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={inputBase + " " + className} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={inputBase + " min-h-20 " + className} {...rest} />;
}

export function Select({
  opcoes,
  placeholder,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  opcoes: Opcao[];
  placeholder?: string;
}) {
  return (
    <select className={inputBase + " cursor-pointer " + className} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {opcoes.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

type Variante = "primary" | "secondary" | "danger" | "ghost";

const variantes: Record<Variante, string> = {
  primary:
    "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] text-white border-transparent " +
    "shadow-[0_4px_14px_rgba(82,39,255,0.35)] hover:shadow-[0_6px_20px_rgba(82,39,255,0.45)]",
  secondary:
    "bg-white text-[var(--foreground)] hover:bg-slate-50 border-[var(--border)] hover:border-slate-300",
  danger:
    "bg-[var(--danger)] text-white hover:bg-red-700 border-transparent shadow-[0_4px_14px_rgba(220,38,38,0.3)]",
  ghost:
    "bg-transparent text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--foreground)] border-transparent",
};

export function Button({
  variante = "primary",
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.03, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      disabled={disabled}
      className={
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 " +
        "text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed " +
        variantes[variante] +
        " " +
        className
      }
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

type BadgeTom = "neutral" | "success" | "danger" | "warning" | "primary";

const tons: Record<BadgeTom, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  success: "bg-[var(--success-soft)] text-[var(--success)] ring-green-200",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] ring-red-200",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] ring-amber-200",
  primary: "bg-[var(--primary-soft)] text-[var(--primary)] ring-violet-200",
};

export function Badge({
  children,
  tom = "neutral",
}: {
  children: ReactNode;
  tom?: BadgeTom;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset " +
        tons[tom]
      }
    >
      {children}
    </span>
  );
}

export function EmptyState({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[var(--foreground)]">{titulo}</p>
      {descricao && <p className="text-sm text-[var(--muted)]">{descricao}</p>}
    </div>
  );
}

// Tabela com linhas animadas (entrada em cascata).
export type Coluna<T> = {
  chave: string;
  cabecalho: string;
  render: (item: T) => ReactNode;
  alinhar?: "left" | "right" | "center";
};

function classeAlinhar(a?: "left" | "right" | "center") {
  return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
}

export function Tabela<T extends { id: string }>({
  colunas,
  dados,
  vazio,
  onRowClick,
}: {
  colunas: Coluna<T>[];
  dados: T[];
  vazio?: ReactNode;
  onRowClick?: (item: T) => void;
}) {
  if (dados.length === 0 && vazio) {
    return <>{vazio}</>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left">
            {colunas.map((c) => (
              <th
                key={c.chave}
                className={
                  "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] " +
                  classeAlinhar(c.alinhar)
                }
              >
                {c.cabecalho}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.map((item, i) => (
            <motion.tr
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={
                "border-b border-[var(--border)] transition-colors last:border-0 hover:bg-slate-50/70 " +
                (onRowClick ? "cursor-pointer" : "")
              }
            >
              {colunas.map((c) => (
                <td key={c.chave} className={"px-4 py-3 align-middle " + classeAlinhar(c.alinhar)}>
                  {c.render(item)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
