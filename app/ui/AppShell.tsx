"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import AvisoLicenca from "./AvisoLicenca";
import Onboarding from "./Onboarding";
import TrialAviso from "./TrialAviso";
import { obterEstadoLicenca } from "@/app/licenca-actions";
import type { EstadoLicenca } from "@/lib/licenca";
import { sair } from "@/app/auth/actions";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publica =
    pathname === "/" || pathname === "/login" || pathname === "/cadastro" ||
    pathname === "/termos" || pathname === "/privacidade" || pathname.startsWith("/pagar");
  const [estado, setEstado] = useState<EstadoLicenca | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);

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
        <Sidebar aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
        <main className="flex-1 overflow-x-hidden">
          {/* Barra superior mobile com botão de menu */}
          <div className="sticky top-0 z-30 flex items-center border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2.5 backdrop-blur lg:hidden">
            <button
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              className="-ml-1 rounded-lg p-1.5 text-[var(--foreground)] hover:bg-slate-100"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
            </button>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2">
              <div className="relative h-7 w-7 shrink-0">
                <Image src="/images/logo/logo.png" alt="Easy-NFe" fill className="object-contain" />
              </div>
              <span className="text-sm font-semibold">Easy-NFe</span>
            </div>
          </div>
          <TrialAviso />
          {pathname !== "/admin" && !pathname.startsWith("/admin/") && (
            <div className="flex items-center justify-center gap-2 border-b border-[var(--border)] bg-slate-900 px-4 py-2 text-center text-[11px] font-medium text-slate-300 sm:text-xs">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="hidden sm:inline">Integração SEFAZ-GO ativa · emissão em homologação e produção</span>
              <span className="sm:hidden">SEFAZ-GO ativa · homologação e produção</span>
            </div>
          )}
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Onboarding />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
