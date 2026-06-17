import Link from "next/link";
import { temFeature } from "@/lib/permissoes";

// Gate server-side: renderiza o conteúdo só se o plano do usuário tiver a feature.
export default async function GateFeature({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  if (await temFeature(feature)) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight">Recurso não incluído no seu plano</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Faça upgrade para liberar esta funcionalidade.</p>
        <Link href="/configuracoes" className="mt-6 inline-block rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-5 py-2.5 text-sm font-semibold text-white">
          Ver planos / configurações
        </Link>
      </div>
    </div>
  );
}
