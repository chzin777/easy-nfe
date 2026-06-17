import type { Opcao } from "./types";

// --- Tabelas de domínio fiscal (valores oficiais da NF-e) ---

// Origem da mercadoria (campo `orig` do ICMS).
export const ORIGENS: Opcao[] = [
  { value: "0", label: "0 - Nacional" },
  { value: "1", label: "1 - Estrangeira (importação direta)" },
  { value: "2", label: "2 - Estrangeira (adquirida no mercado interno)" },
  { value: "3", label: "3 - Nacional, importação > 40% e <= 70%" },
  { value: "4", label: "4 - Nacional (processos produtivos básicos)" },
  { value: "5", label: "5 - Nacional, importação <= 40%" },
  { value: "6", label: "6 - Estrangeira (importação direta, sem similar)" },
  { value: "7", label: "7 - Estrangeira (mercado interno, sem similar)" },
  { value: "8", label: "8 - Nacional, importação > 70%" },
];

// Unidades de medida comerciais.
export const UNIDADES: Opcao[] = [
  { value: "UN", label: "UN - Unidade" },
  { value: "PC", label: "PC - Peça" },
  { value: "CX", label: "CX - Caixa" },
  { value: "KG", label: "KG - Quilograma" },
  { value: "G", label: "G - Grama" },
  { value: "L", label: "L - Litro" },
  { value: "ML", label: "ML - Mililitro" },
  { value: "M", label: "M - Metro" },
  { value: "M2", label: "M² - Metro quadrado" },
  { value: "M3", label: "M³ - Metro cúbico" },
  { value: "PAR", label: "PAR - Par" },
  { value: "DZ", label: "DZ - Dúzia" },
];

// Tipo de contribuinte (indicador de IE do destinatário).
export const TIPOS_CONTRIBUINTE: Opcao[] = [
  { value: "1", label: "1 - Contribuinte ICMS" },
  { value: "2", label: "2 - Contribuinte isento de inscrição" },
  { value: "9", label: "9 - Não contribuinte" },
];

// Modalidade do frete (campo `modFrete`).
export const TIPOS_TRANSPORTE: Opcao[] = [
  { value: "0", label: "0 - Por conta do emitente (CIF)" },
  { value: "1", label: "1 - Por conta do destinatário (FOB)" },
  { value: "2", label: "2 - Por conta de terceiros" },
  { value: "3", label: "3 - Transporte próprio (remetente)" },
  { value: "4", label: "4 - Transporte próprio (destinatário)" },
  { value: "9", label: "9 - Sem frete" },
];

// Tipo de nota: modelo + sentido.
export const TIPOS_NOTA: Opcao[] = [
  { value: "55-saida", label: "NF-e (mod. 55) - Saída" },
  { value: "55-entrada", label: "NF-e (mod. 55) - Entrada" },
  { value: "65-saida", label: "NFC-e (mod. 65) - Saída" },
];

export const UFS: Opcao[] = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
].map((uf) => ({ value: uf, label: uf }));

// --- Helpers de rótulo ---

export function rotulo(opcoes: Opcao[], value: string): string {
  return opcoes.find((o) => o.value === value)?.label ?? value;
}

export const STATUS_NOTA: Opcao[] = [
  { value: "autorizada", label: "Autorizada" },
  { value: "rascunho", label: "Rascunho" },
  { value: "cancelada", label: "Cancelada" },
  { value: "rejeitada", label: "Rejeitada" },
  { value: "denegada", label: "Denegada" },
];
