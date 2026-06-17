"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Field,
  Input,
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
import { listarClientes } from "@/app/clientes/actions";
import ClientePicker from "./ClientePicker";
import ProdutoPicker from "./ProdutoPicker";
import TransportadoraPicker from "./TransportadoraPicker";
import { listarProdutos } from "@/app/produtos/actions";
import { listarTransportadoras } from "@/app/transportadoras/actions";

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

  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<EmitirResultado | null>(null);

  useEffect(() => {
    (async () => {
      const [c, p, t] = await Promise.all([
        listarClientes(),
        listarProdutos(),
        listarTransportadoras(),
      ]);
      setClientes(c);
      setProdutos(p);
      setTransportadoras(t);
    })();
  }, []);


  const total = useMemo(
    () => itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0),
    [itens],
  );
  const cliente = clientes.find((c) => c.id === clienteId);

  function adicionarItem() {
    const prod = produtos.find((p) => p.id === produtoSel);
    if (!prod || qtd <= 0) return;
    setItens((lista) => {
      const existente = lista.find((i) => i.produtoId === prod.id);
      if (existente) {
        return lista.map((i) =>
          i.produtoId === prod.id ? { ...i, quantidade: i.quantidade + qtd } : i,
        );
      }
      return [...lista, { produtoId: prod.id, nome: prod.nome, quantidade: qtd, precoUnitario: prod.preco }];
    });
    setProdutoSel("");
    setQtd(1);
  }

  function removerItem(produtoId: string) {
    setItens((lista) => lista.filter((i) => i.produtoId !== produtoId));
  }

  async function emitir() {
    if (!clienteId) {
      setResultado({ ok: false, erro: "Selecione um cliente." });
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

  function canProceed(step: number) {
    if (step === 1) return clienteId !== "";
    if (step === 2) return itens.length > 0;
    return true;
  }

  return (
    <div className="space-y-6">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <Field label="Produto">
              <ProdutoPicker
                produtos={produtos}
                value={produtoSel}
                onChange={setProdutoSel}
                onCriado={(p) => { setProdutos((prev) => [...prev, p]); setProdutoSel(p.id); }}
              />
            </Field>
            <Field label="Quantidade">
              <Input type="number" min="1" value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
            </Field>
            <Button variante="secondary" onClick={adicionarItem} disabled={!produtoSel}>+ Adicionar</Button>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-2.5">Produto</th>
                  <th className="px-4 py-2.5 text-right">Qtd.</th>
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
                      <td className="px-4 py-3 text-right">{i.quantidade}</td>
                      <td className="px-4 py-3 text-right">{formatBRL(i.precoUnitario)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(i.quantidade * i.precoUnitario)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removerItem(i.produtoId)} className="text-xs font-medium text-[var(--danger)] hover:underline">
                          remover
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
          <SectionTitle>Transporte (se necessário)</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Transportadora" hint="Opcional">
              <TransportadoraPicker
                transportadoras={transportadoras}
                value={transportadoraId}
                onChange={(id) => {
                  setTransportadoraId(id);
                  const t = transportadoras.find((x) => x.id === id);
                  if (t) setModFrete(t.tipoTransporte); // sugere a modalidade da transportadora
                }}
                onCriado={(t) => { setTransportadoras((prev) => [...prev, t]); setTransportadoraId(t.id); setModFrete(t.tipoTransporte); }}
              />
            </Field>
            <Field label="Modalidade do frete" required hint="Vai no XML da NF-e (modFrete)">
              <Select opcoes={MODALIDADES_FRETE} value={modFrete} onChange={(e) => setModFrete(e.target.value)} />
            </Field>
          </div>
        </Step>

        {/* Etapa 4 */}
        <Step>
          <SectionTitle>Informações adicionais e resumo</SectionTitle>
          <Field label="Informações complementares">
            <Textarea value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Dados adicionais de interesse do fisco ou do destinatário…" />
          </Field>
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-[var(--border)] bg-slate-50 p-4 text-sm sm:grid-cols-4">
            <Resumo rotulo="Tipo" valor={rotulo(TIPOS_NOTA, tipoNota)} />
            <Resumo rotulo="Cliente" valor={cliente?.nome ?? "—"} />
            <Resumo rotulo="Itens" valor={String(itens.length)} />
            <Resumo rotulo="Total" valor={formatBRL(total)} destaque />
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
              <div className="rounded-lg bg-[var(--warning-soft)] px-3 py-2.5 font-medium text-[var(--warning)]">
                Rejeitada pela SEFAZ — cStat {resultado.cStat}
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
