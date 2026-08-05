"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/app/ui/Modal";
import {
  Badge,
  Button,
  Card,
  DateBR,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Paginacao,
  Select,
  Tabela,
  Textarea,
  formatBRL,
  paginar,
  type Coluna,
} from "@/app/ui/primitives";
import ClientePicker from "@/app/notas/nova/ClientePicker";
import SeletorLC116 from "@/app/servicos/SeletorLC116";
import { listarClientes } from "@/app/clientes/actions";
import { listarServicos, type Servico } from "@/app/servicos/actions";
import type { Cliente } from "@/lib/types";
import {
  alternarContrato,
  atualizarContrato,
  criarContrato,
  emitirContratoAgora,
  excluirContrato,
  listarContratos,
  type Contrato,
  type ContratoInput,
  type Periodicidade,
} from "./actions";

// Contratos: a NFS-e que se repete. O usuário cadastra uma vez e o sistema
// emite sozinho na data — sem refazer o formulário todo mês.

const PERIODICIDADES: { value: Periodicidade; label: string }[] = [
  { value: "MENSAL", label: "Todo mês" },
  { value: "BIMESTRAL", label: "A cada 2 meses" },
  { value: "TRIMESTRAL", label: "A cada 3 meses" },
  { value: "SEMESTRAL", label: "A cada 6 meses" },
  { value: "ANUAL", label: "Uma vez por ano" },
];

const TRIBUTACAO = [
  { value: "1", label: "Tributável (ISS devido)" },
  { value: "2", label: "Imune" },
  { value: "4", label: "Não incidência" },
];

const IMUNIDADES = [
  { value: "0", label: "Não informado" },
  { value: "1", label: "Entes públicos entre si" },
  { value: "2", label: "Templos de qualquer culto" },
  { value: "3", label: "Partidos, sindicatos, educação e assistência sem fins lucrativos" },
  { value: "4", label: "Livros, jornais e periódicos" },
  { value: "5", label: "Fonogramas e videofonogramas musicais brasileiros" },
];

const VAZIO: ContratoInput = {
  nome: "",
  clienteId: "",
  servicoId: null,
  descricaoServico: "",
  cTribNac: "",
  itemListaServico: "",
  cNBS: "",
  codMunicipioPrestacao: "",
  valorServico: 0,
  aliqISS: 0,
  tribISSQN: "1",
  tpImunidade: "0",
  issRetido: false,
  informacoesAdicionais: "",
  periodicidade: "MENSAL",
  diaEmissao: 1,
  fim: "",
  ativo: true,
};

const dataBR = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [form, setForm] = useState<ContratoInput>(VAZIO);
  const [editId, setEditId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [emitindo, setEmitindo] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Contrato | null>(null);
  const [emitirJa, setEmitirJa] = useState<Contrato | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarContratos(), listarClientes(), listarServicos()])
      .then(([c, cl, sv]) => {
        setContratos(c);
        setClientes(cl);
        setServicos(sv);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contratos;
    return contratos.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.clienteNome.toLowerCase().includes(q),
    );
  }, [contratos, busca]);
  const pag = paginar(filtrados, pagina, porPagina);

  function abrirNovo() {
    setForm(VAZIO);
    setEditId(null);
    setErro(null);
    setAberto(true);
  }

  function abrirEdicao(c: Contrato) {
    setForm({
      nome: c.nome,
      clienteId: c.clienteId,
      servicoId: c.servicoId,
      descricaoServico: c.descricaoServico,
      cTribNac: c.cTribNac,
      itemListaServico: c.itemListaServico,
      cNBS: c.cNBS,
      codMunicipioPrestacao: c.codMunicipioPrestacao,
      valorServico: c.valorServico,
      aliqISS: c.aliqISS,
      tribISSQN: c.tribISSQN,
      tpImunidade: c.tpImunidade,
      issRetido: c.issRetido,
      informacoesAdicionais: c.informacoesAdicionais,
      periodicidade: c.periodicidade,
      diaEmissao: c.diaEmissao,
      fim: c.fim,
      ativo: c.ativo,
      proximaEmissao: c.proximaEmissao,
    });
    setEditId(c.id);
    setErro(null);
    setAberto(true);
  }

  // Escolher um serviço do catálogo preenche o resto — é o mesmo atalho da
  // emissão avulsa.
  function escolherServico(id: string) {
    const s = servicos.find((x) => x.id === id);
    if (!s) {
      setForm((f) => ({ ...f, servicoId: null }));
      return;
    }
    setForm((f) => ({
      ...f,
      servicoId: s.id,
      nome: f.nome.trim() ? f.nome : s.nome,
      descricaoServico: s.descricao || s.nome,
      cTribNac: s.cTribNac,
      itemListaServico: s.itemListaServico,
      cNBS: s.cNBS,
      aliqISS: s.aliqISS,
      valorServico: s.valorUnit || f.valorServico,
    }));
  }

  function guardar(salvo: Contrato) {
    setContratos((l) => [...l.filter((c) => c.id !== salvo.id), salvo].sort(ordenar));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      guardar(editId ? await atualizarContrato(editId, form) : await criarContrato(form));
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(c: Contrato) {
    try {
      guardar(await alternarContrato(c.id, !c.ativo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  async function remover(c: Contrato) {
    setConfirmar(null);
    try {
      await excluirContrato(c.id);
      setContratos((l) => l.filter((x) => x.id !== c.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  async function emitirAgora(c: Contrato) {
    setEmitirJa(null);
    setEmitindo(c.id);
    setErro(null);
    setAviso(null);
    const r = await emitirContratoAgora(c.id);
    setEmitindo(null);
    if (!r.ok) {
      setErro(r.erro);
    } else {
      setAviso(`NFS-e nº ${r.numero} emitida para ${c.clienteNome}.`);
    }
    setContratos(await listarContratos());
  }

  const colunas: Coluna<Contrato>[] = [
    {
      chave: "nome",
      cabecalho: "Contrato",
      valor: (c) => c.nome,
      render: (c) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{c.nome}</div>
          <div className="truncate text-xs text-[var(--muted)]">{c.clienteNome}</div>
        </div>
      ),
    },
    {
      chave: "periodicidade",
      cabecalho: "Repetição",
      valor: (c) => c.periodicidade,
      render: (c) => (
        <span className="text-xs">
          {PERIODICIDADES.find((p) => p.value === c.periodicidade)?.label} · dia {c.diaEmissao}
        </span>
      ),
    },
    {
      chave: "proxima",
      cabecalho: "Próxima nota",
      valor: (c) => c.proximaEmissao,
      render: (c) => (
        <div className="text-xs">
          <div>{dataBR(c.proximaEmissao)}</div>
          {c.notasGeradas > 0 && (
            <div className="text-[var(--muted)]">{c.notasGeradas} já emitidas</div>
          )}
        </div>
      ),
    },
    {
      chave: "valor",
      cabecalho: "Valor",
      alinhar: "right",
      valor: (c) => c.valorServico,
      render: (c) => <span className="font-medium">{formatBRL(c.valorServico)}</span>,
    },
    {
      chave: "status",
      cabecalho: "Situação",
      valor: (c) => (c.ativo ? 1 : 0),
      render: (c) =>
        c.ativo ? (
          <Badge tom="success">Ativo</Badge>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <Badge tom="warning">Pausado</Badge>
            {c.ultimoErro && (
              <span className="line-clamp-2 text-[10px] text-[var(--muted)]">{c.ultimoErro}</span>
            )}
          </div>
        ),
    },
    {
      chave: "acoes",
      cabecalho: "",
      alinhar: "right",
      valor: () => "",
      render: (c) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variante="secondary"
            onClick={() => setEmitirJa(c)}
            disabled={!c.ativo || emitindo === c.id}
          >
            {emitindo === c.id ? "Emitindo…" : "Emitir agora"}
          </Button>
          <Button variante="ghost" onClick={() => alternar(c)}>
            {c.ativo ? "Pausar" : "Reativar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Contratos recorrentes"
        subtitulo="A nota de serviço que se repete. Cadastre uma vez e o sistema emite sozinho na data — todo dia de manhã ele confere o que venceu."
        acao={<Button onClick={abrirNovo}>+ Novo contrato</Button>}
      />

      {aviso && (
        <p className="rounded-lg bg-[var(--success-soft,#dcfce7)] px-3 py-2.5 text-sm font-medium text-[var(--success)]">
          {aviso}
        </p>
      )}
      {erro && !aberto && (
        <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2.5 text-sm font-medium text-[var(--danger)]">
          {erro}
        </p>
      )}

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <Input
            placeholder="Buscar por contrato ou tomador"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
          />
        </div>

        {carregando ? (
          <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">Carregando…</div>
        ) : (
          <>
            <Tabela
              colunas={colunas}
              dados={pag.fatia}
              onRowClick={abrirEdicao}
              vazio={
                <EmptyState
                  titulo="Nenhum contrato"
                  descricao="Cadastre um contrato para as notas que você emite todo mês para o mesmo cliente."
                />
              }
            />
            <Paginacao
              total={filtrados.length}
              pagina={pag.pagina}
              paginas={pag.paginas}
              porPagina={porPagina}
              onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
              rotulo="contrato"
            />
          </>
        )}
      </Card>

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={editId ? "Editar contrato" : "Novo contrato"}
        rodape={
          <div className="flex w-full items-center justify-between gap-2">
            {editId ? (
              <Button
                variante="danger"
                onClick={() => {
                  const c = contratos.find((x) => x.id === editId);
                  if (c) { setAberto(false); setConfirmar(c); }
                }}
                disabled={salvando}
              >
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variante="secondary" onClick={() => setAberto(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando || !form.nome.trim()}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {erro && aberto && (
            <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm text-[var(--danger)]">{erro}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome do contrato" required hint="Só para você achar depois.">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Mensalidade — Padaria do Zé"
              />
            </Field>
            <Field label="Tomador" required>
              <ClientePicker
                clientes={clientes}
                value={form.clienteId}
                onChange={(id) => setForm({ ...form, clienteId: id })}
                onCriado={(c) => {
                  setClientes((l) => [...l.filter((x) => x.id !== c.id), c]);
                  setForm((f) => ({ ...f, clienteId: c.id }));
                }}
              />
            </Field>
          </div>

          <Field label="Serviço do catálogo" hint="Preenche o resto. Dá para ajustar depois.">
            <Select
              opcoes={[
                { value: "", label: "— avulso —" },
                ...servicos.map((s) => ({ value: s.id, label: s.nome })),
              ]}
              value={form.servicoId ?? ""}
              onChange={(e) => escolherServico(e.target.value)}
            />
          </Field>

          <Field label="Classificação do serviço" required hint="Busque pelo que é feito.">
            <SeletorLC116
              cTribNac={form.cTribNac}
              itemLista={form.itemListaServico}
              onEscolher={(v) =>
                setForm((f) => ({
                  ...f,
                  cTribNac: v.cTribNac,
                  itemListaServico: v.itemListaServico,
                  descricaoServico: f.descricaoServico.trim() ? f.descricaoServico : v.descricao,
                }))
              }
            />
          </Field>

          <Field label="Descrição do serviço" required hint="É o que sai impresso na nota.">
            <Textarea
              rows={2}
              value={form.descricaoServico}
              onChange={(e) => setForm({ ...form, descricaoServico: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Código nacional" required>
              <Input
                value={form.cTribNac}
                onChange={(e) => setForm({ ...form, cTribNac: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="NBS" hint="Opcional, 9 dígitos.">
              <Input
                value={form.cNBS}
                onChange={(e) => setForm({ ...form, cNBS: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Município da prestação" hint="IBGE. Vazio = o da empresa.">
              <Input
                value={form.codMunicipioPrestacao}
                onChange={(e) =>
                  setForm({ ...form, codMunicipioPrestacao: e.target.value.replace(/\D/g, "").slice(0, 7) })
                }
                inputMode="numeric"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Valor do serviço" required>
              <Input
                type="number"
                step="0.01"
                value={form.valorServico || ""}
                onChange={(e) => setForm({ ...form, valorServico: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Tributação do ISS">
              <Select
                opcoes={TRIBUTACAO}
                value={form.tribISSQN}
                onChange={(e) => setForm({ ...form, tribISSQN: e.target.value })}
              />
            </Field>
            <Field label="Alíquota do ISS (%)">
              <Input
                type="number"
                step="0.01"
                value={form.aliqISS || ""}
                disabled={form.tribISSQN !== "1"}
                onChange={(e) => setForm({ ...form, aliqISS: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>

          {form.tribISSQN === "2" && (
            <Field label="Tipo de imunidade" required>
              <Select
                opcoes={IMUNIDADES}
                value={form.tpImunidade}
                onChange={(e) => setForm({ ...form, tpImunidade: e.target.value })}
              />
            </Field>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.issRetido}
              disabled={form.tribISSQN !== "1"}
              onChange={(e) => setForm({ ...form, issRetido: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            ISS retido pelo tomador
          </label>

          <div className="rounded-xl border border-[var(--border)] p-4">
            <p className="mb-3 text-sm font-semibold">Quando emitir</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Repetição">
                <Select
                  opcoes={PERIODICIDADES}
                  value={form.periodicidade}
                  onChange={(e) =>
                    setForm({ ...form, periodicidade: e.target.value as Periodicidade, proximaEmissao: undefined })
                  }
                />
              </Field>
              <Field label="Dia do mês" hint="31 cai no último dia.">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaEmissao}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      diaEmissao: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                      proximaEmissao: undefined,
                    })
                  }
                />
              </Field>
              <Field label="Encerra em" hint="Opcional. Depois desta data para de emitir.">
                <DateBR value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
              </Field>
            </div>
            {editId && form.proximaEmissao && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Próxima nota em {dataBR(form.proximaEmissao)}.
              </p>
            )}
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Contrato ativo (emite sozinho)
            </label>
          </div>

          <Field label="Informações adicionais">
            <Textarea
              rows={2}
              value={form.informacoesAdicionais}
              onChange={(e) => setForm({ ...form, informacoesAdicionais: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        aberto={!!emitirJa}
        onFechar={() => setEmitirJa(null)}
        titulo="Emitir agora"
        largura="max-w-md"
        camada="z-[60]"
        rodape={
          <div className="flex gap-2">
            <Button variante="secondary" onClick={() => setEmitirJa(null)}>Voltar</Button>
            <Button onClick={() => emitirJa && emitirAgora(emitirJa)}>Emitir NFS-e</Button>
          </div>
        }
      >
        <p className="text-sm">
          Emite a nota de <strong>{emitirJa?.nome}</strong> no valor de{" "}
          {emitirJa ? formatBRL(emitirJa.valorServico) : ""} agora, sem esperar o dia{" "}
          {emitirJa?.diaEmissao}. A próxima passa para o período seguinte.
        </p>
      </Modal>

      <Modal
        aberto={!!confirmar}
        onFechar={() => setConfirmar(null)}
        titulo="Excluir contrato"
        largura="max-w-md"
        camada="z-[60]"
        rodape={
          <div className="flex gap-2">
            <Button variante="secondary" onClick={() => setConfirmar(null)}>Voltar</Button>
            <Button variante="danger" onClick={() => confirmar && remover(confirmar)}>Excluir</Button>
          </div>
        }
      >
        <p className="text-sm">
          Remove <strong>{confirmar?.nome}</strong> e para de emitir. As notas já emitidas continuam
          intactas.
        </p>
      </Modal>
    </div>
  );
}

function ordenar(a: Contrato, b: Contrato): number {
  if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
  return a.proximaEmissao.localeCompare(b.proximaEmissao);
}
