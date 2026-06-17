"use client";

import { useState } from "react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/app/ui/primitives";
import { buscarDFe, type DFeResultado } from "./actions";

export default function NotasRecebidasPage() {
  const [r, setR] = useState<DFeResultado | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function buscar() {
    setCarregando(true);
    setR(await buscarDFe("0"));
    setCarregando(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notas recebidas (DF-e)"
        subtitulo="Documentos emitidos contra o seu CNPJ, direto da SEFAZ."
        acao={<Button onClick={buscar} disabled={carregando}>{carregando ? "Buscando…" : "Buscar na SEFAZ"}</Button>}
      />

      {r && !r.ok && (
        <Card className="border-[var(--danger)]/30 bg-[var(--danger-soft)] p-5">
          <p className="text-sm font-medium text-[var(--danger)]">Falha na consulta</p>
          <p className="mt-1 text-sm text-slate-600">{r.erro}</p>
        </Card>
      )}

      {r && r.ok && (
        <>
          <Card className="flex flex-wrap items-center gap-4 p-4 text-sm">
            <span>Status SEFAZ: <Badge tom={r.cStat === "138" ? "success" : r.cStat === "137" ? "neutral" : "warning"}>cStat {r.cStat}</Badge></span>
            <span className="text-[var(--muted)]">{r.xMotivo}</span>
            <span className="text-[var(--muted)]">· ultNSU {r.ultNSU} · maxNSU {r.maxNSU}</span>
          </Card>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-slate-50 text-left text-xs uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-2.5">NSU</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Emitente</th>
                  <th className="px-4 py-2.5">Chave</th>
                  <th className="px-4 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {r.docs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted)]">Nenhum documento neste lote.</td></tr>
                ) : r.docs.map((d) => (
                  <tr key={d.nsu} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{d.nsu}</td>
                    <td className="px-4 py-3">{d.tipo}</td>
                    <td className="px-4 py-3">{d.emitente}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">{d.chave || "—"}</td>
                    <td className="px-4 py-3 text-right">{d.valor !== "—" ? `R$ ${d.valor}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {!r && !carregando && (
        <EmptyState titulo="Sem consulta ainda" descricao="Clique em “Buscar na SEFAZ” para puxar as notas emitidas contra o seu CNPJ." />
      )}
    </div>
  );
}
