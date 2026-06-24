"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Field, Input, Select, Textarea, SectionTitle } from "@/app/ui/primitives";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { ORIGENS, UNIDADES } from "@/lib/mock-data";
import type { Produto } from "@/lib/types";
import { criarProduto, atualizarProduto, type ProdutoInput } from "./actions";
import NcmPicker from "./NcmPicker";
import BeneficioPicker from "./BeneficioPicker";
import TributacaoFields from "./TributacaoFields";
import MoneyInput from "@/app/ui/MoneyInput";
import { CategoriaSelect } from "@/app/categorias/CategoriasUI";
import { listarCategorias, type Categoria } from "@/app/categorias/actions";

const vazio: ProdutoInput = {
  codigoBarras: "",
  nome: "",
  marca: "",
  peso: 0,
  unidade: "UN",
  ncm: "",
  origem: "0",
  preco: 0,
  descricao: "",
  categoriaId: "",
  cst: "40",
  aliquotaIcms: 0,
  reducaoBaseIcms: 0,
  cest: "",
  codigoBeneficio: "",
  creditoPresumidoIcms: "",
  reguladoAnp: false,
  estoque: 0,
  estoqueMinimo: 0,
  controlaEstoque: false,
};

// Converte um Produto carregado em ProdutoInput (modo edição).
function paraInput(p: Produto): ProdutoInput {
  const { id: _id, codigoInterno: _ci, categoriaNome: _cn, ...resto } = p;
  return resto;
}

// Modal de cadastro de produto em etapas (stepper). Reutilizado na página e nos pickers.
// Em modo edição (produtoInicial), pré-preenche e salva via atualizarProduto.
// `aviso` mostra um banner no topo (ex.: o que a SEFAZ exige corrigir).
export default function NovoProdutoModal({
  onFechar,
  onCriado,
  categorias: categoriasIniciais,
  onCategoriasChange,
  produtoInicial,
  aviso,
  passoInicial = 1,
}: {
  onFechar: () => void;
  onCriado: (p: Produto) => void;
  categorias?: Categoria[];
  onCategoriasChange?: (lista: Categoria[]) => void;
  produtoInicial?: Produto;
  aviso?: ReactNode;
  passoInicial?: number;
}) {
  const edicao = !!produtoInicial;
  const [form, setForm] = useState<ProdutoInput>(produtoInicial ? paraInput(produtoInicial) : vazio);
  const [erro, setErro] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>(categoriasIniciais ?? []);
  function set<K extends keyof ProdutoInput>(k: K, v: ProdutoInput[K]) { setForm((f) => ({ ...f, [k]: v })); }

  useEffect(() => {
    if (categoriasIniciais) return; // já veio pronto da página
    void listarCategorias("produto").then(setCategorias);
  }, [categoriasIniciais]);

  function mudarCategorias(lista: Categoria[]) {
    setCategorias(lista);
    onCategoriasChange?.(lista);
  }

  async function salvar() {
    setErro(null);
    try {
      const p = produtoInicial
        ? await atualizarProduto(produtoInicial.id, form)
        : await criarProduto(form);
      onCriado(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <StepperModal onFechar={onFechar} largura="max-w-2xl">
      {aviso && (
        <div className="mb-4 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2.5 text-sm text-[var(--warning)]">
          {aviso}
        </div>
      )}
      <Stepper
        initialStep={passoInicial}
        completeButtonText={edicao ? "Salvar correções" : "Cadastrar produto"}
        onFinalStepCompleted={salvar}
        canProceed={(s) => (s === 1 ? form.nome.trim() !== "" && form.ncm.trim() !== "" : true)}
      >
        <Step>
          <SectionTitle>Identificação do produto</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Código de barras (GTIN/EAN)"><Input value={form.codigoBarras} onChange={(e) => set("codigoBarras", e.target.value)} placeholder="Sem GTIN" /></Field>
            <Field label="Nome do produto" required><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
            <Field label="Marca"><Input value={form.marca} onChange={(e) => set("marca", e.target.value)} placeholder="Ex.: Nestlé" /></Field>
            <Field label="Categoria">
              <CategoriaSelect
                tipo="produto"
                categorias={categorias}
                value={form.categoriaId}
                onChange={(id) => set("categoriaId", id)}
                onCategoriasChange={mudarCategorias}
              />
            </Field>
            <Field label="Unidade de medida" required><Select opcoes={UNIDADES} value={form.unidade} onChange={(e) => set("unidade", e.target.value)} /></Field>
            <Field label="NCM" required hint="8 dígitos · busque pelo nome do produto">
              <NcmPicker value={form.ncm} onChange={(v) => set("ncm", v)} nomeProduto={form.nome} />
            </Field>
          </div>
        </Step>
        <Step>
          <SectionTitle>Origem, preço e descrição</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo de origem" required><Select opcoes={ORIGENS} value={form.origem} onChange={(e) => set("origem", e.target.value)} /></Field>
            <Field label="Preço" required><MoneyInput value={form.preco} onChange={(v) => set("preco", v)} /></Field>
            <Field label="Peso líquido (kg)" hint="Opcional · ex.: 0,5">
              <Input
                inputMode="decimal"
                value={form.peso ? String(form.peso).replace(".", ",") : ""}
                onChange={(e) => set("peso", Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0)}
                placeholder="0"
              />
            </Field>
            <Field label="Controle de estoque" hint="Baixa automática a cada NF-e">
              <label className="flex h-[46px] items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-sm">
                <input type="checkbox" checked={form.controlaEstoque} onChange={(e) => set("controlaEstoque", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                Controlar estoque deste produto
              </label>
            </Field>
            {!edicao && form.controlaEstoque && (
              <Field label="Estoque inicial" hint="Saldo atual em unidades">
                <Input
                  inputMode="decimal"
                  value={form.estoque ? String(form.estoque).replace(".", ",") : ""}
                  onChange={(e) => set("estoque", Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0)}
                  placeholder="0"
                />
              </Field>
            )}
            {form.controlaEstoque && (
              <Field label="Estoque mínimo" hint="Alerta quando o saldo chegar nesse nível (0 = sem alerta)">
                <Input
                  inputMode="decimal"
                  value={form.estoqueMinimo ? String(form.estoqueMinimo).replace(".", ",") : ""}
                  onChange={(e) => set("estoqueMinimo", Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0)}
                  placeholder="0"
                />
              </Field>
            )}
            <Field label="Descrição do produto" className="sm:col-span-2"><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} /></Field>
          </div>
        </Step>
        <Step>
          <SectionTitle>Configurações fiscais</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TributacaoFields
              value={{ cst: form.cst, aliquotaIcms: form.aliquotaIcms, reducaoBaseIcms: form.reducaoBaseIcms }}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />
            <Field label="CEST"><Input value={form.cest} onChange={(e) => set("cest", e.target.value)} placeholder="0000000" /></Field>
            <Field label="Código do benefício" hint="Busca na tabela oficial de GO">
              <BeneficioPicker value={form.codigoBeneficio} onChange={(v) => set("codigoBeneficio", v)} nomeProduto={form.nome} cst={form.cst} />
            </Field>
            <Field label="Crédito presumido de ICMS"><Input value={form.creditoPresumidoIcms} onChange={(e) => set("creditoPresumidoIcms", e.target.value)} /></Field>
            <Field label="Produto regulamentado pela ANP?">
              <label className="flex h-[46px] items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-sm">
                <input type="checkbox" checked={form.reguladoAnp} onChange={(e) => set("reguladoAnp", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                Sim, produto sujeito à ANP
              </label>
            </Field>
          </div>
        </Step>
      </Stepper>
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </StepperModal>
  );
}
