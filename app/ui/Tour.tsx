"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Modal from "@/app/ui/Modal";
import { Button } from "@/app/ui/primitives";
import { tourVisto, marcarTourVisto } from "@/app/tour-actions";

// Tutorial de uma tela: abre sozinho no primeiro acesso e fica num botão "?"
// flutuante para rever depois. O "já vi" é guardado por usuário no banco, então
// acompanha a pessoa entre navegadores.
//
// O conteúdo de cada tela vive em tours.ts — aqui é só a mecânica.

export type SlideTour = {
  titulo: string;
  texto: string;
  dica?: string;
  cor: string; // classes de gradiente do ícone
  icone: React.ReactNode;
};

export default function Tour({
  chave,
  titulo,
  slides,
}: {
  chave: string;
  titulo: string;
  slides: SlideTour[];
}) {
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [i, setI] = useState(0);

  // Quem monta este componente troca a `key` a cada rota, então o estado já
  // nasce limpo em cada tela — basta perguntar se esta aqui já foi vista.
  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
    void tourVisto(chave).then((visto) => {
      if (vivo && !visto) setAberto(true);
    });
    return () => { vivo = false; };
  }, [chave]);

  function concluir() {
    void marcarTourVisto(chave);
    setAberto(false);
    setI(0);
  }

  if (!montado || slides.length === 0) return null;

  const ultimo = i === slides.length - 1;
  const s = slides[i];

  return (
    <>
      <button
        onClick={() => { setI(0); setAberto(true); }}
        title={titulo}
        aria-label="Ajuda desta tela"
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-[0_8px_24px_rgba(82,39,255,0.4)] transition hover:scale-105 lg:bottom-6"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
      </button>

      <Modal
        aberto={aberto}
        onFechar={concluir}
        titulo={`${titulo} · ${i + 1}/${slides.length}`}
        largura="max-w-lg"
        rodape={
          <div className="flex w-full items-center justify-between">
            <button onClick={concluir} className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-slate-100">
              {ultimo ? "Fechar" : "Pular tutorial"}
            </button>
            <div className="flex gap-2">
              {i > 0 && <Button variante="secondary" onClick={() => setI((v) => v - 1)}>Voltar</Button>}
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
              {s.icone}
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">
              {slides.length > 1 ? `Etapa ${i + 1}: ` : ""}{s.titulo}
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

        <div className="mt-5 flex justify-center gap-1.5">
          {slides.map((_, idx) => (
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
