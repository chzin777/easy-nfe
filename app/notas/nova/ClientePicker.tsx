"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Select } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_CONTRIBUINTE } from "@/lib/mock-data";
import type { Cliente } from "@/lib/types";
import { criarCliente, type ClienteInput } from "@/app/clientes/actions";

const novoVazio: ClienteInput = {
  tipoContribuinte: "1",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

export default function ClientePicker({
  clientes,
  value,
  onChange,
  onCriado,
}: {
  clientes: Cliente[];
  value: string;
  onChange: (id: string) => void;
  onCriado: (c: Cliente) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const sel = clientes.find((c) => c.id === value);
  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? clientes.filter((c) => c.nome.toLowerCase().includes(q) || c.documento.toLowerCase().includes(q) || String(c.codigoInterno).includes(q))
    : clientes;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={
          "flex w-full items-center justify-between rounded-lg border bg-white px-3.5 py-2.5 text-left text-sm transition " +
          (aberto ? "border-[var(--primary)]" : "border-[var(--border)] hover:border-slate-300")
        }
      >
        <span className={sel ? "font-medium" : "text-slate-400"}>
          {sel ? `${sel.codigoInterno} · ${sel.nome}` : "Selecione ou pesquise o cliente…"}
        </span>
        <svg className={"shrink-0 text-slate-400 transition-transform " + (aberto ? "rotate-180" : "")} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {aberto && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-xl">
          <div className="border-b border-[var(--border)] p-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ ou código…"
              className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-[var(--muted)]">Nenhum cliente encontrado.</li>
            ) : (
              filtrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(c.id); setAberto(false); setBusca(""); }}
                    className={"flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 " + (c.id === value ? "bg-[var(--primary-soft)]" : "")}
                  >
                    <span className="font-medium">{c.codigoInterno} · {c.nome}</span>
                    <span className="text-xs text-[var(--muted)]">{c.documento || "sem documento"}</span>
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
            Cadastrar novo cliente
          </button>
        </div>
      )}

      {modal && (
        <NovoClienteModal
          onFechar={() => setModal(false)}
          onCriado={(c) => { setModal(false); onCriado(c); }}
        />
      )}
    </div>
  );
}

function NovoClienteModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: (c: Cliente) => void }) {
  const [form, setForm] = useState<ClienteInput>(novoVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!form.nome.trim() || !form.documento.trim()) {
      setErro("Nome e CPF/CNPJ são obrigatórios.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const c = await criarCliente(form);
      onCriado(c);
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
      titulo="Novo cliente"
      largura="max-w-2xl"
      rodape={
        <>
          <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar e selecionar"}</Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo de contribuinte" required>
            <Select opcoes={TIPOS_CONTRIBUINTE} value={form.tipoContribuinte} onChange={(e) => setForm((f) => ({ ...f, tipoContribuinte: e.target.value }))} />
          </Field>
          <Field label="CPF ou CNPJ" required>
            <Input value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} />
          </Field>
          <Field label="Nome / Razão social" required className="sm:col-span-2">
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </Field>
          <Field label="Inscrição estadual" hint="Vazio se isento">
            <Input value={form.inscricaoEstadual} onChange={(e) => setForm((f) => ({ ...f, inscricaoEstadual: e.target.value }))} />
          </Field>
        </div>
        <ContatoFields value={form.contato} onChange={(contato) => setForm((f) => ({ ...f, contato }))} />
        <EnderecoFields value={form.endereco} onChange={(endereco) => setForm((f) => ({ ...f, endereco }))} />
        {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}
