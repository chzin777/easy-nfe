import Image from "next/image";
import PagamentoCliente from "../PagamentoCliente";

export const metadata = { title: "Pagamento seguro · Easy-NFe" };

export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/images/logo/logo-completa.png" alt="Easy-NFe" width={863} height={309} priority className="h-12 w-auto" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl shadow-slate-200/60">
          {/* Faixa de ambiente seguro */}
          <div className="flex items-center justify-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Ambiente 100% seguro · conexão criptografada
          </div>

          <div className="p-6 sm:p-8">
            <h1 className="text-lg font-semibold tracking-tight">Pagamento da assinatura</h1>
            <p className="mt-1 text-xs text-[var(--muted)]">Confira os dados e escolha a forma de pagamento.</p>
            <div className="mt-5">
              <PagamentoCliente token={token} />
            </div>
          </div>

          {/* Selos de confiança */}
          <div className="border-t border-[var(--border)] bg-slate-50 px-6 py-4">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
                Pagamento protegido
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                Criptografia SSL
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Cancele quando quiser
              </span>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
              Cobrança processada por <span className="font-semibold text-slate-500">Asaas</span>, instituição de pagamento
              regulada pelo Banco Central. Não temos acesso nem armazenamos os dados do seu cartão.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Em caso de dúvidas, fale com nosso suporte. © Easy-NFe
        </p>
      </div>
    </div>
  );
}
