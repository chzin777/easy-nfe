"use client";

import { useState } from "react";
import { Field, Input, SectionTitle } from "@/app/ui/primitives";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import type { Cliente } from "@/lib/types";
import { criarCliente, atualizarCliente, type ClienteInput } from "./actions";

type TipoPessoa = "PF" | "PJ";

const vazio: ClienteInput = {
  tipoContribuinte: "1",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

const soDigitos = (s: string) => s.replace(/\D/g, "");

// Valida dígitos verificadores do CPF (algoritmo oficial da Receita).
function cpfValido(cpf: string) {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, peso: number) => {
    let soma = 0;
    for (const n of base) soma += Number(n) * peso--;
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

function fmtCPF(d: string) {
  return d.slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function fmtCNPJ(d: string) {
  return d.slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// Modal de cliente em etapas (stepper). Cria (sem clienteInicial) ou edita (com).
// Reutilizado na página, nos pickers e no fluxo de correção da emissão.
export default function NovoClienteModal({
  onFechar,
  onCriado,
  clienteInicial,
}: {
  onFechar: () => void;
  onCriado: (c: Cliente) => void;
  clienteInicial?: Cliente;
}) {
  const editando = !!clienteInicial;
  const [form, setForm] = useState<ClienteInput>(() => {
    if (!clienteInicial) return vazio;
    const { id: _id, codigoInterno: _ci, ...resto } = clienteInicial;
    void _id; void _ci;
    return resto as ClienteInput;
  });
  // PF/PJ: ao editar, deriva pelo tamanho do documento; ao criar, exige escolha.
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa | null>(() => {
    if (!clienteInicial) return null;
    return soDigitos(clienteInicial.documento).length > 11 ? "PJ" : "PF";
  });
  const [isento, setIsento] = useState(() => clienteInicial?.tipoContribuinte === "2");
  const [erro, setErro] = useState<string | null>(null);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  // Ao completar o CNPJ, puxa razão social e demais dados públicos (BrasilAPI).
  // Busca no browser (IP do usuário) p/ evitar rate-limit de datacenter.
  // Não sobrescreve campos já preenchidos pelo usuário.
  async function aoMudarCnpj(raw: string) {
    const digitos = soDigitos(raw).slice(0, 14);
    setForm((f) => ({ ...f, documento: digitos }));
    if (digitos.length !== 14) return;
    setBuscandoCnpj(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!r.ok) return;
      const j = await r.json();
      const s = (v: unknown) => (v == null ? "" : String(v));
      setForm((f) => ({
        ...f,
        nome: f.nome.trim() || s(j.razao_social),
        contato: {
          telefone: f.contato.telefone.trim() || s(j.ddd_telefone_1),
          email: f.contato.email.trim() || s(j.email),
        },
        endereco: {
          cep: f.endereco.cep.trim() || s(j.cep),
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

  // Escolhe PF/PJ e ajusta os campos fiscais conforme a regra da SEFAZ.
  function escolher(tp: TipoPessoa) {
    setTipoPessoa(tp);
    setForm((f) => ({
      ...f,
      tipoContribuinte: tp === "PF" ? "9" : isento ? "2" : "1",
      inscricaoEstadual: tp === "PF" ? "" : f.inscricaoEstadual,
      documento: soDigitos(f.documento).slice(0, tp === "PF" ? 11 : 14),
    }));
  }

  function alternarIsento(v: boolean) {
    setIsento(v);
    setForm((f) => ({ ...f, tipoContribuinte: v ? "2" : "1", inscricaoEstadual: v ? "" : f.inscricaoEstadual }));
  }

  const docDigitos = soDigitos(form.documento);
  const docOk = tipoPessoa === "PF" ? cpfValido(docDigitos) : docDigitos.length === 14;
  const cpfInvalido = tipoPessoa === "PF" && docDigitos.length === 11 && !cpfValido(docDigitos);
  // IE obrigatória para PJ não isenta.
  const ieOk = tipoPessoa !== "PJ" || isento || form.inscricaoEstadual.trim() !== "";

  async function salvar() {
    setErro(null);
    try {
      if (clienteInicial) {
        await atualizarCliente(clienteInicial.id, form);
        onCriado({ ...clienteInicial, ...form });
      } else {
        onCriado(await criarCliente(form));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <StepperModal onFechar={onFechar} largura="max-w-2xl">
      <Stepper
        completeButtonText={editando ? "Salvar cliente" : "Cadastrar cliente"}
        onFinalStepCompleted={salvar}
        canProceed={(s) => {
          if (s === 1) return tipoPessoa !== null;
          if (s === 2) return form.nome.trim() !== "" && docOk && ieOk;
          return true;
        }}
      >
        {/* Etapa 1 — tipo de pessoa */}
        <Step>
          <SectionTitle>Tipo de cliente</SectionTitle>
          <p className="-mt-2 mb-4 text-sm text-[var(--muted)]">Escolha para adaptar os campos do cadastro.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CardTipo
              ativo={tipoPessoa === "PF"}
              onClick={() => escolher("PF")}
              titulo="Pessoa Física"
              sub="CPF · consumidor final"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M6 21v-1a6 6 0 0 1 12 0v1" /></svg>}
            />
            <CardTipo
              ativo={tipoPessoa === "PJ"}
              onClick={() => escolher("PJ")}
              titulo="Pessoa Jurídica"
              sub="CNPJ · empresa"
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h.01M9 12h.01M9 15h.01" /></svg>}
            />
          </div>
        </Step>

        {/* Etapa 2 — identificação (adapta ao tipo) */}
        <Step>
          <SectionTitle>Identificação {tipoPessoa === "PJ" ? "da empresa" : "do cliente"}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={tipoPessoa === "PJ" ? "CNPJ" : "CPF"}
              required
              hint={tipoPessoa === "PJ" ? (buscandoCnpj ? "Buscando dados da empresa…" : "Preencha para puxar a razão social") : cpfInvalido ? "CPF inválido — verifique os dígitos" : undefined}
            >
              <Input
                inputMode="numeric"
                value={tipoPessoa === "PJ" ? fmtCNPJ(docDigitos) : fmtCPF(docDigitos)}
                onChange={(e) => {
                  if (tipoPessoa === "PJ") { aoMudarCnpj(e.target.value); return; }
                  setForm((f) => ({ ...f, documento: soDigitos(e.target.value).slice(0, 11) }));
                }}
                placeholder={tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              />
            </Field>
            <Field label={tipoPessoa === "PJ" ? "Razão social" : "Nome completo"} required>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </Field>
            {tipoPessoa === "PJ" && (
              <Field label="Inscrição estadual" required={!isento} className="sm:col-span-2" hint={isento ? "Marcada como isenta" : "Obrigatória — ou marque isento"}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={isento ? "" : form.inscricaoEstadual}
                    disabled={isento}
                    onChange={(e) => setForm((f) => ({ ...f, inscricaoEstadual: e.target.value }))}
                    placeholder={isento ? "ISENTO" : "Inscrição estadual"}
                    className="flex-1"
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={isento}
                      onChange={(e) => alternarIsento(e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                    />
                    Isento de IE
                  </label>
                </div>
              </Field>
            )}
          </div>
        </Step>

        {/* Etapa 3 — contato */}
        <Step>
          <ContatoFields value={form.contato} onChange={(contato) => setForm((f) => ({ ...f, contato }))} />
        </Step>

        {/* Etapa 4 — endereço */}
        <Step>
          <EnderecoFields value={form.endereco} onChange={(endereco) => setForm((f) => ({ ...f, endereco }))} />
        </Step>
      </Stepper>
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </StepperModal>
  );
}

function CardTipo({
  ativo,
  onClick,
  titulo,
  sub,
  icon,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-3 rounded-xl border p-4 text-left transition " +
        (ativo
          ? "border-[var(--primary)] bg-[var(--primary-soft)] ring-2 ring-[var(--primary)]"
          : "border-[var(--border)] bg-white hover:border-slate-300")
      }
    >
      <span className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-lg " + (ativo ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-slate-500")}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-[var(--muted)]">{sub}</span>
      </span>
    </button>
  );
}
