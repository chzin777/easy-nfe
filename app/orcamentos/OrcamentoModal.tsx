"use client";

import { useMemo, useState } from "react";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { Field, Input, Select, Textarea, SectionTitle } from "@/app/ui/primitives";
import { formatBRL } from "@/lib/format";
import { TIPOS_NOTA } from "@/lib/mock-data";
import type { Cliente, Produto, Transportadora } from "@/lib/types";
import type { Servico } from "@/app/servicos/actions";
import type { DescontoTipo } from "@/app/notas/actions";
import ClientePicker from "@/app/notas/nova/ClientePicker";
import ProdutoPicker from "@/app/notas/nova/ProdutoPicker";
import ServicoPicker from "./ServicoPicker";
import { QtyStepper, DescInput, PrecoInput } from "@/app/ui/ItensFields";
import {
  criarOrcamento,
  atualizarOrcamento,
  type OrcamentoCompleto,
  type OrcamentoInput,
} from "./actions";
import { tipoOrcamentoDe, type TipoOrcamento } from "./tipos";
import { IconBox, IconWrench, IconLayers, IconInfo, IconCheck } from "./Icones";

// Uma linha do orçamento — pode ser de produto ou de serviço.
type Linha = {
  id: string;
  refId: string;
  tipo: "produto" | "servico";
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  precoOriginal: number;
  descTipo: DescontoTipo;
  descValor: number;
};

// Data local de hoje (yyyy-mm-dd) — evita o desvio de fuso do toISOString (UTC).
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Preço atual do catálogo, para saber se a linha salva foi ajustada à mão.
function precoCadastro(refId: string, produtos: Produto[], servicos: Servico[]): number | null {
  const p = produtos.find((x) => x.id === refId);
  if (p) return p.preco;
  const s = servicos.find((x) => x.id === refId);
  return s ? s.valorUnit : null;
}

function calcDesc(base: number, tipo: DescontoTipo, valor: number): number {
  if (!valor || valor <= 0) return 0;
  const v = tipo === "percent" ? (base * valor) / 100 : valor;
  return Math.min(Math.max(v, 0), base);
}

export default function OrcamentoModal({
  inicial,
  clientes,
  produtos,
  servicos,
  temNfse,
  transportadoras,
  casas,
  onClientes,
  onProdutos,
  onServicos,
  onSalvo,
  onFechar,
}: {
  inicial?: OrcamentoCompleto | null;
  clientes: Cliente[];
  produtos: Produto[];
  servicos: Servico[];
  temNfse: boolean;
  transportadoras: Transportadora[];
  casas: number;
  onClientes: (c: Cliente) => void;
  onProdutos: (p: Produto) => void;
  onServicos?: (s: Servico) => void;
  onSalvo: (o: OrcamentoCompleto) => void;
  onFechar: () => void;
}) {
  const [tipoOrcamento, setTipoOrcamento] = useState<TipoOrcamento>(() =>
    inicial ? tipoOrcamentoDe(inicial.tipoNota, inicial.itens) : "produto",
  );

  const [clienteId, setClienteId] = useState(inicial?.clienteId ?? "");
  const [transportadoraId, setTransportadoraId] = useState(inicial?.transportadoraId ?? "");
  const [modeloProduto, setModeloProduto] = useState(
    inicial?.tipoNota.includes("65") ? "65-saida" : "55-saida",
  );
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");
  const [validade, setValidade] = useState(inicial?.validade ?? hojeISO());
  const [descNota, setDescNota] = useState<{ tipo: DescontoTipo; valor: number }>(
    inicial?.desconto ?? { tipo: "valor", valor: 0 },
  );

  const [itens, setItens] = useState<Linha[]>(
    inicial?.itens.map((i) => {
      const isServ = !!i.servicoId;
      const refId = i.servicoId ?? i.produtoId ?? "";
      return {
        id: `${isServ ? "servico" : "produto"}-${refId}`,
        refId,
        tipo: isServ ? "servico" : "produto",
        nome: i.nome,
        unidade: i.unidade,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        precoOriginal: precoCadastro(refId, produtos, servicos) ?? i.precoUnitario,
        descTipo: i.descTipo,
        descValor: i.descValor,
      };
    }) ?? [],
  );

  const [abaAdicionar, setAbaAdicionar] = useState<"produto" | "servico">("produto");
  const [produtoSel, setProdutoSel] = useState("");
  const [servicoSel, setServicoSel] = useState("");
  const [qtd, setQtd] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Alterna o tipo do orçamento preservando itens compatíveis
  function mudarTipoOrcamento(novo: TipoOrcamento) {
    if (novo === tipoOrcamento) return;
    setTipoOrcamento(novo);
    if (novo === "produto") {
      setItens((l) => l.filter((x) => x.tipo === "produto"));
    } else if (novo === "servico") {
      setItens((l) => l.filter((x) => x.tipo === "servico"));
    }
  }

  const modoAdicionar = tipoOrcamento === "ambos" ? abaAdicionar : tipoOrcamento;
  const rotuloItem = modoAdicionar === "servico" ? "Serviço" : "Produto";

  const subtotais = useMemo(() => {
    let prod = 0;
    let serv = 0;
    let qtdProd = 0;
    let qtdServ = 0;
    for (const i of itens) {
      const bruto = i.quantidade * i.precoUnitario;
      const liq = bruto - calcDesc(bruto, i.descTipo, i.descValor);
      if (i.tipo === "servico") {
        serv += liq;
        qtdServ++;
      } else {
        prod += liq;
        qtdProd++;
      }
    }
    return { prod, serv, qtdProd, qtdServ };
  }, [itens]);

  const totais = useMemo(() => {
    const liquidoItens = itens.reduce((s, i) => {
      const bruto = i.quantidade * i.precoUnitario;
      return s + (bruto - calcDesc(bruto, i.descTipo, i.descValor));
    }, 0);
    const geral = calcDesc(liquidoItens, descNota.tipo, descNota.valor);
    return { total: liquidoItens - geral };
  }, [itens, descNota]);

  function juntar(linha: Linha) {
    setItens((lista) => {
      const ex = lista.find((i) => i.id === linha.id);
      if (ex) return lista.map((i) => (i.id === linha.id ? { ...i, quantidade: i.quantidade + linha.quantidade } : i));
      return [...lista, linha];
    });
  }

  function adicionar() {
    if (qtd <= 0) return;
    if (modoAdicionar === "servico") {
      const sv = servicos.find((x) => x.id === servicoSel);
      if (!sv) return;
      juntar({
        id: `servico-${sv.id}`,
        refId: sv.id,
        tipo: "servico",
        nome: sv.nome,
        unidade: "UN",
        quantidade: qtd,
        precoUnitario: sv.valorUnit,
        precoOriginal: sv.valorUnit,
        descTipo: "valor",
        descValor: 0,
      });
      setServicoSel("");
    } else {
      const p = produtos.find((x) => x.id === produtoSel);
      if (!p) return;
      juntar({
        id: `produto-${p.id}`,
        refId: p.id,
        tipo: "produto",
        nome: p.nome,
        unidade: p.unidade,
        quantidade: qtd,
        precoUnitario: p.preco,
        precoOriginal: p.preco,
        descTipo: "valor",
        descValor: 0,
      });
      setProdutoSel("");
    }
    setQtd(1);
  }

  const menorQtd = casas > 0 ? Number(Math.pow(10, -casas).toFixed(casas)) : 1;
  function definirQtd(id: string, v: number) {
    setItens((l) => l.map((x) => (x.id === id ? { ...x, quantidade: Math.max(menorQtd, Number(v.toFixed(casas))) } : x)));
  }
  function definirPreco(id: string, v: number) {
    setItens((l) => l.map((x) => (x.id === id ? { ...x, precoUnitario: Math.max(0, Number(v.toFixed(2))) } : x)));
  }
  function definirDesc(id: string, patch: Partial<Pick<Linha, "descTipo" | "descValor">>) {
    setItens((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removerItem(id: string) {
    setItens((l) => l.filter((x) => x.id !== id));
  }

  async function salvar() {
    setErro(null);
    if (!clienteId) { setErro("Selecione o cliente."); return; }
    if (!itens.length) {
      if (tipoOrcamento === "servico") setErro("Adicione ao menos um serviço.");
      else if (tipoOrcamento === "produto") setErro("Adicione ao menos um produto.");
      else setErro("Adicione ao menos um produto ou serviço.");
      return;
    }
    setSalvando(true);
    try {
      const tipoNotaFinal =
        tipoOrcamento === "servico"
          ? "nfse"
          : tipoOrcamento === "ambos"
          ? modeloProduto.includes("65") ? "misto-65" : "misto-55"
          : modeloProduto.includes("65") ? "65-saida" : "55-saida";

      const payload: OrcamentoInput = {
        clienteId,
        transportadoraId: tipoOrcamento === "servico" ? null : transportadoraId || null,
        tipoNota: tipoNotaFinal,
        modFrete: "9",
        observacoes,
        validade: validade || null,
        desconto: descNota,
        itens: itens.map((i) => ({
          ...(i.tipo === "servico" ? { servicoId: i.refId } : { produtoId: i.refId }),
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          descTipo: i.descTipo,
          descValor: i.descValor,
        })),
      };
      const o = inicial ? await atualizarOrcamento(inicial.id, payload) : await criarOrcamento(payload);
      onSalvo(o);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  const total = totais.total;

  return (
    <StepperModal onFechar={onFechar} largura="max-w-3xl">
      <Stepper
        cabecalho={
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold">{inicial ? `Orçamento #${inicial.numero}` : "Novo orçamento"}</span>
            <span className="text-sm text-[var(--muted)]">Total: <b className="text-[var(--foreground)]">{formatBRL(total)}</b></span>
          </div>
        }
        completeButtonText={salvando ? "Salvando…" : inicial ? "Salvar alterações" : "Criar orçamento"}
        onFinalStepCompleted={salvar}
        canProceed={(s) => {
          if (s === 1) return clienteId !== "";
          if (s === 2) return itens.length > 0;
          return true;
        }}
      >
        {/* Etapa 1 — Cliente e dados gerais (com seletor do tipo de orçamento) */}
        <Step>
          <SectionTitle>Cliente e dados gerais</SectionTitle>

          {/* Seletor visual do tipo de orçamento */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Tipo de orçamento
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Opção Produto */}
              <button
                type="button"
                onClick={() => mudarTipoOrcamento("produto")}
                className={`group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  tipoOrcamento === "produto"
                    ? "border-[var(--primary)] bg-gradient-to-br from-indigo-50/80 to-white shadow-sm ring-2 ring-[var(--primary)]/20"
                    : "border-[var(--border)] bg-white hover:border-slate-300 hover:bg-slate-50/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <IconBox className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">Produtos</span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">Venda de mercadorias (NF-e / NFC-e)</p>
                {tipoOrcamento === "produto" && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                    <IconCheck className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>

              {/* Opção Serviço */}
              <button
                type="button"
                onClick={() => mudarTipoOrcamento("servico")}
                className={`group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  tipoOrcamento === "servico"
                    ? "border-[var(--primary)] bg-gradient-to-br from-purple-50/80 to-white shadow-sm ring-2 ring-[var(--primary)]/20"
                    : "border-[var(--border)] bg-white hover:border-slate-300 hover:bg-slate-50/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <IconWrench className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">Serviços</span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">Prestação de serviços (NFS-e)</p>
                {tipoOrcamento === "servico" && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                    <IconCheck className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>

              {/* Opção Ambos */}
              <button
                type="button"
                onClick={() => mudarTipoOrcamento("ambos")}
                className={`group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  tipoOrcamento === "ambos"
                    ? "border-[var(--primary)] bg-gradient-to-br from-violet-50/80 to-white shadow-sm ring-2 ring-[var(--primary)]/20"
                    : "border-[var(--border)] bg-white hover:border-slate-300 hover:bg-slate-50/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 items-center justify-center gap-1 rounded-lg bg-emerald-100 px-2 text-emerald-700">
                    <IconBox className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-[10px] font-bold text-emerald-500">+</span>
                    <IconWrench className="h-3.5 w-3.5 shrink-0" />
                  </span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">Ambos</span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">Produtos e serviços no mesmo orçamento</p>
                {tipoOrcamento === "ambos" && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                    <IconCheck className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cliente" required>
              <ClientePicker clientes={clientes} value={clienteId} onChange={setClienteId} onCriado={(c) => { onClientes(c); setClienteId(c.id); }} />
            </Field>

            {tipoOrcamento !== "servico" ? (
              <Field label={tipoOrcamento === "ambos" ? "Modelo da nota (produtos)" : "Modelo da nota (ao fechar)"}>
                <Select
                  opcoes={TIPOS_NOTA}
                  value={modeloProduto}
                  onChange={(e) => setModeloProduto(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Modelo da nota (ao fechar)">
                <Input value="NFS-e (Nota de Serviço Municipal)" disabled />
              </Field>
            )}

            {tipoOrcamento !== "servico" && (
              <Field label={tipoOrcamento === "ambos" ? "Transportadora (produtos)" : "Transportadora"}>
                <Select
                  opcoes={[{ value: "", label: "— sem transportadora —" }, ...transportadoras.map((t) => ({ value: t.id, label: t.nome }))]}
                  value={transportadoraId}
                  onChange={(e) => setTransportadoraId(e.target.value)}
                />
              </Field>
            )}

            <Field label="Validade do orçamento">
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </Field>
          </div>
        </Step>

        {/* Etapa 2 — Produtos, Serviços ou Ambos */}
        <Step>
          <SectionTitle>
            {tipoOrcamento === "ambos"
              ? "Itens do orçamento (Produtos e Serviços)"
              : tipoOrcamento === "servico"
              ? "Serviços"
              : "Produtos"}
          </SectionTitle>

          {/* Em modo "ambos", seletor para escolher se adiciona produto ou serviço */}
          {tipoOrcamento === "ambos" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-slate-50/70 p-2">
              <div className="flex items-center gap-1.5">
                <span className="px-1 text-xs font-semibold text-[var(--muted)]">Adicionar item:</span>
                <button
                  type="button"
                  onClick={() => setAbaAdicionar("produto")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    abaAdicionar === "produto"
                      ? "bg-white text-[var(--primary)] shadow-sm ring-1 ring-[var(--border)]"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <IconBox className="h-3.5 w-3.5" /> Produto ({subtotais.qtdProd})
                </button>
                <button
                  type="button"
                  onClick={() => setAbaAdicionar("servico")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    abaAdicionar === "servico"
                      ? "bg-white text-[var(--primary)] shadow-sm ring-1 ring-[var(--border)]"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <IconWrench className="h-3.5 w-3.5" /> Serviço ({subtotais.qtdServ})
                </button>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {itens.length} {itens.length === 1 ? "item adicionado" : "itens adicionados"}
              </span>
            </div>
          )}

          {/* Formulário de adição de item */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label={rotuloItem}>
              {modoAdicionar === "servico" ? (
                <ServicoPicker
                  servicos={servicos}
                  value={servicoSel}
                  onChange={setServicoSel}
                  onCriado={(s) => {
                    onServicos?.(s);
                    setServicoSel(s.id);
                  }}
                />
              ) : (
                <ProdutoPicker produtos={produtos} value={produtoSel} onChange={setProdutoSel} onCriado={(p) => { onProdutos(p); setProdutoSel(p.id); }} />
              )}
            </Field>
            <Field label="Quantidade">
              <QtyStepper valor={qtd} onChange={setQtd} casas={casas} />
            </Field>
            <button
              type="button"
              onClick={adicionar}
              disabled={modoAdicionar === "servico" ? !servicoSel : !produtoSel}
              title={(modoAdicionar === "servico" ? !servicoSel : !produtoSel) ? `Selecione um ${rotuloItem.toLowerCase()} primeiro` : `Adicionar ${rotuloItem.toLowerCase()} ao orçamento`}
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--success)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Adicionar
            </button>
          </div>

          {modoAdicionar === "servico" ? (
            servicos.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--warning)]">
                Nenhum serviço cadastrado.{" "}
                <a href="/servicos" className="font-medium underline">Cadastre um serviço</a> para adicioná-lo.
              </p>
            ) : !servicoSel ? (
              <p className="mt-2 text-xs text-[var(--muted)]">Selecione um serviço no campo acima para habilitar “Adicionar”.</p>
            ) : null
          ) : produtos.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--warning)]">
              Nenhum produto cadastrado.{" "}
              <a href="/produtos" className="font-medium underline">Cadastre ou importe um produto</a> para adicioná-lo.
            </p>
          ) : !produtoSel ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Selecione um produto no campo acima para habilitar “Adicionar”.</p>
          ) : null}

          {/* Mobile: cards com quantidade ± */}
          <div className="mt-5 space-y-2.5 sm:hidden">
            {itens.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                {tipoOrcamento === "ambos"
                  ? "Nenhum item adicionado."
                  : tipoOrcamento === "servico"
                  ? "Nenhum serviço adicionado."
                  : "Nenhum produto adicionado."}
              </p>
            ) : (
              <>
                {itens.map((i) => (
                  <div key={i.id} className="rounded-xl border border-[var(--border)] bg-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {tipoOrcamento === "ambos" && (
                            <span
                              title={i.tipo === "servico" ? "Serviço" : "Produto"}
                              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                                i.tipo === "servico" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {i.tipo === "servico" ? (
                                <IconWrench className="h-3 w-3" />
                              ) : (
                                <IconBox className="h-3 w-3" />
                              )}
                            </span>
                          )}
                          <p className="truncate font-medium">{i.nome}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          preço por {i.tipo === "servico" ? "serviço" : "unidade"}
                        </p>
                      </div>
                      <button onClick={() => removerItem(i.id)} aria-label="Remover item" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] transition hover:bg-red-100">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Preço un.</span>
                      <PrecoInput valor={i.precoUnitario} original={i.precoOriginal} onChange={(v) => definirPreco(i.id, v)} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QtyStepper valor={i.quantidade} onChange={(v) => definirQtd(i.id, v)} casas={casas} />
                      <span className="text-base font-semibold">{formatBRL(i.quantidade * i.precoUnitario - calcDesc(i.quantidade * i.precoUnitario, i.descTipo, i.descValor))}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Desconto</span>
                      <DescInput tipo={i.descTipo} valor={i.descValor} onTipo={(t) => definirDesc(i.id, { descTipo: t })} onValor={(v) => definirDesc(i.id, { descValor: v })} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Desktop: tabela */}
          <div className="mt-5 hidden overflow-x-auto rounded-lg border border-[var(--border)] sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-2.5">
                    {tipoOrcamento === "ambos" ? "Item / Tipo" : rotuloItem}
                  </th>
                  <th className="px-4 py-2.5 text-center">Qtd.</th>
                  <th className="px-4 py-2.5 text-right">Preço un.</th>
                  <th className="px-4 py-2.5 text-center">Desconto</th>
                  <th className="px-4 py-2.5 text-right">Subtotal</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                      {tipoOrcamento === "ambos"
                        ? "Nenhum item adicionado."
                        : tipoOrcamento === "servico"
                        ? "Nenhum serviço adicionado."
                        : "Nenhum produto adicionado."}
                    </td>
                  </tr>
                ) : (
                  itens.map((i) => (
                    <tr key={i.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {tipoOrcamento === "ambos" && (
                            <span
                              title={i.tipo === "servico" ? "Serviço" : "Produto"}
                              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                                i.tipo === "servico" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {i.tipo === "servico" ? (
                                <IconWrench className="h-3 w-3" />
                              ) : (
                                <IconBox className="h-3 w-3" />
                              )}
                            </span>
                          )}
                          <span>{i.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><div className="flex justify-center"><QtyStepper valor={i.quantidade} onChange={(v) => definirQtd(i.id, v)} casas={casas} compacto /></div></td>
                      <td className="px-4 py-3 text-right"><div className="flex justify-end"><PrecoInput valor={i.precoUnitario} original={i.precoOriginal} onChange={(v) => definirPreco(i.id, v)} compacto /></div></td>
                      <td className="px-4 py-3"><div className="flex justify-center"><DescInput tipo={i.descTipo} valor={i.descValor} onTipo={(t) => definirDesc(i.id, { descTipo: t })} onValor={(v) => definirDesc(i.id, { descValor: v })} /></div></td>
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(i.quantidade * i.precoUnitario - calcDesc(i.quantidade * i.precoUnitario, i.descTipo, i.descValor))}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removerItem(i.id)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {itens.length > 0 && (
                <tfoot>
                  {tipoOrcamento === "ambos" && subtotais.qtdProd > 0 && subtotais.qtdServ > 0 && (
                    <tr className="border-t border-[var(--border)] bg-slate-50 text-xs text-[var(--muted)]">
                      <td colSpan={4} className="px-4 py-2 text-right">
                        Subtotal Produtos ({subtotais.qtdProd}): <b className="text-slate-700">{formatBRL(subtotais.prod)}</b> · Subtotal Serviços ({subtotais.qtdServ}): <b className="text-slate-700">{formatBRL(subtotais.serv)}</b>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium">Total do orçamento</td>
                    <td className="px-4 py-3 text-right text-base font-semibold text-[var(--primary)]">{formatBRL(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Step>

        {/* Etapa 3 — Desconto e observações */}
        <Step>
          <SectionTitle>Desconto e observações</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Desconto geral">
              <div className="flex items-center gap-2">
                <Input inputMode="decimal" value={descNota.valor ? String(descNota.valor).replace(".", ",") : ""}
                  onChange={(e) => setDescNota((d) => ({ ...d, valor: Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0 }))} />
                <select className="rounded-lg border border-[var(--border)] px-2 py-2.5 text-sm" value={descNota.tipo}
                  onChange={(e) => setDescNota((d) => ({ ...d, tipo: e.target.value as DescontoTipo }))}>
                  <option value="valor">R$</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </Field>
            <Field label="Observações">
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Condições, prazo de entrega, etc." rows={3} className="resize-none" />
            </Field>
          </div>
          {tipoOrcamento === "ambos" && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-sky-200/80 bg-sky-50/70 p-3 text-xs text-sky-900">
              <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <span className="leading-relaxed">
                Ao fechar a venda, os produtos deste orçamento gerarão uma NF-e e os serviços gerarão NFS-e. O desconto geral será rateado proporcionalmente.
              </span>
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <span className="text-sm text-[var(--muted)]">Total do orçamento:</span>
            <span className="text-lg font-bold">{formatBRL(total)}</span>
          </div>
        </Step>
      </Stepper>
      {erro && <p className="mt-2 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </StepperModal>
  );
}
