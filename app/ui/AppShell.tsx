"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AvisoLicenca from "./AvisoLicenca";
import { obterEstadoLicenca, type EstadoLicenca } from "@/app/licenca-actions";
import { sair } from "@/app/auth/actions";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publica = pathname === "/" || pathname === "/login";
  const [estado, setEstado] = useState<EstadoLicenca | null>(null);

  useEffect(() => {
    if (publica) return;
    obterEstadoLicenca().then(setEstado).catch(() => setEstado({ bloqueado: false }));
  }, [pathname, publica]);

  // Landing e login não usam a casca do app.
  if (publica) return <>{children}</>;

  // Licença bloqueada → tela cheia de bloqueio.
  if (estado?.bloqueado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-[var(--danger)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Acesso bloqueado</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {estado.mensagem ?? "Sua licença está expirada."}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">Regularize com o administrador para reativar o acesso.</p>
          <form action={sair} className="mt-6">
            <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              Sair
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {estado?.aviso && (
        <AvisoLicenca
          competencia={estado.aviso.competencia}
          valor={estado.aviso.valor}
          alvoBloqueio={estado.aviso.alvoBloqueio}
        />
      )}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">
          {pathname !== "/admin" && !pathname.startsWith("/admin/") && (
            <div className="flex items-center justify-center gap-2 border-b border-[var(--border)] bg-slate-900 px-4 py-2 text-center text-xs font-medium text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Integração SEFAZ-GO ativa · emissão em homologação e produção
            </div>
          )}
          <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
