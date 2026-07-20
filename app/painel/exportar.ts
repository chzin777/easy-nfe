"use client";

import * as XLSX from "xlsx";
import { baixarElementoPdf } from "@/app/ui/danfePdf";

// Exportação por bloco do painel: cada indicador/gráfico exporta os PRÓPRIOS
// dados (XLSX) ou a própria imagem (PDF). Exportar o painel inteiro daria um
// arquivo que ninguém consegue usar em planilha.

// Linha genérica: cabeçalho vem das chaves do primeiro objeto.
export type LinhaExport = Record<string, string | number>;

function carimbo(): string {
  // Data no nome do arquivo evita sobrescrever export anterior na pasta.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function baixarXlsx(nome: string, linhas: LinhaExport[], aba = "Dados"): void {
  if (!linhas.length) return;
  const ws = XLSX.utils.json_to_sheet(linhas);
  // Largura das colunas pelo conteúdo — sem isso tudo sai truncado no Excel.
  const chaves = Object.keys(linhas[0]);
  ws["!cols"] = chaves.map((k) => ({
    wch: Math.min(40, Math.max(k.length + 2, ...linhas.map((l) => String(l[k] ?? "").length + 2))),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba.slice(0, 31));
  XLSX.writeFile(wb, `${nome}-${carimbo()}.xlsx`);
}

export async function baixarPdf(elId: string, nome: string): Promise<void> {
  await baixarElementoPdf(elId, `${nome}-${carimbo()}`);
}

// Valor monetário para planilha: número puro, sem "R$" nem separador de
// milhar — em texto o Excel não soma.
export function num(v: number): number {
  return Math.round(v * 100) / 100;
}
