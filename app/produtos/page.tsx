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
import { ORIGENS, UNIDADES } from "@/lib/mock-data";
import type { Produto } from "@/lib/types";
import {
  listarProdutos,
  atualizarProduto,
  excluirProduto,
} from "./actions";
import NovoProdutoModal from "./NovoProdutoModal";

type Form = Omit<Produto, "id" | "codigoInterno">;

const formVazio: Form = {
  codigoBarras: "",
  nome: "",
  unidade: "UN",
  ncm: "",
  origem: "0",
  preco: 0,
  descricao: "",
  cest: "",
  codigoBeneficio: "",
  creditoPresumidoIcms: "",
  reguladoAnp: false,
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    setProdutos(await listarProdutos());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.codigoBarras.includes(q) ||
        p.ncm.includes(q) ||
        String(p.codigoInterno).includes(q),
    );
  }, [produtos, busca]);

  function abrirNovo() {
    setEditId(null);
    setForm(formVazio);
    setModo("novo");
  }
  function abrirEdicao(p: Produto) {
    setEditId(p.id);
    const { id: _id, codigoInterno: _ci, ...resto } = p;
    void _id; void _ci;
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

  function set<K extends keyof Form>(chave: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
  }

  const colunas: Coluna<Produto>[] = [
    {
      chave: "codigo",
      cabecalho: "Cód.",
      render: (p) => <span className="font-mono text-xs text-[var(--muted)]">{p.codigoInterno}</span>,
    },
    {
      chave: "nome",
      cabecalho: "Produto",
      render: (p) => (
        <div>
          <p className="font-medium">{p.nome}</p>
          <p className="text-xs text-[var(--muted)]">GTIN {p.codigoBarras || "—"} · NCM {p.ncm || "—"}</p>
        </div>
      ),
    },
    { chave: "unidade", cabecalho: "Un.", render: (p) => p.unidade },
    {
      chave: "anp",
      cabecalho: "ANP",
      alinhar: "center",
      render: (p) => (p.reguladoAnp ? <Badge tom="warning">ANP</Badge> : <span className="text-slate-300">—</span>),
    },
    {
      chave: "preco",
      cabecalho: "Preço",
      alinhar: "right",
      render: (p) => <span className="font-medium">{formatBRL(p.preco)}</span>,
    },
  ];

  // Campos reutilizados nas etapas do stepper e no modal de edição.
  const identificacao = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Código de barras (GTIN/EAN)">
        <Input value={form.codigoBarras} onChange={(e) => set("codigoBarras", e.target.value)} placeholder="Sem GTIN" />
      </Field>
      <Field label="Nome do produto" required>
        <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
      </Field>
      <Field label="Unidade de medida" required>
        <Select opcoes={UNIDADES} value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
      </Field>
      <Field label="NCM" required hint="8 dígitos">
        <Input value={form.ncm} onChange={(e) => set("ncm", e.target.value)} placeholder="00000000" />
      </Field>
    </div>
  );

  const precoOrigem = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Tipo de origem" required>
        <Select opcoes={ORIGENS} value={form.origem} onChange={(e) => set("origem", e.target.value)} />
      </Field>
      <Field label="Preço" required>
        <Input type="number" step="0.01" min="0" value={form.preco} onChange={(e) => set("preco", Number(e.target.value))} />
      </Field>
      <Field label="Descrição do produto" className="sm:col-span-2">
        <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
      </Field>
    </div>
  );

  const fiscal = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="CEST">
        <Input value={form.cest} onChange={(e) => set("cest", e.target.value)} placeholder="0000000" />
      </Field>
      <Field label="Código do benefício">
        <Input value={form.codigoBeneficio} onChange={(e) => set("codigoBeneficio", e.target.value)} placeholder="Ex.: GO820001" />
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
        acao={<Button onClick={abrirNovo}>+ Novo produto</Button>}
      />

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <Input
            placeholder="Buscar por nome, código, GTIN ou NCM…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-md"
          />
        </div>
        <Tabela
          colunas={colunas}
          dados={filtrados}
          onRowClick={abrirEdicao}
          vazio={<EmptyState titulo="Nenhum produto" descricao="Cadastre o primeiro produto para começar." />}
        />
      </Card>

      {/* Criação em etapas (modal compartilhado) */}
      {modo === "novo" && (
        <NovoProdutoModal onFechar={fechar} onCriado={() => { recarregar(); fechar(); }} />
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
    </div>
  );
}
