"use client";

import { useRef, useState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Flutuante from "@/app/ui/Flutuante";
import { ORIGENS, UNIDADES } from "@/lib/mock-data";
import { formatBRL } from "@/lib/format";
import type { Produto } from "@/lib/types";
import { criarProduto, type ProdutoInput } from "@/app/produtos/actions";

const novoVazio: ProdutoInput = {
  codigoBarras: "",
  nome: "",
  unidade: "UN",
  ncm: "",
  origem: "0",
  preco: 0,
  descricao: "",
  cest: "",
  codigoBeneficio: "",
  creditoPresumidoIcms: "",
  reguladoAnp: false,
};

export default function ProdutoPicker({
  produtos,
  value,
  onChange,
  onCriado,
}: {
  produtos: Produto[];
  value: string;
  onChange: (id: string) => void;
  onCriado: (p: Produto) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const sel = produtos.find((p) => p.id === value);
  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? produtos.filter((p) => p.nome.toLowerCase().includes(q) || p.codigoBarras.toLowerCase().includes(q) || p.ncm.includes(q) || String(p.codigoInterno).includes(q))
    : produtos;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          "flex w-full items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-left text-sm transition " +
          (aberto ? "border-[var(--primary)]" : "border-[var(--border)] hover:border-slate-300")
        }
      >
        <span className={sel ? "font-medium" : "text-slate-400"}>
          {sel ? `${sel.codigoInterno} · ${sel.nome}` : "Selecione ou pesquise o produto…"}
        </span>
        <svg className={"shrink-0 text-slate-400 transition-transform " + (aberto ? "rotate-180" : "")} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      <Flutuante anchorRef={btnRef} aberto={aberto} onFechar={() => setAberto(false)}>
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-xl">
          <div className="border-b border-[var(--border)] p-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, GTIN, NCM ou código…"
              className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-[var(--muted)]">Nenhum produto encontrado.</li>
            ) : (
              filtrados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(p.id); setAberto(false); setBusca(""); }}
                    className={"flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 " + (p.id === value ? "bg-[var(--primary-soft)]" : "")}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{p.codigoInterno} · {p.nome}</span>
                      <span className="text-xs text-[var(--muted)]">NCM {p.ncm || "—"}</span>
                    </span>
                    <span className="text-xs font-medium">{formatBRL(p.preco)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => { setModal(true); setAberto(false); }}
            className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Cadastrar novo produto
          </button>
        </div>
      </Flutuante>

      {modal && <NovoProdutoModal onFechar={() => setModal(false)} onCriado={(p) => { setModal(false); onCriado(p); }} />}
    </div>
  );
}

function NovoProdutoModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: (p: Produto) => void }) {
  const [form, setForm] = useState<ProdutoInput>(novoVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function set<K extends keyof ProdutoInput>(k: K, v: ProdutoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar() {
    if (!form.nome.trim() || !form.ncm.trim()) {
      setErro("Nome e NCM são obrigatórios.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const p = await criarProduto(form);
      onCriado(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Novo produto"
      largura="max-w-2xl"
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar e selecionar"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Código de barras (GTIN/EAN)">
          <Input value={form.codigoBarras} onChange={(e) => set("codigoBarras", e.target.value)} placeholder="Sem GTIN" />
        </Field>
        <Field label="Nome do produto" required>
          <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
        </Field>
        <Field label="Unidade" required>
          <Select opcoes={UNIDADES} value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
        </Field>
        <Field label="NCM" required hint="8 dígitos">
          <Input value={form.ncm} onChange={(e) => set("ncm", e.target.value)} placeholder="00000000" />
        </Field>
        <Field label="Origem" required>
          <Select opcoes={ORIGENS} value={form.origem} onChange={(e) => set("origem", e.target.value)} />
        </Field>
        <Field label="Preço" required>
          <Input type="number" step="0.01" min="0" value={form.preco} onChange={(e) => set("preco", Number(e.target.value))} />
        </Field>
        <Field label="CEST">
          <Input value={form.cest} onChange={(e) => set("cest", e.target.value)} placeholder="0000000" />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </Field>
      </div>
      {erro && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{erro}</p>}
    </Modal>
  );
}
