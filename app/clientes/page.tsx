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
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_CONTRIBUINTE, rotulo } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";
import {
  listarClientes,
  atualizarCliente,
  excluirCliente,
} from "./actions";
import NovoClienteModal from "./NovoClienteModal";

type Form = Omit<Cliente, "id" | "codigoInterno">;

const formVazio: Form = {
  tipoContribuinte: "1",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    setClientes(await listarClientes());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.documento.includes(q) ||
        String(c.codigoInterno).includes(q),
    );
  }, [clientes, busca]);

  function abrirNovo() {
    setEditId(null);
    setForm(formVazio);
    setModo("novo");
  }
  function abrirEdicao(c: Cliente) {
    setEditId(c.id);
    const { id: _id, codigoInterno: _ci, ...resto } = c;
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
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Clientes"
        subtitulo="Clique em um cliente para ver detalhes e editar."
        acao={<Button onClick={abrirNovo}>+ Novo cliente</Button>}
      />

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <Input
            placeholder="Buscar por nome, CPF/CNPJ ou código…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-md"
          />
        </div>
        <Tabela
          colunas={colunas}
          dados={filtrados}
          onRowClick={abrirEdicao}
          vazio={<EmptyState titulo="Nenhum cliente" descricao="Cadastre o primeiro cliente." />}
        />
      </Card>

      {/* Criação em etapas (modal compartilhado) */}
      {modo === "novo" && (
        <NovoClienteModal onFechar={fechar} onCriado={() => { recarregar(); fechar(); }} />
      )}

      {/* Edição completa */}
      <Modal
        aberto={modo === "editar"}
        onFechar={fechar}
        titulo={`Cliente #${editId ? clientes.find((c) => c.id === editId)?.codigoInterno : ""}`}
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
