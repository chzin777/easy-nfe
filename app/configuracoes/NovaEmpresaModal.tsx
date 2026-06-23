"use client";

import { useRef, useState } from "react";
import { Field, Input, Select, SectionTitle } from "@/app/ui/primitives";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { EnderecoFields } from "@/app/ui/PessoaFields";
import {
  criarEmpresaComCertificado,
  inspecionarCertificado,
  type EmpresaDados,
  type CertInfo,
} from "./actions";

const CRT = [
  { value: "1", label: "1 - Simples Nacional" },
  { value: "2", label: "2 - Simples Nacional (excesso de sublimite)" },
  { value: "3", label: "3 - Regime Normal" },
];

const vazia: EmpresaDados = {
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

const soDigitos = (s: string) => s.replace(/\D/g, "");
function fmtCNPJ(d: string) {
  return d.slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// Cadastro de empresa em etapas: identificação → endereço → certificado A1.
// O certificado é gravado JUNTO com a empresa nova (server action atômica),
// então o CNPJ do cert é conferido contra a empresa que está sendo criada —
// nunca contra a "empresa ativa".
export default function NovaEmpresaModal({
  onFechar,
  onCriada,
}: {
  onFechar: () => void;
  onCriada: (id: string) => void;
}) {
  const [form, setForm] = useState<EmpresaDados>(vazia);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  // Certificado (opcional neste fluxo — pode ser anexado depois).
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [pfxB64, setPfxB64] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [certErro, setCertErro] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Remonta o Stepper após um erro no salvar final, devolvendo o usuário à
  // última etapa para tentar de novo (o form é preservado).
  const [tentativa, setTentativa] = useState(0);

  const cnpjDigitos = soDigitos(form.cnpj);

  function setE<K extends keyof EmpresaDados>(k: K, v: EmpresaDados[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  // Ao completar o CNPJ, puxa razão social e demais dados públicos (BrasilAPI).
  // Busca no browser (IP do usuário) p/ evitar rate-limit de datacenter.
  async function aoMudarCnpj(raw: string) {
    const digitos = soDigitos(raw).slice(0, 14);
    setForm((f) => ({ ...f, cnpj: digitos }));
    if (digitos.length !== 14) return;
    setBuscandoCnpj(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!r.ok) return;
      const j = await r.json();
      const s = (v: unknown) => (v == null ? "" : String(v));
      setForm((f) => ({
        ...f,
        razaoSocial: f.razaoSocial.trim() || s(j.razao_social),
        nomeFantasia: f.nomeFantasia.trim() || s(j.nome_fantasia),
        telefone: f.telefone.trim() || s(j.ddd_telefone_1),
        email: f.email.trim() || s(j.email),
        endereco: {
          cep: f.endereco.cep.trim() || soDigitos(s(j.cep)),
          logradouro: f.endereco.logradouro.trim() || s(j.logradouro),
          numero: f.endereco.numero.trim() || s(j.numero),
          complemento: f.endereco.complemento.trim() || s(j.complemento),
          bairro: f.endereco.bairro.trim() || s(j.bairro),
          municipio: f.endereco.municipio.trim() || s(j.municipio),
          uf: f.endereco.uf.trim() || s(j.uf),
        },
      }));
    } catch {
      /* offline / CNPJ não encontrado — mantém o que o usuário digitou */
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function aoSelecionarArquivo(file: File) {
    setCertErro(null);
    setCertInfo(null);
    setNomeArquivo(file.name);
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    setPfxB64(dataUrl.split(",")[1] ?? "");
  }

  // Inspeciona o certificado e confere o CNPJ contra a empresa em cadastro,
  // tudo antes do salvar final — assim a etapa só libera quando está correto.
  async function validarCert() {
    if (!pfxB64) { setCertErro("Selecione o arquivo .pfx primeiro."); return; }
    setValidando(true);
    setCertErro(null);
    setCertInfo(null);
    try {
      const info = await inspecionarCertificado(pfxB64, senha);
      if (!info.ok) { setCertErro(info.erro); return; }
      const cnpjCert = soDigitos(info.cnpj);
      if (cnpjCert && cnpjDigitos && cnpjCert !== cnpjDigitos) {
        setCertErro(`O certificado é do CNPJ ${info.cnpj}, mas a empresa é ${fmtCNPJ(cnpjDigitos)}. Use o certificado correto.`);
        return;
      }
      if (info.expirado) { setCertErro("Certificado expirado — não pode assinar notas."); return; }
      setCertInfo(info);
    } catch (e) {
      setCertErro(e instanceof Error ? e.message : "Falha ao ler o certificado.");
    } finally {
      setValidando(false);
    }
  }

  function limparCert() {
    setPfxB64(null);
    setNomeArquivo(null);
    setSenha("");
    setCertInfo(null);
    setCertErro(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Etapa do cert só libera se não houver arquivo OU se o cert anexado já foi
  // validado com sucesso (CNPJ confere e não está expirado).
  const certOk = !pfxB64 || (!!certInfo && !certErro);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const cert = pfxB64 ? { pfxBase64: pfxB64, senha } : null;
      const r = await criarEmpresaComCertificado(form, cert);
      if (!r.ok) {
        setErro(r.erro);
        setTentativa((t) => t + 1); // remonta o stepper na última etapa
        return;
      }
      onCriada(r.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setTentativa((t) => t + 1);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <StepperModal onFechar={onFechar} largura="max-w-2xl">
      <Stepper
        key={tentativa}
        initialStep={tentativa === 0 ? 1 : 3}
        completeButtonText={salvando ? "Cadastrando…" : "Cadastrar empresa"}
        onFinalStepCompleted={salvar}
        canProceed={(s) => {
          if (s === 1) return form.razaoSocial.trim() !== "" && cnpjDigitos.length === 14 && form.inscricaoEstadual.trim() !== "";
          if (s === 3) return certOk && !salvando;
          return true;
        }}
      >
        {/* Etapa 1 — identificação */}
        <Step>
          <SectionTitle>Identificação da empresa</SectionTitle>
          <p className="-mt-2 mb-4 text-sm text-[var(--muted)]">Preencha o CNPJ para puxar os dados automaticamente.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CNPJ" required hint={buscandoCnpj ? "Buscando dados da empresa…" : "Preencha para puxar a razão social"}>
              <Input
                inputMode="numeric"
                value={fmtCNPJ(cnpjDigitos)}
                onChange={(e) => aoMudarCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </Field>
            <Field label="Inscrição estadual" required>
              <Input value={form.inscricaoEstadual} onChange={(e) => setE("inscricaoEstadual", e.target.value)} />
            </Field>
            <Field label="Razão social" required className="sm:col-span-2">
              <Input value={form.razaoSocial} onChange={(e) => setE("razaoSocial", e.target.value)} />
            </Field>
            <Field label="Nome fantasia">
              <Input value={form.nomeFantasia} onChange={(e) => setE("nomeFantasia", e.target.value)} />
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
        </Step>

        {/* Etapa 2 — endereço */}
        <Step>
          <SectionTitle>Endereço da empresa</SectionTitle>
          <div className="mt-2">
            <EnderecoFields value={form.endereco} onChange={(endereco) => setForm((s) => ({ ...s, endereco }))} />
          </div>
        </Step>

        {/* Etapa 3 — certificado A1 (opcional) */}
        <Step>
          <SectionTitle>Certificado A1 (.pfx)</SectionTitle>
          <p className="-mt-2 mb-4 text-sm text-[var(--muted)]">
            Opcional agora — você pode anexar depois em Configurações. Se anexar, o CNPJ do certificado precisa bater com o da empresa.
          </p>

          {certInfo ? (
            <div className="rounded-xl border border-[var(--success)] bg-[var(--success-soft,#dcfce7)] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--success)]">✓ Certificado válido</span>
                <button type="button" onClick={limparCert} className="text-xs font-medium text-[var(--danger)] hover:underline">trocar</button>
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex gap-2"><dt className="text-[var(--muted)]">Titular:</dt><dd className="font-medium">{certInfo.titular}</dd></div>
                <div className="flex gap-2"><dt className="text-[var(--muted)]">CNPJ:</dt><dd className="font-mono">{certInfo.cnpj || "—"}</dd></div>
                <div className="flex gap-2"><dt className="text-[var(--muted)]">Válido até:</dt><dd>{new Date(certInfo.validoAte).toLocaleDateString("pt-BR")} ({certInfo.diasRestantes} dias)</dd></div>
              </dl>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Arquivo do certificado (.pfx / .p12)" className="sm:col-span-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) aoSelecionarArquivo(f); }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary-soft)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--primary)] hover:file:bg-[var(--primary-soft)]"
                />
                {nomeArquivo && <p className="mt-1 text-xs text-[var(--muted)]">Selecionado: {nomeArquivo}</p>}
              </Field>
              <Field label="Senha do certificado" className="sm:col-span-2">
                <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha do .pfx" />
              </Field>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={validarCert}
                  disabled={!pfxB64 || validando}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {validando ? "Validando…" : "Validar certificado"}
                </button>
              </div>
            </div>
          )}

          {certErro && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{certErro}</p>}
        </Step>
      </Stepper>

      {salvando && <p className="mt-2 text-sm font-medium text-[var(--muted)]">Cadastrando empresa…</p>}
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </StepperModal>
  );
}
