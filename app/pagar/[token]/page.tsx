import Image from "next/image";
import PagamentoCliente from "../PagamentoCliente";

export const metadata = { title: "Pagamento · Easy-NFe" };

export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/images/logo/logo-completa.png" alt="Easy-NFe" width={863} height={309} priority className="h-12 w-auto" />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-5 text-lg font-semibold tracking-tight">Pagamento da assinatura</h1>
          <PagamentoCliente token={token} />
        </div>
      </div>
    </div>
  );
}
