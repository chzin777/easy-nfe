"use client";

import { useMemo, useState } from "react";
import StepperModal from "@/app/ui/StepperModal";
import Stepper, { Step } from "@/app/ui/Stepper";
import { Field, Input, Select, Textarea, SectionTitle } from "@/app/ui/primitives";
import { formatBRL } from "@/lib/format";
import { TIPOS_NOTA } from "@/lib/mock-data";
import type { Cliente, Produto, Transportadora } from "@/lib/types";
import type { DescontoTipo } from "@/app/notas/actions";
import ClientePicker from "@/app/notas/nova/ClientePicker";
import ProdutoPicker from "@/app/notas/nova/ProdutoPicker";
import { QtyStepper, DescInput } from "@/app/ui/ItensFields";
import {
  criarOrcamento, atualizarOrcamento, type OrcamentoCompleto, type OrcamentoInput,
} from "./actions";

type Linha = { produtoId: string; nome: string; unidade: string; quantidade: number; precoUnitario: number; descTipo: DescontoTipo; descValor: number };

// Data local de hoje (yyyy-mm-dd) — evita o desvio de fuso do toISOString (UTC).
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  transportadoras,
  casas,
  onClientes,
  onProdutos,
  onSalvo,
  onFechar,
}: {
  inicial?: OrcamentoCompleto | null;
  clientes: Cliente[];
  produtos: Produto[];
  transportadoras: Transportadora[];
  casas: number;
  onClientes: (c: Cliente) => void;
  onProdutos: (p: Produto) => void;
  onSalvo: (o: OrcamentoCompleto) => void;
  onFechar: () => void;
}) {
  const [clienteId, setClienteId] = useState(inicial?.clienteId ?? "");
  const [transportadoraId, setTransportadoraId] = useState(inicial?.transportadoraId ?? "");
  const [tipoNota, setTipoNota] = useState(inicial?.tipoNota ?? "55-saida");
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");
  const [validade, setValidade] = useState(inicial?.validade ?? hojeISO());
  const [descNota, setDescNota] = useState<{ tipo: DescontoTipo; valor: number }>(inicial?.desconto ?? { tipo: "valor", valor: 0 });
  const [itens, setItens] = useState<Linha[]>(
    inicial?.itens.map((i) => ({ produtoId: i.produtoId ?? "", nome: i.nome, unidade: i.unidade, quantidade: i.quantidade, precoUnitario: i.precoUnitario, descTipo: i.descTipo, descValor: i.descValor })) ?? [],
  );
  const [produtoSel, setProdutoSel] = useState("");
  const [qtd, setQtd] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const totais = useMemo(() => {
    const liquidoItens = itens.reduce((s, i) => {
      const bruto = i.quantidade * i.precoUnitario;
      return s + (bruto - calcDesc(bruto, i.descTipo, i.descValor));
    }, 0);
    const geral = calcDesc(liquidoItens, descNota.tipo, descNota.valor);
    return { total: liquidoItens - geral };
  }, [itens, descNota]);

  function adicionar() {
    const p = produtos.find((x) => x.id === produtoSel);
    if (!p || qtd <= 0) return;
    setItens((lista) => {
      const ex = lista.find((i) => i.produtoId === p.id);
      if (ex) return lista.map((i) => (i.produtoId === p.id ? { ...i, quantidade: i.quantidade + qtd } : i));
      return [...lista, { produtoId: p.id, nome: p.nome, unidade: p.unidade, quantidade: qtd, precoUnitario: p.preco, descTipo: "valor", descValor: 0 }];
    });
    setProdutoSel(""); setQtd(1);
  }
  const menorQtd = casas > 0 ? Number(Math.pow(10, -casas).toFixed(casas)) : 1;
  function definirQtd(produtoId: string, v: number) {
    setItens((l) => l.map((x) => (x.produtoId === produtoId ? { ...x, quantidade: Math.max(menorQtd, Number(v.toFixed(casas))) } : x)));
  }
  function definirDesc(produtoId: string, patch: Partial<Pick<Linha, "descTipo" | "descValor">>) {
    setItens((l) => l.map((x) => (x.produtoId === produtoId ? { ...x, ...patch } : x)));
  }
  function removerItem(produtoId: string) {
    setItens((l) => l.filter((x) => x.produtoId !== produtoId));
  }

  async function salvar() {
    setErro(null);
    if (!clienteId) { setErro("Selecione o cliente."); return; }
    if (!itens.length) { setErro("Adicione ao menos um produto."); return; }
    setSalvando(true);
    try {
      const payload: OrcamentoInput = {
        clienteId, transportadoraId: transportadoraId || null, tipoNota, modFrete: "9",
        observacoes, validade: validade || null, desconto: descNota,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, descTipo: i.descTipo, descValor: i.descValor })),
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
        {/* Etapa 1 — Cliente e dados gerais */}
        <Step>
          <SectionTitle>Cliente e dados gerais</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cliente" required>
              <ClientePicker clientes={clientes} value={clienteId} onChange={setClienteId} onCriado={(c) => { onClientes(c); setClienteId(c.id); }} />
            </Field>
            <Field label="Modelo da nota (ao fechar)">
              <Select opcoes={TIPOS_NOTA} value={tipoNota} onChange={(e) => setTipoNota(e.target.value)} />
            </Field>
            <Field label="Transportadora">
              <Select
                opcoes={[{ value: "", label: "— sem transportadora —" }, ...transportadoras.map((t) => ({ value: t.id, label: t.nome }))]}
                value={transportadoraId}
                onChange={(e) => setTransportadoraId(e.target.value)}
              />
            </Field>
            <Field label="Validade do orçamento">
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </Field>
          </div>
        </Step>

        {/* Etapa 2 — Produtos (igual à emissão de nota) */}
        <Step>
          <SectionTitle>Produtos</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Field label="Produto">
              <ProdutoPicker produtos={produtos} value={produtoSel} onChange={setProdutoSel} onCriado={(p) => { onProdutos(p); setProdutoSel(p.id); }} />
            </Field>
            <Field label="Quantidade">
              <QtyStepper valor={qtd} onChange={setQtd} casas={casas} />
            </Field>
            <button
              type="button"
              onClick={adicionar}
              disabled={!produtoSel}
              title={!produtoSel ? "Selecione um produto primeiro" : "Adicionar ao orçamento"}
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--success)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Adicionar
            </button>
          </div>

          {produtos.length === 0 ? (
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
              <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">Nenhum produto adicionado.</p>
            ) : (
              <>
                {itens.map((i) => (
                  <div key={i.produtoId} className="rounded-xl border border-[var(--border)] bg-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.nome}</p>
                        <p className="text-xs text-[var(--muted)]">{formatBRL(i.precoUnitario)}/un</p>
                      </div>
                      <button onClick={() => removerItem(i.produtoId)} aria-label="Remover item" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger)] transition hover:bg-red-100">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QtyStepper valor={i.quantidade} onChange={(v) => definirQtd(i.produtoId, v)} casas={casas} />
                      <span className="text-base font-semibold">{formatBRL(i.quantidade * i.precoUnitario - calcDesc(i.quantidade * i.precoUnitario, i.descTipo, i.descValor))}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-[var(--muted)]">Desconto</span>
                      <DescInput tipo={i.descTipo} valor={i.descValor} onTipo={(t) => definirDesc(i.produtoId, { descTipo: t })} onValor={(v) => definirDesc(i.produtoId, { descValor: v })} />
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
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--muted)]">Nenhum produto adicionado.</td></tr>
                ) : (
                  itens.map((i) => (
                    <tr key={i.produtoId} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-4 py-3 font-medium">{i.nome}</td>
                      <td className="px-4 py-3"><div className="flex justify-center"><QtyStepper valor={i.quantidade} onChange={(v) => definirQtd(i.produtoId, v)} casas={casas} compacto /></div></td>
                      <td className="px-4 py-3 text-right">{formatBRL(i.precoUnitario)}</td>
                      <td className="px-4 py-3"><div className="flex justify-center"><DescInput tipo={i.descTipo} valor={i.descValor} onTipo={(t) => definirDesc(i.produtoId, { descTipo: t })} onValor={(v) => definirDesc(i.produtoId, { descValor: v })} /></div></td>
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(i.quantidade * i.precoUnitario - calcDesc(i.quantidade * i.precoUnitario, i.descTipo, i.descValor))}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removerItem(i.produtoId)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90">
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
