"use client";

import { Card, PageHeader } from "@/app/ui/primitives";

export default function NotasRecebidasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notas recebidas (DF-e)"
        subtitulo="Captura automática das notas emitidas contra o seu CNPJ."
      />

      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
        </div>
        <h2 className="text-xl font-bold tracking-tight">Em breve</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
          A captura das notas recebidas (Distribuição DF-e) e a manifestação do destinatário
          estão em desenvolvimento. Avisaremos assim que estiver disponível.
        </p>
      </Card>
    </div>
  );
}
