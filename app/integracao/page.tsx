"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// WhatsApp para ativar/agendar integrações.
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
            Integrações & diferenciais
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Muito além de emitir.
            <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              {" "}O fiscal da sua empresa no automático.
            </span>
          </h1>
          <p className="mt-5 text-lg text-slate-300">
            Conecte suas vendas online, capture as notas recebidas, entregue no WhatsApp e
            gerencie vários CNPJs — tudo em um só lugar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={whatsapp("Olá! Quero ativar integrações no Easy-NFe.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-6 py-3 text-base font-semibold text-white shadow-[0_4px_14px_rgba(82,39,255,0.45)] transition hover:-translate-y-0.5"
            >
              <IconWpp /> Falar com especialista
            </a>
          </div>
        </motion.div>
      </section>

      {/* ---- OS 5 DIFERENCIAIS ---- */}
      <section className="space-y-6">
        <motion.div {...fade()} className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">O que faz o Easy-NFe diferente</h2>
          <p className="mt-3 text-[var(--muted)]">Recursos que você não encontra num emissor comum.</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {DIFERENCIAIS.map((d, i) => (
            <motion.div
              key={d.titulo}
              {...fade(i * 0.07)}
              className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white shadow-md transition-transform group-hover:scale-110">
                  {d.icon}
                </div>
                <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (d.disponivel ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--primary-soft)] text-[var(--primary)]")}>
                  {d.disponivel ? "Disponível" : "Em breve"}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{d.titulo}</h3>
              <p className="mt-1.5 flex-1 text-sm text-[var(--muted)]">{d.desc}</p>
              {d.tags && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {d.tags.map((t) => (
                    <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{t}</span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---- COMO FUNCIONA ---- */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
        <motion.h2 {...fade()} className="text-center text-3xl font-bold tracking-tight">Como ativamos</motion.h2>
        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-4">
          {PASSOS.map((p, i) => (
            <motion.div key={p.titulo} {...fade(i * 0.1)} className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-base font-bold text-[var(--primary)]">{i + 1}</div>
              <h3 className="mt-3 font-semibold">{p.titulo}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{p.desc}</p>
              {i < PASSOS.length - 1 && (
                <div className="absolute right-0 top-5 hidden h-px w-1/2 translate-x-1/2 bg-gradient-to-r from-[var(--primary)]/40 to-transparent md:block" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---- CTA FINAL ---- */}
      <motion.section
        {...fade()}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-8 py-14 text-center text-white"
      >
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_40%)]" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight">Quer ativar uma dessas integrações?</h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Fale com a gente e montamos o fluxo ideal para o seu negócio.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              href={whatsapp("Olá! Quero ativar integrações (e-commerce/WhatsApp/DFe) no Easy-NFe.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-7 py-3 text-base font-semibold text-[var(--primary)] shadow-lg transition hover:-translate-y-0.5"
            >
              <IconWpp /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

// ---- Dados ----

const DIFERENCIAIS: { titulo: string; desc: string; icon: ReactNode; disponivel: boolean; tags?: string[] }[] = [
  {
    titulo: "Vendeu online, nota emitida",
    desc: "Conecte sua loja e marketplaces: a cada pedido pago, o Easy-NFe emite a NF-e automaticamente. Sem digitar pedido nenhum.",
    icon: <Svg d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" extra={<><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>} />,
    disponivel: false,
    tags: ["Nuvemshop", "Shopify", "Mercado Livre", "WooCommerce"],
  },
  {
    titulo: "Captura de notas recebidas (DFe)",
    desc: "Baixamos da SEFAZ todas as notas emitidas contra o seu CNPJ e você faz a manifestação do destinatário num clique. Você nunca perde uma nota — nem leva multa.",
    icon: <Svg d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" extra={<path d="m9 11 2 2 4-4" />} />,
    disponivel: true,
    tags: ["Manifestação", "DF-e", "Compliance"],
  },
  {
    titulo: "Entrega no WhatsApp",
    desc: "Assim que a nota é autorizada, o DANFE e o XML vão direto pro WhatsApp do seu cliente. E-mail também, se preferir.",
    icon: <Svg d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    disponivel: false,
    tags: ["WhatsApp", "E-mail"],
  },
  {
    titulo: "Multiempresa & contador",
    desc: "Gerencie vários CNPJs numa conta só e dê acesso ao seu contador. Cada empresa com seus produtos, clientes e notas isolados.",
    icon: <Svg d="M3 21h18" extra={<><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>} />,
    disponivel: true,
    tags: ["Vários CNPJs", "Acesso do contador"],
  },
  {
    titulo: "NFC-e e NFS-e no mesmo lugar",
    desc: "Além da NF-e (mod. 55), emita o cupom fiscal do varejo (NFC-e) e a nota de serviço (NFS-e) sem trocar de sistema.",
    icon: <Svg d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" extra={<><path d="M8 7h8" /><path d="M8 11h8" /></>} />,
    disponivel: false,
    tags: ["NFC-e (65)", "NFS-e"],
  },
];

const PASSOS = [
  { titulo: "Fale com a gente", desc: "Conte seu cenário (loja, marketplace, volume) pelo WhatsApp." },
  { titulo: "Conectamos", desc: "Ligamos suas fontes (loja, SEFAZ, WhatsApp) com segurança." },
  { titulo: "Configuramos", desc: "Regras fiscais, CFOP e modelos prontos para o seu negócio." },
  { titulo: "Automatize", desc: "As notas passam a fluir sozinhas. Você só acompanha." },
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
