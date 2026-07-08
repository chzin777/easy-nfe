"use client";

import { useCallback, useRef, useState } from "react";
import Modal from "@/app/ui/Modal";
import BarcodeScanner from "@/app/ui/BarcodeScanner";
import { Button, Input, Select } from "@/app/ui/primitives";
import MoneyInput from "@/app/ui/MoneyInput";
import { UNIDADES } from "@/lib/mock-data";
import { buscarPorGtin, criarProdutosBipagem, type ProdutoBipagem } from "./actions";

// Cada linha da fila de bipagem. `status` guia o feedback visual enquanto o
// auto-fill roda. Só linhas com nome + NCM (8 díg.) são salvas.
type Linha = {
  gtin: string;
  nome: string;
  ncm: string;
  cest: string;
  unidade: string;
  preco: number;
  quantidade: number;
  status: "buscando" | "ok" | "manual" | "erro";
  aviso?: string;
};

// Fluxo de cadastro por bipagem em lote: bipe (leitor USB/câmera/digitação) →
// consulta o GTIN na SEFAZ → acumula na fila → revisa/edita → salva tudo de uma vez.
export default function BipagemModal({
  onFechar,
  onImportado,
}: {
  onFechar: () => void;
  onImportado: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [entrada, setEntrada] = useState("");
  const [scannerAberto, setScannerAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [controlar, setControlar] = useState(true);
  // Dedup síncrono: garante que só disparamos a consulta uma vez por GTIN, sem
  // depender do efeito colateral do updater do setLinhas (que pode rodar depois).
  const vistosRef = useRef<Set<string>>(new Set());

  const atualizar = useCallback((gtin: string, patch: Partial<Linha>) => {
    setLinhas((ls) => ls.map((l) => (l.gtin === gtin ? { ...l, ...patch } : l)));
  }, []);

  // Bipa um código: novo → adiciona à fila e consulta o GTIN; repetido → soma +1
  // na quantidade (contagem física de estoque bipando várias vezes).
  const bipar = useCallback((codigoBruto: string) => {
    const gtin = (codigoBruto || "").replace(/\D/g, "");
    if (![8, 12, 13, 14].includes(gtin.length)) return;
    if (vistosRef.current.has(gtin)) {
      setLinhas((ls) => ls.map((l) => (l.gtin === gtin ? { ...l, quantidade: l.quantidade + 1 } : l)));
      return;
    }
    vistosRef.current.add(gtin);

    setLinhas((ls) => [{ gtin, nome: "", ncm: "", cest: "", unidade: "UN", preco: 0, quantidade: 1, status: "buscando" }, ...ls]);

    void buscarPorGtin(gtin)
      .then((r) => {
        if (r.ok) {
          atualizar(gtin, { nome: r.nome, ncm: r.ncm, cest: r.cest, status: r.nome && r.ncm ? "ok" : "manual" });
        } else {
          atualizar(gtin, { status: "manual", aviso: r.naoEncontrado ? "Não encontrado — preencha à mão." : r.erro });
        }
      })
      .catch((e) => atualizar(gtin, { status: "erro", aviso: e instanceof Error ? e.message : String(e) }));
  }, [atualizar]);

  function submitEntrada() {
    const v = entrada.trim();
    if (!v) return;
    bipar(v);
    setEntrada("");
  }

  function remover(gtin: string) {
    vistosRef.current.delete(gtin); // permite bipar de novo depois de remover
    setLinhas((ls) => ls.filter((l) => l.gtin !== gtin));
  }

  // Obrigatórios p/ cadastrar: nome e preço (e quantidade, se controlar estoque).
  // NCM é opcional — nem todo produto tem na base; pode ser preenchido depois.
  const prontas = linhas.filter((l) => l.nome.trim() && l.preco > 0 && (!controlar || l.quantidade > 0));

  async function salvar() {
    if (!prontas.length) return;
    setSalvando(true);
    try {
      const itens: ProdutoBipagem[] = prontas.map((l) => ({
        codigoBarras: l.gtin,
        nome: l.nome.trim(),
        unidade: l.unidade,
        ncm: l.ncm.replace(/\D/g, ""),
        preco: l.preco,
        cest: l.cest,
        quantidade: l.quantidade,
      }));
      await criarProdutosBipagem(itens, controlar);
      onImportado();
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  const pendentes = linhas.length - prontas.length;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Cadastrar por código de barras"
      largura="max-w-5xl"
      rodape={
        <div className="flex w-full items-center justify-between">
          <span className="text-sm text-[var(--muted)]">
            {linhas.length} bipado{linhas.length === 1 ? "" : "s"}
            {pendentes > 0 && <> · <span className="text-[var(--warning)]">{pendentes} incompleto{pendentes === 1 ? "" : "s"}</span></>}
          </span>
          <div className="flex gap-2">
            <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || !prontas.length}>
              {salvando ? "Salvando…" : `Cadastrar ${prontas.length || ""}`.trim()}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitEntrada(); } }}
            inputMode="numeric"
            placeholder="Bipe com o leitor ou digite o código e tecle Enter…"
          />
          <Button type="button" variante="secondary" onClick={() => setScannerAberto(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 8v8" /><path d="M11 8v8" /><path d="M15 8v8" /></svg>
            Câmera
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--muted)] max-w-[60%]">
            Leitor USB/bluetooth funciona direto no campo acima. Bipar o mesmo código de novo soma +1 na quantidade. Nome/NCM/CEST vêm automáticos — confira e ajuste o que faltar.
          </p>
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <input type="checkbox" checked={controlar} onChange={(e) => setControlar(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Dar entrada no estoque (usar a quantidade bipada)
          </label>
        </div>

        {linhas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--muted)]">
            Nenhum produto bipado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="py-2 pr-2 font-medium">GTIN</th>
                  <th className="px-2 py-2 font-medium">Nome <span className="text-[var(--danger)]">*</span></th>
                  <th className="px-2 py-2 font-medium">NCM</th>
                  <th className="px-2 py-2 font-medium">Un.</th>
                  {controlar && <th className="px-2 py-2 text-right font-medium">Qtd <span className="text-[var(--danger)]">*</span></th>}
                  <th className="px-2 py-2 text-right font-medium">Preço <span className="text-[var(--danger)]">*</span></th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.gtin} className="border-b border-[var(--border)] align-top">
                    <td className="py-2 pr-2">
                      <span className="font-mono text-xs">{l.gtin}</span>
                      {l.status === "buscando" && <span className="mt-0.5 block text-[10px] text-[var(--muted)]">buscando…</span>}
                      {l.aviso && <span className="mt-0.5 block text-[10px] text-[var(--warning)]">{l.aviso}</span>}
                    </td>
                    <td className="px-2 py-2 min-w-[180px]">
                      <Input value={l.nome} onChange={(e) => atualizar(l.gtin, { nome: e.target.value })} placeholder="Nome do produto" />
                    </td>
                    <td className="px-2 py-2 w-[120px]">
                      <Input value={l.ncm} onChange={(e) => atualizar(l.gtin, { ncm: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="8 díg." />
                    </td>
                    <td className="px-2 py-2 w-[150px]">
                      <Select opcoes={UNIDADES} value={l.unidade} onChange={(e) => atualizar(l.gtin, { unidade: e.target.value })} />
                    </td>
                    {controlar && (
                      <td className="px-2 py-2 w-[90px]">
                        <Input
                          inputMode="numeric"
                          className="text-right"
                          value={String(l.quantidade)}
                          onChange={(e) => atualizar(l.gtin, { quantidade: Math.max(0, Number(e.target.value.replace(/[^\d]/g, "")) || 0) })}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2 w-[120px]">
                      <MoneyInput value={l.preco} onChange={(v) => atualizar(l.gtin, { preco: v })} />
                    </td>
                    <td className="py-2 pl-2">
                      <button type="button" onClick={() => remover(l.gtin)} aria-label="Remover" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[var(--danger)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BarcodeScanner
        continuo
        aberto={scannerAberto}
        onFechar={() => setScannerAberto(false)}
        onDetect={(codigo) => bipar(codigo)}
      />
    </Modal>
  );
}
