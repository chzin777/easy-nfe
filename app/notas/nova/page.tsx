"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  Textarea,
} from "@/app/ui/primitives";
import { formatBRL } from "@/lib/format";
import Modal from "@/app/ui/Modal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { TIPOS_NOTA, MODALIDADES_FRETE, rotulo } from "@/lib/mock-data";
import type { ItemNota, Cliente, Produto, Transportadora } from "@/lib/types";

// Item da nota com desconto opcional (não persiste no tipo base).
type LinhaItem = ItemNota & { descTipo: DescontoTipo; descValor: number };

// Desconto aplicado a um valor base (R$ ou %), limitado ao próprio valor.
function calcDesc(base: number, tipo: DescontoTipo, valor: number): number {
  if (!valor || valor <= 0) return 0;
  const v = tipo === "percent" ? (base * valor) / 100 : valor;
  return Math.min(Math.max(v, 0), base);
}
import { emitirNota, obterNota, type EmitirInput, type EmitirResultado, type NotaCompleta, type DescontoTipo } from "../actions";
import VisualizarDanfeModal from "../VisualizarDanfeModal";
import { explicarRejeicao } from "@/lib/nfe/mensagens";
import { listarClientes } from "@/app/clientes/actions";
import NovoClienteModal from "@/app/clientes/NovoClienteModal";
import NovoProdutoModal from "@/app/produtos/NovoProdutoModal";
import ClientePicker from "./ClientePicker";
import ProdutoPicker from "./ProdutoPicker";
import TransportadoraPicker from "./TransportadoraPicker";
import TourEmissao from "./TourEmissao";
import { listarProdutos } from "@/app/produtos/actions";
import { listarTransportadoras } from "@/app/transportadoras/actions";
import { obterCasasDecimaisQtd, obterPadroesEmissao, type PadroesEmissao } from "@/app/configuracoes/actions";
import { QtyStepper, DescInput } from "@/app/ui/ItensFields";

// Arredonda para N casas decimais (evita lixo de ponto flutuante).
function arred(v: number, casas: number) {
  return Number(v.toFixed(casas));
}
// Formata a quantidade conforme as casas decimais configuradas (vírgula BR).
function fmtQtd(v: number, casas: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

export default function NovaNotaPage() {
  const [tipoNota, setTipoNota] = useState("55-saida");
  const [clienteId, setClienteId] = useState("");
  const [transportadoraId, setTransportadoraId] = useState("");
  const [modFrete, setModFrete] = useState("9");
  const [info, setInfo] = useState("");
  const [itens, setItens] = useState<LinhaItem[]>([]);
  const [descNota, setDescNota] = useState<{ tipo: DescontoTipo; valor: number }>({ tipo: "valor", valor: 0 });

  const [produtoSel, setProdutoSel] = useState("");
  const [qtd, setQtd] = useState(1);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [casas, setCasas] = useState(2);
  // Padrões de emissão (configurados em Configurações → Padrões de emissão).
  const PADRAO_INICIAL: PadroesEmissao = { tipoNotaPadrao: "55-saida", travarTipoNota: false, definirTransporte: true, modFretePadrao: "9", infoComplementarPadrao: "", clientePadraoId: "" };
  const [padroes, setPadroes] = useState<PadroesEmissao>(PADRAO_INICIAL);

  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<EmitirResultado | null>(null);
  // Nota recém-autorizada: abre o DANFE p/ baixar PDF/XML logo após emitir.
  const [notaEmitida, setNotaEmitida] = useState<NotaCompleta | null>(null);
  const [corrigirCliente, setCorrigirCliente] = useState<Cliente | null>(null);
  const [corrigirProduto, setCorrigirProduto] = useState<Produto | null>(null);
  // Muda a key do Stepper p/ remontá-lo ao recomeçar/voltar a um passo.
  const [formKey, setFormKey] = useState(0);
  // Passo em que o Stepper monta (1 ao recomeçar; 4 ao voltar de uma correção).
  const [passoEmissao, setPassoEmissao] = useState(1);

  // Limpa todos os campos e volta ao passo 1 (mantém listas já carregadas).
  function resetarFormulario() {
    setTipoNota(padroes.tipoNotaPadrao);
    setClienteId(padroes.clientePadraoId);
    setTransportadoraId("");
    setModFrete(padroes.modFretePadrao);
    setInfo(padroes.infoComplementarPadrao);
    setItens([]);
    setDescNota({ tipo: "valor", valor: 0 });
    setProdutoSel("");
    setQtd(1);
    setPassoEmissao(1);
    setFormKey((k) => k + 1);
  }

  useEffect(() => {
    (async () => {
      const [c, p, t, cd, pad] = await Promise.all([
        listarClientes(),
        listarProdutos(),
        listarTransportadoras(),
        obterCasasDecimaisQtd(),
        obterPadroesEmissao(),
      ]);
      setClientes(c);
      setProdutos(p);
      setTransportadoras(t);
      setCasas(cd);
      setPadroes(pad);
      // Aplica os padrões aos campos iniciais da emissão.
      setTipoNota(pad.tipoNotaPadrao);
      setModFrete(pad.modFretePadrao);
      setInfo(pad.infoComplementarPadrao);
      if (pad.clientePadraoId) setClienteId(pad.clientePadraoId);
    })();
  }, []);


  const totais = useMemo(() => {
    const bruto = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
    const descItens = itens.reduce(
      (s, i) => s + calcDesc(i.quantidade * i.precoUnitario, i.descTipo, i.descValor),
      0,
    );
    const liquidoItens = bruto - descItens;
    const descGeral = calcDesc(liquidoItens, descNota.tipo, descNota.valor);
    const descTotal = descItens + descGeral;
    return { bruto, descTotal, total: liquidoItens - descGeral };
  }, [itens, descNota]);
  const total = totais.total;
  const cliente = clientes.find((c) => c.id === clienteId);
  const transportadora = transportadoras.find((t) => t.id === transportadoraId);

  // Menor quantidade permitida conforme as casas decimais (ex.: 2 → 0,01).
  const menorQtd = casas > 0 ? Number(Math.pow(10, -casas).toFixed(casas)) : 1;

  function adicionarItem() {
    const prod = produtos.find((p) => p.id === produtoSel);
    const q = arred(qtd, casas);
    if (!prod || q <= 0) return;
    setItens((lista) => {
      const existente = lista.find((i) => i.produtoId === prod.id);
      if (existente) {
        return lista.map((i) =>
          i.produtoId === prod.id ? { ...i, quantidade: arred(i.quantidade + q, casas) } : i,
        );
      }
      return [...lista, { produtoId: prod.id, nome: prod.nome, quantidade: q, precoUnitario: prod.preco, descTipo: "valor" as DescontoTipo, descValor: 0 }];
    });
    setProdutoSel("");
    setQtd(1);
    // Feedback tátil leve ao adicionar (mobile).
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
  }

  function definirQtd(produtoId: string, valor: number) {
    setItens((lista) =>
      lista.map((i) =>
        i.produtoId === produtoId ? { ...i, quantidade: Math.max(menorQtd, arred(valor, casas)) } : i,
      ),
    );
  }

  function removerItem(produtoId: string) {
    setItens((lista) => lista.filter((i) => i.produtoId !== produtoId));
  }

  function definirDesc(produtoId: string, patch: Partial<Pick<LinhaItem, "descTipo" | "descValor">>) {
    setItens((lista) => lista.map((i) => (i.produtoId === produtoId ? { ...i, ...patch } : i)));
  }

  async function emitir() {
    if (!clienteId) {
      setResultado({ ok: false, erro: "Selecione um cliente." });
      return;
    }
    if (!transporteOk) {
      setResultado({ ok: false, erro: "Escolha uma transportadora para a modalidade de frete selecionada." });
      return;
    }

    const input: EmitirInput = {
      clienteId,
      transportadoraId: transportadoraId || null,
      tipoNota,
      modFrete,
      infCpl: info || undefined,
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
        descTipo: i.descTipo,
        descValor: i.descValor || 0,
      })),
      descontoNota: descNota.valor > 0 ? descNota : undefined,
    };

    setEmitindo(true);
    setResultado(null);
    setNotaEmitida(null);
    const r = await emitirNota(input);
    // Autorizada e gravada: abre a visualização do DANFE p/ baixar PDF/XML.
    if (r.ok && r.autorizada && r.notaId) {
      const nota = await obterNota(r.notaId);
      if (nota) setNotaEmitida(nota);
    }
    setEmitindo(false);
    setResultado(r);
  }

  // Fecha a visualização do DANFE e recomeça uma nova emissão do zero.
  function novaEmissao() {
    setNotaEmitida(null);
    setResultado(null);
    resetarFormulario();
  }

  // Padrão pode ocultar o passo de transporte (usa a modalidade padrão direto).
  const mostrarTransporte = padroes.definirTransporte;
  // CIF (0), FOB (1) e "9 - Sem ocorrência" não exigem transportadora.
  // Só modalidades 2/3/4 (terceiros / transporte próprio) obrigam.
  const transpOpcional = ["0", "1", "9"].includes(modFrete);
  // Com o passo oculto, confiamos na modalidade padrão (sem transportadora).
  const transporteOk = !mostrarTransporte || transpOpcional || transportadoraId !== "";

  // Passo 1 (destinatário) é pulado quando tipo travado + cliente padrão definido.
  const pularDest = padroes.travarTipoNota && !!padroes.clientePadraoId;
  // Passos efetivamente renderizados (destinatário e transporte podem ser pulados).
  const passos = [...(pularDest ? [] : ["dest"]), "produtos", ...(mostrarTransporte ? ["transporte"] : []), "revisao"];
  function canProceed(step: number) {
    const kind = passos[step - 1];
    if (kind === "dest") return clienteId !== "";
    if (kind === "produtos") return itens.length > 0;
    if (kind === "transporte") return transporteOk;
    return true;
  }

  return (
    <div className="space-y-6 pb-28 lg:pb-0">
      <TourEmissao />
      <PageHeader
        titulo="Emitir nova nota fiscal"
        subtitulo="Monte a nota em etapas: tipo, produtos, transporte e finalização."
      />

      <Stepper
        key={formKey}
        initialStep={passoEmissao}
        nextButtonText="Continuar"
        backButtonText="Voltar"
        completeButtonText="Emitir nota"
        canProceed={canProceed}
        onFinalStepCompleted={emitir}
        resumoMobile={
          <>
            <div className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wider text-[var(--muted)]">
                {itens.length} {itens.length === 1 ? "item" : "itens"}
              </span>
              <span className="block text-base font-semibold text-[var(--primary)]">{formatBRL(total)}</span>
            </div>
          </>
        }
      >
        {/* Etapa 1 — oculta quando tipo travado + cliente padrão definido */}
        {!pularDest && (
        <Step>
          <SectionTitle>{padroes.travarTipoNota ? "Destinatário" : "Tipo e destinatário"}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {padroes.travarTipoNota ? (
              <Field label="Tipo de nota" hint="Fixado nas configurações">
                <div className="flex h-[46px] items-center rounded-lg border border-[var(--border)] bg-slate-50 px-3 text-sm font-medium text-[var(--muted)]">
                  {rotulo(TIPOS_NOTA, tipoNota)}
                </div>
              </Field>
            ) : (
              <Field label="Tipo de nota" required>
                <Select opcoes={TIPOS_NOTA} value={tipoNota} onChange={(e) => setTipoNota(e.target.value)} />
              </Field>
            )}
            <Field label="Cliente" required>
              <ClientePicker
                clientes={clientes}
                value={clienteId}
                onChange={setClienteId}
                onCriado={(c) => { setClientes((prev) => [...prev, c]); setClienteId(c.id); }}
              />
            </Field>
          </div>
          {cliente && (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium">{cliente.nome}</p>
              <p className="text-[var(--muted)]">
                {cliente.documento} · {cliente.endereco.municipio}/{cliente.endereco.uf}
              </p>
            </div>
          )}
        </Step>
        )}

        {/* Etapa 2 */}
        <Step>
          <SectionTitle>Produtos</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Produto">
              <ProdutoPicker
                produtos={produtos}
                value={produtoSel}
                onChange={setProdutoSel}
                onCriado={(p) => { setProdutos((prev) => [...prev, p]); setProdutoSel(p.id); }}
              />
            </Field>
            <Field label="Quantidade">
              <QtyStepper valor={qtd} onChange={setQtd} casas={casas} />
            </Field>
            <button
              type="button"
              onClick={adicionarItem}
              disabled={!produtoSel}
              title={!produtoSel ? "Selecione um produto primeiro" : "Adicionar à nota"}
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--success)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Adicionar
            </button>
          </div>

          {/* Dica: porque o botão pode estar desabilitado */}
          {produtos.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--warning)]">
              Nenhum produto cadastrado nesta empresa.{" "}
              <a href="/produtos" className="font-medium underline">Cadastre ou importe um produto</a> para adicioná-lo à nota.
            </p>
          ) : !produtoSel ? (
            <p className="mt-2 text-xs text-[var(--muted)]">Selecione um produto no campo acima para habilitar “Adicionar”.</p>
          ) : null}

          {/* Mobile: cards com quantidade ± */}
          <div className="mt-5 space-y-2.5 sm:hidden">
            {itens.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                Nenhum produto adicionado.
              </p>
            ) : (
              <>
                {itens.map((i) => (
                  <div key={i.produtoId} className="rounded-xl border border-[var(--border)] bg-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.nome}</p>
                        <p className="text-xs text-[var(--muted)]">{formatBRL(i.precoUnitario)}/un</p>
                      </div>
                      <button
                        onClick={() => removerItem(i.produtoId)}
                        aria-label="Remover item"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] transition hover:bg-red-100"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QtyStepper valor={i.quantidade} onChange={(v) => definirQtd(i.produtoId, v)} casas={casas} />
                      <span className="text-base font-semibold">
                        {formatBRL(i.quantidade * i.precoUnitario - calcDesc(i.quantidade * i.precoUnitario, i.descTipo, i.descValor))}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Desconto</span>
                      <DescInput
                        tipo={i.descTipo}
                        valor={i.descValor}
                        onTipo={(t) => definirDesc(i.produtoId, { descTipo: t })}
                        onValor={(v) => definirDesc(i.produtoId, { descValor: v })}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl bg-[var(--primary-soft)] px-4 py-3">
                  <span className="text-sm font-medium">Total da nota</span>
                  <span className="text-lg font-bold text-[var(--primary)]">{formatBRL(total)}</span>
                </div>
              </>
            )}
          </div>

          {/* Desktop: tabela */}
          <div className="mt-5 hidden overflow-x-auto rounded-lg border border-[var(--border)] sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-2.5">Produto</th>
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
                      Nenhum produto adicionado.
                    </td>
                  </tr>
                ) : (
                  itens.map((i) => (
                    <tr key={i.produtoId} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 font-medium">{i.nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <QtyStepper valor={i.quantidade} onChange={(v) => definirQtd(i.produtoId, v)} casas={casas} compacto />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{formatBRL(i.precoUnitario)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <DescInput
                            tipo={i.descTipo}
                            valor={i.descValor}
                            onTipo={(t) => definirDesc(i.produtoId, { descTipo: t })}
                            onValor={(v) => definirDesc(i.produtoId, { descValor: v })}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatBRL(i.quantidade * i.precoUnitario - calcDesc(i.quantidade * i.precoUnitario, i.descTipo, i.descValor))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removerItem(i.produtoId)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                        >
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
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium">Total da nota</td>
                    <td className="px-4 py-3 text-right text-base font-semibold text-[var(--primary)]">{formatBRL(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Step>

        {/* Etapa 3 — oculta quando o padrão dispensa definir transporte */}
        {mostrarTransporte && (
        <Step>
          <SectionTitle>Transporte</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Modalidade do frete" required hint="Vai no XML da NF-e (modFrete)">
              <Select
                opcoes={MODALIDADES_FRETE}
                value={modFrete}
                onChange={(e) => {
                  const v = e.target.value;
                  setModFrete(v);
                  if (v === "9") setTransportadoraId(""); // sem ocorrência → sem transportadora
                }}
              />
            </Field>
            <Field label="Transportadora" required={!transpOpcional} hint={transpOpcional ? "Opcional para esta modalidade" : "Obrigatória para esta modalidade"}>
              <TransportadoraPicker
                transportadoras={transportadoras}
                value={transportadoraId}
                permitirNenhum={transpOpcional}
                onChange={setTransportadoraId}
                onCriado={(t) => { setTransportadoras((prev) => [...prev, t]); setTransportadoraId(t.id); }}
              />
            </Field>
          </div>
          {!transporteOk && (
            <p className="mt-3 text-sm font-medium text-[var(--warning)]">
              Escolha uma transportadora — obrigatória para a modalidade de frete selecionada.
            </p>
          )}
        </Step>
        )}

        {/* Etapa 4 */}
        <Step>
          <SectionTitle>Conferência e finalização</SectionTitle>
          <p className="-mt-2 mb-4 text-sm text-[var(--muted)]">
            Revise todos os dados abaixo antes de emitir. Confira produtos, quantidades, valores e transporte.
          </p>

          {/* Dados gerais */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[var(--border)] bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <Resumo rotulo="Tipo de nota" valor={rotulo(TIPOS_NOTA, tipoNota)} />
            <Resumo rotulo="Destinatário" valor={cliente?.nome ?? "—"} />
            <Resumo rotulo="Documento" valor={cliente?.documento ?? "—"} />
            <Resumo rotulo="Modalidade do frete" valor={rotulo(MODALIDADES_FRETE, modFrete)} />
            <Resumo rotulo="Transportadora" valor={transportadora?.nome ?? "Sem transporte / retirada"} />
          </div>

          {/* Produtos da nota */}
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
            <div className="border-b border-[var(--border)] bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Produtos · {itens.length} {itens.length === 1 ? "item" : "itens"}
            </div>
            {itens.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">Nenhum produto adicionado.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {itens.map((i) => (
                  <li key={i.produtoId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{i.nome}</p>
                      <p className="text-xs text-[var(--muted)]">{fmtQtd(i.quantidade, casas)} × {formatBRL(i.precoUnitario)}</p>
                    </div>
                    <span className="shrink-0 font-medium">{formatBRL(i.quantidade * i.precoUnitario)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2 border-t border-[var(--border)] px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">Subtotal dos produtos</span>
                <span className="font-medium">{formatBRL(totais.bruto)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--muted)]">Desconto da nota</span>
                <DescInput
                  tipo={descNota.tipo}
                  valor={descNota.valor}
                  onTipo={(t) => setDescNota((d) => ({ ...d, tipo: t }))}
                  onValor={(v) => setDescNota((d) => ({ ...d, valor: v }))}
                />
              </div>
              {totais.descTotal > 0 && (
                <div className="flex items-center justify-between text-sm text-[var(--danger)]">
                  <span>Descontos (itens + nota)</span>
                  <span className="font-medium">− {formatBRL(totais.descTotal)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--primary-soft)] px-4 py-3">
              <span className="text-sm font-semibold">Total da nota</span>
              <span className="text-lg font-bold text-[var(--primary)]">{formatBRL(total)}</span>
            </div>
          </div>

          <div className="mt-4">
            <Field label="Informações complementares">
              <Textarea value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Dados adicionais de interesse do fisco ou do destinatário…" />
            </Field>
          </div>
        </Step>
      </Stepper>

      <Modal
        aberto={emitindo || (resultado !== null && !notaEmitida)}
        onFechar={() => {
          if (emitindo) return;
          // Nota autorizada: ao fechar, recomeça do passo 1 com tudo limpo.
          if (resultado?.ok && resultado.autorizada) resetarFormulario();
          setResultado(null);
        }}
        titulo={emitindo ? "Transmitindo à SEFAZ…" : resultado?.ok && resultado.autorizada ? "Nota autorizada" : "Resultado da emissão"}
        largura="max-w-lg"
        rodape={
          emitindo ? undefined : resultado?.ok && resultado.autorizada ? (
            <Button onClick={() => { resetarFormulario(); setResultado(null); }}>Emitir outra</Button>
          ) : (
            <Button variante="secondary" onClick={() => setResultado(null)}>Voltar e corrigir</Button>
          )
        }
      >
        {emitindo && (
          <div className="flex items-center gap-3 py-4 text-sm text-[var(--muted)]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            Montando XML, assinando com o certificado e enviando ao Web Service…
          </div>
        )}

        {!emitindo && resultado && !resultado.ok && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2.5 font-medium text-[var(--danger)]">Falha ao emitir</div>
            <p className="text-[var(--muted)]">{resultado.erro}</p>
            {resultado.codigo === "endereco_dest" && (
              <Button
                onClick={() => {
                  const alvo = clientes.find((c) => c.id === (resultado.clienteId ?? clienteId)) ?? cliente ?? null;
                  setResultado(null);
                  setCorrigirCliente(alvo);
                }}
              >
                Corrigir endereço do cliente
              </Button>
            )}
          </div>
        )}

        {!emitindo && resultado?.ok && (
          <div className="space-y-3 text-sm">
            {resultado.autorizada ? (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-3 py-2.5 font-medium text-[var(--success)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Autorizada pela SEFAZ (cStat {resultado.cStat})
              </div>
            ) : (
              <div className="space-y-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2.5 text-[var(--warning)]">
                <p className="font-semibold">Nota recusada pela SEFAZ</p>
                {(() => {
                  const ex = explicarRejeicao(resultado.cStat, resultado.xMotivo);
                  // Produto a corrigir: 1º item cujo produto ainda não tem benefício.
                  const alvo =
                    ex.corrige === "produto"
                      ? produtos.find((p) => itens.some((it) => it.produtoId === p.id) && !p.codigoBeneficio?.trim()) ??
                        produtos.find((p) => itens.some((it) => it.produtoId === p.id)) ??
                        null
                      : null;
                  return (
                    <>
                      <p className="text-sm">{ex.resumo}</p>
                      {ex.acao && <p className="text-xs opacity-90">O que fazer: {ex.acao}</p>}
                      <p className="text-[10px] opacity-70">Código técnico: cStat {resultado.cStat}</p>
                      {alvo && (
                        <Button
                          className="mt-1"
                          onClick={() => {
                            setResultado(null);
                            setCorrigirProduto(alvo);
                          }}
                        >
                          Corrigir produto “{alvo.nome}”
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
            {resultado.debugXml && (
              <details className="rounded-lg border border-[var(--border)] bg-slate-50 p-2 text-xs">
                <summary className="cursor-pointer font-medium text-[var(--muted)]">Ver XML enviado (debug)</summary>
                <textarea
                  readOnly
                  value={resultado.debugXml}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-2 h-48 w-full resize-y rounded border border-[var(--border)] bg-white p-2 font-mono text-[10px] leading-tight"
                />
              </details>
            )}
            {resultado.avisoPersistencia && (
              <p className="rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">{resultado.avisoPersistencia}</p>
            )}
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Número</dt><dd className="font-medium">{resultado.numero}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Total</dt><dd className="font-medium">{formatBRL(total)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Motivo</dt><dd className="text-right font-medium">{resultado.xMotivo ?? "—"}</dd></div>
              {resultado.nProt && (
                <div className="flex justify-between"><dt className="text-[var(--muted)]">Protocolo</dt><dd className="font-mono text-xs">{resultado.nProt}</dd></div>
              )}
              <div><dt className="text-[var(--muted)]">Chave de acesso</dt><dd className="mt-1 break-all font-mono text-xs">{resultado.chave}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      {notaEmitida && resultado?.ok && (
        <VisualizarDanfeModal
          nota={notaEmitida}
          banner={{ cStat: resultado.cStat, nProt: resultado.nProt }}
          onFechar={novaEmissao}
          onEmitirOutra={novaEmissao}
        />
      )}

      {corrigirCliente && (
        <NovoClienteModal
          clienteInicial={corrigirCliente}
          passoInicial={4}
          aviso={
            <>
              A SEFAZ recusou a nota por causa do <b>endereço do destinatário</b>. Confira e complete os campos abaixo e salve para emitir de novo.
            </>
          }
          onFechar={() => setCorrigirCliente(null)}
          onCriado={(c) => {
            setClientes((lista) => lista.map((x) => (x.id === c.id ? c : x)));
            setCorrigirCliente(null);
            // Volta o Stepper p/ a Conferência (passo 4) — dados preservados — p/ reemitir.
            setPassoEmissao(passos.length); // último passo (Conferência)
            setFormKey((k) => k + 1);
          }}
        />
      )}

      {corrigirProduto && (
        <NovoProdutoModal
          produtoInicial={corrigirProduto}
          passoInicial={3}
          aviso={
            <>
              A SEFAZ recusou a nota: este produto é isento (CST 40) e precisa do{" "}
              <b>Código do benefício fiscal</b>. Use o botão <b>Buscar</b> no campo (ex.: <b>GO811053</b> — cesta básica) e salve para emitir de novo.
            </>
          }
          onFechar={() => setCorrigirProduto(null)}
          onCriado={(p) => {
            setProdutos((lista) => lista.map((x) => (x.id === p.id ? p : x)));
            setCorrigirProduto(null);
            // Volta o Stepper p/ a Conferência (passo 4) — dados preservados — p/ reemitir.
            setPassoEmissao(passos.length); // último passo (Conferência)
            setFormKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{rotulo}</p>
      <p className={"mt-0.5 truncate font-medium " + (destaque ? "text-[var(--primary)]" : "")}>{valor}</p>
    </div>
  );
}
