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
import { TIPOS_TRANSPORTE, rotulo } from "@/lib/mock-data";
import type { Transportadora } from "@/lib/types";
import {
  listarTransportadoras,
  atualizarTransportadora,
  excluirTransportadora,
} from "./actions";
import NovaTransportadoraModal from "./NovaTransportadoraModal";

type Form = Omit<Transportadora, "id" | "codigoInterno">;

const formVazio: Form = {
  tipoTransporte: "0",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

export default function TransportadorasPage() {
  const [lista, setLista] = useState<Transportadora[]>([]);
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    setLista(await listarTransportadoras());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (t) =>
        t.nome.toLowerCase().includes(q) ||
        t.documento.includes(q) ||
        String(t.codigoInterno).includes(q),
    );
  }, [lista, busca]);

  function abrirNovo() {
    setEditId(null);
    setForm(formVazio);
    setModo("novo");
  }
  function abrirEdicao(t: Transportadora) {
    setEditId(t.id);
    const { id: _id, codigoInterno: _ci, ...resto } = t;
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
    await atualizarTransportadora(editId, form);
    await recarregar();
    setSalvando(false);
    fechar();
  }
  async function excluir() {
    if (!editId) return;
    setSalvando(true);
    await excluirTransportadora(editId);
    await recarregar();
    setSalvando(false);
    fechar();
  }

  const colunas: Coluna<Transportadora>[] = [
    {
      chave: "codigo",
      cabecalho: "Cód.",
      render: (t) => <span className="font-mono text-xs text-[var(--muted)]">{t.codigoInterno}</span>,
    },
    {
      chave: "nome",
      cabecalho: "Transportadora",
      render: (t) => (
        <div>
          <p className="font-medium">{t.nome}</p>
          <p className="text-xs text-[var(--muted)]">{t.documento || "—"}</p>
        </div>
      ),
    },
    {
      chave: "transporte",
      cabecalho: "Modalidade",
      render: (t) => <Badge tom="neutral">{rotulo(TIPOS_TRANSPORTE, t.tipoTransporte)}</Badge>,
    },
    {
      chave: "local",
      cabecalho: "Cidade/UF",
      render: (t) => (t.endereco.municipio ? `${t.endereco.municipio}/${t.endereco.uf}` : "—"),
    },
  ];

  const identificacao = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Tipo de transporte" required>
        <Select
          opcoes={TIPOS_TRANSPORTE}
          value={form.tipoTransporte}
          onChange={(e) => setForm((f) => ({ ...f, tipoTransporte: e.target.value }))}
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
        titulo="Transportadoras"
        subtitulo="Clique em uma transportadora para ver detalhes e editar."
        acao={<Button onClick={abrirNovo}>+ Nova transportadora</Button>}
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
          vazio={<EmptyState titulo="Nenhuma transportadora" descricao="Cadastre a primeira transportadora." />}
        />
      </Card>

      {/* Criação em etapas (modal compartilhado) */}
      {modo === "novo" && (
        <NovaTransportadoraModal onFechar={fechar} onCriado={() => { recarregar(); fechar(); }} />
      )}

      {/* Edição completa */}
      <Modal
        aberto={modo === "editar"}
        onFechar={fechar}
        titulo={`Transportadora #${editId ? lista.find((t) => t.id === editId)?.codigoInterno : ""}`}
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
                  <SectionTitle>Identificação da transportadora</SectionTitle>
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
