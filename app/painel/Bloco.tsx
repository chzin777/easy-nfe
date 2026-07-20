"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/app/ui/primitives";
import { baixarPdf, baixarXlsx, type LinhaExport } from "./exportar";

// Card padrão do painel: título, subtítulo e exportação do próprio conteúdo.
// PDF captura o bloco renderizado (gráfico incluso); XLSX leva os dados que
// alimentaram aquele bloco — por isso cada bloco declara suas próprias linhas.
export default function Bloco({
  id,
  titulo,
  subtitulo,
  linhas,
  nomeArquivo,
  acao,
  className = "",
  children,
}: {
  id: string;
  titulo: string;
  subtitulo?: string;
  // Ausente = bloco sem dados tabulares (só exporta PDF).
  linhas?: LinhaExport[];
  nomeArquivo: string;
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [gerando, setGerando] = useState(false);

  async function pdf() {
    setGerando(true);
    try {
      await baixarPdf(id, nomeArquivo);
    } finally {
      setGerando(false);
    }
  }

  const temDados = !!linhas?.length;

  return (
    <Card className={"flex flex-col " + className}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{subtitulo}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {acao}
          <BotaoExport rotulo="PDF" onClick={pdf} carregando={gerando} titulo="Baixar este bloco em PDF" />
          {temDados && (
            <BotaoExport
              rotulo="XLSX"
              onClick={() => baixarXlsx(nomeArquivo, linhas!, titulo)}
              titulo="Baixar os dados deste bloco em planilha"
            />
          )}
        </div>
      </div>
      {/* id fica no miolo: o PDF sai com o conteúdo, sem os próprios botões. */}
      <div id={id} className="flex-1 bg-[var(--surface)] px-5 pb-5">
        {children}
      </div>
    </Card>
  );
}

function BotaoExport({
  rotulo,
  onClick,
  carregando,
  titulo,
}: {
  rotulo: string;
  onClick: () => void;
  carregando?: boolean;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      title={titulo}
      className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] disabled:opacity-40"
    >
      {carregando ? "…" : rotulo}
    </button>
  );
}
