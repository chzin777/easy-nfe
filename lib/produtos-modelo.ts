// Modelo padrão de importação de produtos (CSV/XLSX).
// Usado tanto no cliente (gerar modelo + preview) quanto no servidor (guard final).
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

export type ColunaModelo = {
  key: keyof ProdutoImport;
  header: string;
  obrigatorio: boolean;
  exemplo: string;
  aliases?: string[];
};

// Ordem das colunas no modelo. Header é o que aparece na 1ª linha do arquivo.
export const COLUNAS_MODELO: ColunaModelo[] = [
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

// Normaliza um cabeçalho/valor para comparação (sem acento, minúsculo, sem espaço extra).
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Mapa headerNormalizado -> key, considerando header e aliases.
export function mapaColunas(): Map<string, keyof ProdutoImport> {
  const m = new Map<string, keyof ProdutoImport>();
  for (const c of COLUNAS_MODELO) {
    m.set(norm(c.header), c.key);
    m.set(norm(c.key), c.key);
    for (const a of c.aliases ?? []) m.set(norm(a), c.key);
  }
  return m;
}

// Converte texto de preço (BR ou US) em número. "1.234,56" -> 1234.56; "29.90" -> 29.9
export function parsePreco(v: string): number {
  const s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  let limpo = s;
  if (temVirgula && temPonto) {
    // '.' é separador de milhar, ',' decimal.
    limpo = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    limpo = s.replace(",", ".");
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function parseBool(v: string): boolean {
  const s = norm(String(v));
  return ["sim", "s", "true", "1", "x", "verdadeiro"].includes(s);
}

const UNIDADES_VALIDAS = new Set(UNIDADES.map((u) => u.value));
const ORIGENS_VALIDAS = new Set(ORIGENS.map((o) => o.value));

export type LinhaValidada = {
  linha: number; // nº da linha no arquivo (1 = primeira de dados)
  produto: ProdutoImport;
  erros: string[];
  avisos: string[];
};

// Valida e normaliza uma linha já mapeada por chave.
export function validarLinha(bruto: Partial<Record<keyof ProdutoImport, string>>, linha: number): LinhaValidada {
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

  const produto: ProdutoImport = {
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

  return { linha, produto, erros, avisos };
}
