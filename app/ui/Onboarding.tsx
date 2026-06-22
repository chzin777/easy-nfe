"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Card, Button } from "./primitives";
import Modal from "./Modal";
import { estadoOnboarding } from "@/app/onboarding-actions";

const CHAVE_PULAR = "easy-nfe:onboarding-pulado"; // esconde o card inline
const CHAVE_MODAL = "easy-nfe:onboarding-modal-visto"; // não reabre o popup sozinho

type Estado = { role: string; temEmpresa: boolean; produtos: number; clientes: number; transportadoras: number };

type Passo = {
  key: string;
  label: string;
  desc: string;
  instrucoes: string[];
  href: string;
  cta: string;
  done: boolean;
  icon: React.ReactNode;
  cor: string;
};

/**
 * Onboarding "primeiros passos": popup central (modal com blur) no primeiro
 * acesso, com instruções passo a passo, + um card inline que permanece como
 * lembrete caso o usuário feche o popup. Tudo some quando os passos terminam.
 */
export default function Onboarding() {
  const [montado, setMontado] = useState(false);
  const [pulado, setPulado] = useState(false);
  const [modalVisto, setModalVisto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const pul = localStorage.getItem(CHAVE_PULAR) === "1";
    const visto = localStorage.getItem(CHAVE_MODAL) === "1";
    setPulado(pul);
    setModalVisto(visto);
    setMontado(true);
    estadoOnboarding()
      .then((s) => {
        setEstado(s);
        const completo = s.temEmpresa && s.produtos > 0 && s.clientes > 0 && s.transportadoras > 0;
        if (s.role === "USER" && !completo && !pul && !visto) setModalAberto(true);
      })
      .catch(() => setEstado(null));
  }, []);

  if (!montado || !estado || estado.role !== "USER") return null;

  const passos: Passo[] = [
    {
      key: "empresa",
      label: "Configure sua empresa",
      desc: "Dados da empresa e certificado digital para emitir.",
      instrucoes: [
        "Acesse Configurações e preencha CNPJ, razão social, endereço e regime tributário (CRT).",
        "Envie seu certificado digital A1 (arquivo .pfx) com a senha — é ele que assina as notas.",
        "Escolha o ambiente: Homologação para testar, Produção para valer.",
      ],
      href: "/configuracoes",
      cta: "Abrir Configurações",
      done: estado.temEmpresa,
      cor: "from-rose-500 to-pink-600",
      icon: <IBuilding />,
    },
    {
      key: "produto",
      label: "Cadastre seu primeiro produto",
      desc: "Os produtos compõem os itens da nota fiscal.",
      instrucoes: [
        "Vá em Produtos → “+ Novo produto”.",
        "Informe nome, NCM (8 dígitos — busque pelo nome), unidade, origem e preço.",
        "Tem muitos? Use “Importar” e suba uma planilha (.xlsx/.csv) pelo modelo.",
      ],
      href: "/produtos",
      cta: "Abrir Produtos",
      done: estado.produtos > 0,
      cor: "from-violet-500 to-purple-600",
      icon: <IBox />,
    },
    {
      key: "cliente",
      label: "Cadastre seu primeiro cliente",
      desc: "O cliente é o destinatário da nota.",
      instrucoes: [
        "Vá em Clientes → “+ Novo cliente”.",
        "Digite o CPF/CNPJ — no CNPJ os dados vêm preenchidos automaticamente.",
        "Confirme endereço e contato. Também dá pra importar por planilha.",
      ],
      href: "/clientes",
      cta: "Abrir Clientes",
      done: estado.clientes > 0,
      cor: "from-blue-500 to-indigo-600",
      icon: <IUser />,
    },
    {
      key: "transportadora",
      label: "Cadastre sua transportadora",
      desc: "Necessária quando há transporte de terceiros no frete.",
      instrucoes: [
        "Vá em Transportadoras → “+ Nova transportadora”.",
        "Só é obrigatória quando o frete é por conta de terceiros (modalidades 2, 3 ou 4).",
        "Informe CNPJ, endereço e, se houver, placa/UF do veículo.",
      ],
      href: "/transportadoras",
      cta: "Abrir Transportadoras",
      done: estado.transportadoras > 0,
      cor: "from-emerald-500 to-teal-600",
      icon: <ITruck />,
    },
  ];

  const feitos = passos.filter((p) => p.done).length;
  const completo = feitos === passos.length;
  if (completo) return null;

  const proximo = passos.find((p) => !p.done);

  function fecharModal() {
    localStorage.setItem(CHAVE_MODAL, "1");
    setModalVisto(true);
    setModalAberto(false);
  }
  function pularTudo() {
    localStorage.setItem(CHAVE_MODAL, "1");
    localStorage.setItem(CHAVE_PULAR, "1");
    setModalVisto(true);
    setPulado(true);
    setModalAberto(false);
  }
  function pularCard() {
    localStorage.setItem(CHAVE_PULAR, "1");
    setPulado(true);
  }
  function abrirModal(passo = 0) {
    setI(passo);
    setModalAberto(true);
  }

  const passo = passos[i];
  const ultimo = i === passos.length - 1;

  return (
    <>
      {/* Card inline (lembrete persistente) */}
      {!pulado && (
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
                    <span className="text-xl">👋</span> Primeiros passos
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Conclua a configuração para emitir sua primeira nota fiscal.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variante="secondary" onClick={() => abrirModal(passos.indexOf(proximo ?? passos[0]))} className="!px-3 !py-1.5 !text-xs">
                    Ver guia
                  </Button>
                  <button
                    onClick={pularCard}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-slate-100 hover:text-[var(--foreground)]"
                  >
                    Pular
                  </button>
                </div>
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
                <span className="text-xs font-medium text-[var(--muted)]">{feitos}/{passos.length}</span>
              </div>

              <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {passos.map((p, idx) => (
                  <button
                    key={p.key}
                    onClick={() => abrirModal(idx)}
                    className={
                      "flex flex-col rounded-xl border p-4 text-left transition hover:-translate-y-0.5 " +
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
                        <span className="text-xs font-medium text-[var(--muted)]">Passo {idx + 1}</span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{p.label}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{p.desc}</p>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Popup central (modal com blur) */}
      <Modal
        aberto={modalAberto}
        onFechar={fecharModal}
        titulo="Bem-vindo! Vamos começar"
        largura="max-w-xl"
        rodape={
          <div className="flex w-full items-center justify-between gap-3">
            <button onClick={pularTudo} className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-slate-100">
              Pular primeiros passos
            </button>
            <div className="flex gap-2">
              {i > 0 && <Button variante="secondary" onClick={() => setI((v) => v - 1)}>Voltar</Button>}
              {ultimo ? (
                <Button onClick={fecharModal}>Concluir</Button>
              ) : (
                <Button onClick={() => setI((v) => v + 1)}>Próximo</Button>
              )}
            </div>
          </div>
        }
      >
        {/* Progresso */}
        <div className="mb-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)]"
              animate={{ width: `${(feitos / passos.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-medium text-[var(--muted)]">{feitos}/{passos.length} feitos</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={passo.key}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${passo.cor} text-white shadow-md`}>
                {passo.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--muted)]">Passo {i + 1} de {passos.length}</p>
                <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  {passo.label}
                  {passo.done && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      Feito
                    </span>
                  )}
                </h3>
              </div>
            </div>

            <ol className="mt-4 space-y-2.5">
              {passo.instrucoes.map((t, idx) => (
                <li key={idx} className="flex gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-bold text-[var(--primary)]">{idx + 1}</span>
                  <span className="text-[var(--foreground)]">{t}</span>
                </li>
              ))}
            </ol>

            <Link
              href={passo.href}
              onClick={fecharModal}
              className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(82,39,255,0.3)] transition hover:-translate-y-0.5"
            >
              {passo.cta}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </Link>
          </motion.div>
        </AnimatePresence>

        {/* Indicadores */}
        <div className="mt-6 flex justify-center gap-1.5">
          {passos.map((p, idx) => (
            <button
              key={p.key}
              onClick={() => setI(idx)}
              aria-label={`Ir para o passo ${idx + 1}`}
              className={"h-1.5 rounded-full transition-all " + (idx === i ? "w-6 bg-[var(--primary)]" : p.done ? "w-1.5 bg-[var(--success)]" : "w-1.5 bg-slate-300")}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}

function IBuilding() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></svg>;
}
function IBox() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>;
}
function IUser() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function ITruck() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>;
}
