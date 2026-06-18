"use client";

import { useState } from "react";
import { Field, Input, Select, SectionTitle } from "@/app/ui/primitives";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_CONTRIBUINTE } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";
import { criarCliente, atualizarCliente, type ClienteInput } from "./actions";

const vazio: ClienteInput = {
  tipoContribuinte: "1",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

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
  const [erro, setErro] = useState<string | null>(null);

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
        canProceed={(s) => (s === 1 ? form.nome.trim() !== "" && form.documento.trim() !== "" : true)}
      >
        <Step>
          <SectionTitle>Identificação do cliente</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo de contribuinte" required>
              <Select opcoes={TIPOS_CONTRIBUINTE} value={form.tipoContribuinte} onChange={(e) => setForm((f) => ({ ...f, tipoContribuinte: e.target.value }))} />
            </Field>
            <Field label="CPF ou CNPJ" required>
              <Input value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} />
            </Field>
            <Field label="Nome completo / Razão social" required className="sm:col-span-2">
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </Field>
            <Field label="Inscrição estadual" hint="Deixe vazio se isento">
              <Input value={form.inscricaoEstadual} onChange={(e) => setForm((f) => ({ ...f, inscricaoEstadual: e.target.value }))} />
            </Field>
          </div>
        </Step>
        <Step>
          <ContatoFields value={form.contato} onChange={(contato) => setForm((f) => ({ ...f, contato }))} />
        </Step>
        <Step>
          <EnderecoFields value={form.endereco} onChange={(endereco) => setForm((f) => ({ ...f, endereco }))} />
        </Step>
      </Stepper>
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </StepperModal>
  );
}
