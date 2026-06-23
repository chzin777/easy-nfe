"use client";

import { useState } from "react";
import Modal from "@/app/ui/Modal";
import Danfe from "@/app/ui/Danfe";
import DanfeNFCe from "@/app/ui/DanfeNFCe";
import { Button } from "@/app/ui/primitives";
import { baixarDanfePdf } from "@/app/ui/danfePdf";
import { obterXmlNota, type NotaCompleta } from "./actions";

// Visualização do DANFE com botões para baixar o PDF e o XML. Reutilizável.
// `banner` (opcional) mostra o aviso de autorização logo após emitir.
export default function VisualizarDanfeModal({
  nota,
  onFechar,
  banner,
  onEmitirOutra,
}: {
  nota: NotaCompleta;
  onFechar: () => void;
  banner?: { cStat: string | null; nProt: string | null };
  onEmitirOutra?: () => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const elId = `danfe-print-${nota.id}`;

  async function pdf() {
    setGerando(true); setErro(null);
    try {
      await baixarDanfePdf(elId, nota.numero);
    } catch {
      setErro("Falha ao gerar o PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  async function xml() {
    setErro(null);
    const r = await obterXmlNota(nota.id);
    if (!r.ok) { setErro(r.erro); return; }
    const blob = new Blob([r.xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.nome; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`DANFE · Nota nº ${nota.numero}`}
      largura="max-w-4xl"
      rodape={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variante="secondary" onClick={onFechar}>Fechar</Button>
          {nota.status === "autorizada" && (
            <Button variante="secondary" onClick={xml}>Salvar XML</Button>
          )}
          <Button onClick={pdf} disabled={gerando}>{gerando ? "Gerando PDF…" : "Baixar PDF"}</Button>
          {onEmitirOutra && <Button onClick={onEmitirOutra}>Emitir outra</Button>}
        </div>
      }
    >
      {erro && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2.5 text-sm font-medium text-[var(--danger)]">
          <span>⚠ {erro}</span>
          <button onClick={() => setErro(null)} className="text-[var(--muted)] hover:text-[var(--foreground)]">✕</button>
        </div>
      )}
      {banner && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-3 py-2.5 text-sm font-medium text-[var(--success)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          <span>
            Nota autorizada pela SEFAZ (cStat {banner.cStat}){banner.nProt ? ` · protocolo ${banner.nProt}` : ""}. Baixe o PDF ou o XML abaixo.
          </span>
        </div>
      )}
      <div id={elId}>
        {nota.modelo === "65" ? <DanfeNFCe nota={nota} /> : <Danfe nota={nota} />}
      </div>
    </Modal>
  );
}
