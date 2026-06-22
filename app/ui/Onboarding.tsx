"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./primitives";
import { estadoOnboarding } from "@/app/onboarding-actions";

const CHAVE = "easy-nfe:onboarding-pulado";

type Passo = {
  key: string;
  label: string;
  desc: string;
  href: string;
  cta: string;
  done: boolean;
  icon: React.ReactNode;
  cor: string;
};

/**
 * "Primeiros passos" global (renderizado no AppShell). Aparece em qualquer página
 * logada do usuário comum no primeiro acesso: configurar empresa e cadastrar
 * produto, cliente e transportadora. Marca os passos já feitos e some sozinho
 * quando tudo estiver pronto. Pulável (localStorage).
 */
export default function Onboarding() {
  const [montado, setMontado] = useState(false);
  const [pulado, setPulado] = useState(false);
  const [estado, setEstado] = useState<{ role: string; temEmpresa: boolean; produtos: number; clientes: number; transportadoras: number } | null>(null);

  useEffect(() => {
    setPulado(localStorage.getItem(CHAVE) === "1");
    setMontado(true);
    estadoOnboarding().then(setEstado).catch(() => setEstado(null));
  }, []);

  if (!montado || pulado || !estado || estado.role !== "USER") return null;

  const passos: Passo[] = [
    {
      key: "empresa",
      label: "Configure sua empresa",
      desc: "Dados da empresa e certificado digital para emitir.",
      href: "/configuracoes",
      cta: "Configurar empresa",
      done: estado.temEmpresa,
      cor: "from-rose-500 to-pink-600",
      icon: <IBuilding />,
    },
    {
      key: "produto",
      label: "Cadastre seu primeiro produto",
      desc: "Os produtos compõem os itens da nota fiscal.",
      href: "/produtos",
      cta: "Cadastrar produto",
      done: estado.produtos > 0,
      cor: "from-violet-500 to-purple-600",
      icon: <IBox />,
    },
    {
      key: "cliente",
      label: "Cadastre seu primeiro cliente",
      desc: "O cliente é o destinatário da nota.",
      href: "/clientes",
      cta: "Cadastrar cliente",
      done: estado.clientes > 0,
      cor: "from-blue-500 to-indigo-600",
      icon: <IUser />,
    },
    {
      key: "transportadora",
      label: "Cadastre sua transportadora",
      desc: "Necessária quando há transporte de terceiros no frete.",
      href: "/transportadoras",
      cta: "Cadastrar transportadora",
      done: estado.transportadoras > 0,
      cor: "from-emerald-500 to-teal-600",
      icon: <ITruck />,
    },
  ];

  const feitos = passos.filter((p) => p.done).length;
  const completo = feitos === passos.length;
  if (completo) return null;

  function pular() {
    localStorage.setItem(CHAVE, "1");
    setPulado(true);
  }

  const proximo = passos.find((p) => !p.done);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6"
      >
        <Card className="relative overflow-hidden border-[var(--primary)]/20 p-5 sm:p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-[var(--primary)]/10 to-[var(--primary-2)]/10 blur-2xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <span className="text-xl">👋</span> Bem-vindo! Vamos começar
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Conclua os primeiros passos para emitir sua primeira nota fiscal.
              </p>
            </div>
            <button
              onClick={pular}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-slate-100 hover:text-[var(--foreground)]"
            >
              Pular por agora
            </button>
          </div>

          <div className="relative mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)]"
                initial={{ width: 0 }}
                animate={{ width: `${(feitos / passos.length) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-medium text-[var(--muted)]">
              {feitos}/{passos.length}
            </span>
          </div>

          <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {passos.map((p, i) => (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={
                  "flex flex-col rounded-xl border p-4 transition " +
                  (p.done
                    ? "border-[var(--success)]/30 bg-[var(--success-soft)]/40"
                    : p === proximo
                      ? "border-[var(--primary)]/40 bg-[var(--primary-soft)]/30"
                      : "border-[var(--border)] bg-white")
                }
              >
                <div className="flex items-center justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${p.cor} text-white shadow-sm`}>
                    {p.icon}
                  </div>
                  {p.done ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[var(--success)]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      Feito
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-[var(--muted)]">Passo {i + 1}</span>
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold">{p.label}</p>
                <p className="mt-1 flex-1 text-xs text-[var(--muted)]">{p.desc}</p>
                {!p.done && (
                  <Link
                    href={p.href}
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-3 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(82,39,255,0.3)] transition hover:-translate-y-0.5"
                  >
                    {p.cta}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

function IBuilding() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></svg>;
}
function IBox() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>;
}
function IUser() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function ITruck() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>;
}
