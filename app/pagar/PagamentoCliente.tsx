"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/app/ui/primitives";
import { formatBRL, formatData } from "@/lib/format";
import { obterFaturaPublica, gerarCobrancaFatura, conferirPagamento, type DadosPagamento } from "./actions";

type Fatura = { planoNome: string; valor: number; vencimento: string; status: string; metodo: string | null };

export default function PagamentoCliente({ token }: { token: string }) {
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [metodo, setMetodo] = useState<"pix" | "boleto" | null>(null);
  const [dados, setDados] = useState<Extract<DadosPagamento, { ok: true }> | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pago, setPago] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    obterFaturaPublica(token)
      .then((r) => {
        if ("erro" in r) setErro(r.erro);
        else { setFatura(r); if (r.status === "PAGA") setPago(true); }
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar a cobrança."))
      .finally(() => setCarregando(false));
  }, [token]);

  async function escolher(m: "pix" | "boleto") {
    setMetodo(m);
    setDados(null);
    setErro(null);
    setGerando(true);
    const r = await gerarCobrancaFatura(token, m);
    setGerando(false);
    if ("erro" in r) { setErro(r.erro); return; }
    setDados(r);
  }

  const verificar = useCallback(async () => {
    const r = await conferirPagamento(token);
    if (r.status === "paga") setPago(true);
    return r.status;
  }, [token]);

  // Poll enquanto há cobrança pendente.
  useEffect(() => {
    if (!dados || pago) return;
    const id = setInterval(() => { void verificar(); }, 6000);
    return () => clearInterval(id);
  }, [dados, pago, verificar]);

  function copiar(txt: string) {
    navigator.clipboard?.writeText(txt).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  }

  if (carregando) {
    return <div className="flex items-center gap-3 py-10 text-sm text-[var(--muted)]"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" /> Carregando cobrança…</div>;
  }

  if (pago) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Pagamento confirmado!</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Sua assinatura está ativa. Bom uso!</p>
        <a href="/painel" className="mt-5 inline-block rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5">Ir para o sistema</a>
      </div>
    );
  }

  if (!fatura) {
    return <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">{erro ?? "Cobrança não encontrada."}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
        <p className="text-sm text-[var(--muted)]">Plano <span className="font-semibold text-slate-900">{fatura.planoNome}</span></p>
        <p className="mt-1 text-2xl font-bold text-[var(--primary)]">{formatBRL(fatura.valor)}</p>
        <p className="text-xs text-[var(--muted)]">Vence em {formatData(fatura.vencimento)}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Escolha como pagar</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => escolher("pix")}
            className={"flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition " + (metodo === "pix" ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:border-slate-300")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 3 3-3 3-3-3 3-3Z" /><path d="m12 16 3 3-3 3-3-3 3-3Z" /><path d="m2 12 3-3 3 3-3 3-3-3Z" /><path d="m16 12 3-3 3 3-3 3-3-3Z" /></svg>
            Pix
          </button>
          <button
            onClick={() => escolher("boleto")}
            className={"flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition " + (metodo === "boleto" ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:border-slate-300")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5v14" /><path d="M7 5v14" /><path d="M11 5v14" /><path d="M15 5v14" /><path d="M19 5v14" /></svg>
            Boleto
          </button>
        </div>
      </div>

      {gerando && (
        <div className="flex items-center gap-3 py-4 text-sm text-[var(--muted)]"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" /> Gerando cobrança…</div>
      )}

      {erro && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}

      <AnimatePresence mode="wait">
        {dados?.metodo === "pix" && (
          <motion.div key="pix" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3 text-center">
            {dados.pixQrImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:image/png;base64,${dados.pixQrImage}`} alt="QR Code Pix" className="mx-auto h-52 w-52 rounded-lg border border-[var(--border)] bg-white p-2" />
            ) : (
              <p className="text-sm text-[var(--muted)]">QR sendo gerado…</p>
            )}
            <p className="text-xs text-[var(--muted)]">Escaneie no app do banco ou use o copia-e-cola:</p>
            {dados.pixCopiaECola && (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-left font-mono text-xs">{dados.pixCopiaECola}</code>
                <Button variante="secondary" onClick={() => copiar(dados.pixCopiaECola!)}>{copiado ? "Copiado!" : "Copiar"}</Button>
              </div>
            )}
            <p className="text-xs text-[var(--muted)]">A confirmação é automática após o pagamento.</p>
          </motion.div>
        )}

        {dados?.metodo === "boleto" && (
          <motion.div key="boleto" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {dados.bankSlipUrl && (
              <a href={dados.bankSlipUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5">
                Abrir boleto (PDF)
              </a>
            )}
            {dados.linhaDigitavel ? (
              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">Linha digitável:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs">{dados.linhaDigitavel}</code>
                  <Button variante="secondary" onClick={() => copiar(dados.linhaDigitavel!)}>{copiado ? "Copiado!" : "Copiar"}</Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">Linha digitável sendo gerada — use o PDF acima.</p>
            )}
            <p className="text-xs text-[var(--muted)]">A compensação do boleto leva até 2 dias úteis.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {dados && (
        <div className="flex items-center justify-center gap-2 border-t border-[var(--border)] pt-4">
          <span className="text-xs text-[var(--muted)]">Já pagou?</span>
          <Button variante="secondary" onClick={() => verificar()}>Verificar pagamento</Button>
        </div>
      )}
    </div>
  );
}
