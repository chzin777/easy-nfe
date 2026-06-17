"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { listarEmpresas, trocarEmpresa, type EmpresaResumo } from "@/app/configuracoes/actions";
import { sair, papelAtual } from "@/app/auth/actions";
import { obterMinhasFeatures } from "@/app/permissoes-actions";

type Item = { href: string; label: string; icon: ReactNode; feature?: string };
type Grupo = { titulo: string; itens: Item[] };

const grupos: Grupo[] = [
  {
    titulo: "Geral",
    itens: [{ href: "/painel", label: "Dashboard", icon: <IconGrid />, feature: "dashboard" }],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/produtos", label: "Produtos", icon: <IconBox />, feature: "produtos" },
      { href: "/clientes", label: "Clientes", icon: <IconUser />, feature: "clientes" },
      { href: "/transportadoras", label: "Transportadoras", icon: <IconTruck />, feature: "transportadoras" },
    ],
  },
  {
    titulo: "Emissão de notas",
    itens: [
      { href: "/notas/nova", label: "Emitir nova nota", icon: <IconPlus />, feature: "emitir_nfe" },
      { href: "/notas", label: "Notas emitidas", icon: <IconList />, feature: "notas_listar" },
      { href: "/importar", label: "Importar XML", icon: <IconImport />, feature: "importar_xml" },
    ],
  },
  {
    titulo: "Recursos",
    itens: [{ href: "/integracao", label: "Integração", icon: <IconPlug /> }],
  },
  {
    titulo: "Sistema",
    itens: [{ href: "/configuracoes", label: "Configurações", icon: <IconGear /> }],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[] | null>(null);

  useEffect(() => {
    listarEmpresas().then(setEmpresas).catch(() => {});
    papelAtual().then(setRole).catch(() => {});
    obterMinhasFeatures().then(setFeatures).catch(() => setFeatures([]));
  }, []);

  // Acesso total às funcionalidades (admin, suporte e contador).
  const acessoTotal = role === "ADMIN" || role === "SUPORTE" || role === "CONTADOR";
  // Painel administrativo: só admin/suporte (contador NÃO).
  const painelAdmin = role === "ADMIN" || role === "SUPORTE";

  // Filtra itens pelas features do plano (acesso total vê tudo; enquanto carrega, mostra tudo).
  const podeVer = (it: Item) => acessoTotal || !it.feature || features === null || features.includes(it.feature);

  const gruposRender: Grupo[] = grupos
    .map((g) => {
      let itens = g.itens.filter(podeVer);
      if (painelAdmin && g.titulo === "Sistema") {
        itens = [...itens, { href: "/admin", label: "Painel administrativo", icon: <IconShield /> }];
      }
      return { ...g, itens };
    })
    .filter((g) => g.itens.length > 0);

  // Item ativo = href mais específico (mais longo) que casa com a rota atual.
  // Evita que "/notas" marque ativo quando estamos em "/notas/nova".
  const hrefAtivo = gruposRender
    .flatMap((g) => g.itens.map((i) => i.href))
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-[var(--sidebar)] to-[var(--sidebar-2)] text-slate-300">
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-10 w-10 shrink-0"
        >
          <Image src="/logo-nobg.png" alt="easy-nfe" fill className="object-contain" />
        </motion.div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">easy-nfe</p>
          <p className="text-xs text-slate-400">Emissão de NF-e · GO</p>
        </div>
      </div>

      <SeletorEmpresa empresas={empresas} />

      <nav className="flex-1 space-y-6 px-3 py-2">
        {gruposRender.map((g) => (
          <div key={g.titulo}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {g.titulo}
            </p>
            <ul className="space-y-1">
              {g.itens.map((item) => {
                const ativo = item.href === hrefAtivo;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
                    >
                      {ativo && (
                        <motion.span
                          layoutId="sidebar-ativo"
                          className="absolute inset-0 rounded-lg bg-gradient-to-r from-[var(--primary)]/90 to-[var(--primary-2)]/80 shadow-lg shadow-violet-900/30"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span
                        className={
                          "relative z-10 shrink-0 transition-transform duration-200 group-hover:scale-110 " +
                          (ativo ? "text-white" : "text-slate-400 group-hover:text-white")
                        }
                      >
                        {item.icon}
                      </span>
                      <span
                        className={
                          "relative z-10 transition-colors " +
                          (ativo ? "text-white" : "text-slate-300 group-hover:text-white")
                        }
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-4">
        <form action={sair}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

// Seletor de empresa ativa — dropdown custom animado, topo da sidebar.
function SeletorEmpresa({ empresas }: { empresas: EmpresaResumo[] }) {
  const ativa = empresas.find((e) => e.ativa);
  const [aberto, setAberto] = useState(false);
  const [trocando, setTrocando] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  async function onTrocar(id: string) {
    if (id === ativa?.id) { setAberto(false); return; }
    setTrocando(id);
    await trocarEmpresa(id);
    window.location.reload();
  }

  if (empresas.length === 0) {
    return (
      <div className="mx-3 mb-2 rounded-xl border border-white/5 bg-white/5 p-3">
        <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Empresa ativa</p>
        <Link href="/configuracoes" className="mt-1 block px-0.5 py-1 text-xs font-medium text-amber-300 hover:underline">
          Cadastrar empresa →
        </Link>
      </div>
    );
  }

  const iniciais = (ativa?.razaoSocial ?? "—").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative mx-3 mb-2">
      <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Empresa ativa</p>
      <button
        onClick={() => setAberto((v) => !v)}
        className={
          "flex w-full items-center gap-2.5 rounded-xl border bg-white/5 px-2.5 py-2 text-left transition " +
          (aberto ? "border-[var(--primary)] bg-white/10" : "border-white/10 hover:border-white/20 hover:bg-white/10")
        }
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-[11px] font-bold text-white shadow-sm">
          {iniciais}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{ativa?.razaoSocial ?? "Selecione"}</span>
          {ativa?.cnpj && <span className="block truncate font-mono text-[10px] text-slate-400">{ativa.cnpj}</span>}
        </span>
        <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </motion.span>
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute left-0 right-0 z-40 mt-1.5 max-h-72 origin-top overflow-y-auto rounded-xl border border-white/10 bg-[var(--sidebar-2)] p-1.5 shadow-2xl shadow-black/40"
          >
            {empresas.map((e, i) => {
              const sel = e.id === ativa?.id;
              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <button
                    onClick={() => onTrocar(e.id)}
                    disabled={trocando !== null}
                    className={
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition " +
                      (sel ? "bg-[var(--primary)]/20 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white")
                    }
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold">
                      {e.razaoSocial.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.razaoSocial}</span>
                      <span className="block truncate font-mono text-[10px] text-slate-400">{e.cnpj}</span>
                    </span>
                    {trocando === e.id ? (
                      <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : sel ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--primary)]"><path d="M20 6 9 17l-5-5" /></svg>
                    ) : null}
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Ícones inline (sem dependência externa) ---

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconTruck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
      <path d="M12 18v-6" /><path d="M9 15h6" />
    </svg>
  );
}
function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
      <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
    </svg>
  );
}
function IconImport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
    </svg>
  );
}
function IconPlug() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
