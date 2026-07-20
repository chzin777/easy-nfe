"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  BarraSelecao,
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
import ConfirmDialog from "@/app/ui/ConfirmDialog";
import CampoMassa from "@/app/ui/CampoMassa";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { ORIGENS, UNIDADES } from "@/lib/mock-data";
import type { Produto } from "@/lib/types";
import {
  listarProdutos,
  atualizarProduto,
  excluirProduto,
  excluirProdutos,
  atualizarProdutosEmMassa,
  importarProdutos,
  ajustarEstoque,
  type PatchProdutos,
} from "./actions";
import NovoProdutoModal from "./NovoProdutoModal";
import BipagemModal from "./BipagemModal";
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
  precoCusto: 0,
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
      chave: "codigo", cabecalho: "Cód.", valor: (p) => p.codigoInterno,
      render: (p) => <span className="font-mono text-xs text-[var(--muted)]">{p.codigoInterno}</span>,
    },
  },
  {
    chave: "nome", label: "Produto", fixa: true, col: {
      chave: "nome", cabecalho: "Produto", valor: (p) => p.nome,
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
      chave: "marca", cabecalho: "Marca", valor: (p) => p.marca,
      render: (p) => p.marca || <span className="text-slate-300">—</span>,
    },
  },
  {
    chave: "categoria", label: "Categoria", col: {
      chave: "categoria", cabecalho: "Categoria", valor: (p) => p.categoriaNome,
      render: (p) => (p.categoriaNome ? <Badge tom="primary">{p.categoriaNome}</Badge> : <span className="text-slate-300">—</span>),
    },
  },
  {
    chave: "unidade", label: "Unidade", col: {
      chave: "unidade", cabecalho: "Un.", valor: (p) => p.unidade, render: (p) => p.unidade,
    },
  },
  {
    chave: "peso", label: "Peso (kg)", col: {
      chave: "peso", cabecalho: "Peso", alinhar: "right", valor: (p) => p.peso,
      render: (p) => (p.peso > 0 ? `${p.peso.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg` : <span className="text-slate-300">—</span>),
    },
  },
  {
    chave: "ncm", label: "NCM", col: {
      chave: "ncm", cabecalho: "NCM", valor: (p) => p.ncm,
      render: (p) => <span className="font-mono text-xs">{p.ncm || "—"}</span>,
    },
  },
  {
    chave: "gtin", label: "GTIN / EAN", col: {
      chave: "gtin", cabecalho: "GTIN", valor: (p) => p.codigoBarras,
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
      // Sem controle de estoque não há saldo — vai pro fim da ordenação.
      valor: (p) => (p.controlaEstoque ? p.estoque : null),
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
      chave: "preco", cabecalho: "Preço", alinhar: "right", valor: (p) => p.preco,
      render: (p) => <span className="font-medium">{formatBRL(p.preco)}</span>,
    },
  },
  {
    chave: "custo", label: "Custo", col: {
      chave: "custo", cabecalho: "Custo", alinhar: "right",
      valor: (p) => (p.precoCusto > 0 ? p.precoCusto : null),
      render: (p) => p.precoCusto > 0
        ? <span className="text-[var(--muted)]">{formatBRL(p.precoCusto)}</span>
        : <span className="text-slate-300">—</span>,
    },
  },
  {
    chave: "margem", label: "Margem", col: {
      chave: "margem", cabecalho: "Margem", alinhar: "right",
      valor: (p) => (p.precoCusto > 0 && p.preco > 0 ? ((p.preco - p.precoCusto) / p.preco) * 100 : null),
      render: (p) => {
        if (!(p.precoCusto > 0) || !(p.preco > 0)) return <span className="text-slate-300">—</span>;
        const m = ((p.preco - p.precoCusto) / p.preco) * 100;
        return <span className={"font-medium " + (m < 0 ? "text-[var(--danger)]" : "")}>{m.toFixed(1)}%</span>;
      },
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
  const [bipagem, setBipagem] = useState(false);
  const [gerenciarCat, setGerenciarCat] = useState(false);
  const [colunasModal, setColunasModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [extratoId, setExtratoId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Seleção múltipla + ações em massa.
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState<"um" | "massa" | null>(null);
  const [edicaoMassa, setEdicaoMassa] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

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
    setErro(null);
    try {
      await excluirProduto(editId);
      await recarregar();
      setSelecionados((s) => s.filter((id) => id !== editId));
      setConfirmando(null);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setConfirmando(null);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirSelecionados() {
    setProcessando(true);
    setErro(null);
    try {
      const r = await excluirProdutos(selecionados);
      if (!r.ok) { setErro(r.erro); return; }
      await recarregar();
      setSelecionados([]);
      setConfirmando(null);
    } finally {
      setProcessando(false);
    }
  }

  async function aplicarEmMassa(patch: PatchProdutos) {
    setProcessando(true);
    setErro(null);
    try {
      const r = await atualizarProdutosEmMassa(selecionados, patch);
      if (!r.ok) { setErro(r.erro); return; }
      await recarregar();
      setSelecionados([]);
      setEdicaoMassa(false);
    } finally {
      setProcessando(false);
    }
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
      <Field label="Preço de venda" required>
        <MoneyInput value={form.preco} onChange={(v) => set("preco", v)} />
      </Field>
      <Field
        label="Preço de custo"
        hint={
          form.precoCusto > 0 && form.preco > 0
            ? `Margem ${(((form.preco - form.precoCusto) / form.preco) * 100).toFixed(1)}%`
            : "Opcional · usado nos indicadores de margem e lucro"
        }
      >
        <MoneyInput value={form.precoCusto} onChange={(v) => set("precoCusto", v)} />
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
            <Button variante="secondary" onClick={() => setBipagem(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 8v8" /><path d="M11 8v8" /><path d="M15 8v8" /></svg>
              Bipar código
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
            onChange={(e) => { setBusca(e.target.value); setSelecionados([]); }}
          />
          <Select
            placeholder="Todas as categorias"
            opcoes={categorias.map((c) => ({ value: c.id, label: c.nome }))}
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value); setSelecionados([]); }}
          />
        </div>
        {carregando ? (
          <LightningLoader texto="Carregando produtos…" />
        ) : (
          <Tabela
            colunas={colunas}
            dados={filtrados}
            onRowClick={abrirEdicao}
            selecionados={selecionados}
            onSelecionados={setSelecionados}
            vazio={<EmptyState titulo="Nenhum produto" descricao="Cadastre o primeiro produto para começar." />}
          />
        )}
      </Card>

      <BarraSelecao quantidade={selecionados.length} onLimpar={() => setSelecionados([])}>
        {erro && <span className="text-xs font-medium text-[var(--danger)]">{erro}</span>}
        <Button variante="secondary" onClick={() => { setErro(null); setEdicaoMassa(true); }}>
          Editar em massa
        </Button>
        <Button variante="dangerSoft" onClick={() => { setErro(null); setConfirmando("massa"); }}>
          Excluir
        </Button>
      </BarraSelecao>

      <EdicaoMassaModal
        aberto={edicaoMassa}
        quantidade={selecionados.length}
        categorias={categorias}
        onCategoriasChange={setCategorias}
        processando={processando}
        erro={erro}
        onAplicar={aplicarEmMassa}
        onFechar={() => setEdicaoMassa(false)}
      />

      <ConfirmDialog
        aberto={confirmando !== null}
        mensagem={
          confirmando === "massa"
            ? `Excluir ${selecionados.length} produto${selecionados.length > 1 ? "s" : ""}?`
            : "Excluir este produto?"
        }
        detalhe={erro ?? undefined}
        processando={processando || salvando}
        onConfirmar={confirmando === "massa" ? excluirSelecionados : excluir}
        onFechar={() => setConfirmando(null)}
      />

      {/* Criação em etapas (modal compartilhado) */}
      {modo === "novo" && (
        <NovoProdutoModal
          categorias={categorias}
          onCategoriasChange={setCategorias}
          onFechar={fechar}
          onCriado={() => { recarregar(); fechar(); }}
        />
      )}

      {/* Cadastro por bipagem em lote (código de barras → SEFAZ) */}
      {bipagem && (
        <BipagemModal
          onFechar={() => setBipagem(false)}
          onImportado={recarregar}
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
          modeloUrl="/models/produtos.xlsx"
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
            <Button variante="ghost" className="text-[var(--danger)]" onClick={() => setConfirmando("um")} disabled={salvando}>Excluir</Button>
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

// Mesmas opções do form de edição (TributacaoFields).
const OPCOES_CST_MASSA = [
  { value: "40", label: "Isenção (CST 40)" },
  { value: "20", label: "Redução de base de cálculo (CST 20)" },
];

function EdicaoMassaModal({
  aberto,
  quantidade,
  categorias,
  onCategoriasChange,
  processando,
  erro,
  onAplicar,
  onFechar,
}: {
  aberto: boolean;
  quantidade: number;
  categorias: Categoria[];
  onCategoriasChange: (c: Categoria[]) => void;
  processando: boolean;
  erro: string | null;
  onAplicar: (patch: PatchProdutos) => void;
  onFechar: () => void;
}) {
  const [usar, setUsar] = useState({
    categoria: false, origem: false, unidade: false,
    ncm: false, cfop: false, cst: false, preco: false,
  });
  const [categoriaId, setCategoriaId] = useState("");
  const [origem, setOrigem] = useState("0");
  const [unidade, setUnidade] = useState("UN");
  const [ncm, setNcm] = useState("");
  const [cfop, setCfop] = useState("");
  const [cst, setCst] = useState("40");
  const [modoPreco, setModoPreco] = useState<"percentual" | "valor">("percentual");
  const [reajuste, setReajuste] = useState("");

  function alternar<K extends keyof typeof usar>(chave: K, v: boolean) {
    setUsar((u) => ({ ...u, [chave]: v }));
  }

  const valorReajuste = Number(reajuste.replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
  const nenhum = !Object.values(usar).some(Boolean);

  function aplicar() {
    const patch: PatchProdutos = {};
    if (usar.categoria) patch.categoriaId = categoriaId;
    if (usar.origem) patch.origem = origem;
    if (usar.unidade) patch.unidade = unidade;
    if (usar.ncm) patch.ncm = ncm;
    if (usar.cfop) patch.cfopPadrao = cfop;
    if (usar.cst) patch.cst = cst;
    if (usar.preco) patch.reajuste = { modo: modoPreco, valor: valorReajuste };
    onAplicar(patch);
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Editar ${quantidade} produto${quantidade > 1 ? "s" : ""}`}
      largura="max-w-lg"
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar} disabled={processando}>Cancelar</Button>
          <Button onClick={aplicar} disabled={processando || nenhum}>
            {processando ? "Aplicando…" : "Aplicar aos selecionados"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-[var(--muted)]">
        Marque só os campos que devem ser sobrescritos. Os demais ficam como estão.
      </p>
      {erro && <p className="mb-3 text-sm font-medium text-[var(--danger)]">{erro}</p>}
      <div className="space-y-2.5">
        <CampoMassa label="Categoria" ativo={usar.categoria} onAtivo={(v) => alternar("categoria", v)}>
          <CategoriaSelect
            tipo="produto"
            categorias={categorias}
            value={categoriaId}
            onChange={setCategoriaId}
            onCategoriasChange={onCategoriasChange}
          />
          <p className="mt-1.5 text-xs text-[var(--muted)]">Sem categoria = remove a categoria atual.</p>
        </CampoMassa>
        <CampoMassa label="Tipo de origem" ativo={usar.origem} onAtivo={(v) => alternar("origem", v)}>
          <Select opcoes={ORIGENS} value={origem} onChange={(e) => setOrigem(e.target.value)} />
        </CampoMassa>
        <CampoMassa label="Unidade de medida" ativo={usar.unidade} onAtivo={(v) => alternar("unidade", v)}>
          <Select opcoes={UNIDADES} value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        </CampoMassa>
        <CampoMassa label="NCM" ativo={usar.ncm} onAtivo={(v) => alternar("ncm", v)}>
          <Input
            inputMode="numeric"
            value={ncm}
            onChange={(e) => setNcm(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="00000000"
          />
        </CampoMassa>
        <CampoMassa label="CFOP padrão" ativo={usar.cfop} onAtivo={(v) => alternar("cfop", v)}>
          <Input
            inputMode="numeric"
            value={cfop}
            onChange={(e) => setCfop(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="5102"
          />
        </CampoMassa>
        <CampoMassa label="Tributação do ICMS" ativo={usar.cst} onAtivo={(v) => alternar("cst", v)}>
          <Select opcoes={OPCOES_CST_MASSA} value={cst} onChange={(e) => setCst(e.target.value)} />
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            {cst === "20"
              ? "Alíquota e carga efetiva não são alteradas em massa — confira produto a produto quem ainda estiver sem alíquota."
              : "CST 40 zera alíquota e redução de base dos produtos selecionados."}
          </p>
        </CampoMassa>
        <CampoMassa label="Reajustar preço" ativo={usar.preco} onAtivo={(v) => alternar("preco", v)}>
          <div className="grid grid-cols-[150px_1fr] gap-3">
            <Field label="Tipo">
              <Select
                opcoes={[
                  { value: "percentual", label: "Percentual (%)" },
                  { value: "valor", label: "Valor fixo (R$)" },
                ]}
                value={modoPreco}
                onChange={(e) => setModoPreco(e.target.value as "percentual" | "valor")}
              />
            </Field>
            <Field
              label={modoPreco === "percentual" ? "Reajuste (%)" : "Reajuste (R$)"}
              hint="Use negativo para reduzir · ex.: -10"
            >
              <Input
                inputMode="decimal"
                value={reajuste}
                onChange={(e) => setReajuste(e.target.value)}
                placeholder={modoPreco === "percentual" ? "10" : "5,00"}
              />
            </Field>
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Aplicado sobre o preço atual de cada produto. Preço nunca fica abaixo de zero.
          </p>
        </CampoMassa>
      </div>
    </Modal>
  );
}
