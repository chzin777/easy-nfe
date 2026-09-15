"use client";

import Link from "next/link";
import Image from "next/image";
import ScrollLink from "./ScrollLink";
import { NAV_ITENS } from "./navItens";
import "./rodape.css";

/**
 * RODAPÉ — na gramática do Easy MEI: fundo escuro, marca grande,
 * colunas de links e uma linha fina embaixo com a microtipografia em mono.
 *
 * O bloco de chamada fica DENTRO do rodapé, não numa seção antes dele:
 * é a última coisa da página, e separar os dois criava duas faixas
 * escuras empilhadas com o mesmo peso.
 */

const WPP_VENDAS =
  "https://wa.me/556282103699?text=" +
  encodeURIComponent("Olá! Tenho dúvidas sobre os planos do Easy-NFe e gostaria de ajuda para escolher o ideal para minha empresa.");

export default function Rodape() {
  return (
    <footer className="rodape">
      <div className="rodape__caixa">
        {/* a chamada final */}
        <div className="rodape__chamada">
          <div>
            <h2 className="rodape__chamada-titulo">
              Sua primeira nota sai hoje.
            </h2>
            <p className="rodape__chamada-linha">
              Teste grátis por 7 dias, sem cartão de crédito.
            </p>
          </div>
          <div className="rodape__chamada-acoes">
            <Link href="/cadastro" className="rodape__botao">Criar conta grátis</Link>
            <a href={WPP_VENDAS} target="_blank" rel="noopener noreferrer" className="rodape__botao rodape__botao--fantasma">
              Falar com a gente
            </a>
          </div>
        </div>

        <div className="rodape__grade">
          <div className="rodape__marca-col">
            <Image
              src="/images/logo/logo-completa.png"
              alt="Easy-NFe"
              width={863}
              height={309}
              className="rodape__logo"
            />
            <p className="rodape__sobre">
              NF-e, NFC-e e NFS-e emitidas em segundos, com DANFE em PDF e entrega
              automática ao cliente por WhatsApp ou e-mail.
            </p>
          </div>

          <div>
            <p className="rodape__medida">Navegar</p>
            <ul className="rodape__lista">
              {NAV_ITENS.map((i) => (
                <li key={i.href}>
                  <ScrollLink href={i.href} className="rodape__elo">{i.rotulo}</ScrollLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="rodape__medida">Conta</p>
            <ul className="rodape__lista">
              <li><Link href="/login" className="rodape__elo">Entrar</Link></li>
              <li><Link href="/cadastro" className="rodape__elo">Criar conta</Link></li>
              <li><Link href="/recuperar-senha" className="rodape__elo">Esqueci a senha</Link></li>
              <li>
                <a href={WPP_VENDAS} target="_blank" rel="noopener noreferrer" className="rodape__elo">
                  Suporte no WhatsApp
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="rodape__medida">Legal</p>
            <ul className="rodape__lista">
              <li><Link href="/termos" className="rodape__elo">Termos de uso</Link></li>
              <li><Link href="/privacidade" className="rodape__elo">Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div className="rodape__linha">
          <p className="rodape__medida rodape__medida--fraca">
            Easy-NFe não é órgão público · a autorização das notas é da SEFAZ
          </p>
          <p className="rodape__medida rodape__medida--fraca">© 2026 Easy-NFe</p>
        </div>
      </div>
    </footer>
  );
}
