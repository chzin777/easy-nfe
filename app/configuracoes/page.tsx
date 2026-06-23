"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Select,
  formatData,
} from "@/app/ui/primitives";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { EnderecoFields } from "@/app/ui/PessoaFields";
import NovaEmpresaModal from "./NovaEmpresaModal";
import AbaWhatsApp from "./AbaWhatsApp";
import {
  listarEmpresas,
  obterEmpresaAtiva,
  salvarEmpresa,
  trocarEmpresa,
  salvarCertificado,
  removerCertificado,
  obterCertificado,
  listarEquipe,
  adicionarMembro,
  removerMembro,
  alterarPapelMembro,
  obterDadosCobranca,
  salvarDadosCobranca,
  type CertStatus,
  type EmpresaDados,
  type EmpresaResumo,
  type EquipeInfo,
} from "./actions";

const CRT = [
  { value: "1", label: "1 - Simples Nacional" },
  { value: "2", label: "2 - Simples Nacional (excesso de sublimite)" },
  { value: "3", label: "3 - Regime Normal" },
];

const empresaVazia: EmpresaDados = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  crt: "1",
  telefone: "",
  email: "",
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
  ambiente: "homologacao",
  serie: "1",
  proximoNumero: "1",
  serieNFCe: "1",
  proximoNumeroNFCe: "1",
  cscNFCe: "",
  idCscNFCe: "",
  casasDecimaisQtd: "2",
};

export default function ConfiguracoesPage() {
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
  const [form, setForm] = useState<EmpresaDados>(empresaVazia);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);

  async function carregar() {
    const [lista, ativa] = await Promise.all([listarEmpresas(), obterEmpresaAtiva()]);
    setEmpresas(lista);
    setForm(ativa ?? empresaVazia);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, []);

  async function onTrocar(id: string) {
    setTrocando(true);
    await trocarEmpresa(id);
    await carregar();
    setTrocando(false);
  }

  async function aoCriarEmpresa() {
    setNovaAberta(false);
    setTrocando(true);
    await carregar(); // a empresa nova já vem como ativa (server action)
    setTrocando(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarEmpresa(form);
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
    await carregar();
  }

  function setE<K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  const ativaValue = form.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configurações fiscais"
        subtitulo="Empresa emitente, certificado digital e ambiente de emissão."
        acao={
          <div className="flex items-center gap-3">
            {salvo && <span className="text-sm font-medium text-[var(--success)]">✓ Salvo</span>}
            {form.id && (
              <Button variante="secondary" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar alterações"}
              </Button>
            )}
            <Button onClick={() => setNovaAberta(true)}>+ Nova empresa</Button>
          </div>
        }
      />

      {empresas.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="max-w-md text-sm text-[var(--muted)]">
            Cadastre sua primeira empresa emitente — dados fiscais, endereço e certificado A1 — para começar a emitir notas.
          </p>
          <Button onClick={() => setNovaAberta(true)}>+ Cadastrar empresa</Button>
        </Card>
      ) : (
        <>
          {/* Seletor de empresa */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-[var(--muted)]">Empresa ativa:</span>
              <div className="min-w-[280px] flex-1">
                <SeletorEmpresa empresas={empresas} ativaId={ativaValue} onSelecionar={onTrocar} onNova={() => setNovaAberta(true)} />
              </div>
            </div>
          </Card>

          {erro && (
            <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{erro}</p>
          )}

          <Card className="relative p-6">
            {trocando && <LightningLoader overlay texto="Carregando empresa…" />}
            <Tabs
              abas={[
                { id: "emit", label: "Empresa emitente", content: <AbaEmitente form={form} setE={setE} setForm={setForm} onSalvar={salvar} salvando={salvando} salvo={salvo} /> },
                { id: "cert", label: "Certificado A1", content: <AbaCertificado /> },
                { id: "cobranca", label: "Cobrança", content: <AbaCobranca /> },
                { id: "equipe", label: "Equipe", content: <AbaEquipe /> },
                { id: "whatsapp", label: "WhatsApp", content: <AbaWhatsApp /> },
                { id: "amb", label: "Ambiente & numeração", content: <AbaAmbiente form={form} setE={setE} onSalvar={salvar} salvando={salvando} salvo={salvo} /> },
              ]}
            />
          </Card>
        </>
      )}

      {novaAberta && <NovaEmpresaModal onFechar={() => setNovaAberta(false)} onCriada={aoCriarEmpresa} />}
    </div>
  );
}

function AbaCobranca() {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterDadosCobranca()
      .then((d) => { setCpfCnpj(d.cpfCnpj); setTelefone(d.telefone); })
      .finally(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarDadosCobranca({ cpfCnpj, telefone });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  if (carregando) return <LightningLoader texto="Carregando dados…" />;

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Dados de cobrança</SectionTitle>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Usados para gerar Pix, boleto ou cartão da sua assinatura. O CPF/CNPJ é obrigatório para emitir a cobrança.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CPF/CNPJ" required hint="Somente números">
            <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
          </Field>
          <Field label="Telefone (WhatsApp)">
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </Field>
        </div>
        {erro && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </section>
      <BarraSalvar onSalvar={salvar} salvando={salvando} salvo={salvo} rotuloNovo="Salvar dados" />
    </div>
  );
}

function AbaEquipe() {
  const [info, setInfo] = useState<EquipeInfo | null>(null);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"dono" | "membro">("membro");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    setInfo(await listarEquipe());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, []);

  async function adicionar() {
    setSalvando(true);
    setErro(null);
    const r = await adicionarMembro({ email, nome, senha, papel });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setEmail(""); setNome(""); setSenha(""); setPapel("membro");
    await recarregar();
  }
  async function remover(userId: string) {
    const r = await removerMembro(userId);
    if (!r.ok) { setErro(r.erro); return; }
    await recarregar();
  }
  async function trocarPapel(userId: string, novo: "dono" | "membro") {
    setErro(null);
    const r = await alterarPapelMembro(userId, novo);
    if (!r.ok) { setErro(r.erro); return; }
    await recarregar();
  }

  if (!info) return <LightningLoader texto="Carregando equipe…" />;

  if (!info.permitido) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-6 text-sm">
        <p className="font-medium">Equipe não disponível no seu plano</p>
        <p className="mt-1 text-[var(--muted)]">Faça upgrade para um plano com multiusuário e adicione membros à empresa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Membros desta empresa</SectionTitle>
        <p className="text-sm text-[var(--muted)]">
          {info.limite < 0 ? "Usuários ilimitados" : `${info.usados}/${info.limite} membros`} · o dono não conta no limite.
        </p>
        <ul className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {info.membros.map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{m.nome || m.email}</span>
                <span className="text-[var(--muted)]"> · {m.email}</span>
                <span className={"ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold " + (m.papel === "dono" ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-slate-100 text-slate-600")}>{m.papel}</span>
                {m.voce && <span className="ml-1 text-xs text-[var(--muted)]">(você)</span>}
              </span>
              {info.voceEhDono && !m.voce && (
                <div className="flex items-center gap-2">
                  <Button
                    variante="secondary"
                    onClick={() => trocarPapel(m.userId, m.papel === "dono" ? "membro" : "dono")}
                    className="!px-3 !py-1.5 !text-xs"
                  >
                    {m.papel === "dono" ? "Tornar membro" : "Tornar dono"}
                  </Button>
                  <Button variante="danger" onClick={() => remover(m.userId)} className="!px-3 !py-1.5 !text-xs">Remover</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {info.voceEhDono && (
        <section>
          <SectionTitle>Adicionar membro</SectionTitle>
          <p className="mb-3 text-xs text-[var(--muted)]">Se o e-mail já existir, ele só ganha acesso a esta empresa. Senão, cria a conta.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            <Field label="E-mail" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Senha (se novo)" hint="Mín. 8 caracteres"><Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
            <Field label="Papel" hint="Dono gerencia equipe, dados e certificado">
              <Select
                opcoes={[{ value: "membro", label: "Membro" }, { value: "dono", label: "Dono" }]}
                value={papel}
                onChange={(e) => setPapel(e.target.value as "dono" | "membro")}
              />
            </Field>
          </div>
          {erro && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{erro}</p>}
          <div className="mt-4">
            <Button onClick={adicionar} disabled={salvando || !info.podeAdicionar || !email}>
              {salvando ? "Adicionando…" : "Adicionar à equipe"}
            </Button>
            {!info.podeAdicionar && <span className="ml-3 text-sm text-[var(--warning)]">Limite do plano atingido.</span>}
          </div>
        </section>
      )}

      {!info.voceEhDono && erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </div>
  );
}

function SeletorEmpresa({
  empresas,
  ativaId,
  onSelecionar,
  onNova,
}: {
  empresas: EmpresaResumo[];
  ativaId: string;
  onSelecionar: (id: string) => void;
  onNova: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const ativa = empresas.find((e) => e.id === ativaId);
  const q = busca.trim().toLowerCase();
  const filtrados = q ? empresas.filter((e) => e.razaoSocial.toLowerCase().includes(q) || e.cnpj.includes(q)) : empresas;
  const iniciais = (ativa?.razaoSocial ?? "+").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          "flex w-full items-center gap-2.5 rounded-lg border bg-white px-3 py-2 text-left transition " +
          (aberto ? "border-[var(--primary)]" : "border-[var(--border)] hover:border-slate-300")
        }
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-2)] text-[11px] font-bold text-white">{iniciais}</span>
        <span className="min-w-0 flex-1">
          {ativa ? (
            <>
              <span className="block truncate text-sm font-semibold">{ativa.razaoSocial}</span>
              <span className="block truncate font-mono text-[11px] text-[var(--muted)]">{ativa.cnpj}</span>
            </>
          ) : (
            <span className="block text-sm font-medium text-[var(--muted)]">Selecione uma empresa</span>
          )}
        </span>
        <svg className={"shrink-0 text-slate-400 transition-transform " + (aberto ? "rotate-180" : "")} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {aberto && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-xl">
          {empresas.length > 3 && (
            <div className="border-b border-[var(--border)] p-2">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar empresa…"
                className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtrados.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => { onSelecionar(e.id); setAberto(false); setBusca(""); }}
                  className={"flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 " + (e.id === ativaId ? "bg-[var(--primary-soft)]" : "")}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">{e.razaoSocial.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.razaoSocial}</span>
                    <span className="block truncate font-mono text-[11px] text-[var(--muted)]">{e.cnpj}</span>
                  </span>
                  {e.id === ativaId && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--primary)]"><path d="M20 6 9 17l-5-5" /></svg>
                  )}
                </button>
              </li>
            ))}
            {filtrados.length === 0 && <li className="px-3 py-3 text-center text-xs text-[var(--muted)]">Nenhuma empresa.</li>}
          </ul>
          <button
            type="button"
            onClick={() => { onNova(); setAberto(false); setBusca(""); }}
            className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Cadastrar nova empresa
          </button>
        </div>
      )}
    </div>
  );
}

// Barra de salvar reaproveitada no rodapé das abas que editam a empresa.
function BarraSalvar({
  onSalvar,
  salvando,
  salvo,
  rotuloNovo,
}: {
  onSalvar: () => void;
  salvando: boolean;
  salvo: boolean;
  rotuloNovo: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
      {salvo && <span className="text-sm font-medium text-[var(--success)]">✓ Salvo</span>}
      <Button onClick={onSalvar} disabled={salvando}>
        {salvando ? "Salvando…" : rotuloNovo}
      </Button>
    </div>
  );
}

function AbaEmitente({
  form,
  setE,
  setForm,
  onSalvar,
  salvando,
  salvo,
}: {
  form: EmpresaDados;
  setE: <K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) => void;
  setForm: React.Dispatch<React.SetStateAction<EmpresaDados>>;
  onSalvar: () => void;
  salvando: boolean;
  salvo: boolean;
}) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Razão social" required className="sm:col-span-2">
            <Input value={form.razaoSocial} onChange={(e) => setE("razaoSocial", e.target.value)} />
          </Field>
          <Field label="Nome fantasia">
            <Input value={form.nomeFantasia} onChange={(e) => setE("nomeFantasia", e.target.value)} />
          </Field>
          <Field label="CNPJ" required>
            <Input value={form.cnpj} onChange={(e) => setE("cnpj", e.target.value)} />
          </Field>
          <Field label="Inscrição estadual" required>
            <Input value={form.inscricaoEstadual} onChange={(e) => setE("inscricaoEstadual", e.target.value)} />
          </Field>
          <Field label="Regime tributário (CRT)" required>
            <Select opcoes={CRT} value={form.crt} onChange={(e) => setE("crt", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input value={form.telefone} onChange={(e) => setE("telefone", e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setE("email", e.target.value)} />
          </Field>
        </div>
      </section>
      <EnderecoFields value={form.endereco} onChange={(endereco) => setForm((s) => ({ ...s, endereco }))} />
      <BarraSalvar onSalvar={onSalvar} salvando={salvando} salvo={salvo} rotuloNovo={form.id ? "Salvar alterações" : "Cadastrar empresa"} />
    </div>
  );
}

function AbaAmbiente({
  form,
  setE,
  onSalvar,
  salvando,
  salvo,
}: {
  form: EmpresaDados;
  setE: <K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) => void;
  onSalvar: () => void;
  salvando: boolean;
  salvo: boolean;
}) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Ambiente de emissão</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["homologacao", "producao"] as const).map((a) => {
            const sel = form.ambiente === a;
            return (
              <button
                key={a}
                onClick={() => setE("ambiente", a)}
                className={
                  "cursor-pointer rounded-xl border-2 p-4 text-left transition " +
                  (sel ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:border-slate-300")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{a === "homologacao" ? "Homologação" : "Produção"}</span>
                  <span className={"h-4 w-4 rounded-full border-2 " + (sel ? "border-[var(--primary)] bg-[var(--primary)]" : "border-slate-300")} />
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {a === "homologacao" ? "Testes, sem valor fiscal (tpAmb=2)." : "Notas com valor fiscal real (tpAmb=1)."}
                </p>
              </button>
            );
          })}
        </div>
        {form.ambiente === "producao" && (
          <p className="mt-3 text-sm font-medium text-[var(--danger)]">
            ⚠ Em produção as notas têm valor fiscal e contam numeração oficial. Confirme o credenciamento.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Numeração</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Série">
            <Input value={form.serie} onChange={(e) => setE("serie", e.target.value)} />
          </Field>
          <Field label="Próximo nº NF-e (mod. 55)">
            <Input type="number" min="1" value={form.proximoNumero} onChange={(e) => setE("proximoNumero", e.target.value)} />
          </Field>
          <Field
            label="Casas decimais na quantidade"
            hint="Ex.: 2 permite 1,50 Kg · 3 permite 1,500 · usado na emissão"
          >
            <Select
              opcoes={[
                { value: "0", label: "0 — somente inteiros (1)" },
                { value: "1", label: "1 casa (1,5)" },
                { value: "2", label: "2 casas (1,50)" },
                { value: "3", label: "3 casas (1,500)" },
                { value: "4", label: "4 casas (1,5000)" },
              ]}
              value={form.casasDecimaisQtd}
              onChange={(e) => setE("casasDecimaisQtd", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>NFC-e (modelo 65)</SectionTitle>
        <p className="mb-3 text-sm text-[var(--muted)]">
          O CSC (Código de Segurança do Contribuinte) e seu identificador são emitidos pela SEFAZ após o
          credenciamento NFC-e. Sem eles o QR Code não pode ser gerado.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Série NFC-e">
            <Input value={form.serieNFCe} onChange={(e) => setE("serieNFCe", e.target.value)} />
          </Field>
          <Field label="Próximo nº NFC-e (mod. 65)">
            <Input type="number" min="1" value={form.proximoNumeroNFCe} onChange={(e) => setE("proximoNumeroNFCe", e.target.value)} />
          </Field>
          <Field label="ID do CSC (cIdToken)" hint="1 a 6 dígitos">
            <Input value={form.idCscNFCe} onChange={(e) => setE("idCscNFCe", e.target.value)} />
          </Field>
          <Field label="CSC (token)">
            <Input value={form.cscNFCe} onChange={(e) => setE("cscNFCe", e.target.value)} />
          </Field>
        </div>
      </section>

      <BarraSalvar onSalvar={onSalvar} salvando={salvando} salvo={salvo} rotuloNovo={form.id ? "Salvar alterações" : "Cadastrar empresa"} />
    </div>
  );
}

function AbaCertificado() {
  const [senha, setSenha] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [pfxB64, setPfxB64] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [cert, setCert] = useState<CertStatus | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function recarregar() {
    setCert(await obterCertificado());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, []);

  async function aoSelecionar(file: File) {
    setErro(null);
    setNomeArquivo(file.name);
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    setPfxB64(dataUrl.split(",")[1] ?? "");
  }

  async function enviar() {
    if (!pfxB64) {
      setErro("Selecione o arquivo .pfx primeiro.");
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const r = await salvarCertificado(pfxB64, senha);
      if (r.ok) {
        setPfxB64(null);
        setSenha("");
        setNomeArquivo(null);
        if (inputRef.current) inputRef.current.value = "";
        await recarregar();
      } else {
        setErro(r.erro);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o certificado. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function remover() {
    await removerCertificado();
    await recarregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        <p>
          O certificado é um segredo. É <strong>criptografado (AES-256)</strong> e guardado no banco vinculado à empresa —
          usado apenas no servidor para assinar suas notas. Nunca trafega de volta ao navegador.
        </p>
      </div>

      {cert?.temCert && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionTitle>Certificado configurado</SectionTitle>
            <div className="flex items-center gap-3">
              <StatusCert cert={cert} />
              <button onClick={remover} className="text-xs font-medium text-[var(--danger)] hover:underline">remover</button>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Linha rotulo="Titular" valor={cert.titular ?? "—"} />
            <Linha rotulo="Válido até" valor={cert.validoAte ? `${formatData(cert.validoAte)} (${cert.diasRestantes} dias)` : "—"} />
          </dl>
        </Card>
      )}

      <section>
        <SectionTitle>{cert?.temCert ? "Substituir certificado A1 (.pfx)" : "Enviar certificado A1 (.pfx)"}</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Arquivo .pfx / .p12" required>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-[var(--border)] bg-white px-3.5 py-2.5 text-sm hover:border-slate-300">
              <span className={nomeArquivo ? "font-medium" : "text-slate-400"}>{nomeArquivo ?? "Selecionar arquivo…"}</span>
              <span className="text-[var(--primary)]">procurar</span>
              <input ref={inputRef} type="file" accept=".pfx,.p12,application/x-pkcs12" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) aoSelecionar(f); }} />
            </label>
          </Field>
          <Field label="Senha do certificado" required>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
          </Field>
        </div>
        {erro && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{erro}</p>}
        <div className="mt-4">
          <Button onClick={enviar} disabled={carregando || !pfxB64}>{carregando ? "Validando e salvando…" : "Validar e salvar"}</Button>
        </div>
      </section>
    </div>
  );
}

function StatusCert({ cert }: { cert: CertStatus }) {
  if (cert.expirado) return <Badge tom="danger">Expirado</Badge>;
  if ((cert.diasRestantes ?? 0) <= 30) return <Badge tom="warning">Expira em {cert.diasRestantes} dias</Badge>;
  return <Badge tom="success">Válido</Badge>;
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">{rotulo}</dt>
      <dd className="mt-0.5 font-medium">{valor}</dd>
    </div>
  );
}
