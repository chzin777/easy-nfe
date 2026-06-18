"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { Button, Field, Input } from "@/app/ui/primitives";
import { entrar, type AuthResultado } from "../auth/actions";

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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado esquerdo — formulário */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center">
            <span className="relative block h-12 w-48 shrink-0">
              <Image src="/images/logo/Easy%20NFe%20-%20logo%20completa.png" alt="easy-nfe" fill className="object-contain object-left" priority />
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bem-vindo de volta</h1>
          <p className="mt-1.5 text-sm text-[var(--muted)]">Acesse sua conta para emitir e gerenciar suas notas.</p>

          <form action={formAction} className="mt-8 space-y-4">
            <Field label="E-mail" required>
              <Input name="email" type="email" placeholder="voce@empresa.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha" required>
              <Input name="senha" type="password" placeholder="••••••••" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Field>

            {erro && (
              <p className="flex items-center gap-2 rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                {erro}
              </p>
            )}

            <Button type="submit" disabled={pendente} className="w-full justify-center bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] py-2.5 text-white shadow-lg shadow-violet-500/25">
              {pendente ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-[var(--muted)]">
            Não tem acesso? Fale com o administrador da sua empresa.
          </p>
        </div>
      </div>

      {/* Lado direito — imagem de fundo + texto por cima */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[var(--primary)] via-[var(--primary-2)] to-indigo-700 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <Image
          src="https://www.varitus.com.br/wp-content/uploads/2023/09/varitus-25-09-23.png"
          alt="easy-nfe"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        {/* Overlay p/ legibilidade do texto */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/85 via-[var(--primary-2)]/80 to-indigo-900/85" />

        <div className="relative z-10 max-w-md text-white">
          <h2 className="text-3xl font-bold leading-tight">Emita NF-e em segundos, direto do seu sistema.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            Assinatura digital A1, envio à SEFAZ, DANFE e cancelamento — tudo em um só lugar, com integrações que economizam seu tempo.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Vendas online viram NF-e automática",
              "Integração com WhatsApp",
              "Envio automático de NF-e por e-mail",
              "Multiempresa e multiusuário",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-sm italic leading-relaxed text-white/90">
              “Reduzimos o tempo de emissão de notas em 80%. A integração com nosso ERP foi o divisor de águas.”
            </p>
            <p className="mt-3 text-xs font-semibold text-white/70">— Cliente easy-nfe</p>
          </div>
        </div>
      </div>
    </div>
  );
}
