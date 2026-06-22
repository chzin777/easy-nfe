"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Modal from "@/app/ui/Modal";
import { Button } from "@/app/ui/primitives";

const CHAVE = "easy-nfe:tour-nova-nota-v1";

type Slide = { titulo: string; texto: string; dica?: string; icon: React.ReactNode; cor: string };

const SLIDES: Slide[] = [
  {
    titulo: "Tipo e destinatário",
    texto: "Escolha o tipo da nota (ex.: NF-e de saída) e selecione o cliente que vai receber. Não tem o cliente? Dá para cadastrar na hora pelo próprio seletor.",
    dica: "O cliente é o destinatário — confira o endereço, ele vai no XML.",
    cor: "from-blue-500 to-indigo-600",
    icon: <IUser />,
  },
  {
    titulo: "Produtos",
    texto: "Busque o produto, informe a quantidade e clique em “Adicionar”. Repita para cada item. Dá para ajustar a quantidade com os botões + / − e remover itens.",
    dica: "O total da nota é calculado automaticamente conforme você adiciona.",
    cor: "from-violet-500 to-purple-600",
    icon: <IBox />,
  },
  {
    titulo: "Transporte",
    texto: "Selecione a modalidade do frete. Para CIF, FOB ou “sem ocorrência” a transportadora é opcional; para transporte de terceiros ela é obrigatória.",
    dica: "Modalidades 2/3/4 exigem escolher uma transportadora.",
    cor: "from-emerald-500 to-teal-600",
    icon: <ITruck />,
  },
  {
    titulo: "Conferência e emissão",
    texto: "Revise tudo: destinatário, produtos, valores e transporte. Adicione informações complementares se precisar e clique em “Emitir nota” para transmitir à SEFAZ.",
    dica: "Após emitir, o sistema mostra o status (autorizada/rejeitada) e a chave de acesso.",
    cor: "from-amber-500 to-orange-600",
    icon: <IFile />,
  },
];

/**
 * Tutorial guiado da tela de emissão. Abre sozinho no primeiro acesso e fica
 * disponível num botão flutuante "?" para rever a qualquer momento.
 */
export default function TourEmissao() {
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    setMontado(true);
    if (localStorage.getItem(CHAVE) !== "1") {
      setAberto(true);
    }
  }, []);

  function concluir() {
    localStorage.setItem(CHAVE, "1");
    setAberto(false);
    setI(0);
  }
  function abrir() {
    setI(0);
    setAberto(true);
  }

  const ultimo = i === SLIDES.length - 1;
  const s = SLIDES[i];

  if (!montado) return null;

  return (
    <>
      {/* Botão flutuante para reabrir o tutorial */}
      <button
        onClick={abrir}
        title="Como emitir uma nota"
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-[0_8px_24px_rgba(82,39,255,0.4)] transition hover:scale-105 lg:bottom-6"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
      </button>

      <Modal
        aberto={aberto}
        onFechar={concluir}
        titulo={`Como emitir uma nota · ${i + 1}/${SLIDES.length}`}
        largura="max-w-lg"
        rodape={
          <div className="flex w-full items-center justify-between">
            <button onClick={concluir} className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-slate-100">
              {ultimo ? "Fechar" : "Pular tutorial"}
            </button>
            <div className="flex gap-2">
              {i > 0 && (
                <Button variante="secondary" onClick={() => setI((v) => v - 1)}>Voltar</Button>
              )}
              {ultimo ? (
                <Button onClick={concluir}>Entendi, vamos lá!</Button>
              ) : (
                <Button onClick={() => setI((v) => v + 1)}>Próximo</Button>
              )}
            </div>
          </div>
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.cor} text-white shadow-md`}>
              {s.icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">
              Etapa {i + 1}: {s.titulo}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{s.texto}</p>
            {s.dica && (
              <p className="mt-3 flex gap-2 rounded-lg bg-[var(--primary-soft)]/50 px-3 py-2.5 text-sm text-[var(--foreground)]">
                <span>💡</span>
                <span>{s.dica}</span>
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Indicadores de slide */}
        <div className="mt-5 flex justify-center gap-1.5">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Ir para etapa ${idx + 1}`}
              className={"h-1.5 rounded-full transition-all " + (idx === i ? "w-6 bg-[var(--primary)]" : "w-1.5 bg-slate-300")}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}

function IBox() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>;
}
function IUser() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function ITruck() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>;
}
function IFile() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v6h6" /></svg>;
}
