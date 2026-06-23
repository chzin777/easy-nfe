"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Tabela,
  EmptyState,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import {
  listarFornecedores,
  criarFornecedor,
  atualizarFornecedor,
  excluirFornecedor,
  type Fornecedor,
  type FornecedorInput,
} from "./actions";

const soDig = (s: string) => s.replace(/\D/g, "");

const formVazio: FornecedorInput = {
  documento: "",
  nome: "",
  nomeFantasia: "",
  inscricaoEstadual: "",
  observacoes: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

export default function FornecedoresPage() {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FornecedorInput>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function recarregar() {
    try {
      setLista(await listarFornecedores());
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (f) =>
        f.nome.toLowerCase().includes(q) ||
        f.nomeFantasia.toLowerCase().includes(q) ||
        f.documento.includes(q) ||
        String(f.codigoInterno).includes(q),
    );
  }, [lista, busca]);

  function abrirNovo() {
    setEditId(null);
    setForm(formVazio);
    setErro(null);
    setModo("novo");
  }
  function abrirEdicao(f: Fornecedor) {
    setEditId(f.id);
    const { id: _id, codigoInterno: _ci, ...resto } = f;
    void _id; void _ci;
    setForm(resto);
    setErro(null);
    setModo("editar");
  }
  function fechar() {
    setModo(null);
  }

  // Puxa razão social/endereço pelo CNPJ (BrasilAPI, no browser).
  async function aoMudarDoc(raw: string) {
    const d = soDig(raw).slice(0, 14);
    setForm((f) => ({ ...f, documento: d }));
    if (d.length !== 14) return;
    setBuscandoCnpj(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
      if (!r.ok) return;
      const j = await r.json();
      const s = (v: unknown) => (v == null ? "" : String(v));
      setForm((f) => ({
        ...f,
        nome: f.nome.trim() || s(j.razao_social),
        nomeFantasia: f.nomeFantasia.trim() || s(j.nome_fantasia),
        contato: {
          telefone: f.contato.telefone.trim() || s(j.ddd_telefone_1),
          email: f.contato.email.trim() || s(j.email),
        },
        endereco: {
          cep: f.endereco.cep.trim() || s(j.cep),
          logradouro: f.endereco.logradouro.trim() || s(j.logradouro),
          numero: f.endereco.numero.trim() || s(j.numero),
          complemento: f.endereco.complemento.trim() || s(j.complemento),
          bairro: f.endereco.bairro.trim() || s(j.bairro),
          municipio: f.endereco.municipio.trim() || s(j.municipio),
          uf: f.endereco.uf.trim() || s(j.uf),
        },
      }));
    } catch {
      /* offline / não encontrado */
    } finally {
      setBuscandoCnpj(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (modo === "editar" && editId) await atualizarFornecedor(editId, form);
      else await criarFornecedor(form);
      await recarregar();
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }
  async function excluir() {
    if (!editId) return;
    setSalvando(true);
    await excluirFornecedor(editId);
    await recarregar();
    setSalvando(false);
    fechar();
  }

  const colunas: Coluna<Fornecedor>[] = [
    {
      chave: "codigo",
      cabecalho: "Cód.",
      render: (f) => <span className="font-mono text-xs text-[var(--muted)]">{f.codigoInterno}</span>,
    },
    {
      chave: "nome",
      cabecalho: "Fornecedor",
      render: (f) => (
        <div>
          <p className="font-medium">{f.nome}</p>
          <p className="text-xs text-[var(--muted)]">{f.nomeFantasia || f.documento || "—"}</p>
        </div>
      ),
    },
    {
      chave: "doc",
      cabecalho: "CNPJ/CPF",
      render: (f) => <span className="font-mono text-xs">{f.documento || "—"}</span>,
    },
    {
      chave: "local",
      cabecalho: "Cidade/UF",
      render: (f) => (f.endereco.municipio ? `${f.endereco.municipio}/${f.endereco.uf}` : "—"),
    },
  ];

  const identificacao = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="CNPJ ou CPF" required hint={buscandoCnpj ? "Buscando dados da empresa…" : "Preencha o CNPJ para puxar a razão social"}>
        <Input value={form.documento} onChange={(e) => aoMudarDoc(e.target.value)} placeholder="00.000.000/0000-00" />
      </Field>
      <Field label="Inscrição estadual" hint="Deixe vazio se isento">
        <Input value={form.inscricaoEstadual} onChange={(e) => setForm((f) => ({ ...f, inscricaoEstadual: e.target.value }))} />
      </Field>
      <Field label="Razão social" required>
        <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
      </Field>
      <Field label="Nome fantasia">
        <Input value={form.nomeFantasia} onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))} />
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <Input value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} placeholder="Anotações internas sobre o fornecedor" />
      </Field>
    </div>
  );

  const docOk = soDig(form.documento).length >= 11;
  const podeSalvar = form.nome.trim() !== "" && docOk;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Fornecedores"
        subtitulo="Empresas que faturam contra o seu CNPJ. Cadastre para identificar a origem nas notas recebidas."
        acao={<Button onClick={abrirNovo}>+ Novo fornecedor</Button>}
      />

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <Input
            placeholder="Buscar por nome, CNPJ ou código…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-md"
          />
        </div>
        {carregando ? (
          <LightningLoader texto="Carregando fornecedores…" />
        ) : (
          <Tabela
            colunas={colunas}
            dados={filtrados}
            onRowClick={abrirEdicao}
            vazio={<EmptyState titulo="Nenhum fornecedor" descricao="Cadastre o primeiro fornecedor." />}
          />
        )}
      </Card>

      <Modal
        aberto={modo !== null}
        onFechar={fechar}
        titulo={modo === "editar" ? `Fornecedor #${editId ? lista.find((f) => f.id === editId)?.codigoInterno : ""}` : "Novo fornecedor"}
        rodape={
          <div className="flex w-full items-center justify-between">
            {modo === "editar" ? (
              <Button variante="ghost" className="text-[var(--danger)]" onClick={excluir} disabled={salvando}>Excluir</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variante="secondary" onClick={fechar} disabled={salvando}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando || !podeSalvar}>{salvando ? "Salvando…" : modo === "editar" ? "Salvar alterações" : "Cadastrar fornecedor"}</Button>
            </div>
          </div>
        }
      >
        {erro && <p className="mb-3 text-sm font-medium text-[var(--danger)]">{erro}</p>}
        <Tabs
          alturaConteudo="360px"
          abas={[
            {
              id: "ident",
              label: "Identificação",
              content: (
                <>
                  <SectionTitle>Identificação do fornecedor</SectionTitle>
                  {identificacao}
                </>
              ),
            },
            {
              id: "contato",
              label: "Contato",
              content: <ContatoFields value={form.contato} onChange={(contato) => setForm((f) => ({ ...f, contato }))} />,
            },
            {
              id: "endereco",
              label: "Endereço",
              content: <EnderecoFields value={form.endereco} onChange={(endereco) => setForm((f) => ({ ...f, endereco }))} />,
            },
          ]}
        />
      </Modal>
    </div>
  );
}
