"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Card,
  Input,
  PageHeader,
  Select,
  EmptyState,
  Paginacao,
  paginar,
  formatBRL,
  formatData,
} from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import { explicarRejeicao } from "@/lib/nfe/mensagens";
import { listarEventos, type EventoEmissao, type TipoEvento } from "./actions";

const META: Record<TipoEvento, { rotulo: string; tom: "success" | "danger" | "warning" | "neutral" | "primary" }> = {
  autorizada: { rotulo: "Autorizada", tom: "success" },
  rejeitada: { rotulo: "Rejeitada", tom: "danger" },
  denegada: { rotulo: "Denegada", tom: "warning" },
  cancelada: { rotulo: "Cancelada", tom: "neutral" },
  processando: { rotulo: "Em processamento", tom: "primary" },
};

const OPCOES_TIPO = [
  { value: "", label: "Todos os eventos" },
  { value: "autorizada", label: "Autorizadas" },
  { value: "rejeitada", label: "Rejeitadas" },
  { value: "denegada", label: "Denegadas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "processando", label: "Em processamento" },
];

export default function EventosPage() {
  const [eventos, setEventos] = useState<EventoEmissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  useEffect(() => {
    listarEventos()
      .then((e) => { setEventos(e); setCarregando(false); })
      .catch(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return eventos.filter((e) => {
      if (filtro && e.tipo !== filtro) return false;
      if (q && !e.clienteNome.toLowerCase().includes(q) && !String(e.numero).includes(q) && !e.chaveAcesso.includes(q)) return false;
      return true;
    });
  }, [eventos, busca, filtro]);

  const pag = paginar(filtrados, pagina, porPagina);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of eventos) c[e.tipo] = (c[e.tipo] ?? 0) + 1;
    return c;
  }, [eventos]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Eventos"
        subtitulo="Linha do tempo de todas as emissões — sucesso, rejeições, cancelamentos e em processamento."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(Object.keys(META) as TipoEvento[]).map((t) => (
          <Card key={t} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{META[t].rotulo}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{contagem[t] ?? 0}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_240px]">
          <Input placeholder="Buscar por nº, cliente ou chave…" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
          <Select opcoes={OPCOES_TIPO} value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1); }} />
        </div>

        {carregando ? (
          <LightningLoader texto="Carregando eventos…" />
        ) : filtrados.length === 0 ? (
          <EmptyState titulo="Nenhum evento" descricao="As emissões aparecem aqui assim que você emitir notas." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {pag.fatia.map((e) => {
              const meta = META[e.tipo];
              const ex = e.tipo === "rejeitada" || e.tipo === "denegada" ? explicarRejeicao(e.cStat, e.xMotivo) : null;
              return (
                <li key={e.id} className="flex items-start gap-4 px-4 py-3">
                  <span className="mt-0.5 shrink-0">
                    <Badge tom={meta.tom}>{meta.rotulo}</Badge>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Nota nº {e.numero}/{e.serie} · {e.clienteNome}
                    </p>
                    {ex ? (
                      <p className="text-xs text-[var(--danger)]">
                        {ex.resumo}{ex.acao ? ` — ${ex.acao}` : ""}
                      </p>
                    ) : e.tipo === "cancelada" && e.xMotivo ? (
                      <p className="text-xs text-[var(--muted)]">Justificativa: {e.xMotivo}</p>
                    ) : e.chaveAcesso ? (
                      <p className="break-all font-mono text-[11px] text-[var(--muted)]">{e.chaveAcesso}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{formatBRL(e.valorTotal)}</p>
                    <p className="text-[11px] text-[var(--muted)]">{formatData(e.quando)}</p>
                    {e.cStat && <p className="text-[10px] text-[var(--muted)]">cStat {e.cStat}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Paginacao
          total={filtrados.length}
          pagina={pag.pagina}
          paginas={pag.paginas}
          porPagina={porPagina}
          onPagina={setPagina}
          onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
          rotulo="evento"
        />
      </Card>
    </div>
  );
}
