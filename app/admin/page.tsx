"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { Badge, Button, Card, Field, Input, Select } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Stepper, { Step } from "@/app/ui/Stepper";
import StepperModal from "@/app/ui/StepperModal";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { FEATURES } from "@/lib/features";
import { formatBRL, formatData } from "@/lib/format";
import {
  listarUsuarios, criarUsuario, type UsuarioResumo,
  listarPlanos, salvarPlano, excluirPlano, type PlanoDados,
  listarBeneficios, type Beneficio,
  listarBeneficiosAdmin, salvarBeneficio, excluirBeneficio, type BeneficioDados,
  listarCategorias, criarCategoria, renomearCategoria, moverCategoria, definirPlanoPopular, type CategoriaPlano,
} from "./actions";
import UsuarioDetalhe from "./UsuarioDetalhe";
import Integracoes from "./Integracoes";

const ROLES = [
  { value: "USER", label: "Usuário" },
  { value: "SUPORTE", label: "Suporte" },
  { value: "CONTADOR", label: "Contador" },
  { value: "ADMIN", label: "Administrador" },
];

const tomLicenca: Record<string, "success" | "danger" | "warning" | "neutral" | "primary"> = {
  ATIVA: "success", TRIAL: "primary", EXPIRADA: "danger", SUSPENSA: "warning", CANCELADA: "neutral",
};

const ABAS = ["usuarios", "planos", "beneficios", "integracoes"] as const;
type Aba = (typeof ABAS)[number];
const ABA_LABEL: Record<Aba, string> = {
  usuarios: "Usuários & Licenças",
  planos: "Planos",
  beneficios: "Benefícios",
  integracoes: "Integrações",
};

const abaVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: "0%", opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-40%" : "40%", opacity: 0 }),
};

export default function AdminPage() {
  const [aba, setAba] = useState<Aba>("usuarios");
  const [dir, setDir] = useState(0);

  function trocar(nova: Aba) {
    if (nova === aba) return;
    setDir(ABAS.indexOf(nova) - ABAS.indexOf(aba));
    setAba(nova);
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Painel administrativo</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">Usuários, licenças, pagamentos e planos.</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => trocar(a)}
            className={"rounded-md px-4 py-1.5 transition " + (aba === a ? "bg-white text-[var(--primary)] shadow-sm" : "text-slate-500")}
          >
            {ABA_LABEL[a]}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={aba}
            custom={dir}
            variants={abaVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {aba === "usuarios" ? <AbaUsuarios /> : aba === "planos" ? <AbaPlanos /> : aba === "beneficios" ? <AbaBeneficios /> : <Integracoes />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  async function recarregar() {
    try { setUsuarios(await listarUsuarios()); }
    finally { setCarregando(false); }
  }
   
  useEffect(() => { void recarregar(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">{usuarios.length} usuário(s) cadastrado(s)</p>
        <Button onClick={() => setNovo(true)}>+ Novo usuário</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-2.5">Usuário</th>
              <th className="px-4 py-2.5">Papel</th>
              <th className="px-4 py-2.5">Plano</th>
              <th className="px-4 py-2.5">Licença</th>
              <th className="px-4 py-2.5">Validade</th>
              <th className="px-4 py-2.5 text-center">Empresas</th>
              <th className="px-4 py-2.5 text-center">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={7} className="px-4 py-8"><LightningLoader texto="Carregando usuários…" /></td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">Nenhum usuário.</td></tr>
            ) : usuarios.map((u) => (
              <tr key={u.id} onClick={() => setDetalheId(u.id)} className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.nome || "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{u.email}</p>
                </td>
                <td className="px-4 py-3"><Badge tom={u.role === "ADMIN" ? "primary" : u.role === "SUPORTE" ? "warning" : "neutral"}>{u.role}</Badge></td>
                <td className="px-4 py-3">{u.plano ?? "—"}</td>
                <td className="px-4 py-3">{u.statusLicenca ? <Badge tom={tomLicenca[u.statusLicenca] ?? "neutral"}>{u.statusLicenca}</Badge> : "—"}</td>
                <td className="px-4 py-3 text-xs">{u.validadeEm ? formatData(u.validadeEm) : "—"}</td>
                <td className="px-4 py-3 text-center">{u.empresas}</td>
                <td className="px-4 py-3 text-center">{u.ativo ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <NovoUsuarioModal aberto={novo} onFechar={() => setNovo(false)} onCriado={() => { setNovo(false); recarregar(); }} />
      {detalheId && (
        <UsuarioDetalhe
          userId={detalheId}
          onFechar={() => setDetalheId(null)}
          onMudou={recarregar}
        />
      )}
    </div>
  );
}

const STATUS_LIC = ["TRIAL", "ATIVA", "EXPIRADA", "SUSPENSA", "CANCELADA"].map((v) => ({ value: v, label: v }));

// Data ISO (yyyy-mm-dd) daqui a N dias — usada no trial.
function isoEmDias(dias: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + dias);
  return dt.toISOString().slice(0, 10);
}

function NovoUsuarioModal({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: () => void }) {
  // Passo 1 — Conta (mesmos campos da aba "Conta" do editar).
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<"USER" | "SUPORTE" | "ADMIN" | "CONTADOR">("USER");
  const [ativo, setAtivo] = useState(true);
  // Passo 2 — Licença (mesmos campos da aba "Licença" do editar).
  const [planos, setPlanos] = useState<Required<PlanoDados>[]>([]);
  const [planoId, setPlanoId] = useState("");
  const [status, setStatus] = useState("TRIAL");
  const [diasTrial, setDiasTrial] = useState(7);
  const [validade, setValidade] = useState(isoEmDias(7));

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Carrega planos ao abrir e reseta o formulário.
  useEffect(() => {
    if (!aberto) return;
    setNome(""); setEmail(""); setSenha(""); setRole("USER"); setAtivo(true);
    setPlanoId(""); setStatus("TRIAL"); setDiasTrial(7); setValidade(isoEmDias(7));
    setErro(null);
    (async () => {
      const pl = await listarPlanos();
      setPlanos(pl);
      setPlanoId((atual) => atual || pl[0]?.id || "");
    })();
  }, [aberto]);

  function aplicarTrial(dias: number) {
    const d = Math.max(1, dias || 0);
    setDiasTrial(d);
    setValidade(isoEmDias(d));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await criarUsuario({
      email, senha, nome, role, ativo,
      licenca: planoId
        ? { planoId, status: status as "TRIAL" | "ATIVA" | "EXPIRADA" | "SUSPENSA" | "CANCELADA", validadeEm: validade || null }
        : null,
    });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onCriado();
  }

  if (!aberto) return null;

  const contaUI = (
    <div className="space-y-4">
      <p className="text-sm font-semibold">Dados da conta</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="E-mail" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Senha" required hint="Mínimo 8 caracteres."><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
        <Field label="Papel" required><Select opcoes={ROLES} value={role} onChange={(e) => setRole(e.target.value as typeof role)} /></Field>
        <Field label="Status"><Select opcoes={[{ value: "true", label: "Ativo" }, { value: "false", label: "Bloqueado" }]} value={String(ativo)} onChange={(e) => setAtivo(e.target.value === "true")} /></Field>
      </div>
      {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </div>
  );

  const licencaUI = (
    <div className="space-y-4">
      <p className="text-sm font-semibold">Licença / Plano <span className="font-normal text-[var(--muted)]">— TRIAL não gera fatura</span></p>
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">Plano</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {planos.map((p) => {
            const sel = planoId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanoId(sel ? "" : p.id)}
                className={
                  "flex flex-col items-start rounded-xl border-2 p-3 text-left transition " +
                  (sel ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:border-slate-300")
                }
              >
                <span className="text-sm font-semibold">{p.nome}</span>
                {p.sobConsulta ? (
                  <span className="mt-1 text-xs text-[var(--muted)]">Sob consulta</span>
                ) : (
                  <>
                    <span className="mt-1 text-lg font-bold text-[var(--primary)]">{formatBRL(p.preco)}</span>
                    <span className="text-[10px] text-[var(--muted)]">/{p.periodicidade === "anual" ? "ano" : "mês"} · {p.limiteEmpresas < 0 ? "∞" : p.limiteEmpresas} empresa(s)</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Sem plano selecionado, o usuário é criado sem licença (ou trial padrão de 7 dias se for Usuário).</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Status"><Select opcoes={STATUS_LIC} value={status} onChange={(e) => setStatus(e.target.value)} /></Field>
        {status === "TRIAL" ? (
          <Field label="Período de trial (dias)" hint={`Expira em ${formatData(validade)}`}>
            <Input type="number" min="1" value={diasTrial} onChange={(e) => aplicarTrial(Number(e.target.value))} />
          </Field>
        ) : (
          <Field label="Validade"><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></Field>
        )}
      </div>
      {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </div>
  );

  return (
    <StepperModal onFechar={salvando ? () => {} : onFechar} largura="max-w-3xl">
      {salvando ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-16 shadow-2xl">
          <LightningLoader texto="Criando usuário…" />
        </div>
      ) : (
        <Stepper
          completeButtonText="Criar usuário"
          onFinalStepCompleted={salvar}
          canProceed={(s) => (s === 1 ? emailRegex.test(email.trim()) && senha.length >= 8 : true)}
        >
          <Step>{contaUI}</Step>
          <Step>{licencaUI}</Step>
        </Stepper>
      )}
    </StepperModal>
  );
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Nome do plano de nível imediatamente anterior (menor ordem) ao informado.
function nomePlanoAnterior(planos: Required<PlanoDados>[], ordem: number, selfId?: string): string | undefined {
  return planos
    .filter((p) => p.ordem < ordem && p.id !== selfId)
    .sort((a, b) => b.ordem - a.ordem)[0]?.nome;
}

// IDs de benefícios já herdados via "tudo_anterior", subindo a cadeia de planos.
function idsHerdados(planos: Required<PlanoDados>[], catalogo: Beneficio[], ordem: number, selfId?: string): Set<string> {
  const porId = new Map(catalogo.map((b) => [b.id, b]));
  const ids = new Set<string>();
  const visitados = new Set<string>();
  let atual = planos.filter((x) => x.ordem < ordem && x.id !== selfId).sort((a, b) => b.ordem - a.ordem)[0];
  while (atual && !visitados.has(atual.id)) {
    visitados.add(atual.id);
    for (const id of atual.beneficioIds) ids.add(id);
    // se o plano anterior também herda, sobe mais um nível
    if (!atual.beneficioIds.some((id) => porId.get(id)?.chave === "tudo_anterior")) break;
    const ord = atual.ordem;
    atual = planos.filter((x) => x.ordem < ord).sort((a, b) => b.ordem - a.ordem)[0];
  }
  return ids;
}

// Rótulo do benefício, resolvendo o especial "tudo_anterior" dinamicamente.
function rotuloBeneficio(b: Beneficio, prevNome?: string): string {
  if (b.chave === "tudo_anterior") return `Tudo do ${prevNome ?? "plano anterior"}`;
  return b.nome;
}

function AbaPlanos() {
  const [planos, setPlanos] = useState<Required<PlanoDados>[]>([]);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPlano[]>([]);
  const [edit, setEdit] = useState<PlanoDados | null>(null);
  const [novaCat, setNovaCat] = useState(false);
  const [editCat, setEditCat] = useState<CategoriaPlano | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function recarregar() {
    try {
      const [pl, bs, cs] = await Promise.all([listarPlanos(), listarBeneficios(), listarCategorias()]);
      setPlanos(pl);
      setBeneficios(bs);
      setCategorias(cs);
    } finally { setCarregando(false); }
  }
   
  useEffect(() => { void recarregar(); }, []);

  async function moverCat(id: string, dir: "cima" | "baixo") { await moverCategoria(id, dir); recarregar(); }
  async function togglePopular(p: Required<PlanoDados>) { await definirPlanoPopular(p.id, !p.popular); recarregar(); }

  const porId = new Map(beneficios.map((b) => [b.id, b]));
  const vazio: PlanoDados = { nome: "", descricao: "", preco: 0, precoAntigo: 0, sobConsulta: false, categoria: "", periodicidade: "mensal", limiteEmpresas: 1, limiteUsuarios: 1, beneficioIds: [], ativo: true, popular: false, permiteTrial: false, ordem: planos.length };

  // Agrupa por categoria, na ordem do catálogo (sem categoria por último).
  const grupos: { categoria: string; itens: Required<PlanoDados>[] }[] = [];
  for (const c of categorias) {
    const itens = planos.filter((p) => p.categoria === c.nome);
    if (itens.length) grupos.push({ categoria: c.nome, itens });
  }
  const semCat = planos.filter((p) => !p.categoria || !categorias.some((c) => c.nome === p.categoria));
  if (semCat.length) grupos.push({ categoria: "", itens: semCat });

  function cardPlano(p: Required<PlanoDados>) {
    const prev = nomePlanoAnterior(planos, p.ordem, p.id);
    const temTudoAnterior = p.beneficioIds.some((id) => porId.get(id)?.chave === "tudo_anterior");
    const planoAnterior = planos.filter((x) => x.ordem < p.ordem && x.id !== p.id).sort((a, b) => b.ordem - a.ordem)[0];
    const idsAnterior = new Set(planoAnterior?.beneficioIds ?? []);
    // Com "tudo do anterior", esconde os benefícios que já vêm do plano de baixo.
    const idsVisiveis = p.beneficioIds.filter((id) => {
      if (porId.get(id)?.chave === "tudo_anterior") return true;
      return !(temTudoAnterior && idsAnterior.has(id));
    });
    return (
      <Card key={p.id} className="flex flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{p.nome}</p>
            <p className="text-xs text-[var(--muted)]">{p.periodicidade} · {p.limiteEmpresas < 0 ? "∞" : p.limiteEmpresas} empresa(s)</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {!p.ativo && <Badge tom="neutral">inativo</Badge>}
            <button
              onClick={() => togglePopular(p)}
              title={p.popular ? "Remover destaque de mais popular" : "Marcar como mais popular"}
              className={"rounded-md p-1 transition " + (p.popular ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:bg-slate-100 hover:text-amber-400")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={p.popular ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 2.5 14 7.6l5.7.8-4.1 4 1 5.6-5.1-2.7L7.3 18l1-5.6-4.1-4 5.7-.8Z" /></svg>
            </button>
          </div>
        </div>
        {p.popular && <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">★ Mais popular</span>}
        {p.sobConsulta ? (
          <p className="mt-2 text-lg font-bold text-[var(--primary)]">Sob consulta</p>
        ) : (
          <p className="mt-2 flex items-baseline gap-2">
            {p.precoAntigo > 0 && <span className="text-sm text-[var(--muted)] line-through">{formatBRL(p.precoAntigo)}</span>}
            <span className="text-2xl font-bold text-[var(--primary)]">{formatBRL(p.preco)}</span>
          </p>
        )}
        {p.descricao && <p className="mt-1 text-sm text-[var(--muted)]">{p.descricao}</p>}
        <ul className="mt-3 flex-1 space-y-1 text-sm">
          {idsVisiveis.map((id) => {
            const b = porId.get(id);
            return <li key={id} className="flex gap-1.5"><span className="text-[var(--success)]">✓</span>{b ? rotuloBeneficio(b, prev) : id}</li>;
          })}
        </ul>
        <Button variante="secondary" className="mt-4" onClick={() => setEdit(p)}>Editar</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">{planos.length} plano(s) · {categorias.length} categoria(s).</p>
        <div className="flex gap-2">
          <Button variante="secondary" onClick={() => setNovaCat(true)}>+ Nova categoria</Button>
          <Button onClick={() => setEdit(vazio)}>+ Novo plano</Button>
        </div>
      </div>

      {carregando ? (
        <LightningLoader texto="Carregando planos…" />
      ) : planos.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">Nenhum plano. Crie o primeiro.</p>
      ) : (
        grupos.map((g) => {
          const cat = categorias.find((c) => c.nome === g.categoria);
          const catIdx = cat ? categorias.findIndex((c) => c.id === cat.id) : -1;
          return (
            <div key={g.categoria || "_sem_"}>
              <div className="mb-2 flex items-center gap-1.5">
                <p className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{g.categoria || "Sem categoria"}</p>
                {cat && (
                  <>
                    <button
                      onClick={() => moverCat(cat.id, "cima")}
                      disabled={catIdx <= 0}
                      title="Mover categoria para cima"
                      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                    </button>
                    <button
                      onClick={() => moverCat(cat.id, "baixo")}
                      disabled={catIdx >= categorias.length - 1}
                      title="Mover categoria para baixo"
                      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                    <button
                      onClick={() => setEditCat(cat)}
                      title="Renomear categoria"
                      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--primary)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.itens.map(cardPlano)}
              </div>
            </div>
          );
        })
      )}

      {edit && <PlanoModal inicial={edit} catalogo={beneficios} planos={planos} categorias={categorias} onFechar={() => setEdit(null)} onSalvo={() => { setEdit(null); recarregar(); }} />}
      {novaCat && <NovaCategoriaModal onFechar={() => setNovaCat(false)} onCriada={() => { setNovaCat(false); recarregar(); }} />}
      {editCat && <NovaCategoriaModal inicial={editCat} onFechar={() => setEditCat(null)} onCriada={() => { setEditCat(null); recarregar(); }} />}
    </div>
  );
}

function PlanoModal({ inicial, catalogo, planos, categorias, onFechar, onSalvo }: { inicial: PlanoDados; catalogo: Beneficio[]; planos: Required<PlanoDados>[]; categorias: CategoriaPlano[]; onFechar: () => void; onSalvo: () => void }) {
  const [p, setP] = useState<PlanoDados>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const editando = !!p.id;

  function set<K extends keyof PlanoDados>(k: K, v: PlanoDados[K]) { setP((s) => ({ ...s, [k]: v })); }

  // ordem automática = nº de planos já na categoria escolhida + 1.
  function setCategoria(cat: string) {
    const ord = planos.filter((x) => x.categoria === cat && x.id !== p.id).length + 1;
    setP((s) => ({ ...s, categoria: cat, ordem: ord }));
  }

  const ilimitadoEmpresas = p.limiteEmpresas < 0;
  const ilimitadoUsuarios = p.limiteUsuarios < 0;

  const prevNome = nomePlanoAnterior(planos, p.ordem, p.id);
  const noPlano = p.beneficioIds.map((id) => catalogo.find((b) => b.id === id)).filter(Boolean) as Beneficio[];
  const temTudoAnterior = p.beneficioIds.some((id) => catalogo.find((b) => b.id === id)?.chave === "tudo_anterior");
  const herdados = temTudoAnterior ? idsHerdados(planos, catalogo, p.ordem, p.id) : new Set<string>();
  const disponiveis = catalogo.filter((b) => !p.beneficioIds.includes(b.id) && !herdados.has(b.id));

  function adicionar(id: string) { if (!p.beneficioIds.includes(id)) set("beneficioIds", [...p.beneficioIds, id]); }
  function remover(id: string) { set("beneficioIds", p.beneficioIds.filter((x) => x !== id)); }

  async function salvar() {
    setSalvando(true); setErro(null);
    const r = await salvarPlano(p);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo();
  }
  async function excluir() {
    if (!p.id) return;
    setSalvando(true);
    const r = await excluirPlano(p.id);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo();
  }

  const dados = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nome" required><Input value={p.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
        <Field label="Categoria" hint="Agrupa na landing">
          <Select
            opcoes={[{ value: "", label: "— sem categoria —" }, ...categorias.map((c) => ({ value: c.nome, label: c.nome }))]}
            value={p.categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </Field>
        <Field label="Periodicidade"><Select opcoes={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }]} value={p.periodicidade} onChange={(e) => set("periodicidade", e.target.value)} /></Field>
        <Field label="Ordem" hint="Automática pela categoria"><Input type="number" value={p.ordem} onChange={(e) => set("ordem", Number(e.target.value))} /></Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.sobConsulta} onChange={(e) => set("sobConsulta", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Sob consulta (sem preço fixo — landing mostra “Fale com vendedores”)
      </label>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Preço de (riscado)" hint="0 = sem promoção"><Input type="number" step="0.01" min="0" value={p.precoAntigo} disabled={p.sobConsulta} onChange={(e) => set("precoAntigo", Number(e.target.value))} /></Field>
        <Field label="Preço (R$)"><Input type="number" step="0.01" min="0" value={p.preco} disabled={p.sobConsulta} onChange={(e) => set("preco", Number(e.target.value))} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Limite de empresas">
          <Input type="number" min="1" value={ilimitadoEmpresas ? "" : p.limiteEmpresas} disabled={ilimitadoEmpresas} placeholder={ilimitadoEmpresas ? "Ilimitado" : ""} onChange={(e) => set("limiteEmpresas", Number(e.target.value))} />
          <label className="mt-1.5 flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={ilimitadoEmpresas} onChange={(e) => set("limiteEmpresas", e.target.checked ? -1 : 1)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
            Ilimitado
          </label>
        </Field>
        <Field label="Usuários por empresa">
          <Input type="number" min="1" value={ilimitadoUsuarios ? "" : p.limiteUsuarios} disabled={ilimitadoUsuarios} placeholder={ilimitadoUsuarios ? "Ilimitado" : ""} onChange={(e) => set("limiteUsuarios", Number(e.target.value))} />
          <label className="mt-1.5 flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={ilimitadoUsuarios} onChange={(e) => set("limiteUsuarios", e.target.checked ? -1 : 1)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
            Ilimitado
          </label>
        </Field>
      </div>

      <Field label="Descrição"><Input value={p.descricao} onChange={(e) => set("descricao", e.target.value)} /></Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Ativo (exibir na landing page)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.permiteTrial} disabled={p.sobConsulta} onChange={(e) => set("permiteTrial", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Libera teste grátis de 7 dias (botão “Testar grátis por 7 dias” na landing)
      </label>
    </div>
  );

  const beneficiosUI = (
    <div>
      <p className="mb-2 text-sm font-semibold">Benefícios do plano <span className="font-normal text-[var(--muted)]">— arraste ou clique para mover</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (arrastando) { adicionar(arrastando); setArrastando(null); } }}
          className="min-h-[180px] rounded-lg border-2 border-dashed border-[var(--primary)]/30 bg-[var(--primary-soft)]/40 p-2"
        >
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">No plano ({noPlano.length})</p>
          {noPlano.length === 0 && <p className="px-1 py-6 text-center text-xs text-[var(--muted)]">Arraste benefícios para cá.</p>}
          <ul className="space-y-1.5">
            {noPlano.map((b) => (
              <li key={b.id} draggable onDragStart={() => setArrastando(b.id)} onClick={() => remover(b.id)}
                className="flex cursor-grab items-center justify-between rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm active:cursor-grabbing">
                <span>{rotuloBeneficio(b, prevNome)}</span>
                <span className="text-xs text-[var(--danger)]">✕</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (arrastando) { remover(arrastando); setArrastando(null); } }}
          className="min-h-[180px] rounded-lg border-2 border-dashed border-[var(--border)] bg-slate-50 p-2"
        >
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Disponíveis ({disponiveis.length})</p>
          {disponiveis.length === 0 && <p className="px-1 py-6 text-center text-xs text-[var(--muted)]">Todos no plano.</p>}
          <ul className="space-y-1.5">
            {disponiveis.map((b) => (
              <li key={b.id} draggable onDragStart={() => setArrastando(b.id)} onClick={() => adicionar(b.id)}
                className="flex cursor-grab items-center justify-between rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm active:cursor-grabbing hover:border-[var(--primary)]">
                <span>{rotuloBeneficio(b, prevNome)}</span>
                <span className="text-xs text-[var(--primary)]">+</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  // Edição → abas (igual ao "Editar cliente"). Criação → stepper (igual ao "Novo cliente").
  if (editando) {
    return (
      <Modal aberto onFechar={onFechar} titulo="Editar plano" largura="max-w-3xl"
        rodape={
          <div className="flex w-full items-center justify-between">
            <Button variante="ghost" className="text-[var(--danger)]" onClick={excluir} disabled={salvando}>Excluir</Button>
            <div className="flex gap-2">
              <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</Button>
            </div>
          </div>
        }
      >
        <Tabs
          alturaConteudo="420px"
          abas={[
            { id: "dados", label: "Dados", content: dados },
            { id: "beneficios", label: "Benefícios", content: beneficiosUI },
          ]}
        />
        {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </Modal>
    );
  }

  return (
    <StepperModal onFechar={salvando ? () => {} : onFechar} largura="max-w-3xl">
      {salvando ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-16 shadow-2xl">
          <LightningLoader texto="Cadastrando plano…" />
        </div>
      ) : (
        <Stepper completeButtonText="Cadastrar plano" onFinalStepCompleted={salvar} canProceed={(s) => (s === 1 ? p.nome.trim() !== "" : true)}>
          <Step>{dados}</Step>
          <Step>{beneficiosUI}</Step>
        </Stepper>
      )}
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </StepperModal>
  );
}

function AbaBeneficios() {
  const [itens, setItens] = useState<Required<BeneficioDados>[]>([]);
  const [edit, setEdit] = useState<BeneficioDados | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function recarregar() {
    try { setItens(await listarBeneficiosAdmin()); }
    finally { setCarregando(false); }
  }
   
  useEffect(() => { void recarregar(); }, []);

  const vazio: BeneficioDados = { chave: "", nome: "", descricao: "", ordem: itens.length + 1, ativo: true, features: [] };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">{itens.length} benefício(s) no catálogo. Use-os ao montar os planos.</p>
        <Button onClick={() => setEdit(vazio)}>+ Novo benefício</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-2.5">Nome</th>
              <th className="px-4 py-2.5">Chave</th>
              <th className="px-4 py-2.5 text-center">Ordem</th>
              <th className="px-4 py-2.5 text-center">Em uso</th>
              <th className="px-4 py-2.5 text-center">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={5} className="px-4 py-8"><LightningLoader texto="Carregando benefícios…" /></td></tr>
            ) : itens.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">Nenhum benefício.</td></tr>
            ) : itens.map((b) => (
              <tr key={b.id} onClick={() => setEdit(b)} className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{b.nome}</p>
                  {b.descricao && <p className="text-xs text-[var(--muted)]">{b.descricao}</p>}
                </td>
                <td className="px-4 py-3"><code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{b.chave}</code></td>
                <td className="px-4 py-3 text-center">{b.ordem}</td>
                <td className="px-4 py-3 text-center">{b.emUso}</td>
                <td className="px-4 py-3 text-center">{b.ativo ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {edit && <BeneficioModal inicial={edit} onFechar={() => setEdit(null)} onSalvo={() => { setEdit(null); recarregar(); }} />}
    </div>
  );
}

function BeneficioModal({ inicial, onFechar, onSalvo }: { inicial: BeneficioDados; onFechar: () => void; onSalvo: () => void }) {
  const [b, setB] = useState<BeneficioDados>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  function set<K extends keyof BeneficioDados>(k: K, v: BeneficioDados[K]) { setB((s) => ({ ...s, [k]: v })); }

  function toggleFeature(chave: string) {
    setB((s) => ({
      ...s,
      features: s.features.includes(chave) ? s.features.filter((f) => f !== chave) : [...s.features, chave],
    }));
  }
  const categorias = [...new Set(FEATURES.map((f) => f.categoria))];

  async function salvar() {
    setSalvando(true); setErro(null);
    const r = await salvarBeneficio(b);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo();
  }
  async function excluir() {
    if (!b.id) return;
    setSalvando(true);
    const r = await excluirBeneficio(b.id);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo();
  }

  return (
    <Modal aberto onFechar={onFechar} titulo={b.id ? "Editar benefício" : "Novo benefício"} largura="max-w-2xl"
      rodape={
        <div className="flex w-full items-center justify-between">
          {b.id ? <Button variante="ghost" className="text-[var(--danger)]" onClick={excluir} disabled={salvando}>Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" required className="sm:col-span-2"><Input value={b.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Integração com WhatsApp" /></Field>
          <Field label="Chave" hint="Único; vazio = gera do nome"><Input value={b.chave} onChange={(e) => set("chave", e.target.value)} placeholder="whatsapp" /></Field>
          <Field label="Ordem"><Input type="number" value={b.ordem} onChange={(e) => set("ordem", Number(e.target.value))} /></Field>
          <Field label="Descrição (opcional)" className="sm:col-span-2"><Input value={b.descricao} onChange={(e) => set("descricao", e.target.value)} /></Field>
        </div>

        <div>
          <p className="text-sm font-semibold">Funcionalidades liberadas</p>
          <p className="mb-2 text-xs text-[var(--muted)]">O que este benefício dá acesso. ({b.features.length} selecionada(s))</p>
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-[var(--border)] p-3">
            {categorias.map((cat) => (
              <div key={cat}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{cat}</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {FEATURES.filter((f) => f.categoria === cat).map((f) => (
                    <label key={f.chave} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={b.features.includes(f.chave)} onChange={() => toggleFeature(f.chave)} className="h-4 w-4 accent-[var(--primary)]" />
                      {f.nome}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={b.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Ativo
        </label>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}

function NovaCategoriaModal({ inicial, onFechar, onCriada }: { inicial?: CategoriaPlano; onFechar: () => void; onCriada: () => void }) {
  const editando = !!inicial;
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true); setErro(null);
    const r = editando ? await renomearCategoria(inicial.id, nome) : await criarCategoria(nome);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onCriada();
  }

  return (
    <Modal aberto onFechar={onFechar} titulo={editando ? "Renomear categoria" : "Nova categoria"} largura="max-w-sm"
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !nome.trim()}>{salvando ? "Salvando…" : editando ? "Salvar" : "Criar"}</Button>
        </>
      }
    >
      <Field label="Nome da categoria" required>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Para crescer" autoFocus />
      </Field>
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </Modal>
  );
}
