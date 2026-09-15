"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import ScrollLink from "./ScrollLink";
import BlurText from "./BlurText";
import "./hero.css";

/**
 * HERO — TELA DIVIDIDA, na gramática do Easy MEI.
 *
 * Metade escura com a tipografia, metade clara com o produto. A divisa é
 * vertical e vai até as bordas: não é um cartão sobre um fundo, são dois
 * mundos encostados — o da obrigação fiscal, escuro, e o do aplicativo,
 * claro. No celular a divisa vira horizontal: o eixo muda, ela continua.
 *
 * O que muda em relação ao irmão: o produto não é um celular em 3D, é o
 * painel de verdade, inclinado e invadindo o lado escuro, com as placas
 * de vidro do login flutuando por cima — é o mesmo sistema dos dois lados
 * do login, então a página e a porta de entrada combinam.
 */

const SELOS = ["Sem cartão de crédito", "Cancele quando quiser", "Primeira nota em minutos"];

const PLACAS = [
  { n: 1 as const, titulo: "NF-e 1.482", nota: "AUTORIZADA EM 4s" },
  { n: 2 as const, titulo: "DANFE enviada", nota: "WHATSAPP DO CLIENTE" },
  { n: 3 as const, titulo: "Venda do site", nota: "VIROU NOTA SOZINHA" },
];

/* Amplitude do giro com o ponteiro, em graus, escolhida no olho: mais que
   isto e o painel "deita" e a leitura do print se perde. O -9° de base fica
   no CSS, junto do resto do enquadramento. */
const GIRO_Y = 7;
const GIRO_X = 4.5;

export default function HeroPrincipal() {
  const palco = useRef<HTMLDivElement>(null);

  /* O giro segue o ponteiro na tela INTEIRA do herói, não só sobre a
     imagem: seguir só em cima dela faz o efeito aparecer e sumir na borda.
     A suavização é um lerp em rAF — com transition puro o painel arrasta
     atrás do cursor e dá impressão de travamento. */
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const cena = el.querySelector<HTMLElement>(".heroi__cena");
    if (!cena) return;

    let alvoX = 0, alvoY = 0, atualX = 0, atualY = 0, quadro = 0;
    const laco = () => {
      atualX += (alvoX - atualX) * 0.09;
      atualY += (alvoY - atualY) * 0.09;
      cena.style.setProperty("--gx", `${(-atualY * GIRO_X).toFixed(3)}deg`);
      cena.style.setProperty("--gy", `${(atualX * GIRO_Y).toFixed(3)}deg`);
      quadro = requestAnimationFrame(laco);
    };
    quadro = requestAnimationFrame(laco);

    const mover = (e: PointerEvent) => {
      alvoX = (e.clientX / window.innerWidth) * 2 - 1;
      alvoY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const sair = () => { alvoX = 0; alvoY = 0; };
    window.addEventListener("pointermove", mover, { passive: true });
    window.addEventListener("pointerleave", sair);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerleave", sair);
    };
  }, []);

  return (
    <section className="heroi">
      {/* o lado claro, encostado */}
      <div className="heroi__lado" aria-hidden="true" />
      <div className="heroi__halo" aria-hidden="true" />

      <div className="heroi__grade">
        <div className="heroi__coluna">
          <p className="heroi__medida">
            <span className="heroi__ponto" aria-hidden="true" />
            Emissor de NF-e, NFC-e e NFS-e
          </p>

          <h1 className="heroi__titulo">
            <BlurText
              text="Emita nota fiscal sem entender"
              delay={90}
              animateBy="words"
              direction="top"
              className="justify-start"
            />
            <BlurText
              text="nada de nota fiscal."
              delay={90}
              animateBy="words"
              direction="top"
              className="heroi__titulo-acento justify-start"
            />
          </h1>

          <p className="heroi__apoio">
            Escolha o cliente, o que vendeu e clique em emitir. A gente manda para a Receita,
            gera o PDF e entrega ao seu cliente por WhatsApp ou e-mail. Sem planilha, sem
            instalar programa, sem depender do contador a cada venda.
          </p>

          <div className="heroi__acoes">
            <Link href="/cadastro" className="heroi__botao">
              Testar grátis por 7 dias
            </Link>
            <ScrollLink href="#planos" className="heroi__botao heroi__botao--fantasma">
              Ver planos
            </ScrollLink>
          </div>

          <ul className="heroi__selos">
            {SELOS.map((s) => (
              <li key={s}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* o produto, em 3D de verdade, invadindo o lado escuro */}
        <div ref={palco} className="heroi__palco">
          {/* a cena é o que gira; o que está dentro dela tem profundidade
              própria em translateZ, então as placas se deslocam mais que o
              painel quando o ponteiro anda — é paralaxe, não decalque */}
          <div className="heroi__cena">
            <div className="heroi__quadro">
              <Image
                src="/images/prints/dashboard.png"
                alt="Painel do Easy-NFe com as notas emitidas"
                width={1600}
                height={1000}
                priority
                sizes="(max-width: 1023px) 92vw, 46vw"
                className="heroi__print"
              />
              <span className="heroi__brilho" aria-hidden="true" />
            </div>

            {PLACAS.map((p) => (
              <div key={p.n} className={`placa-fundo ph-${p.n}`} aria-hidden="true">
                <div className="placa-heroi">
                  <span className="placa-heroi__icone">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                  <span className="placa-heroi__texto">
                    <b>{p.titulo}</b>
                    <i>{p.nota}</i>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
