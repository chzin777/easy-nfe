"use client";

import { useState } from "react";
import { Field, Input, Select, SectionTitle } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_TRANSPORTE } from "@/lib/mock-data";
import type { Transportadora } from "@/lib/types";
import { criarTransportadora, type TransportadoraInput } from "./actions";

const vazio: TransportadoraInput = {
  tipoTransporte: "0",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

// Modal de cadastro de transportadora em etapas (stepper). Reutilizado na página e no picker.
export default function NovaTransportadoraModal({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado: (t: Transportadora) => void;
}) {
  const [form, setForm] = useState<TransportadoraInput>(vazio);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    try {
      onCriado(await criarTransportadora(form));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Nova transportadora" largura="max-w-2xl">
      <Stepper
        completeButtonText="Cadastrar transportadora"
        onFinalStepCompleted={salvar}
        canProceed={(s) => (s === 1 ? form.nome.trim() !== "" && form.documento.trim() !== "" : true)}
      >
        <Step>
          <SectionTitle>Identificação da transportadora</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo de transporte" required>
              <Select opcoes={TIPOS_TRANSPORTE} value={form.tipoTransporte} onChange={(e) => setForm((f) => ({ ...f, tipoTransporte: e.target.value }))} />
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
    </Modal>
  );
}
