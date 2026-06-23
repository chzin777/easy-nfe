"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Select,
  Tabela,
  EmptyState,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_CONTRIBUINTE, rotulo } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";
import {
  listarClientes,
  atualizarCliente,
  excluirCliente,
  importarClientes,
} from "./actions";
import NovoClienteModal from "./NovoClienteModal";
import ImportarPlanilhaModal from "@/app/ui/ImportarPlanilhaModal";
import { COLUNAS_CLIENTE, validarLinhaCliente } from "@/lib/clientes-modelo";
import { CategoriaSelect, GerenciarCategoriasModal } from "@/app/categorias/CategoriasUI";
import { listarCategorias, type Categoria } from "@/app/categorias/actions";

type Form = Omit<Cliente, "id" | "codigoInterno" | "categoriaNome" | "padrao">;

const formVazio: Form = {
  tipoContribuinte: "1",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  categoriaId: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [importar, setImportar] = useState(false);
  const [gerenciarCat, setGerenciarCat] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function recarregar() {
    try {
      const [cs, cats] = await Promise.all([listarClientes(), listarCategorias("cliente")]);
      setClientes(cs);
      setCategorias(cats);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {

    void recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filtroCategoria && c.categoriaId !== filtroCategoria) return false;
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        c.documento.includes(q) ||
        String(c.codigoInterno).includes(q)
      );
    });
  }, [clientes, busca, filtroCategoria]);

  function abrirNovo() {
    setEditId(null);
    setForm(formVazio);
    setModo("novo");
  }
  function abrirEdicao(c: Cliente) {
    setEditId(c.id);
    const { id: _id, codigoInterno: _ci, categoriaNome: _cn, ...resto } = c;
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
    await atualizarCliente(editId, form);
    await recarregar();
    setSalvando(false);
    fechar();
  }
  async function excluir() {
    if (!editId) return;
    setSalvando(true);
    await excluirCliente(editId);
    await recarregar();
    setSalvando(false);
    fechar();
  }

  const colunas: Coluna<Cliente>[] = [
    {
      chave: "codigo",
      cabecalho: "Cód.",
      render: (c) => <span className="font-mono text-xs text-[var(--muted)]">{c.codigoInterno}</span>,
    },
    {
      chave: "nome",
      cabecalho: "Cliente",
      render: (c) => (
        <div>
          <p className="font-medium">{c.nome}</p>
          <p className="text-xs text-[var(--muted)]">{c.documento || "—"}</p>
        </div>
      ),
    },
    {
      chave: "contribuinte",
      cabecalho: "Contribuinte",
      render: (c) => <Badge tom="primary">{rotulo(TIPOS_CONTRIBUINTE, c.tipoContribuinte)}</Badge>,
    },
    {
      chave: "categoria",
      cabecalho: "Categoria",
      render: (c) => (c.categoriaNome ? <Badge tom="primary">{c.categoriaNome}</Badge> : <span className="text-slate-300">—</span>),
    },
    {
      chave: "local",
      cabecalho: "Cidade/UF",
      render: (c) => (c.endereco.municipio ? `${c.endereco.municipio}/${c.endereco.uf}` : "—"),
    },
  ];

  const identificacao = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Tipo de contribuinte" required>
        <Select
          opcoes={TIPOS_CONTRIBUINTE}
          value={form.tipoContribuinte}
          onChange={(e) => setForm((f) => ({ ...f, tipoContribuinte: e.target.value }))}
        />
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
      <Field label="Categoria">
        <CategoriaSelect
          tipo="cliente"
          categorias={categorias}
          value={form.categoriaId}
          onChange={(id) => setForm((f) => ({ ...f, categoriaId: id }))}
          onCategoriasChange={setCategorias}
        />
      </Field>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Clientes"
        subtitulo="Clique em um cliente para ver detalhes e editar."
        acao={
          <div className="flex flex-wrap gap-2">
            <Button variante="secondary" onClick={() => setGerenciarCat(true)}>Categorias</Button>
            <Button variante="secondary" onClick={() => setImportar(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
              Importar
            </Button>
            <Button onClick={abrirNovo}>+ Novo cliente</Button>
          </div>
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_220px]">
          <Input
            placeholder="Buscar por nome, CPF/CNPJ ou código…"
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
          <LightningLoader texto="Carregando clientes…" />
        ) : (
          <Tabela
            colunas={colunas}
            dados={filtrados}
            onRowClick={abrirEdicao}
            vazio={<EmptyState titulo="Nenhum cliente" descricao="Cadastre o primeiro cliente." />}
          />
        )}
      </Card>

      {/* Criação em etapas (modal compartilhado) */}
      {modo === "novo" && (
        <NovoClienteModal
          categorias={categorias}
          onCategoriasChange={setCategorias}
          onFechar={fechar}
          onCriado={() => { recarregar(); fechar(); }}
        />
      )}

      {/* Gerenciar categorias de cliente */}
      {gerenciarCat && (
        <GerenciarCategoriasModal
          tipo="cliente"
          onFechar={() => setGerenciarCat(false)}
          onMudou={setCategorias}
        />
      )}

      {/* Importação em massa (CSV/XLSX) */}
      {importar && (
        <ImportarPlanilhaModal
          titulo="Importar clientes"
          nomeModelo="modelo-clientes"
          nomePlanilha="Clientes"
          colunas={COLUNAS_CLIENTE}
          headerObrigatorio="nome"
          validar={validarLinhaCliente}
          obrigatoriasLabel={<><b>Nome</b> e <b>CPF/CNPJ</b></>}
          preview={[
            { label: "Nome", render: (c) => <span className="font-medium">{c.nome || "(vazio)"}</span> },
            { label: "CPF/CNPJ", render: (c) => <span className="font-mono text-xs">{c.documento || "—"}</span> },
            { label: "Município", render: (c) => c.municipio ? `${c.municipio}/${c.uf}` : "—" },
          ]}
          onImportar={importarClientes}
          onFechar={() => setImportar(false)}
          onImportado={recarregar}
        />
      )}

      {/* Edição completa */}
      <Modal
        aberto={modo === "editar"}
        onFechar={fechar}
        titulo={(editId ? clientes.find((c) => c.id === editId)?.nome : "") || "Cliente"}
        rodape={
          <div className="flex w-full items-center justify-between">
            {/* Consumidor final (padrão) não pode ser excluído. */}
            {clientes.find((c) => c.id === editId)?.padrao ? (
              <span className="text-xs text-[var(--muted)]">Cliente padrão do sistema</span>
            ) : (
              <Button variante="ghost" className="text-[var(--danger)]" onClick={excluir} disabled={salvando}>Excluir</Button>
            )}
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
            {
              id: "ident",
              label: "Identificação",
              content: (
                <>
                  <SectionTitle>Identificação do cliente</SectionTitle>
                  {identificacao}
                </>
              ),
            },
            {
              id: "contato",
              label: "Contato",
              content: (
                <ContatoFields value={form.contato} onChange={(contato) => setForm((f) => ({ ...f, contato }))} />
              ),
            },
            {
              id: "endereco",
              label: "Endereço",
              content: (
                <EnderecoFields value={form.endereco} onChange={(endereco) => setForm((f) => ({ ...f, endereco }))} />
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
