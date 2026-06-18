import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { lerSessao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import Aurora from "./ui/Aurora";
import Reveal from "./ui/Reveal";
import ScrollVelocity from "./ui/ScrollVelocity";

const WPP_PARCEIRO = "https://wa.me/556282103699?text=" + encodeURIComponent("Olá! Sou contador(a) e quero ser parceiro(a) do easy-nfe. Gostaria de saber como funciona o programa de parcerias para contadores.");

const RECURSOS = [
  { titulo: "Emissão de NF-e", desc: "Modelo 55 com autorização síncrona na SEFAZ em segundos.", icon: <IFile /> },
  { titulo: "Assinatura A1", desc: "Certificado digital A1 com assinatura XML-DSig automática.", icon: <ILock /> },
  { titulo: "DANFE & cancelamento", desc: "Gere o DANFE em PDF e cancele notas direto pelo painel.", icon: <IDoc /> },
  { titulo: "Vendeu online, nota emitida", desc: "Conecte sua loja e marketplaces: cada pedido pago vira NF-e automática.", icon: <IPlug /> },
  { titulo: "WhatsApp & e-mail", desc: "Envie o DANFE e o XML ao cliente por WhatsApp ou e-mail automaticamente.", icon: <IChat /> },
  { titulo: "Multiempresa & contador", desc: "Vários CNPJs em uma conta, com acesso para o seu contador.", icon: <IBuilding /> },
];

const STATS = [
  { valor: "< 3s", rotulo: "para autorizar uma nota" },
  { valor: "99,9%", rotulo: "de disponibilidade" },
  { valor: "100%", rotulo: "conforme layout 4.00 da SEFAZ" },
  { valor: "7 dias", rotulo: "de teste grátis" },
];

const PASSOS = [
  { n: "1", titulo: "Configure sua empresa", desc: "Cadastre o CNPJ, suba o certificado A1 e escolha o ambiente (homologação ou produção)." },
  { n: "2", titulo: "Cadastre produtos e clientes", desc: "Importe de um XML ou cadastre manualmente. Dados fiscais ficam prontos para uso." },
  { n: "3", titulo: "Emita a nota", desc: "Monte a nota em etapas, assine e envie à SEFAZ com um clique. DANFE gerado na hora." },
  { n: "4", titulo: "Entregue ao cliente", desc: "Mande o XML e o DANFE por WhatsApp ou e-mail automaticamente." },
];

const INTEGRACOES = [
  { nome: "SEFAZ-GO", desc: "Web Service oficial 4.00" },
  { nome: "E-commerce", desc: "Loja & marketplaces" },
  { nome: "WhatsApp", desc: "Envio automático" },
  { nome: "E-mail", desc: "XML + DANFE" },
];

const FAQ = [
  { p: "Preciso de certificado digital?", r: "Sim, um certificado A1 (.pfx). Você sobe na própria plataforma e ele é usado apenas para assinar suas notas, com segurança." },
  { p: "Funciona para qualquer estado?", r: "A emissão está homologada para a SEFAZ-GO. Outros estados entram sob demanda — fale com a gente." },
  { p: "Tem fidelidade ou multa?", r: "Não. Os planos são mensais e você cancela quando quiser." },
  { p: "Consigo emitir para mais de uma empresa?", r: "Sim. Os planos Profissional e Empresarial permitem múltiplos CNPJs e usuários na mesma conta." },
  { p: "Como começo?", r: "Crie sua conta, configure a empresa e o certificado e já pode emitir em homologação. Tem 7 dias grátis." },
];

// Planos p/ a landing. DB indisponivel (cold start/pooler) nao derruba a pagina.
async function carregarPlanos() {
  try {
    return await prisma.plano.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
      include: { beneficios: { orderBy: { ordem: "asc" }, select: { chave: true, nome: true } } },
    });
  } catch (e) {
    console.error("landing: falha ao carregar planos", e);
    return [];
  }
}

export default async function Landing() {
  // Logado vai direto pro painel.
  if (await lerSessao()) redirect("/painel");

  const planos = await carregarPlanos();
  const planoAnterior = (ordem: number) =>
    planos.filter((x) => x.ordem < ordem).sort((a, b) => b.ordem - a.ordem)[0];
  const nomePlanoAnterior = (ordem: number) => planoAnterior(ordem)?.nome;
  // Com "Tudo do {anterior}", esconde os benefícios já cobertos pelo plano de baixo (redundância).
  const beneficiosVisiveis = (p: (typeof planos)[number]) => {
    const temTudoAnterior = p.beneficios.some((b) => b.chave === "tudo_anterior");
    if (!temTudoAnterior) return p.beneficios;
    const anteriores = new Set((planoAnterior(p.ordem)?.beneficios ?? []).map((b) => b.chave));
    return p.beneficios.filter((b) => b.chave === "tudo_anterior" || !anteriores.has(b.chave));
  };

  const destaqueId = planos.find((p) => p.popular)?.id;
  // Agrupa por categoria preservando a ordem de aparição.
  const grupos: { categoria: string; itens: typeof planos }[] = [];
  for (const p of planos) {
    const c = p.categoria ?? "";
    const g = grupos.find((x) => x.categoria === c);
    if (g) g.itens.push(p);
    else grupos.push({ categoria: c, itens: [p] });
  }
  const agruparPorCategoria = grupos.some((g) => g.categoria !== "");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5 text-white">
            <span className="relative h-8 w-8 shrink-0">
              <Image src="/images/logo/logo.png" alt="easy-nfe" fill className="object-contain" />
            </span>
            <span className="text-base font-bold tracking-tight">Easy NFe</span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-slate-300 sm:flex">
            <a href="#recursos" className="transition hover:text-white">Recursos</a>
            <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
            <a href="#planos" className="transition hover:text-white">Planos</a>
            <a href="#parceiros" className="transition hover:text-white">Parceiros</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </div>
          <Link href="/login" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20">
            Entrar
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* Aurora WebGL de fundo */}
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <Aurora colorStops={["#f367ff", "#B497CF", "#5227FF"]} blend={0.5} amplitude={1.0} speed={1} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />
        <div className="relative mx-auto max-w-4xl px-6 py-28 text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Emita NF-e em segundos,
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent"> direto do seu sistema.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Assinatura digital A1, envio à SEFAZ, DANFE e cancelamento — com vendas online,
            WhatsApp e e-mail integrados. Tudo em uma plataforma só.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/cadastro" className="w-full rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:-translate-y-0.5 sm:w-auto">
              Começar grátis
            </Link>
            <a href="#planos" className="w-full rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20 sm:w-auto">
              Ver planos
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-12 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.rotulo} className="text-center">
              <p className="text-3xl font-extrabold tracking-tight text-[var(--primary)]">{s.valor}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{s.rotulo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Tudo que sua empresa precisa para faturar</h2>
          <p className="mt-3 text-[var(--muted)]">Do certificado à entrega da nota ao cliente, sem planilha nem retrabalho.</p>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(82,39,255,0.3)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-white">{r.icon}</div>
              <h3 className="mt-4 font-semibold">{r.titulo}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{r.desc}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="bg-white pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Da configuração à nota na mão do cliente</h2>
            <p className="mt-3 text-[var(--muted)]">Quatro passos. Sem instalar nada.</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p) => (
              <div key={p.n} className="relative rounded-2xl border border-[var(--border)] p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-sm font-bold text-white">{p.n}</span>
                <h3 className="mt-4 font-semibold">{p.titulo}</h3>
                <p className="mt-1.5 text-sm text-[var(--muted)]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrações */}
      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Conectado ao que você já usa</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">Integrações nativas para você não digitar nota duas vezes.</p>
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {INTEGRACOES.map((it) => (
              <div key={it.nome} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
                <p className="text-lg font-bold">{it.nome}</p>
                <p className="mt-1 text-xs text-slate-400">{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Quem usa, recomenda</h2>
            <p className="mt-3 text-[var(--muted)]">Negócios que trocaram a planilha pelo easy-nfe.</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {["1", "2", "3"].map((n) => (
              <div key={n} className="relative aspect-[19/20] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
                <Image
                  src={`/images/prints/${n}.png`}
                  alt={`Avaliação de cliente ${n}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover object-top"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parcerias com contadores */}
      <section id="parceiros" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-white sm:p-14">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-300">
                  Para contadores
                </span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight">Seja parceiro contábil do easy-nfe</h2>
                <p className="mt-3 text-slate-300">
                  Indique o easy-nfe para seus clientes e ganhe comissão recorrente. Seus clientes emitem NF-e em segundos
                  e você acompanha tudo com mais agilidade — menos planilha, menos retrabalho.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {[
                    "Comissão recorrente por cliente ativo",
                    "Painel e suporte dedicados ao parceiro",
                    "Condições especiais para a sua carteira",
                    "Onboarding e treinamento da sua equipe",
                  ].map((t) => (
                    <li key={t} className="flex gap-2"><span className="text-violet-400">✓</span><span className="text-slate-200">{t}</span></li>
                  ))}
                </ul>
                <a
                  href={WPP_PARCEIRO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.24.68-1.42 1.32-1.95 1.36-.5.04-.97.22-3.27-.68-2.77-1.09-4.53-3.92-4.66-4.1-.14-.18-1.13-1.5-1.13-2.86 0-1.36.71-2.03.97-2.31.24-.27.54-.34.71-.34.18 0 .36 0 .51.01.16.01.39-.06.6.46.24.55.81 1.91.88 2.05.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.55.73 1.81.86.27.14.45.2.51.31.07.11.07.64-.17 1.32Z" /></svg>
                  Quero ser parceiro
                </a>
              </Reveal>
              <Reveal className="hidden lg:block">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
                  <div className="grid grid-cols-2 gap-6 text-center">
                    {[
                      { n: "Recorrente", l: "Comissão por cliente" },
                      { n: "Sem custo", l: "Para começar" },
                      { n: "Suporte", l: "Humano e dedicado" },
                      { n: "7 dias", l: "Grátis pros clientes" },
                    ].map((s) => (
                      <div key={s.l}>
                        <p className="text-2xl font-extrabold text-violet-300">{s.n}</p>
                        <p className="mt-1 text-xs text-slate-400">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Faixa de texto em movimento (reage ao scroll) */}
      <section className="overflow-hidden border-y border-[var(--border)] bg-slate-950 py-8 text-white">
        <ScrollVelocity
          texts={["Emita NF-e em segundos  •  Vendas online  •", "WhatsApp  •  E-mail  •  DANFE  •  Sem fidelidade  •"]}
          velocity={70}
          numCopies={6}
          className="px-4 text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text"
        />
      </section>

      {/* Planos */}
      <section id="planos" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Planos para cada tamanho de operação</h2>
            <p className="mt-3 text-[var(--muted)]">Comece com 7 dias grátis. Sem fidelidade.</p>
          </div>

          {planos.length === 0 ? (
            <p className="mt-12 text-center text-sm text-[var(--muted)]">Planos em breve.</p>
          ) : (
            grupos.map((g) => (
              <div key={g.categoria || "_"} className="mt-12">
                {agruparPorCategoria && g.categoria && (
                  <h3 className="mb-5 text-center text-sm font-semibold uppercase tracking-wider text-[var(--primary)]">{g.categoria}</h3>
                )}
                <div className="flex flex-wrap justify-center gap-6">
                  {g.itens.map((p) => {
                    const destaque = p.id === destaqueId;
                    return (
                      <div key={p.id} className={"relative flex w-full flex-col rounded-2xl border bg-white p-7 sm:w-[21rem] md:w-[22rem] " + (destaque ? "border-[var(--primary)] shadow-xl shadow-violet-500/10 ring-1 ring-[var(--primary)]" : "border-[var(--border)] shadow-sm")}>
                        {destaque && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-semibold text-white">Mais popular</span>}
                        <h3 className="text-lg font-bold">{p.nome}</h3>
                        {p.descricao && <p className="mt-1 text-sm text-[var(--muted)]">{p.descricao}</p>}
                        {p.sobConsulta ? (
                          <p className="mt-5 text-2xl font-extrabold tracking-tight text-[var(--primary)]">Sob consulta</p>
                        ) : (
                          <>
                            {p.precoAntigo && Number(p.precoAntigo) > 0 && (
                              <p className="mt-5 text-sm text-[var(--muted)] line-through">{formatBRL(Number(p.precoAntigo))}</p>
                            )}
                            <p className={(p.precoAntigo && Number(p.precoAntigo) > 0 ? "mt-0.5" : "mt-5") + " text-4xl font-extrabold tracking-tight"}>
                              {formatBRL(Number(p.preco))}
                              <span className="text-base font-medium text-[var(--muted)]">/{p.periodicidade === "anual" ? "ano" : "mês"}</span>
                            </p>
                          </>
                        )}
                        <p className="mt-1 text-xs text-[var(--muted)]">{p.limiteEmpresas < 0 ? "Empresas ilimitadas" : `${p.limiteEmpresas} empresa(s)`}</p>
                        <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                          {beneficiosVisiveis(p).map((b, j) => (
                            <li key={j} className="flex gap-2"><span className="text-[var(--success)]">✓</span><span className="text-slate-600">{b.chave === "tudo_anterior" ? `Tudo do ${nomePlanoAnterior(p.ordem) ?? "plano anterior"}` : b.nome}</span></li>
                          ))}
                        </ul>
                        {p.sobConsulta ? (
                          <Link href={`/cadastro?plano=${p.id}`} className={"mt-7 rounded-xl px-5 py-2.5 text-center text-sm font-semibold transition " + (destaque ? "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] text-white shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" : "bg-slate-100 text-slate-900 hover:bg-slate-200")}>
                            Fale com nossos vendedores
                          </Link>
                        ) : (
                          <Link href={`/cadastro?plano=${p.id}`} className={"mt-7 rounded-xl px-5 py-2.5 text-center text-sm font-semibold transition " + (destaque ? "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-2)] text-white shadow-lg shadow-violet-500/25 hover:-translate-y-0.5" : "bg-slate-100 text-slate-900 hover:bg-slate-200")}>
                            Começar agora
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white py-24">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Perguntas frequentes</h2>
            <p className="mt-3 text-[var(--muted)]">Ainda com dúvida? Fale com a gente.</p>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details key={f.p} className="group rounded-xl border border-[var(--border)] bg-white p-5 [&_summary]:list-none">
                <summary className="flex items-center justify-between gap-4 font-medium">
                  {f.p}
                  <svg className="shrink-0 transition-transform group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{f.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] py-20 text-center text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold">Pronto para emitir sua primeira nota?</h2>
          <p className="mt-3 text-white/85">Acesse sua conta e comece agora. Suporte humano de verdade.</p>
          <Link href="/login" className="mt-8 inline-block rounded-xl bg-white px-7 py-3 text-sm font-semibold text-[var(--primary)] shadow-lg transition hover:-translate-y-0.5">
            Entrar
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-10 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center text-white">
            <Image
              src="/images/logo/logo-completa.png"
              alt="easy-nfe"
              width={863}
              height={309}
              className="h-11 w-auto"
            />
          </div>
          <p className="text-xs">© {2026} easy-nfe · Emissão de NF-e. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function IFile() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v6h6" /></svg>; }
function ILock() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }
function IDoc() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>; }
function IPlug() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></svg>; }
function IChat() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
function IBuilding() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" /></svg>; }
