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
import { emitirNota, type EmitirInput, type EmitirResultado } from "../actions";
import { explicarRejeicao } from "@/lib/nfe/mensagens";
import { listarClientes } from "@/app/clientes/actions";
import NovoClienteModal from "@/app/clientes/NovoClienteModal";
import ClientePicker from "./ClientePicker";
import ProdutoPicker from "./ProdutoPicker";
import TransportadoraPicker from "./TransportadoraPicker";
import TourEmissao from "./TourEmissao";
import { listarProdutos } from "@/app/produtos/actions";
import { listarTransportadoras } from "@/app/transportadoras/actions";
import { obterCasasDecimaisQtd } from "@/app/configuracoes/actions";

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
  const [itens, setItens] = useState<ItemNota[]>([]);

  const [produtoSel, setProdutoSel] = useState("");
  const [qtd, setQtd] = useState(1);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [casas, setCasas] = useState(2);

  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<EmitirResultado | null>(null);
  const [corrigirCliente, setCorrigirCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    (async () => {
      const [c, p, t, cd] = await Promise.all([
        listarClientes(),
        listarProdutos(),
        listarTransportadoras(),
        obterCasasDecimaisQtd(),
      ]);
      setClientes(c);
      setProdutos(p);
      setTransportadoras(t);
      setCasas(cd);
    })();
  }, []);


  const total = useMemo(
    () => itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0),
    [itens],
  );
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
      return [...lista, { produtoId: prod.id, nome: prod.nome, quantidade: q, precoUnitario: prod.preco }];
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
      itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
    };

    setEmitindo(true);
    setResultado(null);
    const r = await emitirNota(input);
    setEmitindo(false);
    setResultado(r);
  }

  // CIF (0), FOB (1) e "9 - Sem ocorrência" não exigem transportadora.
  // Só modalidades 2/3/4 (terceiros / transporte próprio) obrigam.
  const transpOpcional = ["0", "1", "9"].includes(modFrete);
  const transporteOk = transpOpcional || transportadoraId !== "";

  function canProceed(step: number) {
    if (step === 1) return clienteId !== "";
    if (step === 2) return itens.length > 0;
    if (step === 3) return transporteOk;
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
        {/* Etapa 1 */}
        <Step>
          <SectionTitle>Tipo e destinatário</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo de nota" required>
              <Select opcoes={TIPOS_NOTA} value={tipoNota} onChange={(e) => setTipoNota(e.target.value)} />
            </Field>
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
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--success)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Adicionar
            </button>
          </div>

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
                      <span className="text-base font-semibold">{formatBRL(i.quantidade * i.precoUnitario)}</span>
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
                  <th className="px-4 py-2.5 text-right">Subtotal</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--muted)]">
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
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(i.quantidade * i.precoUnitario)}</td>
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
                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium">Total da nota</td>
                    <td className="px-4 py-3 text-right text-base font-semibold text-[var(--primary)]">{formatBRL(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Step>

        {/* Etapa 3 */}
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
        aberto={emitindo || resultado !== null}
        onFechar={() => { if (!emitindo) setResultado(null); }}
        titulo={emitindo ? "Transmitindo à SEFAZ…" : resultado?.ok && resultado.autorizada ? "Nota autorizada" : "Resultado da emissão"}
        largura="max-w-lg"
        rodape={
          emitindo ? undefined : resultado?.ok && resultado.autorizada ? (
            <Button onClick={() => window.location.reload()}>Emitir outra</Button>
          ) : (
            <Button variante="secondary" onClick={() => window.location.reload()}>Voltar e corrigir</Button>
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
                  return (
                    <>
                      <p className="text-sm">{ex.resumo}</p>
                      {ex.acao && <p className="text-xs opacity-90">O que fazer: {ex.acao}</p>}
                      <p className="text-[10px] opacity-70">Código técnico: cStat {resultado.cStat}</p>
                    </>
                  );
                })()}
              </div>
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

      {corrigirCliente && (
        <NovoClienteModal
          clienteInicial={corrigirCliente}
          onFechar={() => setCorrigirCliente(null)}
          onCriado={(c) => {
            setClientes((lista) => lista.map((x) => (x.id === c.id ? c : x)));
            setCorrigirCliente(null);
          }}
        />
      )}
    </div>
  );
}

// Seletor de quantidade: botões ± grandes + campo central editável que aceita
// decimais (vírgula). `casas` define quantas casas após a vírgula.
function QtyStepper({
  valor,
  onChange,
  casas,
  compacto,
}: {
  valor: number;
  onChange: (valor: number) => void;
  casas: number;
  compacto?: boolean;
}) {
  const [foco, setFoco] = useState(false);
  const [txt, setTxt] = useState("");
  const passo = 1;
  const menor = casas > 0 ? Number(Math.pow(10, -casas).toFixed(casas)) : 1;
  const arr = (v: number) => Number(v.toFixed(casas));

  // Converte texto BR ("1,5" / "1.5") em número.
  function parse(s: string) {
    let c = s.replace(/[^\d.,]/g, "").replace(/\./g, ",");
    const p = c.split(",");
    c = p.shift()! + (p.length ? "," + p.join("") : "");
    c = c.replace(",", ".");
    return c === "" || c === "." ? 0 : Number(c);
  }

  const display = foco
    ? txt
    : valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

  const btn = compacto ? "h-8 w-8" : "h-12 w-12 sm:h-[46px] sm:w-11";
  const larguraNum = compacto ? "w-12" : "w-16";

  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(menor, arr(valor - passo)))}
        disabled={valor <= menor}
        aria-label="Diminuir"
        className={"flex items-center justify-center text-lg font-medium text-[var(--foreground)] transition hover:bg-slate-50 disabled:opacity-30 " + btn}
      >
        −
      </button>
      <input
        type="text"
        inputMode={casas > 0 ? "decimal" : "numeric"}
        value={display}
        onFocus={() => {
          setFoco(true);
          setTxt(valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas }));
        }}
        onChange={(e) => { setTxt(e.target.value); onChange(arr(parse(e.target.value))); }}
        onBlur={() => { setFoco(false); onChange(Math.max(menor, arr(parse(txt)))); }}
        className={"border-x border-[var(--border)] py-2 text-center text-sm font-semibold tabular-nums outline-none focus:bg-[var(--primary-soft)]/40 " + larguraNum}
      />
      <button
        type="button"
        onClick={() => onChange(arr(valor + passo))}
        aria-label="Aumentar"
        className={"flex items-center justify-center text-lg font-medium text-[var(--foreground)] transition hover:bg-slate-50 " + btn}
      >
        +
      </button>
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
