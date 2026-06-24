"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Tabela,
  Textarea,
  EmptyState,
  formatBRL,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { ORIGENS, UNIDADES } from "@/lib/mock-data";
import type { Produto } from "@/lib/types";
import {
  listarProdutos,
  atualizarProduto,
  excluirProduto,
  importarProdutos,
  ajustarEstoque,
} from "./actions";
import NovoProdutoModal from "./NovoProdutoModal";
import ExtratoEstoqueModal from "./ExtratoEstoqueModal";
import ImportarPlanilhaModal from "@/app/ui/ImportarPlanilhaModal";
import { COLUNAS_PRODUTO, validarLinhaProduto } from "@/lib/produtos-modelo";
import NcmPicker from "./NcmPicker";
import BeneficioPicker from "./BeneficioPicker";
import TributacaoFields from "./TributacaoFields";
import MoneyInput from "@/app/ui/MoneyInput";
import { CategoriaSelect, GerenciarCategoriasModal } from "@/app/categorias/CategoriasUI";
import { listarCategorias, type Categoria } from "@/app/categorias/actions";

type Form = Omit<Produto, "id" | "codigoInterno" | "categoriaNome">;

const formVazio: Form = {
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

// Catálogo de colunas disponíveis na lista. `fixa` = sempre visível.
const COLUNAS_DISPONIVEIS: { chave: string; label: string; fixa?: boolean; col: Coluna<Produto> }[] = [
  {
    chave: "codigo", label: "Código", col: {
      chave: "codigo", cabecalho: "Cód.",
      render: (p) => <span className="font-mono text-xs text-[var(--muted)]">{p.codigoInterno}</span>,
    },
  },
  {
    chave: "nome", label: "Produto", fixa: true, col: {
      chave: "nome", cabecalho: "Produto",
      render: (p) => (
        <div>
          <p className="font-medium">{p.nome}</p>
          <p className="text-xs text-[var(--muted)]">GTIN {p.codigoBarras || "—"} · NCM {p.ncm || "—"}</p>
        </div>
      ),
    },
  },
  {
    chave: "marca", label: "Marca", col: {
      chave: "marca", cabecalho: "Marca",
      render: (p) => p.marca || <span className="text-slate-300">—</span>,
    },
  },
  {
    chave: "categoria", label: "Categoria", col: {
      chave: "categoria", cabecalho: "Categoria",
      render: (p) => (p.categoriaNome ? <Badge tom="primary">{p.categoriaNome}</Badge> : <span className="text-slate-300">—</span>),
    },
  },
  {
    chave: "unidade", label: "Unidade", col: {
      chave: "unidade", cabecalho: "Un.", render: (p) => p.unidade,
    },
  },
  {
    chave: "peso", label: "Peso (kg)", col: {
      chave: "peso", cabecalho: "Peso", alinhar: "right",
      render: (p) => (p.peso > 0 ? `${p.peso.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg` : <span className="text-slate-300">—</span>),
    },
  },
  {
    chave: "ncm", label: "NCM", col: {
      chave: "ncm", cabecalho: "NCM",
      render: (p) => <span className="font-mono text-xs">{p.ncm || "—"}</span>,
    },
  },
  {
    chave: "gtin", label: "GTIN / EAN", col: {
      chave: "gtin", cabecalho: "GTIN",
      render: (p) => <span className="font-mono text-xs">{p.codigoBarras || "—"}</span>,
    },
  },
  {
    chave: "anp", label: "ANP", col: {
      chave: "anp", cabecalho: "ANP", alinhar: "center",
      render: (p) => (p.reguladoAnp ? <Badge tom="warning">ANP</Badge> : <span className="text-slate-300">—</span>),
    },
  },
  {
    chave: "estoque", label: "Estoque", col: {
      chave: "estoque", cabecalho: "Estoque", alinhar: "right",
      render: (p) => {
        if (!p.controlaEstoque) return <span className="text-slate-300">—</span>;
        const zerado = p.estoque <= 0;
        const baixo = !zerado && p.estoqueMinimo > 0 && p.estoque <= p.estoqueMinimo;
        return (
          <span className="inline-flex items-center justify-end gap-1.5">
            <span className={"font-medium " + (zerado ? "text-[var(--danger)]" : baixo ? "text-[var(--warning)]" : "")}>
              {p.estoque.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
            </span>
            {zerado ? <Badge tom="danger">zerado</Badge> : baixo ? <Badge tom="warning">baixo</Badge> : null}
          </span>
        );
      },
    },
  },
  {
    chave: "preco", label: "Preço", col: {
      chave: "preco", cabecalho: "Preço", alinhar: "right",
      render: (p) => <span className="font-medium">{formatBRL(p.preco)}</span>,
    },
  },
];

const COLS_PADRAO = ["codigo", "nome", "marca", "categoria", "unidade", "estoque", "preco"];
const COLS_STORAGE = "easy-nfe:cols-produtos-v1";

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [importar, setImportar] = useState(false);
  const [gerenciarCat, setGerenciarCat] = useState(false);
  const [colunasModal, setColunasModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [extratoId, setExtratoId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Colunas visíveis (persistidas no navegador).
  const [colsVisiveis, setColsVisiveis] = useState<string[]>(COLS_PADRAO);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLS_STORAGE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setColsVisiveis(JSON.parse(raw));
    } catch { /* ignora */ }
  }, []);
  function salvarCols(cols: string[]) {
    setColsVisiveis(cols);
    try { localStorage.setItem(COLS_STORAGE, JSON.stringify(cols)); } catch { /* ignora */ }
  }

  async function recarregar() {
    try {
      const [ps, cs] = await Promise.all([listarProdutos(), listarCategorias("produto")]);
      setProdutos(ps);
      setCategorias(cs);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (filtroCategoria && p.categoriaId !== filtroCategoria) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        p.codigoBarras.includes(q) ||
        p.ncm.includes(q) ||
        String(p.codigoInterno).includes(q)
      );
    });
  }, [produtos, busca, filtroCategoria]);

  function abrirNovo() {
    setEditId(null);
    setForm(formVazio);
    setModo("novo");
  }
  function abrirEdicao(p: Produto) {
    setEditId(p.id);
    const { id: _id, codigoInterno: _ci, categoriaNome: _cn, ...resto } = p;
    void _id; void _ci; void _cn;
    setForm(resto);
    setModo("editar");
  }
  function fechar() {
    setModo(null);
  }
  async function salvarEdicao() {
    if (!editId) return;
    setSalvando(true);
    await atualizarProduto(editId, form);
    await recarregar();
    setSalvando(false);
    fechar();
  }
  async function excluir() {
    if (!editId) return;
    setSalvando(true);
    await excluirProduto(editId);
    await recarregar();
    setSalvando(false);
    fechar();
  }
  // Ajuste de estoque: commita o saldo digitado (form.estoque) via movimento.
  const [ajustando, setAjustando] = useState(false);
  async function salvarAjuste() {
    if (!editId) return;
    setAjustando(true);
    const r = await ajustarEstoque(editId, form.estoque, "Ajuste manual");
    setAjustando(false);
    if (r.ok) await recarregar();
    else alert(r.erro);
  }

  function set<K extends keyof Form>(chave: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  const colunas = useMemo<Coluna<Produto>[]>(
    () => COLUNAS_DISPONIVEIS.filter((c) => c.fixa || colsVisiveis.includes(c.chave)).map((c) => c.col),
    [colsVisiveis],
  );

  // Campos reutilizados nas etapas do stepper e no modal de edição.
  const identificacao = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Código de barras (GTIN/EAN)">
        <Input value={form.codigoBarras} onChange={(e) => set("codigoBarras", e.target.value)} placeholder="Sem GTIN" />
      </Field>
      <Field label="Nome do produto" required>
        <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
      </Field>
      <Field label="Marca">
        <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} placeholder="Ex.: Nestlé" />
      </Field>
      <Field label="Categoria">
        <CategoriaSelect
          tipo="produto"
          categorias={categorias}
          value={form.categoriaId}
          onChange={(id) => set("categoriaId", id)}
          onCategoriasChange={setCategorias}
        />
      </Field>
      <Field label="Unidade de medida" required>
        <Select opcoes={UNIDADES} value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
      </Field>
      <Field label="NCM" required hint="8 dígitos · busque pelo nome do produto">
        <NcmPicker value={form.ncm} onChange={(v) => set("ncm", v)} nomeProduto={form.nome} />
      </Field>
    </div>
  );

  const precoOrigem = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Tipo de origem" required>
        <Select opcoes={ORIGENS} value={form.origem} onChange={(e) => set("origem", e.target.value)} />
      </Field>
      <Field label="Preço" required>
        <MoneyInput value={form.preco} onChange={(v) => set("preco", v)} />
      </Field>
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
          <input
            type="checkbox"
            checked={form.controlaEstoque}
            onChange={(e) => set("controlaEstoque", e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Controlar estoque deste produto
        </label>
      </Field>
      {form.controlaEstoque && (
        <>
          <Field label="Estoque atual" hint="Altere e clique em Ajustar p/ registrar o movimento">
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                value={String(form.estoque).replace(".", ",")}
                onChange={(e) => set("estoque", Number(e.target.value.replace(",", ".").replace(/[^\d.-]/g, "")) || 0)}
                placeholder="0"
              />
              <Button type="button" variante="secondary" onClick={salvarAjuste} disabled={ajustando || !editId}>
                {ajustando ? "…" : "Ajustar"}
              </Button>
            </div>
          </Field>
          <Field label="Estoque mínimo" hint="Alerta quando o saldo chegar nesse nível (0 = sem alerta)">
            <Input
              inputMode="decimal"
              value={form.estoqueMinimo ? String(form.estoqueMinimo).replace(".", ",") : ""}
              onChange={(e) => set("estoqueMinimo", Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0)}
              placeholder="0"
            />
          </Field>
          {editId && (
            <div className="sm:col-span-2">
              <Button type="button" variante="ghost" onClick={() => setExtratoId(editId)}>
                Ver extrato de movimentações →
              </Button>
            </div>
          )}
        </>
      )}
      <Field label="Descrição do produto" className="sm:col-span-2">
        <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
      </Field>
    </div>
  );

  const fiscal = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TributacaoFields
        value={{ cst: form.cst, aliquotaIcms: form.aliquotaIcms, reducaoBaseIcms: form.reducaoBaseIcms }}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
      />
      <Field label="CEST">
        <Input value={form.cest} onChange={(e) => set("cest", e.target.value)} placeholder="0000000" />
      </Field>
      <Field label="Código do benefício" hint="Busca na tabela oficial de GO">
        <BeneficioPicker value={form.codigoBeneficio} onChange={(v) => set("codigoBeneficio", v)} nomeProduto={form.nome} cst={form.cst} />
      </Field>
      <Field label="Crédito presumido de ICMS">
        <Input value={form.creditoPresumidoIcms} onChange={(e) => set("creditoPresumidoIcms", e.target.value)} />
      </Field>
      <Field label="Produto regulamentado pela ANP?">
        <label className="flex h-[46px] items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={form.reguladoAnp}
            onChange={(e) => set("reguladoAnp", e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Sim, produto sujeito à ANP
        </label>
      </Field>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Produtos"
        subtitulo="Clique em um produto para ver detalhes e editar."
        acao={
          <div className="flex flex-wrap gap-2">
            <Button variante="secondary" onClick={() => setGerenciarCat(true)}>Categorias</Button>
            <Button variante="secondary" onClick={() => setColunasModal(true)}>Colunas</Button>
            <Button variante="secondary" onClick={() => setImportar(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
              Importar
            </Button>
            <Button onClick={abrirNovo}>+ Novo produto</Button>
          </div>
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_220px]">
          <Input
            placeholder="Buscar por nome, marca, código, GTIN ou NCM…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Select
            placeholder="Todas as categorias"
            opcoes={categorias.map((c) => ({ value: c.id, label: c.nome }))}
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          />
        </div>
        {carregando ? (
          <LightningLoader texto="Carregando produtos…" />
        ) : (
          <Tabela
            colunas={colunas}
            dados={filtrados}
            onRowClick={abrirEdicao}
            vazio={<EmptyState titulo="Nenhum produto" descricao="Cadastre o primeiro produto para começar." />}
          />
        )}
      </Card>

      {/* Criação em etapas (modal compartilhado) */}
      {modo === "novo" && (
        <NovoProdutoModal
          categorias={categorias}
          onCategoriasChange={setCategorias}
          onFechar={fechar}
          onCriado={() => { recarregar(); fechar(); }}
        />
      )}

      {/* Gerenciar categorias de produto */}
      {gerenciarCat && (
        <GerenciarCategoriasModal
          tipo="produto"
          onFechar={() => setGerenciarCat(false)}
          onMudou={setCategorias}
        />
      )}

      {/* Personalizar colunas da lista */}
      <Modal
        aberto={colunasModal}
        onFechar={() => setColunasModal(false)}
        titulo="Personalizar colunas"
        largura="max-w-md"
        rodape={<Button variante="secondary" onClick={() => setColunasModal(false)}>Fechar</Button>}
      >
        <p className="mb-3 text-sm text-[var(--muted)]">Escolha quais colunas aparecem na lista de produtos.</p>
        <ul className="space-y-1">
          {COLUNAS_DISPONIVEIS.map((c) => {
            const ativa = c.fixa || colsVisiveis.includes(c.chave);
            return (
              <li key={c.chave}>
                <label className={"flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm " + (c.fixa ? "opacity-60" : "cursor-pointer hover:bg-slate-50")}>
                  <input
                    type="checkbox"
                    checked={ativa}
                    disabled={c.fixa}
                    onChange={(e) => {
                      if (e.target.checked) salvarCols([...colsVisiveis, c.chave]);
                      else salvarCols(colsVisiveis.filter((x) => x !== c.chave));
                    }}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {c.label}
                  {c.fixa && <span className="text-xs text-[var(--muted)]">(sempre visível)</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <button onClick={() => salvarCols(COLS_PADRAO)} className="mt-3 text-sm font-medium text-[var(--primary)] hover:underline">
          Restaurar padrão
        </button>
      </Modal>

      {/* Importação em massa (CSV/XLSX) */}
      {importar && (
        <ImportarPlanilhaModal
          titulo="Importar produtos"
          nomeModelo="modelo-produtos"
          nomePlanilha="Produtos"
          modeloUrl="/modelo.xlsx"
          colunas={COLUNAS_PRODUTO}
          headerObrigatorio="nome"
          validar={validarLinhaProduto}
          obrigatoriasLabel={<><b>Nome</b>, <b>Unidade</b>, <b>NCM</b>, <b>Origem</b> e <b>Preço</b></>}
          preview={[
            { label: "Nome", render: (p) => <span className="font-medium">{p.nome || "(vazio)"}</span> },
            { label: "Un.", render: (p) => p.unidade },
            { label: "NCM", render: (p) => <span className="font-mono text-xs">{p.ncm || "—"}</span> },
            { label: "Preço", alinhar: "right", render: (p) => formatBRL(p.preco) },
          ]}
          onImportar={importarProdutos}
          onFechar={() => setImportar(false)}
          onImportado={recarregar}
        />
      )}

      {/* Edição completa */}
      <Modal
        aberto={modo === "editar"}
        onFechar={fechar}
        titulo={`Produto #${editId ? produtos.find((p) => p.id === editId)?.codigoInterno : ""}`}
        rodape={
          <div className="flex w-full items-center justify-between">
            <Button variante="ghost" className="text-[var(--danger)]" onClick={excluir} disabled={salvando}>Excluir</Button>
            <div className="flex gap-2">
              <Button variante="secondary" onClick={fechar} disabled={salvando}>Cancelar</Button>
              <Button onClick={salvarEdicao} disabled={salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</Button>
            </div>
          </div>
        }
      >
        <Tabs
          alturaConteudo="360px"
          abas={[
            { id: "ident", label: "Identificação", content: identificacao },
            { id: "preco", label: "Origem & preço", content: precoOrigem },
            { id: "fiscal", label: "Fiscal", content: fiscal },
          ]}
        />
      </Modal>

      {/* Extrato de movimentações de estoque */}
      {extratoId && (
        <ExtratoEstoqueModal
          produtoId={extratoId}
          nome={produtos.find((p) => p.id === extratoId)?.nome ?? "Produto"}
          onFechar={() => setExtratoId(null)}
        />
      )}
    </div>
  );
}
