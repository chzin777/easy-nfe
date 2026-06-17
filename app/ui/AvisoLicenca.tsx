"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

// Banner fixo de aviso de fatura atrasada, com contagem regressiva até o bloqueio.
export default function AvisoLicenca({
  competencia,
  valor,
  alvoBloqueio,
}: {
  competencia: string;
  valor: number;
  alvoBloqueio: string;
}) {
  const alvo = new Date(alvoBloqueio).getTime();
  const [restante, setRestante] = useState(() => alvo - Date.now());

  useEffect(() => {
    const t = setInterval(() => setRestante(alvo - Date.now()), 1000);
    return () => clearInterval(t);
  }, [alvo]);

  const seg = Math.max(0, Math.floor(restante / 1000));
  const dias = Math.floor(seg / 86400);
  const horas = Math.floor((seg % 86400) / 3600);
  const min = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  const timer = `${dias}d ${p(horas)}:${p(min)}:${p(s)}`;

  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [ano, mes] = competencia.split("-");
  const compLabel = `${nomes[Number(mes) - 1] ?? mes}/${ano}`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-xs font-medium text-amber-950">
      <span className="flex items-center gap-1.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        Fatura {compLabel} ({formatBRL(valor)}) em atraso.
      </span>
      <span>
        Regularize em <span className="font-mono font-bold tabular-nums">{timer}</span> ou o acesso será bloqueado.
      </span>
    </div>
  );
}
