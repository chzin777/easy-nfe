"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Button, Field, Input } from "@/app/ui/primitives";
import { formatBRL } from "@/lib/format";
import PagamentoCliente from "@/app/pagar/PagamentoCliente";
import {
  cadastrarTrial,
  cadastrarAssinatura,
  criarLead,
  type CadastroResultado,
  type AssinaturaResultado,
  type LeadResultado,
} from "./actions";
import type { PlanoOpcao } from "./page";

type Modo = "trial" | "assinatura" | "contato";

export default function CadastroForm({
  selecionado,
  querTrial = false,
}: {
  selecionado: PlanoOpcao | null;
  querTrial?: boolean;
}) {
  // Decide o modo inicial:
  // - plano sob consulta → contato
  // - veio do botão "Testar grátis" (e o plano permite) → trial
  // - plano pago escolhido → assinatura (gera link de pagamento)
  // - sem plano na URL → trial (entrada padrão)
  const modoInicial: Modo = selecionado?.sobConsulta
    ? "contato"
    : querTrial
      ? "trial"
      : selecionado
        ? "assinatura"
        : "trial";
  const [modo, setModo] = useState<Modo>(modoInicial);

  const [trialState, trialAction, trialPend] = useActionState<CadastroResultado | null, FormData>(cadastrarTrial, null);
  const [assinState, assinAction, assinPend] = useActionState<AssinaturaResultado | null, FormData>(cadastrarAssinatura, null);
  const [leadState, leadAction, leadPend] = useActionState<LeadResultado | null, FormData>(criarLead, null);

  const trialErro = trialState && "erro" in trialState ? trialState.erro : null;
  const assinErro = assinState && "erro" in assinState ? assinState.erro : null;
  const leadErro = leadState && "erro" in leadState ? leadState.erro : null;
  const leadOk = leadState && "ok" in leadState;
  const assinOk = assinState && "ok" in assinState ? assinState : null;

  useEffect(() => {
    if (trialState && "ok" in trialState) window.location.href = trialState.destino;
  }, [trialState]);

  const planoNomeSel = selecionado?.nome ?? "";
  const podeTrial = !!selecionado?.permiteTrial;
  const temPreco = (selecionado?.preco ?? 0) > 0;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <Image
        src="/images/logo/logo-completa.png"
        alt="Easy-NFe"
        width={863}
        height={309}
        priority
        className="absolute left-6 top-6 z-20 h-20 w-auto sm:left-8 sm:top-8"
      />

      {/* Form */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {assinOk ? (
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Conta criada! Pague para ativar</h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">Escolha Pix ou boleto abaixo. Seu acesso já está liberado — você pode pagar agora ou pelo link a qualquer momento.</p>
              <div className="mt-6">
                <PagamentoCliente token={assinOk.token} />
              </div>
              <a href={assinOk.destino} className="mt-5 inline-block text-sm font-medium text-[var(--primary)] hover:underline">Pular e ir para o sistema →</a>
            </div>
          ) : modo === "assinatura" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Criar conta e assinar</h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {planoNomeSel ? <>Plano <span className="font-semibold text-slate-900">{planoNomeSel}</span>{temPreco && <> · {formatBRL(selecionado!.preco)}/{selecionado!.periodicidade === "anual" ? "ano" : "mês"}</>}.</> : "Crie sua conta para assinar."} Geramos um link de pagamento (Pix, boleto ou cartão).
              </p>

              <form action={assinAction} className="mt-8 space-y-4">
                <Field label="Nome" required>
                  <Input name="nome" placeholder="Seu nome" autoComplete="name" required />
                </Field>
                <Field label="CPF/CNPJ" required hint="Usado na cobrança">
                  <Input name="cpfCnpj" placeholder="Somente números" inputMode="numeric" required />
                </Field>
                <Field label="E-mail" required>
                  <Input name="email" type="email" placeholder="voce@empresa.com" autoComplete="email" required />
                </Field>
                <Field label="Telefone (WhatsApp)">
                  <Input name="telefone" placeholder="(00) 00000-0000" autoComplete="tel" />
                </Field>
                <Field label="Senha" required hint="Mín. 8 caracteres">
                  <Input name="senha" type="password" placeholder="••••••••" autoComplete="new-password" required />
                </Field>
                <input type="hidden" name="planoId" value={selecionado?.id ?? ""} />

                {assinErro && <ErroBox>{assinErro}</ErroBox>}

                <Button
                  type="submit"
                  disabled={assinPend}
                  className="w-full justify-center bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] py-2.5 text-white shadow-lg shadow-violet-500/25"
                >
                  {assinPend ? "Criando conta…" : "Criar conta e gerar pagamento"}
                </Button>
              </form>

              <div className="mt-6 space-y-1.5 text-center text-xs text-[var(--muted)]">
                {podeTrial && (
                  <p>
                    Prefere testar antes?{" "}
                    <button type="button" onClick={() => setModo("trial")} className="font-medium text-[var(--primary)] hover:underline">
                      Teste grátis por 7 dias
                    </button>
                  </p>
                )}
                <p>
                  Quer falar antes?{" "}
                  <button type="button" onClick={() => setModo("contato")} className="font-medium text-[var(--primary)] hover:underline">
                    Fale com nossa equipe
                  </button>
                </p>
              </div>
            </>
          ) : modo === "trial" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Teste grátis por 7 dias</h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                Sem cartão. Crie sua conta e comece a emitir no plano Básico.
              </p>

              <form action={trialAction} className="mt-8 space-y-4">
                <Field label="Nome" required>
                  <Input name="nome" placeholder="Seu nome" autoComplete="name" required />
                </Field>
                <Field label="E-mail" required>
                  <Input name="email" type="email" placeholder="voce@empresa.com" autoComplete="email" required />
                </Field>
                <Field label="Telefone (WhatsApp)">
                  <Input name="telefone" placeholder="(00) 00000-0000" autoComplete="tel" />
                </Field>
                <Field label="Senha" required hint="Mín. 8 caracteres">
                  <Input name="senha" type="password" placeholder="••••••••" autoComplete="new-password" required />
                </Field>

                {trialErro && <ErroBox>{trialErro}</ErroBox>}

                <Button
                  type="submit"
                  disabled={trialPend}
                  className="w-full justify-center bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] py-2.5 text-white shadow-lg shadow-violet-500/25"
                >
                  {trialPend ? "Criando conta…" : "Começar teste grátis"}
                </Button>
              </form>

              <div className="mt-6 space-y-1.5 text-center text-xs text-[var(--muted)]">
                {temPreco && (
                  <p>
                    Já quer assinar?{" "}
                    <button type="button" onClick={() => setModo("assinatura")} className="font-medium text-[var(--primary)] hover:underline">
                      Assinar e pagar agora
                    </button>
                  </p>
                )}
                <p>
                  Prefere conversar antes?{" "}
                  <button type="button" onClick={() => setModo("contato")} className="font-medium text-[var(--primary)] hover:underline">
                    Fale com nossa equipe
                  </button>
                </p>
              </div>
            </>
          ) : leadOk ? (
            <div className="rounded-2xl border border-[var(--border)] bg-slate-50 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <h1 className="mt-4 text-xl font-bold text-slate-900">Recebemos seu contato!</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">Nossa equipe vai falar com você em breve.</p>
              <Link href="/" className="mt-6 inline-block text-sm font-medium text-[var(--primary)] hover:underline">Voltar ao início</Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fale com nossa equipe</h1>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                Deixe seus dados e entramos em contato.
              </p>

              <form action={leadAction} className="mt-8 space-y-4">
                <Field label="Nome" required>
                  <Input name="nome" placeholder="Seu nome" autoComplete="name" required />
                </Field>
                <Field label="E-mail" required>
                  <Input name="email" type="email" placeholder="voce@empresa.com" autoComplete="email" required />
                </Field>
                <Field label="Telefone (WhatsApp)" required>
                  <Input name="telefone" placeholder="(00) 00000-0000" autoComplete="tel" required />
                </Field>
                <Field label="Empresa">
                  <Input name="empresa" placeholder="Razão social / nome fantasia" autoComplete="organization" />
                </Field>
                <Field label="Mensagem">
                  <Input name="mensagem" placeholder="Conte rapidamente o que precisa" />
                </Field>
                <input type="hidden" name="planoId" value={selecionado?.id ?? ""} />
                <input type="hidden" name="planoNome" value={planoNomeSel} />

                {leadErro && <ErroBox>{leadErro}</ErroBox>}

                <Button
                  type="submit"
                  disabled={leadPend}
                  className="w-full justify-center bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] py-2.5 text-white shadow-lg shadow-violet-500/25"
                >
                  {leadPend ? "Enviando…" : "Quero ser contatado"}
                </Button>
              </form>

              {!selecionado?.sobConsulta && (
                <p className="mt-6 text-center text-xs text-[var(--muted)]">
                  Quer começar agora?{" "}
                  <button type="button" onClick={() => setModo(temPreco ? "assinatura" : "trial")} className="font-medium text-[var(--primary)] hover:underline">
                    {temPreco ? "Assinar e pagar" : "Começar teste grátis de 7 dias"}
                  </button>
                </p>
              )}
            </>
          )}

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted)]">ou</span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <motion.a
            href="/login"
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="mt-4 flex w-full items-center justify-center rounded-lg border border-[var(--primary)] py-2.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-white"
          >
            Entrar
          </motion.a>

          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            Já tem conta? Acesse com seu e-mail e senha.
          </p>
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
          <h2 className="text-3xl font-bold leading-tight">Comece a emitir hoje, sem burocracia.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            Assinatura A1, envio à SEFAZ, DANFE e integrações. Pague com Pix, boleto ou cartão.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Configure sua empresa em minutos",
              "Emita NF-e e NFC-e direto do sistema",
              "Multiempresa e multiusuário",
              "Suporte humano de verdade",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ErroBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
      {children}
    </p>
  );
}
