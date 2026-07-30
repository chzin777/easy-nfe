"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NOVIDADES, VERSAO_NOVIDADES, type Novidade } from "@/lib/novidades";
import IconeNovidade from "@/app/ui/IconesNovidades";

// Carrossel de novidades no topo do painel. Anda sozinho, para quando o mouse
// está em cima e some de vez quando o usuário fecha — a dispensa é guardada por
// versão, então uma leva nova de novidades volta a aparecer.

const CHAVE = "novidades:dispensadas";
const EVENTO = "novidades:mudou";
const INTERVALO = 6000;

function lerDispensadas(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE) ?? "[]") as string[];
  } catch {
    return []; // modo privado / quota
  }
}

// Se o usuário já dispensou esta leva é estado do navegador, não do React. Lido
// com useSyncExternalStore para o servidor renderizar nada e não haver flash.
function assinar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENTO, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENTO, callback);
  };
}

export default function NovidadesCarrossel() {
  const dispensado = useSyncExternalStore(
    assinar,
    () => lerDispensadas().includes(VERSAO_NOVIDADES),
    () => true, // no servidor: não renderiza
  );
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const visivel = !dispensado;

  const ir = useCallback((passo: number) => {
    setI((atual) => (atual + passo + NOVIDADES.length) % NOVIDADES.length);
  }, []);

  useEffect(() => {
    if (!visivel || pausado) return;
    timer.current = setInterval(() => ir(1), INTERVALO);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [visivel, pausado, ir]);

  function dispensar() {
    try {
      const atuais = lerDispensadas();
      window.localStorage.setItem(CHAVE, JSON.stringify([...new Set([...atuais, VERSAO_NOVIDADES])]));
    } catch {
      // ignora
    }
    window.dispatchEvent(new Event(EVENTO));
  }

  if (!visivel) return null;
  const n = NOVIDADES[i];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-[0_8px_30px_rgba(16,24,40,0.12)]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-600/25 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3 px-5 pt-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-200">
          Novidades do Easy
        </span>
        <button
          type="button"
          onClick={dispensar}
          aria-label="Não mostrar mais"
          className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Todos os cards na mesma célula do grid: os invisíveis reservam a altura
          do maior, então a faixa não muda de tamanho ao trocar de novidade. */}
      <div className="grid px-5 py-3 [grid-template-areas:'card']">
        {NOVIDADES.map((item, idx) => (
          <div key={idx} aria-hidden className="invisible pointer-events-none [grid-area:card]">
            <CardNovidade n={item} />
          </div>
        ))}
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="[grid-area:card]"
          >
            <CardNovidade n={n} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative flex items-center justify-between gap-3 px-5 pb-4">
        <div className="flex items-center gap-1.5">
          {NOVIDADES.map((item, idx) => (
            <button
              key={item.titulo}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Novidade ${idx + 1}: ${item.titulo}`}
              aria-current={idx === i}
              className={
                "h-1.5 rounded-full transition-all " +
                (idx === i ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/60")
              }
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Seta rotulo="Anterior" onClick={() => ir(-1)} d="M15 6l-6 6 6 6" />
          <Seta rotulo="Próxima" onClick={() => ir(1)} d="M9 6l6 6-6 6" />
        </div>
      </div>
    </div>
  );
}

function CardNovidade({ n }: { n: Novidade }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-lg">
        <IconeNovidade icone={n.icone} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold">{n.titulo}</h3>
          <span
            className={
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase " +
              (n.tag === "Novo" ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-slate-300")
            }
          >
            {n.tag}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{n.desc}</p>
        {n.href && (
          <Link
            href={n.href}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-violet-300 transition hover:text-violet-200"
          >
            Ver na prática
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}

function Seta({ rotulo, onClick, d }: { rotulo: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className="rounded-lg border border-white/15 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </button>
  );
}
