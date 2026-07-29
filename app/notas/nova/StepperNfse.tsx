"use client";

import { useMemo, useState, type ReactNode } from "react";
import Stepper, { Step } from "@/app/ui/Stepper";
import {
  Badge,
  Button,
  Card,
  DateBR,
  Field,
  Input,
  SectionTitle,
  Select,
  Textarea,
  formatBRL,
} from "@/app/ui/primitives";
import { formatCpfCnpj } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import ClientePicker from "./ClientePicker";
import SeletorLC116 from "@/app/servicos/SeletorLC116";
import type { Servico } from "@/app/servicos/actions";
import { emitirNotaServico, type EmitirNfseInput } from "@/app/notas-servico/actions";

// Emissão de NFS-e dentro da tela de nova nota. É um fluxo próprio porque o
// documento é outro: uma DPS descreve UM serviço, sem itens, sem ICMS e sem
// transporte. O que se aproveita da NF-e é só o tomador.

const TRIBUTACAO = [
  { value: "1", label: "Tributável (ISS devido)" },
  { value: "2", label: "Imune" },
  { value: "3", label: "Exportação de serviço" },
  { value: "4", label: "Não incidência" },
];

const hoje = () => new Date().toISOString().slice(0, 10);

const VAZIO: EmitirNfseInput = {
  clienteId: "",
  servicoId: null,
  descricao: "",
  cTribNac: "",
  cNBS: "",
  valorServico: 0,
  aliqISS: 0,
  tribISSQN: "1",
  issRetido: false,
  codMunicipioPrestacao: "",
  competencia: "",
  informacoesAdicionais: "",
};

export default function StepperNfse({
  clientes,
  onClienteCriado,
  servicos,
  tipoSelect,
}: {
  clientes: Cliente[];
  onClienteCriado: (c: Cliente) => void;
  servicos: Servico[];
  // O seletor de tipo de nota fica no passo 1, igual ao fluxo da NF-e.
  tipoSelect: ReactNode;
}) {
  const [form, setForm] = useState<EmitirNfseInput>({ ...VAZIO, competencia: hoje() });
  const [itemLista, setItemLista] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{ numero: number; chaveAcesso: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const cliente = clientes.find((c) => c.id === form.clienteId);
  const valorISS = useMemo(
    () => (form.tribISSQN === "1" && form.aliqISS > 0 ? (form.valorServico * form.aliqISS) / 100 : 0),
    [form.tribISSQN, form.aliqISS, form.valorServico],
  );

  function escolherServico(id: string) {
    const s = servicos.find((x) => x.id === id);
    if (!s) {
      setForm((f) => ({ ...f, servicoId: null }));
      return;
    }
    setItemLista(s.itemListaServico);
    setForm((f) => ({
      ...f,
      servicoId: s.id,
      descricao: s.descricao || s.nome,
      cTribNac: s.cTribNac,
      cNBS: s.cNBS,
      aliqISS: s.aliqISS,
      valorServico: s.valorUnit || f.valorServico,
    }));
  }

  async function emitir() {
    setEmitindo(true);
    setErro(null);
    const r = await emitirNotaServico(form);
    setEmitindo(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setSucesso({ numero: r.numero, chaveAcesso: r.chaveAcesso });
  }

  function novaEmissao() {
    setForm({ ...VAZIO, competencia: hoje() });
    setItemLista("");
    setErro(null);
    setSucesso(null);
    setFormKey((k) => k + 1);
  }

  if (sucesso) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold tracking-tight">NFS-e nº {sucesso.numero} autorizada</h2>
        <p className="mx-auto mt-2 max-w-md break-all font-mono text-xs text-[var(--muted)]">
          {sucesso.chaveAcesso}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={novaEmissao}>Emitir outra</Button>
          <a href="/notas-servico">
            <Button variante="secondary">Ver notas de serviço</Button>
          </a>
        </div>
      </Card>
    );
  }

  // Passo 1 exige tomador; passo 2, a descrição e a classificação do serviço.
  function canProceed(step: number) {
    if (step === 1) return form.clienteId !== "";
    if (step === 2) return form.descricao.trim() !== "" && form.cTribNac.length === 6;
    return true;
  }

  return (
    <Stepper
      key={formKey}
      nextButtonText="Continuar"
      backButtonText="Voltar"
      completeButtonText={emitindo ? "Transmitindo…" : "Emitir NFS-e"}
      canProceed={canProceed}
      onFinalStepCompleted={emitir}
      resumoMobile={
        <div className="leading-tight">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--muted)]">Serviço</span>
          <span className="block text-base font-semibold text-[var(--primary)]">
            {formatBRL(form.valorServico)}
          </span>
        </div>
      }
    >
      <Step>
        <SectionTitle>Tipo e tomador</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo de nota" required>
            {tipoSelect}
          </Field>
          <Field label="Tomador (quem contratou)" required>
            <ClientePicker
              clientes={clientes}
              value={form.clienteId}
              onChange={(id) => setForm({ ...form, clienteId: id })}
              onCriado={(c) => {
                onClienteCriado(c);
                setForm((f) => ({ ...f, clienteId: c.id }));
              }}
            />
          </Field>
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Nota de serviço não tem produtos nem transporte. Uma nota descreve um serviço prestado.
        </p>
      </Step>

      <Step>
        <SectionTitle>Serviço prestado</SectionTitle>
        <div className="space-y-4">
          <Field label="Serviço do catálogo" hint="Preenche o resto. Dá para ajustar depois de escolher.">
            <Select
              opcoes={[
                { value: "", label: "— avulso —" },
                ...servicos.map((s) => ({ value: s.id, label: s.nome })),
              ]}
              value={form.servicoId ?? ""}
              onChange={(e) => escolherServico(e.target.value)}
            />
          </Field>

          <Field label="Classificação do serviço" required hint="Busque pelo que foi feito.">
            <SeletorLC116
              cTribNac={form.cTribNac}
              itemLista={itemLista}
              onEscolher={(v) => {
                setItemLista(v.itemListaServico);
                setForm((f) => ({
                  ...f,
                  cTribNac: v.cTribNac,
                  descricao: f.descricao.trim() ? f.descricao : v.descricao,
                }));
              }}
            />
          </Field>

          <Field label="Descrição do serviço" required hint="É o que sai impresso na nota.">
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Código nacional" required hint="Os 2 últimos são o desdobramento.">
              <Input
                value={form.cTribNac}
                onChange={(e) => setForm({ ...form, cTribNac: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Competência" hint="Mês do serviço.">
              <DateBR
                value={form.competencia}
                onChange={(e) => setForm({ ...form, competencia: e.target.value })}
              />
            </Field>
            <Field label="Município da prestação" hint="IBGE. Vazio = o da empresa.">
              <Input
                value={form.codMunicipioPrestacao}
                onChange={(e) =>
                  setForm({ ...form, codMunicipioPrestacao: e.target.value.replace(/\D/g, "").slice(0, 7) })
                }
                inputMode="numeric"
              />
            </Field>
          </div>
        </div>
      </Step>

      <Step>
        <SectionTitle>Valores e ISS</SectionTitle>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Valor do serviço" required>
              <Input
                type="number"
                step="0.01"
                value={form.valorServico || ""}
                onChange={(e) => setForm({ ...form, valorServico: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Tributação do ISS">
              <Select
                opcoes={TRIBUTACAO}
                value={form.tribISSQN}
                onChange={(e) => setForm({ ...form, tribISSQN: e.target.value })}
              />
            </Field>
            <Field label="Alíquota do ISS (%)" hint={valorISS > 0 ? `ISS de ${formatBRL(valorISS)}` : undefined}>
              <Input
                type="number"
                step="0.01"
                value={form.aliqISS || ""}
                disabled={form.tribISSQN !== "1"}
                onChange={(e) => setForm({ ...form, aliqISS: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.issRetido}
              disabled={form.tribISSQN !== "1"}
              onChange={(e) => setForm({ ...form, issRetido: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            ISS retido pelo tomador
            <span className="text-xs text-[var(--muted)]">(quem contratou é quem recolhe)</span>
          </label>

          <Field label="Informações adicionais">
            <Textarea
              rows={2}
              value={form.informacoesAdicionais}
              onChange={(e) => setForm({ ...form, informacoesAdicionais: e.target.value })}
            />
          </Field>

          <div className="rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-3 text-sm">
            <div className="mb-1 flex items-center gap-2">
              <Badge tom="primary">Resumo</Badge>
              <span className="font-semibold text-[var(--primary)]">{formatBRL(form.valorServico)}</span>
            </div>
            <p className="text-[var(--muted)]">
              {cliente ? cliente.nome : "—"}
              {cliente?.documento ? ` · ${formatCpfCnpj(cliente.documento)}` : ""}
            </p>
            <p className="line-clamp-2 text-[var(--muted)]">{form.descricao || "—"}</p>
          </div>

          {erro && (
            <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2.5 text-sm font-medium text-[var(--danger)]">
              {erro}
            </p>
          )}
        </div>
      </Step>
    </Stepper>
  );
}
