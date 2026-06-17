"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import { formatBRL, formatData } from "@/lib/format";
import {
  listarUsuarios, criarUsuario, type UsuarioResumo,
  listarPlanos, salvarPlano, excluirPlano, type PlanoDados,
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

export default function AdminPage() {
  const [aba, setAba] = useState<"usuarios" | "planos">("usuarios");

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Painel administrativo</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">Usuários, licenças, pagamentos e planos.</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        {(["usuarios", "planos"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={"rounded-md px-4 py-1.5 transition " + (aba === a ? "bg-white text-[var(--primary)] shadow-sm" : "text-slate-500")}
          >
            {a === "usuarios" ? "Usuários & Licenças" : "Planos"}
          </button>
        ))}
      </div>

      {aba === "usuarios" ? <AbaUsuarios /> : <AbaPlanos />}
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
  const [edit, setEdit] = useState<PlanoDados | null>(null);

  async function recarregar() { setPlanos(await listarPlanos()); }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recarregar(); }, []);

  const vazio: PlanoDados = { nome: "", descricao: "", preco: 0, periodicidade: "mensal", limiteEmpresas: 1, recursos: [], ativo: true, ordem: planos.length };

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
              {p.recursos.map((r, i) => <li key={i} className="flex gap-1.5"><span className="text-[var(--success)]">✓</span>{r}</li>)}
            </ul>
            <Button variante="secondary" className="mt-4" onClick={() => setEdit(p)}>Editar</Button>
          </Card>
        ))}
      </div>

      {edit && <PlanoModal inicial={edit} onFechar={() => setEdit(null)} onSalvo={() => { setEdit(null); recarregar(); }} />}
    </div>
  );
}

function PlanoModal({ inicial, onFechar, onSalvo }: { inicial: PlanoDados; onFechar: () => void; onSalvo: () => void }) {
  const [p, setP] = useState<PlanoDados>(inicial);
  const [recursosTexto, setRecursosTexto] = useState(inicial.recursos.join("\n"));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function set<K extends keyof PlanoDados>(k: K, v: PlanoDados[K]) { setP((s) => ({ ...s, [k]: v })); }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarPlano({ ...p, recursos: recursosTexto.split("\n").map((x) => x.trim()).filter(Boolean) });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo();
  }
  async function remover() {
    if (!p.id) return;
    setSalvando(true);
    const r = await excluirPlano(p.id);
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onSalvo();
  }

  return (
    <Modal aberto onFechar={onFechar} titulo={p.id ? "Editar plano" : "Novo plano"} largura="max-w-lg"
      rodape={
        <div className="flex w-full items-center justify-between">
          {p.id ? <Button variante="ghost" className="text-[var(--danger)]" onClick={remover} disabled={salvando}>Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome" required className="col-span-2"><Input value={p.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
          <Field label="Preço (R$)"><Input type="number" step="0.01" min="0" value={p.preco} onChange={(e) => set("preco", Number(e.target.value))} /></Field>
          <Field label="Periodicidade"><Select opcoes={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }]} value={p.periodicidade} onChange={(e) => set("periodicidade", e.target.value)} /></Field>
          <Field label="Limite de empresas" hint="-1 = ilimitado"><Input type="number" value={p.limiteEmpresas} onChange={(e) => set("limiteEmpresas", Number(e.target.value))} /></Field>
          <Field label="Ordem"><Input type="number" value={p.ordem} onChange={(e) => set("ordem", Number(e.target.value))} /></Field>
        </div>
        <Field label="Descrição"><Input value={p.descricao} onChange={(e) => set("descricao", e.target.value)} /></Field>
        <Field label="Recursos (um por linha)"><Textarea value={recursosTexto} onChange={(e) => setRecursosTexto(e.target.value)} placeholder={"Emissão ilimitada de NF-e\nSuporte por WhatsApp"} /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Ativo (exibir na landing page)
        </label>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}
