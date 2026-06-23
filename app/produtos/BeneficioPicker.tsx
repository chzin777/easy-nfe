"use client";

import { useMemo, useState } from "react";
import { buscarBeneficioGO, obterBeneficioGO, CST_EMITIDA } from "@/lib/nfe/beneficios";
import Modal from "@/app/ui/Modal";

// Campo de Código de Benefício Fiscal (cBenef) com busca na tabela oficial
// da SEFAZ-GO, em modal. Espelha o NcmPicker. Dados são estáticos (sem rede),
// então filtra direto no client. `nomeProduto` pré-preenche a busca.
//
// O sistema emite CST 40 (isenção). O cBenef precisa ser do tipo Isenção, senão
// a SEFAZ recusa (cStat 931). Por isso a busca filtra por CST 40 por padrão, com
// opção de mostrar todos os tipos. Código incompatível dispara aviso no campo.
export default function BeneficioPicker({
  value,
  onChange,
  nomeProduto,
  cst,
}: {
  value: string;
  onChange: (v: string) => void;
  nomeProduto?: string;
  cst?: string; // CST da nota (filtra códigos compatíveis). Default 40 (isenção).
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [todosTipos, setTodosTipos] = useState(false);

  const cstAlvo = cst || CST_EMITIDA;
  const res = useMemo(
    () => buscarBeneficioGO(termo, { cst: todosTipos ? null : cstAlvo }),
    [termo, todosTipos, cstAlvo],
  );
  const atual = obterBeneficioGO(value);
  const incompativel = atual && atual.cst !== cstAlvo;
  const rotuloCst = cstAlvo === "20" ? "Redução de BC" : "Isenção";

  function abrir() {
    setTermo((nomeProduto ?? "").trim());
    setAberto(true);
  }

  const inputBase =
    "w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none transition-all " +
    "focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary-soft)] hover:border-slate-300";

  return (
    <>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
          placeholder="Ex.: GO811053"
          className={inputBase + " flex-1 font-mono"}
        />
        <button
          type="button"
          onClick={abrir}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 text-sm font-medium text-[var(--primary)] transition hover:bg-violet-100"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          Buscar
        </button>
      </div>
      {value && (
        atual ? (
          incompativel ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--danger)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
              <span>Este código é de <b>{atual.tipo}</b>, mas o produto está como <b>{rotuloCst}</b> (CST {cstAlvo}). Tipos diferentes — a SEFAZ recusa (931). Escolha um código de <b>{rotuloCst}</b>.</span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">{atual.tipo} · {atual.descricao}</p>
          )
        ) : (
          <p className="mt-1 text-xs text-[var(--danger)]">Código não consta na tabela GO — confira.</p>
        )
      )}

      <Modal aberto={aberto} onFechar={() => setAberto(false)} titulo="Buscar benefício fiscal (GO)" largura="max-w-2xl">
        <input
          autoFocus
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Descreva (ex.: cesta básica, carne, isenção) ou digite o código"
          className={inputBase}
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <input type="checkbox" checked={todosTipos} onChange={(e) => setTodosTipos(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
          Mostrar todos os tipos (a nota usa CST {cstAlvo} = {rotuloCst}; outros tipos serão recusados)
        </label>

        <div className="mt-3 max-h-[420px] min-h-[180px] overflow-auto">
          {termo.trim() === "" ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">Digite um termo ou código para buscar.</p>
          ) : res.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              Nenhum benefício de isenção encontrado. Tente outro termo{!todosTipos ? " ou marque “mostrar todos os tipos”" : ""}.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {res.map((b) => {
                const incomp = b.cst !== cstAlvo;
                return (
                  <li key={b.codigo}>
                    <button
                      type="button"
                      onClick={() => { onChange(b.codigo); setAberto(false); }}
                      className={
                        "flex w-full flex-col gap-1 px-3 py-2.5 text-left transition hover:bg-slate-50 " +
                        (b.codigo === value ? "bg-[var(--primary-soft)]" : "")
                      }
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-[var(--primary)]">{b.codigo}</span>
                        <span className={"rounded-full px-1.5 py-0.5 text-[10px] font-medium " + (incomp ? "bg-[var(--danger-soft,#fee2e2)] text-[var(--danger)]" : "bg-[var(--success-soft)] text-[var(--success)]")}>
                          {b.tipo}
                        </span>
                        {b.nfce === false && (
                          <span className="rounded-full bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">só NF-e</span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--foreground)]">{b.descricao}</span>
                      {b.fundamento && <span className="text-[11px] text-[var(--muted)]">{b.fundamento}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-[var(--muted)]">
          Tabela oficial SEFAZ-GO (IN 1.518/22-GSE). Confirme o código com seu contador — a escolha do benefício é responsabilidade do emitente.
        </p>
      </Modal>
    </>
  );
}
