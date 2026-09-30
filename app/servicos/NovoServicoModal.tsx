"use client";

import { useState } from "react";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { Field, Input, Textarea, SectionTitle } from "@/app/ui/primitives";
import MoneyInput from "@/app/ui/MoneyInput";
import SeletorLC116 from "./SeletorLC116";
import {
  criarServico,
  atualizarServico,
  type Servico,
  type ServicoInput,
} from "./actions";

const VAZIO: ServicoInput = {
  nome: "",
  descricao: "",
  cTribNac: "",
  itemListaServico: "",
  cNBS: "",
  aliqISS: 0,
  valorUnit: 0,
};

function paraInput(s: Servico): ServicoInput {
  return {
    nome: s.nome,
    descricao: s.descricao,
    cTribNac: s.cTribNac,
    itemListaServico: s.itemListaServico,
    cNBS: s.cNBS,
    aliqISS: s.aliqISS,
    valorUnit: s.valorUnit,
  };
}

export default function NovoServicoModal({
  onFechar,
  onCriado,
  servicoInicial,
  passoInicial = 1,
}: {
  onFechar: () => void;
  onCriado: (s: Servico) => void;
  servicoInicial?: Servico;
  passoInicial?: number;
}) {
  const edicao = !!servicoInicial;
  const [form, setForm] = useState<ServicoInput>(
    servicoInicial ? paraInput(servicoInicial) : VAZIO
  );
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof ServicoInput>(k: K, v: ServicoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar() {
    setErro(null);
    try {
      const salvo = servicoInicial
        ? await atualizarServico(servicoInicial.id, form)
        : await criarServico(form);
      onCriado(salvo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <StepperModal onFechar={onFechar} largura="max-w-2xl">
      <Stepper
        reservarFechar
        initialStep={passoInicial}
        completeButtonText={edicao ? "Salvar alterações" : "Cadastrar serviço"}
        onFinalStepCompleted={salvar}
        canProceed={(passo) => {
          if (passo === 1) return form.nome.trim() !== "";
          if (passo === 2) return form.cTribNac.trim().length >= 4;
          return true;
        }}
      >
        {/* Etapa 1: Identificação e preço */}
        <Step>
          <SectionTitle>Identificação do serviço</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome do serviço" required className="sm:col-span-2">
              <Input
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex.: Manutenção preventiva, Consultoria, Instalação..."
                autoFocus
              />
            </Field>

            <Field label="Preço padrão (R$)">
              <MoneyInput
                value={form.valorUnit}
                onChange={(v) => set("valorUnit", v)}
              />
            </Field>

            <Field label="Alíquota do ISS (%)" hint="Alíquota do município prestador">
              <Input
                type="number"
                step="0.01"
                value={form.aliqISS || ""}
                onChange={(e) => set("aliqISS", Number(e.target.value) || 0)}
                placeholder="0,00"
              />
            </Field>

            <Field
              label="Descrição para a nota"
              hint="Texto padrão que sai no corpo da NFS-e"
              className="sm:col-span-2"
            >
              <Textarea
                rows={2}
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Detalhamento das atividades executadas..."
              />
            </Field>
          </div>
        </Step>

        {/* Etapa 2: Classificação fiscal e LC 116 */}
        <Step>
          <SectionTitle>Classificação fiscal (LC 116)</SectionTitle>
          <div className="space-y-4">
            <Field
              label="Buscar classificação oficial"
              required
              hint="Busque pelo que a sua empresa faz — o código e descrição legal saem daqui."
            >
              <SeletorLC116
                cTribNac={form.cTribNac}
                itemLista={form.itemListaServico}
                onEscolher={(v) =>
                  setForm((f) => ({
                    ...f,
                    cTribNac: v.cTribNac,
                    itemListaServico: v.itemListaServico,
                    descricao: f.descricao.trim() ? f.descricao : v.descricao,
                  }))
                }
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Código de tributação nacional"
                required
                hint="6 dígitos. Os 2 últimos são o desdobramento municipal."
              >
                <Input
                  value={form.cTribNac}
                  onChange={(e) => set("cTribNac", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="140101"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Item da lista de serviços" hint="Ex.: 14.01 da Lei Complementar 116">
                <Input
                  value={form.itemListaServico}
                  onChange={(e) => set("itemListaServico", e.target.value)}
                  placeholder="14.01"
                />
              </Field>
            </div>
          </div>
        </Step>

        {/* Etapa 3: Tributação municipal e NBS */}
        <Step>
          <SectionTitle>Tributação municipal e NBS</SectionTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Código NBS" hint="Nomenclatura Brasileira de Serviços (opcional, 9 dígitos)">
                <Input
                  value={form.cNBS}
                  onChange={(e) => set("cNBS", e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="1.0101.00.00"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Alíquota do ISS municipal (%)">
                <Input
                  type="number"
                  step="0.01"
                  value={form.aliqISS || ""}
                  onChange={(e) => set("aliqISS", Number(e.target.value) || 0)}
                  placeholder="0,00"
                />
              </Field>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-slate-50/80 p-3.5 text-xs text-[var(--muted)]">
              <p className="font-semibold text-slate-700">Padrão Nacional de NFS-e</p>
              <p className="mt-1">
                Ao emitir notas de serviço para este item, o código de tributação nacional e a alíquota de ISS configurados serão enviados automaticamente para o sistema da sua prefeitura ou Ambiente Nacional.
              </p>
            </div>
          </div>
        </Step>
      </Stepper>
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </StepperModal>
  );
}
