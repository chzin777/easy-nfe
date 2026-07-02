"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Field, Input } from "@/app/ui/primitives";
import { redefinirSenha, type RedefinirResultado } from "../recuperar-senha/actions";

export default function RedefinirForm({ token, valido = true }: { token: string; valido?: boolean }) {
  const [estado, formAction, pendente] = useActionState<RedefinirResultado | null, FormData>(
    redefinirSenha,
    null,
  );
  const erro = estado && "erro" in estado ? estado.erro : null;
  const ok = estado && "ok" in estado;

  // Token ausente, expirado ou já usado — validado no servidor. Não mostra o form.
  if (!token || !valido) {
    return (
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft,#fee2e2)] text-[var(--danger)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Link inválido ou expirado</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          {token
            ? "Este link já foi usado ou expirou. Cada link vale uma única vez e por 1 hora. Solicite um novo."
            : "Este link de redefinição está incompleto. Solicite um novo."}
        </p>
        <Link href="/recuperar-senha" className="mt-6 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
          Solicitar novo link →
        </Link>
      </div>
    );
  }

  if (ok) {
    return (
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Senha redefinida!</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          Sua senha foi atualizada. Já pode entrar com a nova senha.
        </p>
        <Link
          href="/login"
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nova senha</h1>
      <p className="mt-1.5 text-sm text-[var(--muted)]">Escolha uma nova senha para sua conta.</p>

      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Nova senha" required hint="Mín. 8 caracteres">
          <Input name="senha" type="password" placeholder="••••••••" autoComplete="new-password" required />
        </Field>
        <Field label="Confirmar senha" required>
          <Input name="confirmar" type="password" placeholder="••••••••" autoComplete="new-password" required />
        </Field>

        {erro && (
          <p className="flex items-center gap-2 rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            {erro}
          </p>
        )}

        <Button type="submit" disabled={pendente} className="w-full justify-center bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] py-2.5 text-white shadow-lg shadow-violet-500/25">
          {pendente ? "Salvando…" : "Redefinir senha"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">Voltar para o login</Link>
      </p>
    </>
  );
}
