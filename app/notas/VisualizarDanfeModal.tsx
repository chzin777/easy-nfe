"use client";

import { useState } from "react";
import Modal from "@/app/ui/Modal";
import Danfe from "@/app/ui/Danfe";
import DanfeNFCe from "@/app/ui/DanfeNFCe";
import { Button, Input } from "@/app/ui/primitives";
import { baixarDanfePdf, gerarElementoPdfBase64 } from "@/app/ui/danfePdf";
import { obterXmlNota, enviarNotaPorEmail, type NotaCompleta } from "./actions";

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

  // Envio por e-mail
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [pedirEmail, setPedirEmail] = useState(false);
  const [emailManual, setEmailManual] = useState("");

  async function enviarEmail(paraOverride?: string) {
    setEnviando(true); setErro(null); setEnviado(null);
    try {
      // Gera o DANFE em PDF (base64) a partir do que já está renderizado.
      const pdfBase64 = await gerarElementoPdfBase64(elId);
      const r = await enviarNotaPorEmail(nota.id, { pdfBase64, paraOverride });
      if (!r.ok) {
        // Cliente sem e-mail → revela o campo para digitar um endereço.
        if (/não tem e-mail|e-mail válido/i.test(r.erro)) setPedirEmail(true);
        setErro(r.erro);
        return;
      }
      setEnviado(r.para);
      setPedirEmail(false);
    } catch {
      setErro("Falha ao gerar o PDF ou enviar o e-mail. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

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
          {nota.status === "autorizada" && (
            <Button variante="secondary" onClick={() => enviarEmail()} disabled={enviando || gerando}>
              {enviando ? "Enviando…" : "Enviar por e-mail"}
            </Button>
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
      {enviado && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--success-soft)] px-3 py-2.5 text-sm font-medium text-[var(--success)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>
          <span>Nota enviada por e-mail para <strong>{enviado}</strong>.</span>
        </div>
      )}
      {pedirEmail && !enviado && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium">Enviar para qual e-mail?</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              value={emailManual}
              onChange={(e) => setEmailManual(e.target.value)}
              placeholder="cliente@empresa.com"
              className="max-w-xs"
            />
            <Button onClick={() => enviarEmail(emailManual)} disabled={enviando || !emailManual}>
              {enviando ? "Enviando…" : "Enviar"}
            </Button>
          </div>
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
