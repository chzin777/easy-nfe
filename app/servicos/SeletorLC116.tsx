"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/app/ui/primitives";
import { LC116, buscarLC116, cTribNacDe } from "@/lib/nfse/lc116";

// Busca do serviço pela lista da LC 116. A pessoa digita o que faz — "vidro",
// "troca de óleo" — em vez de decorar código.
//
// O código de tributação nacional tem 6 dígitos: os 4 primeiros são o item e o
// subitem escolhidos aqui; os 2 últimos são o desdobramento nacional, que fica
// em 01 (o caso da maioria) e pode ser corrigido no campo ao lado.
export default function SeletorLC116({
  cTribNac,
  itemLista,
  onEscolher,
}: {
  cTribNac: string;
  itemLista: string;
  onEscolher: (v: { cTribNac: string; itemListaServico: string; descricao: string }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const resultados = useMemo(() => buscarLC116(busca).slice(0, 60), [busca]);

  // O rótulo do botão vem do item já escolhido, ou do código digitado à mão.
  const atual =
    LC116.find((s) => s.codigo === itemLista) ??
    (cTribNac.length >= 4
      ? LC116.find((s) => s.codigo.replace(/\D/g, "") === cTribNac.slice(0, 4))
      : undefined);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => { setAberto((v) => !v); setBusca(""); }}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-3.5 py-2.5 text-left text-sm transition hover:border-slate-300"
      >
        <span className="min-w-0">
          {atual ? (
            <>
              <span className="font-mono text-xs text-[var(--muted)]">{atual.codigo}</span>{" "}
              <span className="line-clamp-1">{atual.descricao}</span>
            </>
          ) : (
            <span className="text-slate-400">Buscar o serviço na lista oficial…</span>
          )}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-400">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="border-b border-[var(--border)] p-2">
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: vidro, conserto, consultoria, 14.01"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {resultados.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">Nada encontrado.</p>
            ) : (
              resultados.map((s) => (
                <button
                  key={s.codigo}
                  type="button"
                  onClick={() => {
                    onEscolher({
                      cTribNac: cTribNacDe(s.codigo),
                      itemListaServico: s.codigo,
                      descricao: s.descricao,
                    });
                    setAberto(false);
                  }}
                  className="block w-full cursor-pointer border-b border-[var(--border)] px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                >
                  <span className="font-mono text-xs text-[var(--primary)]">{s.codigo}</span>
                  <span className="mt-0.5 block text-sm leading-snug">{s.descricao}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
