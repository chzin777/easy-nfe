"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button, Field, Input } from "@/app/ui/primitives";
import { solicitarRedefinicao, type RecuperarResultado } from "./actions";

export default function RecuperarSenhaPage() {
  const [estado, formAction, pendente] = useActionState<RecuperarResultado | null, FormData>(
    solicitarRedefinicao,
    null,
  );
  const erro = estado && "erro" in estado ? estado.erro : null;
  const ok = estado && "ok" in estado;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <Link href="/" aria-label="Voltar à página inicial" className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <Image
          src="/images/logo/logo-completa.png"
          alt="Easy-NFe"
          width={863}
          height={309}
          priority
          className="h-20 w-auto transition hover:opacity-80"
        />
      </Link>

      {/* Form */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {ok ? (
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Confira seu e-mail</h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. O link expira em 1 hora.
              </p>
              <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
                ← Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Esqueceu a senha?</h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
              </p>

              <form action={formAction} className="mt-8 space-y-4">
                <Field label="E-mail" required>
                  <Input name="email" type="email" placeholder="voce@empresa.com" autoComplete="email" required />
                </Field>

                {erro && (
                  <p className="flex items-center gap-2 rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                    {erro}
                  </p>
                )}

                <Button type="submit" disabled={pendente} className="w-full justify-center bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] py-2.5 text-white shadow-lg shadow-violet-500/25">
                  {pendente ? "Enviando…" : "Enviar link de redefinição"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-[var(--muted)]">
                Lembrou a senha?{" "}
                <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">Entrar</Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Painel direito */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[var(--primary)] via-[var(--primary-2)] to-indigo-700 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <Image
          src="https://wallpapers.com/images/hd/purple-abstract-2gf414bg9xvsakmf.jpg"
          alt="Easy-NFe"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/85 via-[var(--primary-2)]/80 to-indigo-900/85" />
        <div className="relative z-10 max-w-md text-white">
          <h2 className="text-3xl font-bold leading-tight">Recupere seu acesso em poucos minutos.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            Enviamos um link seguro para o seu e-mail. Ele expira em 1 hora e só pode ser usado uma vez.
          </p>
        </div>
      </div>
    </div>
  );
}
