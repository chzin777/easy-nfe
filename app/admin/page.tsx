"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { Badge, Button, Card, Field, Input, Select } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import { formatBRL, formatData } from "@/lib/format";
import {
  listarUsuarios, criarUsuario, type UsuarioResumo,
  listarPlanos, salvarPlano, excluirPlano, type PlanoDados,
  listarBeneficios, type Beneficio,
  listarBeneficiosAdmin, salvarBeneficio, excluirBeneficio, type BeneficioDados,
} from "./actions";
import UsuarioDetalhe from "./UsuarioDetalhe";

const ROLES = [
  { value: "USER", label: "Usuário" },
  { value: "SUPORTE", label: "Suporte" },
  { value: "ADMIN", label: "Administrador" },
];

const tomLicenca: Record<string, "success" | "danger" | "warning" | "neutral" | "primary"> = {
  ATIVA: "success", TRIAL: "primary", EXPIRADA: "danger", SUSPENSA: "warning", CANCELADA: "neutral",
};

const ABAS = ["usuarios", "planos", "beneficios"] as const;
type Aba = (typeof ABAS)[number];
const ABA_LABEL: Record<Aba, string> = {
  usuarios: "Usuários & Licenças",
  planos: "Planos",
  beneficios: "Benefícios",
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
            {aba === "usuarios" ? <AbaUsuarios /> : aba === "planos" ? <AbaPlanos /> : <AbaBeneficios />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
  const [novo, setNovo] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  async function recarregar() {
    setUsuarios(await listarUsuarios());
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
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
            {usuarios.length === 0 ? (
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

function NovoUsuarioModal({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState("USER");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await criarUsuario({ email, senha, nome, role: role as "USER" | "SUPORTE" | "ADMIN" });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setEmail(""); setSenha(""); setNome(""); setRole("USER");
    onCriado();
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Novo usuário" largura="max-w-md"
      rodape={<><Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button><Button onClick={salvar} disabled={salvando}>{salvando ? "Criando…" : "Criar"}</Button></>}
    >
      <div className="space-y-4">
        <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="E-mail" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Senha" required hint="Mínimo 8 caracteres."><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
        <Field label="Papel" required><Select opcoes={ROLES} value={role} onChange={(e) => setRole(e.target.value)} /></Field>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}

function AbaPlanos() {
  const [planos, setPlanos] = useState<Required<PlanoDados>[]>([]);
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [edit, setEdit] = useState<PlanoDados | null>(null);

  async function recarregar() {
    const [pl, bs] = await Promise.all([listarPlanos(), listarBeneficios()]);
    setPlanos(pl);
    setBeneficios(bs);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recarregar(); }, []);

  const nomePorId = new Map(beneficios.map((b) => [b.id, b.nome]));
  const vazio: PlanoDados = { nome: "", descricao: "", preco: 0, periodicidade: "mensal", limiteEmpresas: 1, limiteUsuarios: 1, beneficioIds: [], ativo: true, ordem: planos.length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">{planos.length} plano(s). Aparecem na landing page quando ativos.</p>
        <Button onClick={() => setEdit(vazio)}>+ Novo plano</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {planos.map((p) => (
          <Card key={p.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{p.nome}</p>
                <p className="text-xs text-[var(--muted)]">{p.periodicidade} · {p.limiteEmpresas < 0 ? "∞" : p.limiteEmpresas} empresa(s)</p>
              </div>
              {!p.ativo && <Badge tom="neutral">inativo</Badge>}
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--primary)]">{formatBRL(p.preco)}</p>
            {p.descricao && <p className="mt-1 text-sm text-[var(--muted)]">{p.descricao}</p>}
            <ul className="mt-3 flex-1 space-y-1 text-sm">
              {p.beneficioIds.map((id) => <li key={id} className="flex gap-1.5"><span className="text-[var(--success)]">✓</span>{nomePorId.get(id) ?? id}</li>)}
            </ul>
            <Button variante="secondary" className="mt-4" onClick={() => setEdit(p)}>Editar</Button>
          </Card>
        ))}
      </div>

      {edit && <PlanoModal inicial={edit} catalogo={beneficios} onFechar={() => setEdit(null)} onSalvo={() => { setEdit(null); recarregar(); }} />}
    </div>
  );
}

function PlanoModal({ inicial, catalogo, onFechar, onSalvo }: { inicial: PlanoDados; catalogo: Beneficio[]; onFechar: () => void; onSalvo: () => void }) {
  const [p, setP] = useState<PlanoDados>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);

  function set<K extends keyof PlanoDados>(k: K, v: PlanoDados[K]) { setP((s) => ({ ...s, [k]: v })); }

  const noPlano = p.beneficioIds.map((id) => catalogo.find((b) => b.id === id)).filter(Boolean) as Beneficio[];
  const disponiveis = catalogo.filter((b) => !p.beneficioIds.includes(b.id));

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

  return (
    <Modal aberto onFechar={onFechar} titulo={p.id ? "Editar plano" : "Novo plano"} largura="max-w-3xl"
      rodape={
        <div className="flex w-full items-center justify-between">
          {p.id ? <Button variante="ghost" className="text-[var(--danger)]" onClick={excluir} disabled={salvando}>Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome" required className="col-span-2"><Input value={p.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
          <Field label="Preço (R$)"><Input type="number" step="0.01" min="0" value={p.preco} onChange={(e) => set("preco", Number(e.target.value))} /></Field>
          <Field label="Periodicidade"><Select opcoes={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }]} value={p.periodicidade} onChange={(e) => set("periodicidade", e.target.value)} /></Field>
          <Field label="Limite de empresas" hint="-1 = ilimitado"><Input type="number" value={p.limiteEmpresas} onChange={(e) => set("limiteEmpresas", Number(e.target.value))} /></Field>
          <Field label="Usuários por empresa" hint="-1 = ilimitado"><Input type="number" value={p.limiteUsuarios} onChange={(e) => set("limiteUsuarios", Number(e.target.value))} /></Field>
          <Field label="Ordem"><Input type="number" value={p.ordem} onChange={(e) => set("ordem", Number(e.target.value))} /></Field>
          <Field label="Descrição" className="col-span-2"><Input value={p.descricao} onChange={(e) => set("descricao", e.target.value)} /></Field>
        </div>

        {/* Benefícios: arrastar do catálogo (direita) para o plano (esquerda) */}
        <div>
          <p className="mb-2 text-sm font-semibold">Benefícios do plano <span className="font-normal text-[var(--muted)]">— arraste ou clique para mover</span></p>
          <div className="grid grid-cols-2 gap-3">
            {/* No plano */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (arrastando) { adicionar(arrastando); setArrastando(null); } }}
              className="min-h-[180px] rounded-lg border-2 border-dashed border-[var(--primary)]/30 bg-[var(--primary-soft)]/40 p-2"
            >
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--primary)]">No plano ({noPlano.length})</p>
              {noPlano.length === 0 && <p className="px-1 py-6 text-center text-xs text-[var(--muted)]">Arraste benefícios para cá.</p>}
              <ul className="space-y-1.5">
                {noPlano.map((b) => (
                  <li
                    key={b.id}
                    draggable
                    onDragStart={() => setArrastando(b.id)}
                    onClick={() => remover(b.id)}
                    className="flex cursor-grab items-center justify-between rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm active:cursor-grabbing"
                  >
                    <span>{b.nome}</span>
                    <span className="text-xs text-[var(--danger)]">✕</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Disponíveis */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (arrastando) { remover(arrastando); setArrastando(null); } }}
              className="min-h-[180px] rounded-lg border-2 border-dashed border-[var(--border)] bg-slate-50 p-2"
            >
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Disponíveis ({disponiveis.length})</p>
              {disponiveis.length === 0 && <p className="px-1 py-6 text-center text-xs text-[var(--muted)]">Todos no plano.</p>}
              <ul className="space-y-1.5">
                {disponiveis.map((b) => (
                  <li
                    key={b.id}
                    draggable
                    onDragStart={() => setArrastando(b.id)}
                    onClick={() => adicionar(b.id)}
                    className="flex cursor-grab items-center justify-between rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-sm active:cursor-grabbing hover:border-[var(--primary)]"
                  >
                    <span>{b.nome}</span>
                    <span className="text-xs text-[var(--primary)]">+</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Ativo (exibir na landing page)
        </label>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}

function AbaBeneficios() {
  const [itens, setItens] = useState<Required<BeneficioDados>[]>([]);
  const [edit, setEdit] = useState<BeneficioDados | null>(null);

  async function recarregar() { setItens(await listarBeneficiosAdmin()); }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recarregar(); }, []);

  const vazio: BeneficioDados = { chave: "", nome: "", descricao: "", ordem: itens.length + 1, ativo: true };

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
            {itens.length === 0 ? (
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
    <Modal aberto onFechar={onFechar} titulo={b.id ? "Editar benefício" : "Novo benefício"} largura="max-w-lg"
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
        <Field label="Nome" required><Input value={b.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Integração com WhatsApp" /></Field>
        <Field label="Chave" hint="Identificador único; deixe vazio para gerar do nome"><Input value={b.chave} onChange={(e) => set("chave", e.target.value)} placeholder="whatsapp" /></Field>
        <Field label="Descrição (opcional)"><Input value={b.descricao} onChange={(e) => set("descricao", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ordem"><Input type="number" value={b.ordem} onChange={(e) => set("ordem", Number(e.target.value))} /></Field>
          <label className="flex items-end gap-2 pb-2.5 text-sm">
            <input type="checkbox" checked={b.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Ativo
          </label>
        </div>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}
