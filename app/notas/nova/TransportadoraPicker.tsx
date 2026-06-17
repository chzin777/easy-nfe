"use client";

import { useRef, useState } from "react";
import { Button, Field, Input, Select } from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import Flutuante from "@/app/ui/Flutuante";
import { ContatoFields, EnderecoFields } from "@/app/ui/PessoaFields";
import { TIPOS_TRANSPORTE } from "@/lib/mock-data";
import type { Transportadora } from "@/lib/types";
import { criarTransportadora, type TransportadoraInput } from "@/app/transportadoras/actions";

const novoVazio: TransportadoraInput = {
  tipoTransporte: "0",
  documento: "",
  nome: "",
  inscricaoEstadual: "",
  contato: { telefone: "", email: "" },
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "GO" },
};

export default function TransportadoraPicker({
  transportadoras,
  value,
  onChange,
  onCriado,
}: {
  transportadoras: Transportadora[];
  value: string;
  onChange: (id: string) => void;
  onCriado: (t: Transportadora) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const sel = transportadoras.find((t) => t.id === value);
  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? transportadoras.filter((t) => t.nome.toLowerCase().includes(q) || t.documento.toLowerCase().includes(q) || String(t.codigoInterno).includes(q))
    : transportadoras;

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
          {sel ? `${sel.codigoInterno} · ${sel.nome}` : "Sem transporte / retirada"}
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
              placeholder="Buscar por nome, CPF/CNPJ ou código…"
              className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => { onChange(""); setAberto(false); setBusca(""); }}
                className={"flex w-full px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-slate-50 " + (value === "" ? "bg-[var(--primary-soft)]" : "")}
              >
                Sem transporte / retirada
              </button>
            </li>
            {filtrados.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => { onChange(t.id); setAberto(false); setBusca(""); }}
                  className={"flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 " + (t.id === value ? "bg-[var(--primary-soft)]" : "")}
                >
                  <span className="font-medium">{t.codigoInterno} · {t.nome}</span>
                  <span className="text-xs text-[var(--muted)]">{t.documento || "sem documento"}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => { setModal(true); setAberto(false); }}
            className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Cadastrar nova transportadora
          </button>
        </div>
      </Flutuante>

      {modal && <NovaTranspModal onFechar={() => setModal(false)} onCriado={(t) => { setModal(false); onCriado(t); }} />}
    </div>
  );
}

function NovaTranspModal({ onFechar, onCriado }: { onFechar: () => void; onCriado: (t: Transportadora) => void }) {
  const [form, setForm] = useState<TransportadoraInput>(novoVazio);
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
      const t = await criarTransportadora(form);
      onCriado(t);
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
      titulo="Nova transportadora"
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
          <Field label="Tipo de transporte" required>
            <Select opcoes={TIPOS_TRANSPORTE} value={form.tipoTransporte} onChange={(e) => setForm((f) => ({ ...f, tipoTransporte: e.target.value }))} />
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
