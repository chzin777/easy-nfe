"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  Paginacao,
  paginar,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import ConfirmDialog from "@/app/ui/ConfirmDialog";
import CampoMassa from "@/app/ui/CampoMassa";
import Tabs from "@/app/ui/Tabs";
import LightningLoader from "@/app/ui/LightningLoader";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { UFS } from "@/lib/mock-data";
import {
  listarFornecedores,
  criarFornecedor,
  atualizarFornecedor,
  excluirFornecedor,
  excluirFornecedores,
  atualizarFornecedoresEmMassa,
  type Fornecedor,
  type FornecedorInput,
  type PatchFornecedores,
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
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [modo, setModo] = useState<"novo" | "editar" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FornecedorInput>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Seleção múltipla + ações em massa.
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState<"um" | "massa" | null>(null);
  const [edicaoMassa, setEdicaoMassa] = useState(false);
  const [erroMassa, setErroMassa] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

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

  const pag = paginar(filtrados, pagina, porPagina);

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
    setErro(null);
    try {
      await excluirFornecedor(editId);
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
    setErroMassa(null);
    try {
      const r = await excluirFornecedores(selecionados);
      if (!r.ok) { setErroMassa(r.erro); return; }
      await recarregar();
      setSelecionados([]);
      setConfirmando(null);
    } finally {
      setProcessando(false);
    }
  }

  async function aplicarEmMassa(patch: PatchFornecedores) {
    setProcessando(true);
    setErroMassa(null);
    try {
      const r = await atualizarFornecedoresEmMassa(selecionados, patch);
      if (!r.ok) { setErroMassa(r.erro); return; }
      await recarregar();
      setSelecionados([]);
      setEdicaoMassa(false);
    } finally {
      setProcessando(false);
    }
  }

  const colunas: Coluna<Fornecedor>[] = [
    {
      chave: "codigo",
      cabecalho: "Cód.",
      valor: (f) => f.codigoInterno,
      render: (f) => <span className="font-mono text-xs text-[var(--muted)]">{f.codigoInterno}</span>,
    },
    {
      chave: "nome",
      cabecalho: "Fornecedor",
      valor: (f) => f.nome,
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
      valor: (f) => f.documento,
      render: (f) => <span className="font-mono text-xs">{f.documento || "—"}</span>,
    },
    {
      chave: "local",
      cabecalho: "Cidade/UF",
      valor: (f) => (f.endereco.municipio ? `${f.endereco.municipio}/${f.endereco.uf}` : ""),
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
            onChange={(e) => { setBusca(e.target.value); setSelecionados([]); setPagina(1); }}
            className="max-w-md"
          />
        </div>
        {carregando ? (
          <LightningLoader texto="Carregando fornecedores…" />
        ) : (
          <>
            <Tabela
              colunas={colunas}
              dados={pag.fatia}
              onRowClick={abrirEdicao}
              selecionados={selecionados}
              onSelecionados={setSelecionados}
              vazio={<EmptyState titulo="Nenhum fornecedor" descricao="Cadastre o primeiro fornecedor." />}
            />
            <Paginacao
              total={filtrados.length}
              pagina={pag.pagina}
              paginas={pag.paginas}
              porPagina={porPagina}
              onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
              rotulo="fornecedor"
            />
          </>
        )}
      </Card>

      <BarraSelecao quantidade={selecionados.length} onLimpar={() => setSelecionados([])}>
        {erroMassa && <span className="text-xs font-medium text-[var(--danger)]">{erroMassa}</span>}
        <Button variante="secondary" onClick={() => { setErroMassa(null); setEdicaoMassa(true); }}>
          Editar em massa
        </Button>
        <Button variante="dangerSoft" onClick={() => { setErroMassa(null); setConfirmando("massa"); }}>
          Excluir
        </Button>
      </BarraSelecao>

      <EdicaoMassaModal
        aberto={edicaoMassa}
        quantidade={selecionados.length}
        processando={processando}
        erro={erroMassa}
        onAplicar={aplicarEmMassa}
        onFechar={() => setEdicaoMassa(false)}
      />

      <ConfirmDialog
        aberto={confirmando !== null}
        mensagem={
          confirmando === "massa"
            ? `Excluir ${selecionados.length} fornecedor${selecionados.length > 1 ? "es" : ""}?`
            : "Excluir este fornecedor?"
        }
        detalhe={erroMassa ?? erro ?? undefined}
        processando={processando || salvando}
        onConfirmar={confirmando === "massa" ? excluirSelecionados : excluir}
        onFechar={() => setConfirmando(null)}
      />

      <Modal
        aberto={modo !== null}
        onFechar={fechar}
        titulo={modo === "editar" ? `Fornecedor #${editId ? lista.find((f) => f.id === editId)?.codigoInterno : ""}` : "Novo fornecedor"}
        rodape={
          <div className="flex w-full items-center justify-between">
            {modo === "editar" ? (
              <Button variante="ghost" className="text-[var(--danger)]" onClick={() => setConfirmando("um")} disabled={salvando}>Excluir</Button>
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

// Edição em massa. O fornecedor não tem categoria — os campos agrupáveis são
// cidade/UF e as observações internas.
function EdicaoMassaModal({
  aberto,
  quantidade,
  processando,
  erro,
  onAplicar,
  onFechar,
}: {
  aberto: boolean;
  quantidade: number;
  processando: boolean;
  erro: string | null;
  onAplicar: (patch: PatchFornecedores) => void;
  onFechar: () => void;
}) {
  const [usarLocal, setUsarLocal] = useState(false);
  const [usarObs, setUsarObs] = useState(false);
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("GO");
  const [observacoes, setObservacoes] = useState("");

  const nenhum = !usarLocal && !usarObs;

  function aplicar() {
    const patch: PatchFornecedores = {};
    if (usarLocal) { patch.municipio = municipio; patch.uf = uf; }
    if (usarObs) patch.observacoes = observacoes;
    onAplicar(patch);
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Editar ${quantidade} fornecedor${quantidade > 1 ? "es" : ""}`}
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
        <CampoMassa label="Observações" ativo={usarObs} onAtivo={setUsarObs}>
          <Input
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Anotações internas sobre o fornecedor"
          />
        </CampoMassa>
      </div>
    </Modal>
  );
}
