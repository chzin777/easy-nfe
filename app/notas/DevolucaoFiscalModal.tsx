"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/ui/Modal";
import { Button, Field, Input, Textarea, EmptyState } from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import { itensDevolviveis, emitirNotaDevolucao, type ItemDevolvivel } from "./actions";

export default function DevolucaoFiscalModal({
  notaId,
  numero,
  onFechar,
  onConcluido,
}: {
  notaId: string;
  numero: number | string;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [itens, setItens] = useState<ItemDevolvivel[] | null>(null);
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [cfopPorItem, setCfopPorItem] = useState<Record<string, string>>({});
  const [refChave, setRefChave] = useState("");
  const [tipoSaida, setTipoSaida] = useState(true);
  const [natOp, setNatOp] = useState("DEVOLUCAO DE COMPRA");
  const [infCpl, setInfCpl] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);

  useEffect(() => {
    void itensDevolviveis(notaId).then((lista) => {
      setItens(lista);
      setQtd(Object.fromEntries(lista.map((i) => [i.produtoId, i.disponivel])));
    });
  }, [notaId]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

  async function emitir() {
    setErro(null);
    setEmitindo(true);
    const payload = Object.entries(qtd)
      .map(([produtoId, quantidade]) => ({
        produtoId,
        quantidade,
        cfop: cfopPorItem[produtoId]?.replace(/\D/g, "") || undefined,
      }))
      .filter((x) => x.quantidade > 0);
    const r = await emitirNotaDevolucao({
      notaOriginalId: notaId,
      itens: payload,
      naturezaOperacao: natOp,
      infCpl: infCpl || undefined,
      refChaveManual: refChave.replace(/\D/g, "") || undefined,
      tipoSaida,
    });
    setEmitindo(false);
    if (r.ok) onConcluido();
    else setErro(r.erro);
  }

  const selecionados = (itens ?? []).filter((i) => (qtd[i.produtoId] ?? 0) > 0);

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`NF-e de Devolução · Nota nº ${numero}`}
      largura="max-w-2xl"
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar} disabled={emitindo}>Cancelar</Button>
          <Button onClick={emitir} disabled={emitindo || selecionados.length === 0}>
            {emitindo ? "Emitindo…" : "Emitir NF-e de Devolução"}
          </Button>
        </>
      }
    >
      {itens === null ? (
        <div className="flex justify-center py-10"><LightningLoader /></div>
      ) : itens.length === 0 ? (
        <EmptyState
          titulo="Nada a devolver"
          descricao="Esta nota não tem itens disponíveis para devolução."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Emite uma NF-e de devolução (finNFe=4) referenciando a nota original. Os itens voltam ao estoque automaticamente após autorização.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tipo de Operação">
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                value={tipoSaida ? "saida" : "entrada"}
                onChange={(e) => {
                  const saida = e.target.value === "saida";
                  setTipoSaida(saida);
                  setNatOp(saida ? "DEVOLUCAO DE COMPRA" : "DEVOLUCAO DE VENDA");
                }}
              >
                <option value="saida">Saída (devolução de compra)</option>
                <option value="entrada">Entrada (devolução de venda)</option>
              </select>
            </Field>
            <Field label="Chave da NF-e Referenciada (44 dígitos)">
              <Input
                value={refChave}
                onChange={(e) => setRefChave(e.target.value.replace(/\D/g, "").slice(0, 44))}
                placeholder="Chave da nota de entrada/saída"
                maxLength={44}
              />
            </Field>
          </div>

          <div className="space-y-2">
            {itens.map((i) => (
              <div key={i.produtoId} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.nome}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Vendido {fmt(i.quantidadeVendida)} · já devolvido {fmt(i.jaDevolvida)} · disponível {fmt(i.disponivel)} {i.unidade ?? ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="w-24 shrink-0">
                    <Input
                      inputMode="numeric"
                      value={cfopPorItem[i.produtoId] ?? ""}
                      onChange={(e) => setCfopPorItem((s) => ({ ...s, [i.produtoId]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      placeholder="CFOP"
                      maxLength={4}
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <Input
                      inputMode="decimal"
                      value={qtd[i.produtoId] ? String(qtd[i.produtoId]).replace(".", ",") : ""}
                      onChange={(e) => {
                        const v = Math.min(i.disponivel, Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0);
                        setQtd((s) => ({ ...s, [i.produtoId]: v }));
                      }}
                      placeholder="Qtd"
                      disabled={i.disponivel <= 0}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Field label="Natureza da Operação">
            <Input value={natOp} onChange={(e) => setNatOp(e.target.value)} placeholder="DEVOLUCAO DE COMPRA" />
          </Field>
          <Field label="Informações Complementares (opcional)">
            <Textarea value={infCpl} onChange={(e) => setInfCpl(e.target.value)} placeholder="Ex.: Devolução referente à NF xxx..." />
          </Field>
          {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
        </div>
      )}
    </Modal>
  );
}