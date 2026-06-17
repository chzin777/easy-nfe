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
import { EnderecoFields } from "@/app/ui/PessoaFields";
import {
  listarEmpresas,
  obterEmpresaAtiva,
  salvarEmpresa,
  trocarEmpresa,
  salvarCertificado,
  removerCertificado,
  obterCertificado,
  type CertStatus,
  type EmpresaDados,
  type EmpresaResumo,
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
};

export default function ConfiguracoesPage() {
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
  const [form, setForm] = useState<EmpresaDados>(empresaVazia);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    if (id === "__nova__") {
      setForm(empresaVazia);
      return;
    }
    await trocarEmpresa(id);
    await carregar();
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

  const ativaValue = form.id ?? "__nova__";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configurações fiscais"
        subtitulo="Empresa emitente, certificado digital e ambiente de emissão."
        acao={
          <div className="flex items-center gap-3">
            {salvo && <span className="text-sm font-medium text-[var(--success)]">✓ Salvo</span>}
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : form.id ? "Salvar alterações" : "Cadastrar empresa"}
            </Button>
          </div>
        }
      />

      {/* Seletor de empresa */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-medium text-[var(--muted)]">Empresa ativa:</span>
        <div className="min-w-[260px] flex-1">
          <Select
            opcoes={[
              ...empresas.map((e) => ({ value: e.id, label: `${e.razaoSocial} · ${e.cnpj}` })),
              { value: "__nova__", label: "➕ Cadastrar nova empresa…" },
            ]}
            value={ativaValue}
            onChange={(e) => onTrocar(e.target.value)}
          />
        </div>
        {empresas.length === 0 && (
          <span className="text-sm text-[var(--warning)]">Cadastre sua primeira empresa para emitir notas.</span>
        )}
      </Card>

      {erro && (
        <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-4 py-3 text-sm font-medium text-[var(--danger)]">{erro}</p>
      )}

      <Card className="p-6">
        <Tabs
          abas={[
            { id: "emit", label: "Empresa emitente", content: <AbaEmitente form={form} setE={setE} setForm={setForm} /> },
            { id: "cert", label: "Certificado A1", content: <AbaCertificado /> },
            { id: "amb", label: "Ambiente & numeração", content: <AbaAmbiente form={form} setE={setE} /> },
          ]}
        />
      </Card>
    </div>
  );
}

function AbaEmitente({
  form,
  setE,
  setForm,
}: {
  form: EmpresaDados;
  setE: <K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) => void;
  setForm: React.Dispatch<React.SetStateAction<EmpresaDados>>;
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
    </div>
  );
}

function AbaAmbiente({
  form,
  setE,
}: {
  form: EmpresaDados;
  setE: <K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) => void;
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
        </div>
      </section>
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
    const r = await salvarCertificado(pfxB64, senha);
    setCarregando(false);
    if (r.ok) {
      setPfxB64(null);
      setSenha("");
      setNomeArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      await recarregar();
    } else {
      setErro(r.erro);
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
