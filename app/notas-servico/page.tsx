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
  formatData,
  paginar,
  type Coluna,
} from "@/app/ui/primitives";
import { formatCpfCnpj } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import { listarClientes } from "@/app/clientes/actions";
import ClientePicker from "@/app/notas/nova/ClientePicker";
import { listarServicos, type Servico } from "@/app/servicos/actions";
import {
  baixarXmlNotaServico,
  emitirNotaServico,
  listarNotasServico,
  recuperarNotaServico,
  type EmitirNfseInput,
  type NotaServicoUI,
} from "./actions";

const TRIBUTACAO = [
  { value: "1", label: "Tributável (ISS devido)" },
  { value: "2", label: "Imune" },
  { value: "3", label: "Exportação de serviço" },
  { value: "4", label: "Não incidência" },
];

const TOM_STATUS: Record<string, "neutral" | "success" | "danger" | "warning"> = {
  AUTORIZADA: "success",
  REJEITADA: "danger",
  CANCELADA: "danger",
  RASCUNHO: "warning",
  DENEGADA: "danger",
};

const hoje = () => new Date().toISOString().slice(0, 10);

const VAZIO: EmitirNfseInput = {
  clienteId: "",
  servicoId: null,
  descricao: "",
  cTribNac: "",
  cNBS: "",
  valorServico: 0,
  aliqISS: 0,
  tribISSQN: "1",
  issRetido: false,
  codMunicipioPrestacao: "",
  competencia: "",
  informacoesAdicionais: "",
};

export default function NotasServicoPage() {
  const [notas, setNotas] = useState<NotaServicoUI[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [emitir, setEmitir] = useState(false);
  const [form, setForm] = useState<EmitirNfseInput>({ ...VAZIO, competencia: hoje() });
  const [emitindo, setEmitindo] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [detalhe, setDetalhe] = useState<NotaServicoUI | null>(null);

  useEffect(() => {
    Promise.all([listarNotasServico(), listarServicos(), listarClientes()])
      .then(([n, s, c]) => {
        setNotas(n);
        setServicos(s);
        setClientes(c);
      })
      .finally(() => setCarregando(false));
  }, []);

  const pag = paginar(notas, pagina, porPagina);

  const valorISS = useMemo(
    () => (form.tribISSQN === "1" && form.aliqISS > 0 ? (form.valorServico * form.aliqISS) / 100 : 0),
    [form.tribISSQN, form.aliqISS, form.valorServico],
  );

  async function recarregar() {
    const n = await listarNotasServico();
    setNotas(n);
    setPagina(1);
  }

  function abrirEmissao() {
    setForm({ ...VAZIO, competencia: hoje() });
    setMsg(null);
    setEmitir(true);
  }

  // Escolher um serviço do catálogo preenche o resto — o operador só confere.
  function escolherServico(id: string) {
    const s = servicos.find((x) => x.id === id);
    if (!s) {
      setForm((f) => ({ ...f, servicoId: null }));
      return;
    }
    setForm((f) => ({
      ...f,
      servicoId: s.id,
      descricao: s.descricao || s.nome,
      cTribNac: s.cTribNac,
      cNBS: s.cNBS,
      aliqISS: s.aliqISS,
      valorServico: s.valorUnit || f.valorServico,
    }));
  }

  async function transmitir() {
    setEmitindo(true);
    setMsg(null);
    const r = await emitirNotaServico(form);
    setEmitindo(false);
    if (!r.ok) {
      setMsg({ tom: "erro", texto: r.erro });
      if (r.id) await recarregar();
      return;
    }
    setMsg({ tom: "ok", texto: `NFS-e nº ${r.numero} autorizada.` });
    setEmitir(false);
    await recarregar();
  }

  async function recuperar(nota: NotaServicoUI) {
    const r = await recuperarNotaServico(nota.id);
    setMsg(r.ok ? { tom: "ok", texto: "Nota recuperada — estava autorizada no fisco." } : { tom: "erro", texto: r.erro });
    await recarregar();
    setDetalhe(null);
  }

  async function baixarXml(nota: NotaServicoUI) {
    const r = await baixarXmlNotaServico(nota.id);
    if (!r.ok) {
      setMsg({ tom: "erro", texto: r.erro });
      return;
    }
    const url = URL.createObjectURL(new Blob([r.xml], { type: "application/xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  const colunas: Coluna<NotaServicoUI>[] = [
    {
      chave: "numero",
      cabecalho: "Nº",
      valor: (n) => n.numero,
      render: (n) => <span className="font-mono text-xs">#{n.numero}</span>,
    },
    {
      chave: "cliente",
      cabecalho: "Tomador",
      valor: (n) => n.clienteNome,
      render: (n) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{n.clienteNome}</div>
          {n.clienteDocumento && (
            <div className="text-xs text-[var(--muted)]">{formatCpfCnpj(n.clienteDocumento)}</div>
          )}
        </div>
      ),
    },
    {
      chave: "descricao",
      cabecalho: "Serviço",
      valor: (n) => n.descricaoServico,
      render: (n) => <span className="line-clamp-2 text-sm text-[var(--muted)]">{n.descricaoServico}</span>,
    },
    {
      chave: "emitidaEm",
      cabecalho: "Emitida",
      valor: (n) => n.emitidaEm,
      render: (n) => formatData(n.emitidaEm),
    },
    {
      chave: "valor",
      cabecalho: "Valor",
      alinhar: "right",
      valor: (n) => n.valorServico,
      render: (n) => <span className="font-medium">{formatBRL(n.valorServico)}</span>,
    },
    {
      chave: "status",
      cabecalho: "Status",
      valor: (n) => n.status,
      render: (n) => <Badge tom={TOM_STATUS[n.status] ?? "neutral"}>{n.status.toLowerCase()}</Badge>,
    },
  ];

  const podeEmitir =
    form.clienteId !== "" && form.descricao.trim() !== "" && form.cTribNac.length === 6 && form.valorServico > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notas de serviço"
        subtitulo="NFS-e do Padrão Nacional. Uma nota por serviço prestado."
        acao={<Button onClick={abrirEmissao}>+ Emitir NFS-e</Button>}
      />

      {msg && !emitir && (
        <p
          className={
            "rounded-lg px-3 py-2.5 text-sm font-medium " +
            (msg.tom === "erro"
              ? "bg-[var(--danger-soft,#fee2e2)] text-[var(--danger)]"
              : "bg-[var(--success-soft)] text-[var(--success)]")
          }
        >
          {msg.texto}
        </p>
      )}

      <Card>
        {carregando ? (
          <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">Carregando…</div>
        ) : (
          <>
            <Tabela
              colunas={colunas}
              dados={pag.fatia}
              onRowClick={setDetalhe}
              vazio={
                <EmptyState
                  titulo="Nenhuma nota de serviço"
                  descricao="Cadastre os serviços da empresa e emita a primeira NFS-e."
                />
              }
            />
            <Paginacao
              total={notas.length}
              pagina={pag.pagina}
              paginas={pag.paginas}
              porPagina={porPagina}
              onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
              rotulo="nota"
            />
          </>
        )}
      </Card>

      {/* Emissão */}
      <Modal
        aberto={emitir}
        onFechar={() => setEmitir(false)}
        titulo="Emitir nota de serviço"
        rodape={
          <div className="flex gap-2">
            <Button variante="secondary" onClick={() => setEmitir(false)} disabled={emitindo}>
              Cancelar
            </Button>
            <Button onClick={transmitir} disabled={emitindo || !podeEmitir}>
              {emitindo ? "Transmitindo…" : "Emitir"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {msg && emitir && (
            <p
              className={
                "rounded-lg px-3 py-2 text-sm " +
                (msg.tom === "erro"
                  ? "bg-[var(--danger-soft,#fee2e2)] text-[var(--danger)]"
                  : "bg-[var(--success-soft)] text-[var(--success)]")
              }
            >
              {msg.texto}
            </p>
          )}

          <Field label="Tomador (quem contratou)" required>
            <ClientePicker
              clientes={clientes}
              value={form.clienteId}
              onChange={(id) => setForm({ ...form, clienteId: id })}
              onCriado={(c) => {
                setClientes((l) => [c, ...l.filter((x) => x.id !== c.id)]);
                setForm((f) => ({ ...f, clienteId: c.id }));
              }}
            />
          </Field>

          <Field label="Serviço do catálogo" hint="Preenche o resto. Dá para ajustar depois de escolher.">
            <Select
              opcoes={[
                { value: "", label: "— avulso —" },
                ...servicos.map((s) => ({ value: s.id, label: s.nome })),
              ]}
              value={form.servicoId ?? ""}
              onChange={(e) => escolherServico(e.target.value)}
            />
          </Field>

          <Field label="Descrição do serviço" required hint="É o que sai impresso na nota.">
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Código de tributação nacional" required hint="6 dígitos.">
              <Input
                value={form.cTribNac}
                onChange={(e) => setForm({ ...form, cTribNac: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Valor do serviço" required>
              <Input
                type="number"
                step="0.01"
                value={form.valorServico || ""}
                onChange={(e) => setForm({ ...form, valorServico: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tributação do ISS">
              <Select
                opcoes={TRIBUTACAO}
                value={form.tribISSQN}
                onChange={(e) => setForm({ ...form, tribISSQN: e.target.value })}
              />
            </Field>
            <Field
              label="Alíquota do ISS (%)"
              hint={valorISS > 0 ? `ISS de ${formatBRL(valorISS)}` : undefined}
            >
              <Input
                type="number"
                step="0.01"
                value={form.aliqISS || ""}
                disabled={form.tribISSQN !== "1"}
                onChange={(e) => setForm({ ...form, aliqISS: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.issRetido}
              disabled={form.tribISSQN !== "1"}
              onChange={(e) => setForm({ ...form, issRetido: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            ISS retido pelo tomador
            <span className="text-xs text-[var(--muted)]">(quem contratou é quem recolhe)</span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Competência" hint="Mês a que o serviço se refere.">
              <DateBR
                value={form.competencia}
                onChange={(e) => setForm({ ...form, competencia: e.target.value })}
              />
            </Field>
            <Field label="Município da prestação" hint="Código IBGE. Vazio = o da empresa.">
              <Input
                value={form.codMunicipioPrestacao}
                onChange={(e) =>
                  setForm({ ...form, codMunicipioPrestacao: e.target.value.replace(/\D/g, "").slice(0, 7) })
                }
                inputMode="numeric"
              />
            </Field>
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

      {/* Detalhe */}
      <Modal
        aberto={!!detalhe}
        onFechar={() => setDetalhe(null)}
        titulo={detalhe ? `NFS-e nº ${detalhe.numero}` : ""}
        largura="max-w-lg"
        rodape={
          detalhe && (
            <div className="flex gap-2">
              {/* Rascunho = transmitiu e não veio resposta. A nota pode estar
                  autorizada no fisco; reemitir criaria duplicidade. */}
              {detalhe.status === "RASCUNHO" && (
                <Button variante="secondary" onClick={() => void recuperar(detalhe)}>
                  Consultar no fisco
                </Button>
              )}
              {detalhe.chaveAcesso && (
                <Button variante="secondary" onClick={() => void baixarXml(detalhe)}>
                  Baixar XML
                </Button>
              )}
            </div>
          )
        }
      >
        {detalhe && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge tom={TOM_STATUS[detalhe.status] ?? "neutral"}>{detalhe.status.toLowerCase()}</Badge>
              <span className="text-[var(--muted)]">série {detalhe.serie}</span>
            </div>
            <Linha rotulo="Tomador" valor={detalhe.clienteNome} />
            {detalhe.clienteDocumento && (
              <Linha rotulo="CPF/CNPJ" valor={formatCpfCnpj(detalhe.clienteDocumento)} />
            )}
            <Linha rotulo="Serviço" valor={detalhe.descricaoServico} />
            <Linha rotulo="Valor" valor={formatBRL(detalhe.valorServico)} />
            {detalhe.valorISS !== null && <Linha rotulo="ISS" valor={formatBRL(detalhe.valorISS)} />}
            <Linha rotulo="Competência" valor={formatData(detalhe.competencia)} />
            <Linha rotulo="Emitida em" valor={formatData(detalhe.emitidaEm)} />
            {detalhe.chaveAcesso && (
              <Linha
                rotulo="Chave"
                valor={<span className="break-all font-mono text-xs">{detalhe.chaveAcesso}</span>}
              />
            )}
            {detalhe.motivo && (
              <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm text-[var(--danger)]">
                {detalhe.motivo}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-32 shrink-0 text-xs uppercase tracking-wider text-[var(--muted)]">{rotulo}</span>
      <span className="min-w-0">{valor}</span>
    </div>
  );
}
