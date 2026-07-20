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
  SectionTitle,
  Select,
  Tabela,
  EmptyState,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import ConfirmDialog from "@/app/ui/ConfirmDialog";
import CampoMassa from "@/app/ui/CampoMassa";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_CONTRIBUINTE, UFS, rotulo } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";
import {
  listarClientes,
  atualizarCliente,
  excluirCliente,
  excluirClientes,
  atualizarClientesEmMassa,
  importarClientes,
  type PatchClientes,
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

  // Seleção múltipla + ações em massa.
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState<"um" | "massa" | null>(null);
  const [edicaoMassa, setEdicaoMassa] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

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
    setErro(null);
    try {
      await excluirCliente(editId);
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

  // O Consumidor final (padrão) nunca entra na seleção — não pode ser excluído
  // nem editado em massa.
  function marcar(ids: string[]) {
    const proibidos = new Set(clientes.filter((c) => c.padrao).map((c) => c.id));
    setSelecionados(ids.filter((id) => !proibidos.has(id)));
  }

  async function excluirSelecionados() {
    setProcessando(true);
    setErro(null);
    try {
      const r = await excluirClientes(selecionados);
      if (!r.ok) { setErro(r.erro); return; }
      await recarregar();
      setSelecionados([]);
      setConfirmando(null);
    } finally {
      setProcessando(false);
    }
  }

  async function aplicarEmMassa(patch: PatchClientes) {
    setProcessando(true);
    setErro(null);
    try {
      const r = await atualizarClientesEmMassa(selecionados, patch);
      if (!r.ok) { setErro(r.erro); return; }
      await recarregar();
      setSelecionados([]);
      setEdicaoMassa(false);
    } finally {
      setProcessando(false);
    }
  }

  const colunas: Coluna<Cliente>[] = [
    {
      chave: "codigo",
      cabecalho: "Cód.",
      valor: (c) => c.codigoInterno,
      render: (c) => <span className="font-mono text-xs text-[var(--muted)]">{c.codigoInterno}</span>,
    },
    {
      chave: "nome",
      cabecalho: "Cliente",
      valor: (c) => c.nome,
      render: (c) => (
        <div>
          <p className="flex items-center gap-2 font-medium">
            {c.nome}
            {c.padrao && <Badge>padrão</Badge>}
          </p>
          <p className="text-xs text-[var(--muted)]">{c.documento || "—"}</p>
        </div>
      ),
    },
    {
      chave: "contribuinte",
      cabecalho: "Contribuinte",
      valor: (c) => rotulo(TIPOS_CONTRIBUINTE, c.tipoContribuinte),
      render: (c) => <Badge tom="primary">{rotulo(TIPOS_CONTRIBUINTE, c.tipoContribuinte)}</Badge>,
    },
    {
      chave: "categoria",
      cabecalho: "Categoria",
      valor: (c) => c.categoriaNome,
      render: (c) => (c.categoriaNome ? <Badge tom="primary">{c.categoriaNome}</Badge> : <span className="text-slate-300">—</span>),
    },
    {
      chave: "local",
      cabecalho: "Cidade/UF",
      valor: (c) => (c.endereco.municipio ? `${c.endereco.municipio}/${c.endereco.uf}` : ""),
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
          <LightningLoader texto="Carregando clientes…" />
        ) : (
          <Tabela
            colunas={colunas}
            dados={filtrados}
            onRowClick={abrirEdicao}
            selecionados={selecionados}
            onSelecionados={marcar}
            vazio={<EmptyState titulo="Nenhum cliente" descricao="Cadastre o primeiro cliente." />}
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
            ? `Excluir ${selecionados.length} cliente${selecionados.length > 1 ? "s" : ""}?`
            : "Excluir este cliente?"
        }
        detalhe={erro ?? undefined}
        processando={processando || salvando}
        onConfirmar={confirmando === "massa" ? excluirSelecionados : excluir}
        onFechar={() => setConfirmando(null)}
      />

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
          modeloUrl="/models/cliente.xlsx"
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
              <Button variante="ghost" className="text-[var(--danger)]" onClick={() => setConfirmando("um")} disabled={salvando}>Excluir</Button>
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
  onAplicar: (patch: PatchClientes) => void;
  onFechar: () => void;
}) {
  const [usarCategoria, setUsarCategoria] = useState(false);
  const [usarContribuinte, setUsarContribuinte] = useState(false);
  const [usarLocal, setUsarLocal] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [tipoContribuinte, setTipoContribuinte] = useState("1");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("GO");

  const nenhum = !usarCategoria && !usarContribuinte && !usarLocal;

  function aplicar() {
    const patch: PatchClientes = {};
    if (usarCategoria) patch.categoriaId = categoriaId;
    if (usarContribuinte) patch.tipoContribuinte = tipoContribuinte;
    if (usarLocal) { patch.municipio = municipio; patch.uf = uf; }
    onAplicar(patch);
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Editar ${quantidade} cliente${quantidade > 1 ? "s" : ""}`}
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
        <CampoMassa label="Categoria" ativo={usarCategoria} onAtivo={setUsarCategoria}>
          <CategoriaSelect
            tipo="cliente"
            categorias={categorias}
            value={categoriaId}
            onChange={setCategoriaId}
            onCategoriasChange={onCategoriasChange}
          />
          <p className="mt-1.5 text-xs text-[var(--muted)]">Sem categoria = remove a categoria atual.</p>
        </CampoMassa>
        <CampoMassa label="Tipo de contribuinte" ativo={usarContribuinte} onAtivo={setUsarContribuinte}>
          <Select
            opcoes={TIPOS_CONTRIBUINTE}
            value={tipoContribuinte}
            onChange={(e) => setTipoContribuinte(e.target.value)}
          />
        </CampoMassa>
        <CampoMassa label="Cidade / UF" ativo={usarLocal} onAtivo={setUsarLocal}>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="Município">
              <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
            </Field>
            <Field label="UF">
              <Select opcoes={UFS} value={uf} onChange={(e) => setUf(e.target.value)} />
            </Field>
          </div>
        </CampoMassa>
      </div>
    </Modal>
  );
}
