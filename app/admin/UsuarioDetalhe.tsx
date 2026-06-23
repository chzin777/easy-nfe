"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Field, Input, Select } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { formatBRL, formatData } from "@/lib/format";
import {
  detalheUsuario, type UsuarioDetalhe as Detalhe,
  atualizarUsuario, redefinirSenha, excluirUsuario,
  definirLicenca, listarPlanos, type PlanoDados,
  listarEmpresasAdmin, type EmpresaAdmin,
  criarEmpresaParaUsuario, vincularUsuarioEmpresa, desvincularUsuarioEmpresa,
  gerarFaturas, marcarFaturaPaga, marcarFaturaPendente, excluirFatura,
  gerarBoletoAssinatura,
} from "./actions";

const ROLES = [
  { value: "USER", label: "Usuário" },
  { value: "SUPORTE", label: "Suporte" },
  { value: "CONTADOR", label: "Contador" },
  { value: "ADMIN", label: "Administrador" },
];
const STATUS_LIC = ["TRIAL", "ATIVA", "EXPIRADA", "SUSPENSA", "CANCELADA"].map((v) => ({ value: v, label: v }));
const METODOS = ["pix", "cartao", "boleto", "transferencia"].map((v) => ({ value: v, label: v }));

export default function UsuarioDetalhe({
  userId, onFechar, onMudou,
}: { userId: string; onFechar: () => void; onMudou: () => void }) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [planos, setPlanos] = useState<Required<PlanoDados>[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [aba, setAba] = useState("conta");
  const [salvando, setSalvando] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);
  // aba ativa registra aqui seu save; o botão único do rodapé o aciona.
  const salvarRef = useRef<(() => void | Promise<void>) | null>(null);

  async function salvarAtual() {
    setSalvando(true);
    try { await salvarRef.current?.(); } finally { setSalvando(false); }
  }
  const temSalvar = aba === "conta" || aba === "licenca";

  async function excluir() {
    setExcluindo(true);
    setErroExcluir(null);
    const r = await excluirUsuario(userId);
    setExcluindo(false);
    if (!r.ok) { setErroExcluir(r.erro); setConfirmarExcluir(false); return; }
    onMudou();
    onFechar();
  }

  async function recarregar() {
    const det = await detalheUsuario(userId);
    setD(det);
    onMudou();
  }
  useEffect(() => {
    (async () => {
      setD(await detalheUsuario(userId));
      setPlanos(await listarPlanos());
      setEmpresas(await listarEmpresasAdmin());
    })();
  }, [userId]);

  if (!d) {
    return <Modal aberto onFechar={onFechar} titulo="Carregando…" largura="max-w-2xl"><LightningLoader texto="Buscando dados…" /></Modal>;
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`${d.nome || d.email}`}
      largura="max-w-4xl"
      rodape={
        <div className="flex w-full items-center justify-between gap-3">
          {confirmarExcluir ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--danger)]">Excluir definitivamente?</span>
              <Button variante="danger" onClick={excluir} disabled={excluindo}>{excluindo ? "Excluindo…" : "Sim, excluir"}</Button>
              <Button variante="secondary" onClick={() => setConfirmarExcluir(false)} disabled={excluindo}>Cancelar</Button>
            </div>
          ) : (
            <Button variante="ghost" className="text-[var(--danger)]" onClick={() => { setErroExcluir(null); setConfirmarExcluir(true); }}>
              Excluir usuário
            </Button>
          )}
          {temSalvar && !confirmarExcluir ? (
            <Button onClick={salvarAtual} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
          ) : (
            <span />
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {msg && <p className="rounded-lg bg-[var(--success-soft)] px-3 py-2 text-sm font-medium text-[var(--success)]">{msg}</p>}
        {erroExcluir && <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">{erroExcluir}</p>}
        <Tabs
          alturaConteudo="460px"
          onMudarAba={setAba}
          abas={[
            { id: "conta", label: "Conta", content: <Conta d={d} onMudou={recarregar} flash={setMsg} registrar={(fn) => (salvarRef.current = fn)} /> },
            { id: "licenca", label: "Licença", content: <Licenca d={d} planos={planos} onMudou={recarregar} flash={setMsg} registrar={(fn) => (salvarRef.current = fn)} /> },
            { id: "empresas", label: `Empresas (${d.empresas.length})`, content: <Empresas d={d} empresas={empresas} onMudou={recarregar} flash={setMsg} /> },
            { id: "faturas", label: `Faturas (${d.faturas.length})`, content: <Faturas d={d} onMudou={recarregar} flash={setMsg} /> },
          ]}
        />
      </div>
    </Modal>
  );
}

type Sub = { d: Detalhe; onMudou: () => void; flash: (m: string) => void };
type ComSalvar = { registrar: (fn: () => void | Promise<void>) => void };

function Secao({ children }: { titulo: string; children: React.ReactNode }) {
  return <section>{children}</section>;
}

function Conta({ d, onMudou, flash, registrar }: Sub & ComSalvar) {
  const [nome, setNome] = useState(d.nome);
  const [email, setEmail] = useState(d.email);
  const [role, setRole] = useState(d.role);
  const [ativo, setAtivo] = useState(d.ativo);
  const [cpfCnpj, setCpfCnpj] = useState(d.cpfCnpj ?? "");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const r = await atualizarUsuario(d.id, { nome, email, role: role as "USER" | "SUPORTE" | "ADMIN" | "CONTADOR", ativo, cpfCnpj });
    if (!r.ok) { setErro(r.erro); return; }
    if (senha) {
      const rs = await redefinirSenha(d.id, senha);
      if (!rs.ok) { setErro(rs.erro); return; }
      setSenha("");
    }
    flash(senha ? "Conta e senha atualizadas." : "Conta atualizada."); onMudou();
  }
  useEffect(() => { registrar(salvar); });

  return (
    <Secao titulo="Conta">
      <Card className="space-y-4 p-4">
        <p className="text-xs text-[var(--muted)]">Criado em {formatData(d.criadoEm)}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Papel"><Select opcoes={ROLES} value={role} onChange={(e) => setRole(e.target.value as typeof role)} /></Field>
          <Field label="Status"><Select opcoes={[{ value: "true", label: "Ativo" }, { value: "false", label: "Bloqueado" }]} value={String(ativo)} onChange={(e) => setAtivo(e.target.value === "true")} /></Field>
          <Field label="CPF/CNPJ" hint="Usado na cobrança (Asaas)"><Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="só números" /></Field>
        </div>
        <Field label="Redefinir senha" hint="Deixe em branco p/ manter. Mín. 8 caracteres."><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="nova senha" /></Field>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </Card>
    </Secao>
  );
}

function isoEmDias(dias: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + dias);
  return dt.toISOString().slice(0, 10);
}

function Licenca({ d, planos, onMudou, flash, registrar }: Sub & ComSalvar & { planos: Required<PlanoDados>[] }) {
  const [planoId, setPlanoId] = useState(d.licenca?.planoId ?? "");
  const [status, setStatus] = useState(d.licenca?.status ?? "TRIAL");
  // trial padrão = 7 dias; validade já reflete daqui 7 dias quando não houver uma definida.
  const [diasTrial, setDiasTrial] = useState(7);
  const [validade, setValidade] = useState(
    d.licenca?.validadeEm ? d.licenca.validadeEm.slice(0, 10) : isoEmDias(7),
  );
  const [erro, setErro] = useState<string | null>(null);

  // sem opção "Sem plano": seleciona o primeiro plano automaticamente quando carregar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!planoId && planos.length) setPlanoId(planos[0].id);
  }, [planos, planoId]);

  function aplicarTrial(dias: number) {
    setDiasTrial(dias);
    setValidade(isoEmDias(dias));
  }

  async function salvar() {
    setErro(null);
    if (!planoId) { setErro("Selecione um plano para aplicar as permissões."); return; }
    const r = await definirLicenca({ userId: d.id, planoId, status: status as "TRIAL" | "ATIVA" | "EXPIRADA" | "SUSPENSA" | "CANCELADA", validadeEm: validade || null });
    if (!r.ok) { setErro(r.erro); return; }
    flash("Licença atualizada."); onMudou();
  }
  useEffect(() => { registrar(salvar); });

  const opcoesPlano = planos.map((p) => ({ id: p.id, nome: p.nome, preco: p.preco as number | undefined, periodicidade: p.periodicidade, limite: p.limiteEmpresas }));

  return (
    <Secao titulo="Licença / Plano">
      <Card className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--muted)]">Plano</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {opcoesPlano.map((p) => {
              const sel = planoId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPlanoId(p.id)}
                  className={
                    "flex flex-col items-start rounded-xl border-2 p-3 text-left transition " +
                    (sel ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:border-slate-300")
                  }
                >
                  <span className="text-sm font-semibold">{p.nome}</span>
                  {p.preco !== undefined ? (
                    <>
                      <span className="mt-1 text-lg font-bold text-[var(--primary)]">{formatBRL(p.preco)}</span>
                      <span className="text-[10px] text-[var(--muted)]">
                        /{p.periodicidade === "anual" ? "ano" : "mês"} · {p.limite < 0 ? "∞" : p.limite} empresa(s)
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 text-xs text-[var(--muted)]">Sob consulta</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Status"><Select opcoes={STATUS_LIC} value={status} onChange={(e) => setStatus(e.target.value)} /></Field>
          {status === "TRIAL" ? (
            <Field label="Período de trial (dias)" hint={`Expira em ${formatData(validade)}`}>
              <Input type="number" min="1" value={diasTrial} onChange={(e) => aplicarTrial(Math.max(1, Number(e.target.value) || 0))} />
            </Field>
          ) : (
            <Field label="Validade"><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></Field>
          )}
        </div>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </Card>
    </Secao>
  );
}

function Empresas({ d, empresas, onMudou, flash }: Sub & { empresas: EmpresaAdmin[] }) {
  const [vincularId, setVincularId] = useState("");
  const [vincularPapel, setVincularPapel] = useState<"dono" | "membro">("membro");
  const [erro, setErro] = useState<string | null>(null);
  const [novaForm, setNovaForm] = useState(false);

  // empresas que o usuário ainda NÃO tem.
  const idsDoUsuario = new Set(d.empresas.map((e) => e.id));
  const disponiveis = empresas.filter((e) => !idsDoUsuario.has(e.id));

  async function vincular() {
    if (!vincularId) return;
    setErro(null);
    const r = await vincularUsuarioEmpresa({ userId: d.id, empresaId: vincularId, papel: vincularPapel });
    if (!r.ok) { setErro(r.erro); return; }
    setVincularId(""); setVincularPapel("membro"); flash("Empresa vinculada."); onMudou();
  }
  async function trocarPapel(empresaId: string, papel: "dono" | "membro") {
    setErro(null);
    const r = await vincularUsuarioEmpresa({ userId: d.id, empresaId, papel });
    if (!r.ok) { setErro(r.erro); return; }
    flash(`Papel alterado para ${papel}.`); onMudou();
  }
  async function desvincular(empresaId: string) {
    const r = await desvincularUsuarioEmpresa(d.id, empresaId);
    if (!r.ok) { setErro(r.erro); return; }
    flash("Empresa desvinculada."); onMudou();
  }

  return (
    <Secao titulo="Empresas vinculadas">
      <Card className="space-y-3 p-4">
        {d.empresas.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nenhuma empresa.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {d.empresas.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-medium">{e.razaoSocial}</span> <span className="text-[var(--muted)]">· {e.cnpj}</span> <Badge tom={e.papel === "dono" ? "primary" : "neutral"}>{e.papel}</Badge></span>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variante="secondary" onClick={() => trocarPapel(e.id, e.papel === "dono" ? "membro" : "dono")} className="!px-3 !py-1.5 !text-xs">
                    {e.papel === "dono" ? "Tornar membro" : "Tornar dono"}
                  </Button>
                  <Button variante="danger" onClick={() => desvincular(e.id)} className="!px-3 !py-1.5 !text-xs">Desvincular</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2 border-t border-[var(--border)] pt-3">
          <Field label="Vincular empresa existente" className="flex-1">
            <Select opcoes={[{ value: "", label: "Selecione…" }, ...disponiveis.map((e) => ({ value: e.id, label: `${e.razaoSocial} · ${e.cnpj}` }))]} value={vincularId} onChange={(e) => setVincularId(e.target.value)} />
          </Field>
          <Field label="Papel">
            <Select opcoes={[{ value: "membro", label: "Membro" }, { value: "dono", label: "Dono" }]} value={vincularPapel} onChange={(e) => setVincularPapel(e.target.value as "dono" | "membro")} />
          </Field>
          <Button variante="secondary" onClick={vincular} disabled={!vincularId}>Vincular</Button>
          <Button variante="secondary" onClick={() => setNovaForm((v) => !v)}>+ Nova empresa</Button>
        </div>

        {novaForm && <NovaEmpresa userId={d.id} onCriou={() => { setNovaForm(false); flash("Empresa criada e vinculada."); onMudou(); }} />}
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </Card>
    </Secao>
  );
}

function NovaEmpresa({ userId, onCriou }: { userId: string; onCriou: () => void }) {
  const [f, setF] = useState({
    razaoSocial: "", cnpj: "", inscricaoEstadual: "", crt: "1",
    cep: "", logradouro: "", numero: "", bairro: "", municipio: "", uf: "GO",
    ambiente: "homologacao" as "homologacao" | "producao",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((s) => ({ ...s, [k]: v })); }

  async function criar() {
    setSalvando(true); setErro(null);
    const r = await criarEmpresaParaUsuario({ userId, ...f });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onCriou();
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-[var(--border)] p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Razão social" required className="col-span-2"><Input value={f.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} /></Field>
        <Field label="CNPJ" required><Input value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} /></Field>
        <Field label="Inscrição estadual"><Input value={f.inscricaoEstadual} onChange={(e) => set("inscricaoEstadual", e.target.value)} /></Field>
        <Field label="CRT"><Select opcoes={[{ value: "1", label: "1 - Simples" }, { value: "2", label: "2 - Simples excesso" }, { value: "3", label: "3 - Normal" }]} value={f.crt} onChange={(e) => set("crt", e.target.value)} /></Field>
        <Field label="Ambiente"><Select opcoes={[{ value: "homologacao", label: "Homologação" }, { value: "producao", label: "Produção" }]} value={f.ambiente} onChange={(e) => set("ambiente", e.target.value as typeof f.ambiente)} /></Field>
        <Field label="CEP"><Input value={f.cep} onChange={(e) => set("cep", e.target.value)} /></Field>
        <Field label="Logradouro"><Input value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></Field>
        <Field label="Número"><Input value={f.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
        <Field label="Bairro"><Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} /></Field>
        <Field label="Município"><Input value={f.municipio} onChange={(e) => set("municipio", e.target.value)} /></Field>
        <Field label="UF"><Input value={f.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} maxLength={2} /></Field>
      </div>
      {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      <div className="flex justify-end"><Button onClick={criar} disabled={salvando}>{salvando ? "Criando…" : "Criar e vincular"}</Button></div>
    </div>
  );
}

const tomFatura: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PAGA: "success", PENDENTE: "warning", ATRASADA: "danger", CANCELADA: "neutral",
};

function competenciaLabel(c: string): string {
  const [ano, mes] = c.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`;
}

function Faturas({ d, onMudou, flash }: Sub) {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [data, setData] = useState(hojeISO);
  const [metodo, setMetodo] = useState("pix");
  const [erro, setErro] = useState<string | null>(null);
  const [boletoFor, setBoletoFor] = useState<string | null>(null);
  const [cpf, setCpf] = useState(d.cpfCnpj ?? "");
  const [gerandoBoleto, setGerandoBoleto] = useState(false);

  async function gerarBoleto(f: Detalhe["faturas"][number]) {
    setErro(null);
    setGerandoBoleto(true);
    const r = await gerarBoletoAssinatura({
      userId: d.id, cpfCnpj: cpf, competencia: f.competencia,
      valor: f.valor, vencimento: f.vencimento.slice(0, 10),
    });
    setGerandoBoleto(false);
    if (!r.ok) { setErro(r.erro); return; }
    setBoletoFor(null);
    flash("Boleto gerado no Asaas.");
    onMudou();
  }
  function copiar(txt: string) {
    navigator.clipboard?.writeText(txt).then(() => flash("Linha digitável copiada."));
  }

  function abrirPagamento(id: string) {
    setPagandoId(pagandoId === id ? null : id);
    setData(hojeISO); // data do pagamento já vem com hoje
    setMetodo("pix");
  }

  async function gerar() {
    setErro(null);
    const r = await gerarFaturas(d.id);
    if (!r.ok) { setErro(r.erro); return; }
    flash("Faturas geradas."); onMudou();
  }
  async function confirmarPaga(id: string) {
    setErro(null);
    const r = await marcarFaturaPaga({ faturaId: id, data, metodo });
    if (!r.ok) { setErro(r.erro); return; }
    setPagandoId(null); flash("Fatura marcada como paga."); onMudou();
  }
  async function reabrir(id: string) {
    const r = await marcarFaturaPendente(id);
    if (!r.ok) { setErro(r.erro); return; }
    flash("Fatura reaberta."); onMudou();
  }
  async function remover(id: string) {
    const r = await excluirFatura(id);
    if (!r.ok) { setErro(r.erro); return; }
    flash("Fatura removida."); onMudou();
  }

  const totalPago = d.faturas.filter((f) => f.status === "PAGA").reduce((s, f) => s + f.valor, 0);
  const pendentes = d.faturas.filter((f) => f.status !== "PAGA" && f.status !== "CANCELADA").reduce((s, f) => s + f.valor, 0);

  return (
    <Secao titulo="Faturas">
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">Geradas a partir do plano e da validade da licença.</p>
          <Button variante="secondary" onClick={gerar}>Gerar faturas</Button>
        </div>

        {d.faturas.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">Nenhuma fatura. Defina um plano e validade na aba Licença, depois clique em “Gerar faturas”.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {d.faturas.map((f) => (
              <li key={f.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{competenciaLabel(f.competencia)} · {formatBRL(f.valor)}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {f.planoNome} · vence {formatData(f.vencimento)}
                      {f.status === "PAGA" && f.pagaEm && ` · pago em ${formatData(f.pagaEm)}${f.metodo ? ` (${f.metodo})` : ""}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tom={tomFatura[f.status] ?? "neutral"}>{f.status}</Badge>
                    {f.status === "PAGA" ? (
                      <button onClick={() => reabrir(f.id)} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                        Reabrir
                      </button>
                    ) : (
                      <button onClick={() => abrirPagamento(f.id)} className="flex items-center gap-1 rounded-md bg-[var(--success)] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        Marcar paga
                      </button>
                    )}
                    <button onClick={() => remover(f.id)} title="Excluir fatura" className="flex items-center justify-center rounded-md border border-red-200 px-2 py-1.5 text-[var(--danger)] transition hover:bg-red-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                    </button>
                  </div>
                </div>

                {pagandoId === f.id && (
                  <div className="mt-2 flex items-end gap-2 rounded-lg border border-[var(--border)] bg-slate-50 p-3">
                    <Field label="Data do pagamento" className="flex-1"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
                    <Field label="Método" className="flex-1"><Select opcoes={METODOS} value={metodo} onChange={(e) => setMetodo(e.target.value)} /></Field>
                    <Button variante="secondary" onClick={() => setPagandoId(null)}>Cancelar</Button>
                    <Button onClick={() => confirmarPaga(f.id)}>Confirmar</Button>
                  </div>
                )}

                {/* Boleto Asaas */}
                {f.status !== "PAGA" && f.status !== "CANCELADA" && (
                  <div className="mt-2">
                    {f.bankSlipUrl ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-slate-50 p-2.5 text-xs">
                        <a href={f.bankSlipUrl} target="_blank" rel="noreferrer" className="font-medium text-[var(--primary)] hover:underline">Abrir boleto (PDF)</a>
                        {f.linhaDigitavel && (
                          <>
                            <span className="font-mono text-[var(--muted)]">{f.linhaDigitavel}</span>
                            <button onClick={() => copiar(f.linhaDigitavel!)} className="rounded border border-[var(--border)] px-2 py-1 font-medium hover:bg-white">Copiar</button>
                          </>
                        )}
                        <button onClick={() => setBoletoFor(boletoFor === f.id ? null : f.id)} className="ml-auto text-[var(--muted)] hover:underline">regerar</button>
                      </div>
                    ) : (
                      <button onClick={() => setBoletoFor(boletoFor === f.id ? null : f.id)} className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                        Gerar boleto (Asaas)
                      </button>
                    )}

                    {boletoFor === f.id && (
                      <div className="mt-2 flex items-end gap-2 rounded-lg border border-[var(--border)] bg-white p-3">
                        <Field label="CPF/CNPJ do assinante" className="flex-1" hint="Obrigatório p/ o boleto"><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="só números" /></Field>
                        <Button variante="secondary" onClick={() => setBoletoFor(null)}>Cancelar</Button>
                        <Button onClick={() => gerarBoleto(f)} disabled={gerandoBoleto}>{gerandoBoleto ? "Gerando…" : "Gerar"}</Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between border-t border-[var(--border)] pt-2 text-xs">
          <span className="text-[var(--muted)]">Pendente: <span className="font-semibold text-[var(--warning)]">{formatBRL(pendentes)}</span></span>
          <span className="text-[var(--muted)]">Total pago: <span className="font-semibold text-[var(--success)]">{formatBRL(totalPago)}</span></span>
        </div>
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </Card>
    </Secao>
  );
}
