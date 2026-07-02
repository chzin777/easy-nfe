import "server-only";
import { jsPDF } from "jspdf";

// PDF simplificado da NF-e gerado NO SERVIDOR (sem navegador) — usado no envio
// automático por e-mail. Não substitui o DANFE oficial (gerado no navegador no
// envio manual); é um resumo branded com os dados fiscais + itens. O documento
// com validade fiscal é o XML, que vai junto.

export type NotaPdf = {
  numero: number;
  serie: number;
  modelo: string;
  chaveAcesso: string | null;
  protocolo: string | null;
  valorTotal: unknown;
  emitidaEm: Date;
  ambiente: string; // "PRODUCAO" | "HOMOLOGACAO"
  emitente: {
    razaoSocial: string; cnpj: string; ie: string;
    logradouro: string; numero: string; bairro: string; municipio: string; uf: string; cep: string;
  };
  cliente: { nome: string; documento: string };
  itens: { nome: string; unidade: string | null; quantidade: unknown; precoUnitario: unknown; valorTotal: unknown }[];
};

const ROXO: [number, number, number] = [82, 39, 255];
const CINZA: [number, number, number] = [102, 112, 133];
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtQtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export function gerarPdfNotaBase64(nota: NotaPdf, logoB64: string): string {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 40;

  // --- Cabeçalho: logo + título ---
  try {
    doc.addImage(logoB64, "PNG", M, y, 128, 46); // ratio ~2.79 (863x309)
  } catch {
    // se a logo falhar, segue sem ela
  }
  doc.setTextColor(...ROXO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Nota Fiscal Eletrônica", W - M, y + 18, { align: "right" });
  doc.setTextColor(...CINZA);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nº ${nota.numero} · Série ${nota.serie} · Modelo ${nota.modelo}`, W - M, y + 34, { align: "right" });
  const amb = nota.ambiente === "PRODUCAO" ? "Produção" : "Homologação (sem valor fiscal)";
  doc.text(amb, W - M, y + 47, { align: "right" });
  y += 70;

  doc.setDrawColor(230, 232, 238);
  doc.line(M, y, W - M, y);
  y += 16;

  // --- Emitente / Destinatário (duas colunas) ---
  const colW = (W - M * 2 - 16) / 2;
  const eEnd = `${nota.emitente.logradouro}, ${nota.emitente.numero} — ${nota.emitente.bairro}`;
  const eCid = `${nota.emitente.municipio}/${nota.emitente.uf} · CEP ${nota.emitente.cep}`;
  y = bloco(doc, M, y, colW, "EMITENTE", [
    nota.emitente.razaoSocial,
    `CNPJ ${nota.emitente.cnpj}  ·  IE ${nota.emitente.ie || "—"}`,
    eEnd, eCid,
  ]);
  bloco(doc, M + colW + 16, y - alturaBloco(4), colW, "DESTINATÁRIO", [
    nota.cliente.nome,
    nota.cliente.documento ? `Doc. ${nota.cliente.documento}` : "Consumidor não identificado",
  ]);
  y += 8;

  // --- Dados da autorização ---
  doc.setDrawColor(236, 234, 246);
  doc.setFillColor(250, 249, 255);
  const hInfo = 58;
  doc.roundedRect(M, y, W - M * 2, hInfo, 8, 8, "FD");
  doc.setFontSize(8);
  doc.setTextColor(...CINZA);
  doc.text("CHAVE DE ACESSO", M + 12, y + 16);
  doc.text("PROTOCOLO", M + 12, y + 38);
  doc.text("EMISSÃO", W - M - 150, y + 16);
  doc.text("VALOR TOTAL", W - M - 150, y + 38);
  doc.setTextColor(29, 41, 57);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(nota.chaveAcesso || "—", M + 12, y + 27);
  doc.text(nota.protocolo || "—", M + 12, y + 49);
  doc.setFont("helvetica", "normal");
  doc.text(nota.emitidaEm.toLocaleDateString("pt-BR"), W - M - 150, y + 27);
  doc.setTextColor(...ROXO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(fmtBRL(Number(nota.valorTotal)), W - M - 150, y + 51);
  y += hInfo + 20;

  // --- Itens ---
  doc.setTextColor(...CINZA);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DESCRIÇÃO", M, y);
  doc.text("QTD", W - M - 190, y, { align: "right" });
  doc.text("UNIT.", W - M - 100, y, { align: "right" });
  doc.text("TOTAL", W - M, y, { align: "right" });
  y += 6;
  doc.setDrawColor(230, 232, 238);
  doc.line(M, y, W - M, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(29, 41, 57);
  doc.setFontSize(9);
  for (const it of nota.itens) {
    if (y > 780) { doc.addPage(); y = 40; }
    const nome = doc.splitTextToSize(it.nome, W - M * 2 - 210) as string[];
    doc.text(nome[0], M, y);
    doc.text(`${fmtQtd(Number(it.quantidade))} ${it.unidade ?? ""}`.trim(), W - M - 190, y, { align: "right" });
    doc.text(fmtBRL(Number(it.precoUnitario)), W - M - 100, y, { align: "right" });
    doc.text(fmtBRL(Number(it.valorTotal)), W - M, y, { align: "right" });
    y += 16;
  }

  // --- Rodapé ---
  y = Math.max(y, 800);
  doc.setDrawColor(230, 232, 238);
  doc.line(M, 806, W - M, 806);
  doc.setTextColor(...CINZA);
  doc.setFontSize(7.5);
  doc.text(
    "Resumo gerado pelo Easy-NFe. O documento com validade fiscal é o XML autorizado, anexado a este e-mail.",
    W / 2, 820, { align: "center" },
  );

  return doc.output("datauristring").split(",")[1] ?? "";
}

// Bloco de texto rotulado; devolve o novo y.
function bloco(doc: jsPDF, x: number, y: number, w: number, rotulo: string, linhas: string[]): number {
  doc.setFontSize(8);
  doc.setTextColor(...CINZA);
  doc.setFont("helvetica", "bold");
  doc.text(rotulo, x, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(29, 41, 57);
  for (const l of linhas) {
    const wrapped = doc.splitTextToSize(l, w) as string[];
    doc.text(wrapped[0], x, y);
    y += 13;
  }
  return y;
}

function alturaBloco(nLinhas: number): number {
  return 14 + nLinhas * 13;
}
