"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/ui/Modal";
import { Button, Field, Input, Textarea, EmptyState } from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import { itensDevolviveis, registrarDevolucao, type ItemDevolvivel } from "./actions";

export default function DevolucaoModal({
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
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void itensDevolviveis(notaId).then((lista) => {
      setItens(lista);
      // Pré-preenche com o total disponível de cada item controlado.
      setQtd(Object.fromEntries(lista.filter((i) => i.controlaEstoque).map((i) => [i.produtoId, i.disponivel])));
    });
  }, [notaId]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const payload = Object.entries(qtd)
      .map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
      .filter((x) => x.quantidade > 0);
    const r = await registrarDevolucao(notaId, payload, motivo);
    setSalvando(false);
    if (r.ok) onConcluido();
    else setErro(r.erro);
  }

  const controlados = (itens ?? []).filter((i) => i.controlaEstoque);
  const semControle = (itens ?? []).filter((i) => !i.controlaEstoque);

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Devolução · Nota nº ${numero}`}
      largura="max-w-xl"
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || controlados.length === 0}>
            {salvando ? "Registrando…" : "Devolver ao estoque"}
          </Button>
        </>
      }
    >
      {itens === null ? (
        <div className="flex justify-center py-10"><LightningLoader /></div>
      ) : controlados.length === 0 ? (
        <EmptyState
          titulo="Nada a devolver"
          descricao="Nenhum item desta nota tem controle de estoque ativo."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Informe a quantidade devolvida de cada item. Os itens voltam ao estoque (não cancela a nota).
          </p>
          <div className="space-y-2">
            {controlados.map((i) => (
              <div key={i.produtoId} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.nome}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Vendido {fmt(i.quantidadeVendida)} · já devolvido {fmt(i.jaDevolvida)} · disponível {fmt(i.disponivel)} {i.unidade ?? ""}
                  </p>
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    inputMode="decimal"
                    value={qtd[i.produtoId] ? String(qtd[i.produtoId]).replace(".", ",") : ""}
                    onChange={(e) => {
                      const v = Math.min(i.disponivel, Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0);
                      setQtd((s) => ({ ...s, [i.produtoId]: v }));
                    }}
                    placeholder="0"
                    disabled={i.disponivel <= 0}
                  />
                </div>
              </div>
            ))}
          </div>
          {semControle.length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              {semControle.length} item(ns) sem controle de estoque foram omitidos.
            </p>
          )}
          <Field label="Motivo (opcional)">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: produto avariado, desistência do cliente…" />
          </Field>
          {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
        </div>
      )}
    </Modal>
  );
}
