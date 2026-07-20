"use client";

// Primitivos de UI reutilizáveis (animados). Tailwind v4 + motion.
import type { ReactNode, SelectHTMLAttributes } from "react";
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ButtonHTMLAttributes,
} from "react";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
    <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
        {subtitulo && (
          <p className="mt-1.5 text-sm text-[var(--muted)]">{subtitulo}</p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
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

// Campo de data no padrão brasileiro (dd/mm/aaaa). Mantém o value em ISO
// (YYYY-MM-DD) por fora, então substitui <Input type="date"> sem mudar o
// contrato de onChange. Exibe dd/mm/aaaa (evita o mm/dd/aaaa do picker nativo,
// locale US) E mantém o calendário: o botão à direita abre o date picker nativo
// (input type=date escondido) via showPicker().
export function DateBR({
  value,
  onChange,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const toBR = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };
  const [text, setText] = useState(() => toBR(value));
  const [ultimoValue, setUltimoValue] = useState(value);
  const nativoRef = useRef<HTMLInputElement>(null);
  // Ressincroniza o texto quando o value externo muda (ex.: troca de fatura).
  if (value !== ultimoValue) {
    setUltimoValue(value);
    setText(toBR(value));
  }

  function handleChange(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    let masked = d;
    if (d.length > 4) masked = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    else if (d.length > 2) masked = `${d.slice(0, 2)}/${d.slice(2)}`;
    setText(masked);
    if (d.length === 8) {
      onChange({ target: { value: `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}` } });
    } else if (d.length === 0) {
      onChange({ target: { value: "" } });
    }
  }

  function abrirCalendario() {
    const el = nativoRef.current;
    if (!el) return;
    // showPicker() abre o calendário nativo; fallback = foco/clique.
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* alguns browsers bloqueiam sem gesto */ }
    }
    el.click();
  }

  return (
    <div className="relative">
      <input
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        className={inputBase + " pr-11 " + className}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        {...rest}
      />
      <button
        type="button"
        onClick={abrirCalendario}
        aria-label="Abrir calendário"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-[var(--primary)]"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
      </button>
      {/* Picker nativo escondido: só serve p/ o calendário. Guarda ISO. */}
      <input
        ref={nativoRef}
        type="date"
        value={value}
        onChange={(e) => { setText(toBR(e.target.value)); onChange({ target: { value: e.target.value } }); }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
    </div>
  );
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

type Variante = "primary" | "secondary" | "danger" | "dangerSoft" | "warning" | "ghost";

const variantes: Record<Variante, string> = {
  primary:
    "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] text-white border-transparent " +
    "shadow-[0_4px_14px_rgba(82,39,255,0.35)] hover:shadow-[0_6px_20px_rgba(82,39,255,0.45)]",
  secondary:
    "bg-white text-[var(--foreground)] hover:bg-slate-50 border-[var(--border)] hover:border-slate-300",
  danger:
    "bg-[var(--danger)] text-white hover:bg-red-700 border-transparent shadow-[0_4px_14px_rgba(220,38,38,0.3)]",
  dangerSoft:
    "bg-[var(--danger-soft)] text-[var(--danger)] border-red-200 hover:bg-red-100",
  warning:
    "bg-[var(--warning-soft)] text-[var(--warning)] border-amber-200 hover:bg-amber-100",
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
        "whitespace-nowrap text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed " +
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

// Tabela com linhas animadas (entrada em cascata), ordenação por coluna e
// seleção múltipla opcional.
export type Coluna<T> = {
  chave: string;
  cabecalho: string;
  render: (item: T) => ReactNode;
  alinhar?: "left" | "right" | "center";
  // Valor bruto usado para ordenar. Se ausente, a coluna não é clicável.
  valor?: (item: T) => string | number | Date | null | undefined;
};

function classeAlinhar(a?: "left" | "right" | "center") {
  return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
}

type Ordenacao = { chave: string; dir: "asc" | "desc" };

// Nulos sempre por último; texto compara em pt-BR com numeric (assim "10"
// vem depois de "9" em códigos) e ignorando acento/caixa.
function compararValores(a: unknown, b: unknown): number {
  const vazioA = a === null || a === undefined || a === "";
  const vazioB = b === null || b === undefined || b === "";
  if (vazioA && vazioB) return 0;
  if (vazioA) return 1;
  if (vazioB) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

function SetaOrdem({ dir }: { dir?: "asc" | "desc" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        "transition-all " +
        (dir ? "opacity-100" : "opacity-0 group-hover:opacity-40") +
        (dir === "desc" ? " rotate-180" : "")
      }
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function Tabela<T extends { id: string }>({
  colunas,
  dados,
  vazio,
  onRowClick,
  selecionados,
  onSelecionados,
  ordemInicial,
}: {
  colunas: Coluna<T>[];
  dados: T[];
  vazio?: ReactNode;
  onRowClick?: (item: T) => void;
  // Presença de `onSelecionados` liga a coluna de checkboxes.
  selecionados?: string[];
  onSelecionados?: (ids: string[]) => void;
  ordemInicial?: Ordenacao;
}) {
  const [ordem, setOrdem] = useState<Ordenacao | null>(ordemInicial ?? null);

  const selecao = new Set(selecionados ?? []);
  const selecionavel = !!onSelecionados;

  const colOrdenada = ordem ? colunas.find((c) => c.chave === ordem.chave) : undefined;
  const lista = colOrdenada?.valor
    ? [...dados].sort((a, b) => {
        const r = compararValores(colOrdenada.valor!(a), colOrdenada.valor!(b));
        return ordem!.dir === "asc" ? r : -r;
      })
    : dados;

  function alternarOrdem(c: Coluna<T>) {
    if (!c.valor) return;
    setOrdem((o) =>
      o?.chave === c.chave ? (o.dir === "asc" ? { chave: c.chave, dir: "desc" } : null) : { chave: c.chave, dir: "asc" },
    );
  }

  function alternarItem(id: string) {
    const prox = new Set(selecao);
    if (prox.has(id)) prox.delete(id);
    else prox.add(id);
    onSelecionados?.([...prox]);
  }

  const idsVisiveis = lista.map((d) => d.id);
  const todosMarcados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecao.has(id));
  const algunsMarcados = !todosMarcados && idsVisiveis.some((id) => selecao.has(id));

  if (dados.length === 0 && vazio) {
    return <>{vazio}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left">
            {selecionavel && (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={todosMarcados}
                  ref={(el) => { if (el) el.indeterminate = algunsMarcados; }}
                  onChange={() => onSelecionados?.(todosMarcados ? [] : idsVisiveis)}
                  className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                />
              </th>
            )}
            {colunas.map((c) => {
              const ativo = ordem?.chave === c.chave ? ordem.dir : undefined;
              return (
                <th
                  key={c.chave}
                  onClick={() => alternarOrdem(c)}
                  title={c.valor ? `Ordenar por ${c.cabecalho}` : undefined}
                  className={
                    "group px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors " +
                    classeAlinhar(c.alinhar) +
                    (c.valor ? " cursor-pointer select-none hover:text-[var(--primary)]" : "") +
                    (ativo ? " text-[var(--primary)]" : " text-[var(--muted)]")
                  }
                >
                  <span
                    className={
                      "inline-flex items-center gap-1 " +
                      (c.alinhar === "right" ? "flex-row-reverse" : "")
                    }
                  >
                    {c.cabecalho}
                    {c.valor && <SetaOrdem dir={ativo} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {lista.map((item, i) => {
            const marcado = selecao.has(item.id);
            return (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={
                  "border-b border-[var(--border)] transition-colors last:border-0 " +
                  (marcado ? "bg-[var(--primary-soft)]/50 " : "hover:bg-slate-50/70 ") +
                  (onRowClick ? "cursor-pointer" : "")
                }
              >
                {selecionavel && (
                  <td className="w-10 px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Selecionar linha"
                      checked={marcado}
                      onChange={() => alternarItem(item.id)}
                      className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                    />
                  </td>
                )}
                {colunas.map((c) => (
                  <td key={c.chave} className={"px-4 py-3 align-middle " + classeAlinhar(c.alinhar)}>
                    {c.render(item)}
                  </td>
                ))}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Rodapé de paginação. A lista continua vindo inteira do servidor; aqui só
// fatiamos para a tela não virar um rolo infinito.
export const OPCOES_POR_PAGINA = [10, 25, 50, 100];

// Fatia uma lista já filtrada. `pagina` é 1-based e vem corrigida quando o
// filtro encolhe a lista e a página atual deixa de existir.
export function paginar<T>(itens: T[], pagina: number, porPagina: number): { fatia: T[]; paginas: number; pagina: number } {
  const paginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const atual = Math.min(Math.max(1, pagina), paginas);
  const inicio = (atual - 1) * porPagina;
  return { fatia: itens.slice(inicio, inicio + porPagina), paginas, pagina: atual };
}

export function Paginacao({
  total,
  pagina,
  paginas,
  porPagina,
  onPagina,
  onPorPagina,
  rotulo = "registro",
}: {
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
  onPagina: (p: number) => void;
  onPorPagina?: (n: number) => void;
  rotulo?: string;
}) {
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(pagina * porPagina, total);

  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-md border border-[var(--border)] px-2 text-sm transition " +
    "hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
      <span>
        {total === 0 ? `Nenhum ${rotulo}` : <>Exibindo <b className="text-[var(--foreground)]">{primeiro}–{ultimo}</b> de {total} {rotulo}(s)</>}
      </span>

      <div className="flex items-center gap-3">
        {onPorPagina && (
          <label className="flex items-center gap-1.5">
            por página
            <select
              value={porPagina}
              onChange={(e) => onPorPagina(Number(e.target.value))}
              className="cursor-pointer rounded-md border border-[var(--border)] bg-white px-1.5 py-1 text-xs outline-none focus:border-[var(--primary)]"
            >
              {OPCOES_POR_PAGINA.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button type="button" className={btn} onClick={() => onPagina(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">‹</button>
          <span className="px-1.5">
            <b className="text-[var(--foreground)]">{pagina}</b> / {paginas}
          </span>
          <button type="button" className={btn} onClick={() => onPagina(pagina + 1)} disabled={pagina >= paginas} aria-label="Próxima página">›</button>
        </div>
      </div>
    </div>
  );
}

// Barra flutuante de ações em massa — aparece quando há seleção.
export function BarraSelecao({
  quantidade,
  onLimpar,
  children,
}: {
  quantidade: number;
  onLimpar: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {quantidade > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
        >
          <div className="flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[0_8px_30px_rgba(16,24,40,0.18)]">
            <span className="text-sm font-medium">
              {quantidade} selecionado{quantidade > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={onLimpar}
              className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
            >
              limpar
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
