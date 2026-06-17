"use client";

import { useState } from "react";
import { Field, Input, Select, SectionTitle } from "@/app/ui/primitives";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_CONTRIBUINTE } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";
import { criarCliente, type ClienteInput } from "./actions";

const vazio: ClienteInput = {
  tipoContribuinte: "1",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

// Modal de cadastro de cliente em etapas (stepper). Reutilizado na página e nos pickers.
export default function NovoClienteModal({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado: (c: Cliente) => void;
}) {
  const [form, setForm] = useState<ClienteInput>(vazio);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    try {
      onCriado(await criarCliente(form));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <StepperModal onFechar={onFechar} largura="max-w-2xl">
      <Stepper
        completeButtonText="Cadastrar cliente"
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
