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
// flat = grupo renderiza itens direto, sem header colapsável (corta ruído de
// grupos pequenos). Ordem segue o fluxo de uso: início → saída fiscal →
// comercial → entrada fiscal → cadastros → sistema.
type Grupo = { titulo: string; itens: Item[]; flat?: boolean };

const grupos: Grupo[] = [
  {
    titulo: "Geral",
    flat: true,
    itens: [
      { href: "/painel", label: "Dashboard", icon: <IconGrid />, feature: "dashboard" },
      { href: "/relatorios", label: "Relatórios", icon: <IconReport />, feature: "dashboard" },
    ],
  },
  // Só o que gera documento fiscal de saída.
  {
    titulo: "Emissão de notas",
    itens: [
      { href: "/notas/nova", label: "Emitir nova nota", icon: <IconPlus />, feature: "emitir_nfe" },
      { href: "/orcamentos", label: "Orçamentos", icon: <IconClipboard />, feature: "orcamentos" },
      { href: "/notas", label: "Notas emitidas", icon: <IconList />, feature: "notas_listar" },
    ],
  },
  // Venda sem nota e fiado não são emissão fiscal — vivem no comercial.
  {
    titulo: "Vendas e fiado",
    itens: [
      { href: "/vendas", label: "Vendas sem nota", icon: <IconCart />, feature: "vendas" },
      { href: "/caderneta", label: "Caderneta", icon: <IconBook />, feature: "clientes" },
    ],
  },
  // Documento fiscal que CHEGA (de terceiros), não que sai.
  {
    titulo: "Notas de entrada",
    itens: [
      { href: "/recebidas", label: "Notas recebidas", icon: <IconInbox />, feature: "dfe" },
      { href: "/importar", label: "Importar XML", icon: <IconImport />, feature: "importar_xml" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/produtos", label: "Produtos", icon: <IconBox />, feature: "produtos" },
      { href: "/estoque", label: "Estoque", icon: <IconLayers />, feature: "estoque" },
      { href: "/clientes", label: "Clientes", icon: <IconUser />, feature: "clientes" },
      { href: "/fornecedores", label: "Fornecedores", icon: <IconFactory />, feature: "fornecedores" },
      { href: "/transportadoras", label: "Transportadoras", icon: <IconTruck />, feature: "transportadoras" },
    ],
  },
  {
    titulo: "Sistema",
    flat: true,
    itens: [
      { href: "/configuracoes", label: "Configurações", icon: <IconGear /> },
      { href: "/eventos", label: "Eventos", icon: <IconActivity />, feature: "notas_listar" },
      { href: "/integracao", label: "Integração", icon: <IconPlug /> },
    ],
  },
];

const COLAPSADOS_CACHE_KEY = "sidebar:colapsados";

const FEATURES_CACHE_KEY = "sidebar:features";

// Cache local das features p/ semear o primeiro render e evitar flash no F5.
function lerFeaturesCache(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FEATURES_CACHE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function gravarFeaturesCache(features: string[]) {
  try {
    window.localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(features));
  } catch {
    // ignora (modo privado / quota)
  }
}

export default function Sidebar({
  aberto = false,
  onFechar,
}: {
  aberto?: boolean;
  onFechar?: () => void;
}) {
  const pathname = usePathname();
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[] | null>(null);
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  // Fecha o drawer mobile ao navegar.
  useEffect(() => {
    onFechar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Semeia estado de colapso do localStorage (persiste entre F5).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLAPSADOS_CACHE_KEY);
      if (raw) setColapsados(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignora (modo privado / quota)
    }
  }, []);

  const alternarGrupo = (titulo: string) =>
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(titulo)) next.delete(titulo);
      else next.add(titulo);
      try {
        window.localStorage.setItem(COLAPSADOS_CACHE_KEY, JSON.stringify([...next]));
      } catch {
        // ignora
      }
      return next;
    });

  useEffect(() => {
    // Semeia do cache após montar (evita mismatch de hidratação) e revalida.
    const cache = lerFeaturesCache();
    if (cache) setFeatures(cache);
    listarEmpresas().then(setEmpresas).catch(() => {});
    papelAtual().then(setRole).catch(() => {});
    obterMinhasFeatures()
      .then((f) => {
        setFeatures(f);
        gravarFeaturesCache(f);
      })
      .catch(() => setFeatures([]));
  }, []);

  // Acesso total às funcionalidades (admin, suporte e contador).
  const acessoTotal = role === "ADMIN" || role === "SUPORTE" || role === "CONTADOR";
  // Painel administrativo: só admin/suporte (contador NÃO).
  const painelAdmin = role === "ADMIN" || role === "SUPORTE";

  // Filtra itens pelas features do plano. Acesso total vê tudo. Enquanto carrega
  // (features === null, sem cache) esconde os itens com feature — evita flash de
  // item bloqueado no F5; é melhor aparecer depois do que sumir depois.
  const podeVer = (it: Item) =>
    acessoTotal || !it.feature || (features !== null && features.includes(it.feature));

  // Suporte via WhatsApp: só planos com o benefício "suporte_prioritário".
  const temSuportePrioritario = acessoTotal || (features?.includes("suporte_prioritario") ?? false);

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
    <>
      {/* Backdrop do drawer mobile */}
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onFechar}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] shrink-0 flex-col bg-gradient-to-b from-[var(--sidebar)] to-[var(--sidebar-2)] text-slate-300 transition-transform duration-300 ease-in-out " +
          "lg:sticky lg:top-0 lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 " +
          (aberto ? "translate-x-0 shadow-2xl" : "-translate-x-full")
        }
      >
        <button
          onClick={onFechar}
          aria-label="Fechar menu"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      <div className="flex items-center gap-3 px-5 pb-3 pt-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="relative h-10 w-10 shrink-0"
        >
          <Image src="/images/logo/logo.png" alt="Easy-NFe" fill className="object-contain" />
        </motion.div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Easy-NFe</p>
          <p className="text-xs text-slate-400">Emissão de NF-e · GO</p>
        </div>
      </div>

      <SeletorEmpresa empresas={empresas} />

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {gruposRender.map((g, gi) => {
          const temAtivo = g.itens.some((i) => i.href === hrefAtivo);
          // Grupo da rota atual sempre abre (não esconde onde o usuário está).
          const colapsado = !g.flat && colapsados.has(g.titulo) && !temAtivo;
          const itens = g.itens.map((item) => {
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
          });

          // Grupo flat (1 item / sistema): sem header, só um divisor sutil acima.
          if (g.flat) {
            return (
              <div key={g.titulo} className={gi > 0 ? "mt-2 border-t border-white/5 pt-2" : ""}>
                <ul className="space-y-1">{itens}</ul>
              </div>
            );
          }

          return (
            <div key={g.titulo} className="pt-2">
              <button
                onClick={() => alternarGrupo(g.titulo)}
                className="flex w-full items-center justify-between rounded-md px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-300"
              >
                {g.titulo}
                <motion.span animate={{ rotate: colapsado ? -90 : 0 }} transition={{ duration: 0.2 }} className="text-slate-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {!colapsado && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="space-y-1 overflow-hidden"
                  >
                    {itens}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 mt-2 space-y-2 border-t border-white/5 pt-3">
        {temSuportePrioritario && (
          <a
            href="https://wa.me/5562996183309"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2.5 text-sm font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/20 transition hover:bg-emerald-500/25 hover:text-emerald-200"
          >
            <IconWhatsApp />
            Suporte via WhatsApp
          </a>
        )}
        <form action={sair}>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
            Sair
          </button>
        </form>
      </div>
    </aside>
    </>
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
function IconReport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" />
      <path d="M8 13h2" /><path d="M8 17h5" /><path d="M14 13h2v4" />
    </svg>
  );
}
function IconCart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
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
function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function IconFactory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" />
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
function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 14l2 2 4-4" />
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
function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
// lucide: file-up
function IconImport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M12 12v6" />
      <path d="m15 15-3-3-3 3" />
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
function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
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
