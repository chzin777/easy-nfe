"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ScrollLink from "./ScrollLink";
import { NAV_ITENS as ITENS } from "./navItens";
import "./nav.css";

/**
 * NAV — mesma gramática do Easy MEI.
 *
 * O tratamento é UM: pílula clara, quase opaca, com tinta escura. Ela traz
 * o próprio fundo, então funciona sobre qualquer coisa que passe atrás.
 *
 * Aqui não há GSAP nem Lenis (o Easy MEI usa os dois): a pastilha do hover
 * e o recolhimento na descida são feitos com transform + transition do CSS.
 */


export default function Nav() {
  const [solido, setSolido] = useState(false);
  const [menu, setMenu] = useState(false);
  const barra = useRef<HTMLElement>(null);
  const lista = useRef<HTMLElement>(null);
  const pilula = useRef<HTMLSpanElement>(null);

  /* recolhe na descida, volta na subida — mas nunca acima da dobra,
     onde recolher pareceria defeito */
  useEffect(() => {
    const el = barra.current;
    if (!el) return;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ultimo = window.scrollY;
    let oculta = false;
    const aoRolar = () => {
      const y = window.scrollY;
      setSolido(y > 8);
      const descendo = y > ultimo;
      ultimo = y;
      if (reduz) return;
      if (y < 300) {
        if (oculta) { oculta = false; el.style.transform = "translateY(0)"; }
        return;
      }
      if (descendo && !oculta) { oculta = true; el.style.transform = "translateY(-130%)"; }
      else if (!descendo && oculta) { oculta = false; el.style.transform = "translateY(0)"; }
    };
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  /* Com a folha aberta a página não pode rolar por trás. */
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", fechar);
    return () => { window.removeEventListener("keydown", fechar); document.body.style.overflow = ""; };
  }, [menu]);

  /* a pastilha desliza sob o item apontado */
  useEffect(() => {
    const ul = lista.current, p = pilula.current;
    if (!ul || !p) return;
    let armada = false;
    const entrar = (e: PointerEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a || !ul.contains(a)) return;
      const r = a.getBoundingClientRect(), ur = ul.getBoundingClientRect();
      // sem transição no primeiro encaixe: ela viria voando do canto esquerdo
      if (!armada) { armada = true; p.style.transition = "none"; }
      p.style.transform = `translate(${r.left - ur.left}px, -50%)`;
      p.style.width = `${r.width}px`;
      p.style.opacity = "1";
      if (p.style.transition === "none") {
        requestAnimationFrame(() => { p.style.transition = ""; });
      }
    };
    const sair = () => { p.style.opacity = "0"; };
    ul.addEventListener("pointerover", entrar);
    ul.addEventListener("pointerleave", sair);
    return () => {
      ul.removeEventListener("pointerover", entrar);
      ul.removeEventListener("pointerleave", sair);
    };
  }, []);

  return (
    <header ref={barra} className="nav-barra">
      <div className={"pilula nav-caixa" + (solido ? " nav-caixa--solida" : "")}>
        <ScrollLink href="#topo" className="nav-marca">
          <span className="relative h-7 w-7 shrink-0">
            <Image src="/images/logo/logo.png" alt="" aria-hidden="true" fill className="object-contain" />
          </span>
          <span className="nav-marca__texto">Easy<em>NFe</em></span>
        </ScrollLink>

        <nav ref={lista} aria-label="Principal" className="nav-lista">
          <span ref={pilula} aria-hidden="true" className="pilula nav-pastilha" />
          {ITENS.map((i) => (
            <ScrollLink key={i.href} href={i.href} className="nav-item">
              {i.rotulo}
            </ScrollLink>
          ))}
        </nav>

        <Link href="/cadastro" className="pilula nav-teste">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
          Teste grátis 7 dias
        </Link>

        <Link href="/login" className="pilula nav-entrar">Entrar</Link>

        {/* Abaixo de md os itens somem, e sem isto o celular fica sem
            navegação nenhuma. 44px de alvo, que é o mínimo de toque. */}
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Abrir menu"
          aria-expanded={menu}
          className="nav-hamburguer"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
        </button>
      </div>

      {/* a folha */}
      <div className={"nav-folha" + (menu ? " nav-folha--aberta" : "")} aria-hidden={!menu}>
        <button
          type="button"
          tabIndex={menu ? 0 : -1}
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
          className="nav-folha__veu"
        />
        <nav aria-label="Menu" className="nav-folha__painel">
          <div className="flex items-center justify-between">
            <span className="nav-marca">
              <span className="relative h-7 w-7 shrink-0">
                <Image src="/images/logo/logo.png" alt="" aria-hidden="true" fill className="object-contain" />
              </span>
              <span className="nav-marca__texto">Easy<em>NFe</em></span>
            </span>
            <button
              type="button"
              tabIndex={menu ? 0 : -1}
              onClick={() => setMenu(false)}
              aria-label="Fechar menu"
              className="nav-hamburguer nav-hamburguer--fechar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>

          <ul className="nav-folha__lista">
            {ITENS.map((i) => (
              <li key={i.href} onClick={() => setMenu(false)}>
                <ScrollLink href={i.href} className="nav-folha__item">
                  {i.rotulo}
                </ScrollLink>
              </li>
            ))}
          </ul>

          <Link
            href="/cadastro"
            tabIndex={menu ? 0 : -1}
            onClick={() => setMenu(false)}
            className="pilula nav-folha__acao"
          >
            Teste grátis 7 dias
          </Link>
          <Link
            href="/login"
            tabIndex={menu ? 0 : -1}
            onClick={() => setMenu(false)}
            className="pilula nav-folha__acao nav-folha__acao--fantasma"
          >
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}
