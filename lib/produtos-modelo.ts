// Modelo padrão de importação de produtos (CSV/XLSX).
import type { ColunaModelo, LinhaValidada } from "@/app/ui/ImportarPlanilhaModal";
import { ORIGENS, UNIDADES } from "./mock-data";

export type ProdutoImport = {
  codigoBarras: string;
  nome: string;
  unidade: string;
  ncm: string;
  origem: string;
  preco: number;
  descricao: string;
  cest: string;
  codigoBeneficio: string;
  creditoPresumidoIcms: string;
  reguladoAnp: boolean;
};

export const COLUNAS_PRODUTO: ColunaModelo[] = [
  { key: "nome", header: "Nome", obrigatorio: true, exemplo: "Camiseta branca P" },
  { key: "unidade", header: "Unidade", obrigatorio: true, exemplo: "UN", aliases: ["un", "unid", "unidade de medida"] },
  { key: "ncm", header: "NCM", obrigatorio: true, exemplo: "61091000" },
  { key: "origem", header: "Origem", obrigatorio: true, exemplo: "0", aliases: ["tipo de origem"] },
  { key: "preco", header: "Preco", obrigatorio: true, exemplo: "29,90", aliases: ["preço", "valor", "preco unitario", "preço unitário"] },
  { key: "codigoBarras", header: "Codigo de barras", obrigatorio: false, exemplo: "7891234567890", aliases: ["gtin", "ean", "codigo de barras", "código de barras"] },
  { key: "descricao", header: "Descricao", obrigatorio: false, exemplo: "", aliases: ["descrição"] },
  { key: "cest", header: "CEST", obrigatorio: false, exemplo: "" },
  { key: "codigoBeneficio", header: "Codigo do beneficio", obrigatorio: false, exemplo: "", aliases: ["codigo do beneficio", "código do benefício", "cbenef"] },
  { key: "creditoPresumidoIcms", header: "Credito presumido ICMS", obrigatorio: false, exemplo: "", aliases: ["credito presumido icms", "crédito presumido icms"] },
  { key: "reguladoAnp", header: "Regulado ANP", obrigatorio: false, exemplo: "nao", aliases: ["anp", "regulado anp"] },
];

// Converte texto de preço (BR ou US) em número. "1.234,56" -> 1234.56; "29.90" -> 29.9
export function parsePreco(v: string): number {
  const s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  let limpo = s;
  if (temVirgula && temPonto) limpo = s.replace(/\./g, "").replace(",", ".");
  else if (temVirgula) limpo = s.replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function parseBool(v: string): boolean {
  const s = String(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return ["sim", "s", "true", "1", "x", "verdadeiro"].includes(s);
}

const UNIDADES_VALIDAS = new Set(UNIDADES.map((u) => u.value));
const ORIGENS_VALIDAS = new Set(ORIGENS.map((o) => o.value));

export function validarLinhaProduto(
  bruto: Record<string, string>,
  linha: number,
): LinhaValidada<ProdutoImport> {
  const erros: string[] = [];
  const avisos: string[] = [];

  const nome = (bruto.nome ?? "").trim();
  if (!nome) erros.push("Nome é obrigatório.");

  let unidade = (bruto.unidade ?? "").trim().toUpperCase() || "UN";
  if (!UNIDADES_VALIDAS.has(unidade)) {
    avisos.push(`Unidade "${unidade}" não reconhecida — usando UN.`);
    unidade = "UN";
  }

  const ncm = (bruto.ncm ?? "").replace(/\D/g, "");
  if (!ncm) erros.push("NCM é obrigatório.");
  else if (ncm.length !== 8) avisos.push(`NCM "${ncm}" não tem 8 dígitos.`);

  let origem = (bruto.origem ?? "").trim() || "0";
  origem = origem.replace(/\D/g, "").charAt(0) || "0";
  if (!ORIGENS_VALIDAS.has(origem)) {
    avisos.push(`Origem "${bruto.origem}" inválida — usando 0 (Nacional).`);
    origem = "0";
  }

  const preco = parsePreco(bruto.preco ?? "");
  if (preco <= 0) avisos.push("Preço vazio ou zero.");

  const item: ProdutoImport = {
    nome,
    unidade,
    ncm,
    origem,
    preco,
    codigoBarras: (bruto.codigoBarras ?? "").replace(/\D/g, ""),
    descricao: (bruto.descricao ?? "").trim(),
    cest: (bruto.cest ?? "").replace(/\D/g, ""),
    codigoBeneficio: (bruto.codigoBeneficio ?? "").trim(),
    creditoPresumidoIcms: (bruto.creditoPresumidoIcms ?? "").trim(),
    reguladoAnp: parseBool(bruto.reguladoAnp ?? ""),
  };

  return { linha, item, erros, avisos };
}
