"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

// Esconde a casca (sidebar) no login e no painel admin; nas demais rotas renderiza o app.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Landing e login não usam a casca do app. O painel admin usa a sidebar normal.
  if (pathname === "/" || pathname === "/login") {
    return <>{children}</>;
  }

  const ehAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        {/* Barra de status — só nas páginas de emissão (não no admin). */}
        {!ehAdmin && (
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
  );
}
