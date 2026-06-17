"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import CountUp from "@/app/ui/CountUp";

// WhatsApp para ativar/agendar integração.
const WPP = "5562996183309";
function whatsapp(msg: string): string {
  return `https://wa.me/${WPP}?text=${encodeURIComponent(msg)}`;
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay },
});

export default function IntegracaoPage() {
  return (
    <div className="space-y-16 pb-10">
      {/* ---- HERO ---- */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--sidebar)] via-[#1a1f38] to-[var(--primary)] px-8 py-16 text-white sm:px-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--primary-2)]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

        <motion.div {...fade()} className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Novo · Integração nativa com Winthor
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Seu ERP Winthor emitindo NF-e
            <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              {" "}sem redigitar nada.
            </span>
          </h1>
          <p className="mt-5 text-lg text-slate-300">
            Produtos, clientes e pedidos fluem direto do Winthor para o easy-nfe. Você seleciona o
            pedido, confere e emite. Zero retrabalho, zero erro de digitação.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={whatsapp("Olá! Quero integrar meu Winthor com o easy-nfe.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-6 py-3 text-base font-semibold text-white shadow-[0_4px_14px_rgba(82,39,255,0.45)] transition hover:-translate-y-0.5"
            >
              <IconWpp /> Quero integrar agora
            </a>
            <a
              href={whatsapp("Olá! Quero falar com um especialista sobre a integração Winthor + easy-nfe.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-6 py-3 text-base font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Falar com especialista
            </a>
          </div>
        </motion.div>

        {/* Fluxo */}
        <motion.div {...fade(0.15)} className="relative mt-12 flex flex-wrap items-center gap-3 text-sm">
          <FluxoChip>Winthor (Oracle)</FluxoChip>
          <Seta />
          <FluxoChip>Sincronização automática</FluxoChip>
          <Seta />
          <FluxoChip>easy-nfe</FluxoChip>
          <Seta />
          <FluxoChip destaque>NF-e autorizada</FluxoChip>
        </motion.div>
      </section>

      {/* ---- MÉTRICAS ---- */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { v: 90, suf: "%", t: "menos tempo de digitação" },
          { v: 0, suf: "", t: "retrabalho de cadastro" },
          { v: 30, suf: "s", t: "do pedido à nota emitida" },
          { v: 100, suf: "%", t: "dados vindos do seu ERP" },
        ].map((m, i) => (
          <motion.div
            key={m.t}
            {...fade(i * 0.08)}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-sm"
          >
            <p className="text-3xl font-bold text-[var(--primary)]">
              <CountUp to={m.v} duration={1.4} suffix={m.suf} />
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{m.t}</p>
          </motion.div>
        ))}
      </section>

      {/* ---- BENEFÍCIOS ---- */}
      <section>
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Por que integrar com o Winthor?</h2>
          <p className="mt-3 text-[var(--muted)]">
            O Winthor já é a fonte da verdade do seu negócio. O easy-nfe só fecha o ciclo fiscal.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {beneficios.map((b, i) => (
            <motion.div
              key={b.titulo}
              {...fade(i * 0.07)}
              className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-md transition-transform group-hover:scale-110">
                {b.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{b.titulo}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---- COMO FUNCIONA ---- */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
        <motion.h2 {...fade()} className="text-center text-3xl font-bold tracking-tight">
          Como funciona
        </motion.h2>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-4">
          {passos.map((p, i) => (
            <motion.div key={p.titulo} {...fade(i * 0.1)} className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-base font-bold text-[var(--primary)]">
                {i + 1}
              </div>
              <h3 className="mt-3 font-semibold">{p.titulo}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{p.desc}</p>
              {i < passos.length - 1 && (
                <div className="absolute right-0 top-5 hidden h-px w-1/2 translate-x-1/2 bg-gradient-to-r from-[var(--primary)]/40 to-transparent md:block" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---- TABELAS WINTHOR ---- */}
      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <motion.div {...fade()}>
          <h2 className="text-3xl font-bold tracking-tight">Mapeamento direto das tabelas</h2>
          <p className="mt-3 text-[var(--muted)]">
            Lemos as tabelas que você já conhece. Sem exportações manuais, sem planilhas, sem CSV.
          </p>
          <ul className="mt-6 space-y-3">
            {mapeamentos.map((m) => (
              <li key={m.tabela} className="flex items-center gap-3">
                <code className="rounded-md bg-slate-900 px-2 py-1 font-mono text-xs text-emerald-300">
                  {m.tabela}
                </code>
                <Seta pequena />
                <span className="text-sm font-medium">{m.destino}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div {...fade(0.15)} className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] p-6 font-mono text-xs text-slate-300 shadow-xl">
          <p className="mb-3 flex items-center gap-2 text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2">winthor → easy-nfe</span>
          </p>
          <pre className="whitespace-pre-wrap leading-relaxed">
{`SELECT CODPROD, DESCRICAO, CODAUXILIAR,
       NCM, UNIDADE, PVENDA
  FROM WINDOW.PCPRODUT
 WHERE DTEXCLUSAO IS NULL;

→ 1.482 produtos sincronizados ✓
→ 318 clientes sincronizados ✓
→ pronto para emitir NF-e ✓`}
          </pre>
        </motion.div>
      </section>

      {/* ---- CTA FINAL ---- */}
      <motion.section
        {...fade()}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-8 py-14 text-center text-white"
      >
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_40%)]" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight">Pare de digitar o que o Winthor já tem.</h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Ative a integração e emita sua próxima nota em segundos, com os dados reais do seu ERP.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              href={whatsapp("Olá! Quero ativar a integração Winthor no easy-nfe.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-7 py-3 text-base font-semibold text-[var(--primary)] shadow-lg transition hover:-translate-y-0.5"
            >
              <IconWpp /> Ativar integração Winthor
            </a>
            <a
              href={whatsapp("Olá! Quero agendar uma demonstração da integração Winthor + easy-nfe.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-7 py-3 text-base font-medium text-white backdrop-blur transition hover:bg-white/20"
            >
              Agendar demonstração
            </a>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

// ---- Dados ----

const beneficios: { titulo: string; desc: string; icon: ReactNode }[] = [
  {
    titulo: "Catálogo sempre atualizado",
    desc: "Alterou preço ou produto no Winthor? Reflete no easy-nfe automaticamente.",
    icon: <Svg d="M21 12a9 9 0 1 1-3-6.7L21 8" extra={<path d="M21 3v5h-5" />} />,
  },
  {
    titulo: "Emissão a partir do pedido",
    desc: "Selecione um pedido do PCPEDIDO e gere a NF-e já com itens, cliente e valores.",
    icon: <Svg d="M9 11l3 3L22 4" extra={<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />} />,
  },
  {
    titulo: "Zero erro de digitação",
    desc: "NCM, GTIN, unidade e CFOP vêm prontos da origem. Menos rejeição na SEFAZ.",
    icon: <Svg d="M20 6 9 17l-5-5" />,
  },
  {
    titulo: "Estoque e financeiro em sincronia",
    desc: "A nota emitida volta como referência para baixa e conferência no ERP.",
    icon: <Svg d="M3 3v18h18" extra={<path d="m19 9-5 5-4-4-3 3" />} />,
  },
  {
    titulo: "Somente leitura e seguro",
    desc: "Acesso read-only às tabelas. Não alteramos nada no seu Winthor.",
    icon: <Svg d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    titulo: "Implantação sem dor",
    desc: "Conexão por API segura. Sem instalar agente pesado, sem mexer no banco.",
    icon: <Svg d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  },
];

const passos = [
  { titulo: "Conecte", desc: "Informe os dados de acesso read-only ao Oracle do Winthor." },
  { titulo: "Sincronize", desc: "Produtos e clientes são importados e mantidos atualizados." },
  { titulo: "Selecione", desc: "Escolha um pedido ou monte a nota com itens do catálogo." },
  { titulo: "Emita", desc: "Gere, assine e autorize a NF-e na SEFAZ em segundos." },
];

const mapeamentos = [
  { tabela: "WINDOW.PCPRODUT", destino: "Catálogo de produtos" },
  { tabela: "WINDOW.PCCLIENT", destino: "Cadastro de clientes" },
  { tabela: "WINDOW.PCPEDIDO", destino: "Pedidos para emissão" },
  { tabela: "WINDOW.PCEST", destino: "Conferência de estoque" },
];

// ---- helpers visuais ----

function IconWpp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.99-1.057zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function Svg({ d, extra }: { d: string; extra?: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {extra}
    </svg>
  );
}

function FluxoChip({ children, destaque }: { children: ReactNode; destaque?: boolean }) {
  return (
    <span
      className={
        "rounded-lg border px-3 py-2 text-sm font-medium backdrop-blur " +
        (destaque
          ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
          : "border-white/15 bg-white/10 text-white")
      }
    >
      {children}
    </span>
  );
}

function Seta({ pequena }: { pequena?: boolean }) {
  return (
    <svg
      width={pequena ? 16 : 20}
      height={pequena ? 16 : 20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={pequena ? "text-[var(--muted)]" : "text-violet-300"}
    >
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}
