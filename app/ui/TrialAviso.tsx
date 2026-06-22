"use client";

import { useEffect, useState } from "react";
import { estadoTrial, iniciarPagamentoAssinatura, type EstadoTrial } from "@/app/assinatura-actions";

// Aviso de expiração do trial (a partir do 5º dia), acima da barra "Integração
// SEFAZ-GO ativa". Botão leva à tela de pagamento (Pix/boleto/cartão).
export default function TrialAviso() {
  const [estado, setEstado] = useState<EstadoTrial | null>(null);
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    estadoTrial().then(setEstado).catch(() => setEstado(null));
  }, []);

  if (!estado?.mostrar) return null;

  async function assinar() {
    setIndo(true);
    setErro(null);
    const r = await iniciarPagamentoAssinatura();
    if ("erro" in r) { setErro(r.erro); setIndo(false); return; }
    window.location.href = `/pagar/${r.token}`;
  }

  const msg = estado.expirado
    ? "Seu período de testes expirou. Realize o pagamento e continue emitindo."
    : `Seu período de testes expira em ${estado.diasRestantes} ${estado.diasRestantes === 1 ? "dia" : "dias"}. Realize o pagamento e continue emitindo sem parar.`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-amber-300/60 bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-center text-xs font-medium text-amber-950 sm:text-sm">
      <span className="flex items-center gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
        {msg}
      </span>
      <button
        onClick={assinar}
        disabled={indo}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-900 disabled:opacity-60"
      >
        {indo ? "Abrindo…" : "Assinar agora"}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
      </button>
      {erro && <span className="text-red-900">{erro}</span>}
    </div>
  );
}
