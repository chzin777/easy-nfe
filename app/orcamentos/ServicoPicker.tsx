"use client";

import { useRef, useState } from "react";
import Flutuante from "@/app/ui/Flutuante";
import SeletorMobile, { CardItem } from "@/app/ui/SeletorMobile";
import { useIsMobile } from "@/app/ui/useIsMobile";
import { formatBRL } from "@/lib/format";
import type { Servico } from "@/app/servicos/actions";
import NovoServicoModal from "@/app/servicos/NovoServicoModal";

export default function ServicoPicker({
  servicos,
  value,
  onChange,
  onCriado,
}: {
  servicos: Servico[];
  value: string;
  onChange: (id: string) => void;
  onCriado?: (s: Servico) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const sel = servicos.find((s) => s.id === value);
  const q = busca.trim().toLowerCase();
  const filtrados = q
    ? servicos.filter(
        (s) =>
          s.nome.toLowerCase().includes(q) ||
          (s.descricao && s.descricao.toLowerCase().includes(q)) ||
          s.cTribNac.toLowerCase().includes(q) ||
          s.itemListaServico.toLowerCase().includes(q)
      )
    : servicos;

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
          {sel ? `${sel.nome} - ${formatBRL(sel.valorUnit)}` : "Selecione ou pesquise o serviço…"}
        </span>
        <svg
          className={"shrink-0 text-slate-400 transition-transform " + (aberto ? "rotate-180" : "")}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Desktop: popover ancorado */}
      {!isMobile && (
        <Flutuante anchorRef={btnRef} aberto={aberto} onFechar={() => setAberto(false)}>
          <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-xl">
            <div className="border-b border-[var(--border)] p-2">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, código ou descrição…"
                className="w-full rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtrados.length === 0 ? (
                <li className="px-3 py-3 text-center text-xs text-[var(--muted)]">Nenhum serviço encontrado.</li>
              ) : (
                filtrados.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(s.id);
                        setAberto(false);
                        setBusca("");
                      }}
                      className={
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 " +
                        (s.id === value ? "bg-[var(--primary-soft)]" : "")
                      }
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{s.nome}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {s.itemListaServico ? `LC 116: ${s.itemListaServico}` : s.cTribNac ? `Código: ${s.cTribNac}` : "Serviço municipal"}
                        </span>
                      </span>
                      <span className="text-xs font-medium">{formatBRL(s.valorUnit)}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              onClick={() => {
                setModal(true);
                setAberto(false);
              }}
              className="flex w-full items-center gap-2 border-t border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Cadastrar novo serviço
            </button>
          </div>
        </Flutuante>
      )}

      {/* Mobile: bottom-sheet com cards */}
      {isMobile && (
        <SeletorMobile
          aberto={aberto}
          onFechar={() => setAberto(false)}
          titulo="Selecionar serviço"
          busca={busca}
          onBusca={setBusca}
          placeholder="Buscar por nome, código ou descrição…"
          onCadastrar={() => {
            setModal(true);
            setAberto(false);
          }}
          cadastrarLabel="Cadastrar novo serviço"
        >
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">Nenhum serviço encontrado.</p>
          ) : (
            filtrados.map((s) => (
              <CardItem
                key={s.id}
                selecionado={s.id === value}
                onClick={() => {
                  onChange(s.id);
                  setAberto(false);
                  setBusca("");
                }}
                titulo={s.nome}
                subtitulo={s.itemListaServico ? `LC 116: ${s.itemListaServico}` : s.cTribNac ? `Código: ${s.cTribNac}` : undefined}
                direita={<span className="shrink-0 text-sm font-semibold">{formatBRL(s.valorUnit)}</span>}
              />
            ))
          )}
        </SeletorMobile>
      )}

      {modal && (
        <NovoServicoModal
          onFechar={() => setModal(false)}
          onCriado={(s) => {
            setModal(false);
            if (onCriado) onCriado(s);
            onChange(s.id);
          }}
        />
      )}
    </div>
  );
}
