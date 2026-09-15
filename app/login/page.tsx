"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import Portao from "@/app/ui/Portao";
import { entrar, type AuthResultado } from "../auth/actions";

/**
 * LOGIN — o formulário dentro do Portão (a casca compartilhada com o
 * cadastro). O acesso continua sendo por e-mail e senha.
 */
export default function LoginPage() {
  const [estado, formAction, pendente] = useActionState<AuthResultado | null, FormData>(
    entrar,
    null,
  );
  const erro = estado && "erro" in estado ? estado.erro : null;
  // Controlados p/ preservar o que foi digitado quando o login falha.
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  // Sucesso → navega no cliente (evita re-render do destino dentro da server action).
  useEffect(() => {
    if (estado && "ok" in estado) window.location.href = estado.destino;
  }, [estado]);

  return (
    <Portao>
      <h1 className="portao__titulo">Entrar no painel</h1>
      <p className="portao__linha">
        Suas notas, seus clientes e seus documentos fiscais em um lugar só.
      </p>

      <form className="portao__forma" action={formAction}>
        <label className="campo" htmlFor="email">
          <span className="campo__rotulo">E-mail</span>
          <input
            id="email"
            name="email"
            className="campo__entrada"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="campo" htmlFor="senha">
          <span className="campo__rotulo">Senha</span>
          <input
            id="senha"
            name="senha"
            className="campo__entrada"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>

        {erro && (
          <p className="portao__aviso" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            {erro}
          </p>
        )}

        <button className="botao--cheio" type="submit" disabled={pendente}>
          {pendente ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-5 text-[14px] text-[var(--muted)]">
        <Link href="/recuperar-senha" className="-my-3 inline-flex min-h-[44px] items-center hover:text-[var(--foreground)]">
          Esqueci minha senha
        </Link>
        {" · "}
        <Link href="/cadastro" className="portao__elo -my-3 inline-flex min-h-[44px] items-center">
          criar conta
        </Link>
      </p>

      <p className="portao__rodape">Easy-NFe · teste grátis por 7 dias</p>
    </Portao>
  );
}
