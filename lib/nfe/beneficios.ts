// Busca de Código de Benefício Fiscal (cBenef) — tabela oficial da SEFAZ-GO.
// Fonte: Instrução Normativa 1.518/22-GSE (Tabela de Códigos de Benefícios
// Fiscais de Goiás). Dados extraídos da versão HTML publicada pela Secretaria
// da Economia de GO. Função pura — pode rodar no client.
//
// IMPORTANTE: só cobre GO. A escolha do código correto é responsabilidade
// fiscal do emitente — confira com o contador antes de emitir em produção.
import tabela from "./cbenef-go.json";

export type Beneficio = {
  codigo: string; // ex.: GO811053
  nfe: boolean | null; // permitido em NF-e (mod 55)
  nfce: boolean | null; // permitido em NFC-e (mod 65)
  fundamento: string; // base legal (RCTE, Anexo, etc.)
  descricao: string;
  tipo: string; // Isenção, Não incidência, Redução de BC, etc.
  cst: string | null; // CST compatível com o tipo (40 isenção, 41 não inc., 20 red.BC…)
};

// CST que o sistema emite hoje p/ Regime Normal (nota isenta). O cBenef precisa
// ser de um tipo coerente com essa CST, senão a SEFAZ rejeita (cStat 931).
export const CST_EMITIDA = "40";

export const BENEFICIOS_GO: Beneficio[] = tabela as Beneficio[];

// Normaliza p/ busca (sem acento, minúsculo).
function norm(s: string): string {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const PALAVRAS = (s: string) => norm(s).split(/\s+/).filter(Boolean);

// Busca por código ou por termos na descrição/fundamento (todos os termos
// precisam aparecer). `modelo` filtra por compatibilidade NF-e (55) ou NFC-e (65).
export function buscarBeneficioGO(
  termo: string,
  opts?: { modelo?: "55" | "65"; limite?: number; cst?: string | null },
): Beneficio[] {
  const q = termo.trim();
  if (!q) return [];
  const limite = opts?.limite ?? 40;
  const modelo = opts?.modelo;

  // Código direto (ex.: "GO811053" ou "811053").
  const dig = q.replace(/\D/g, "");
  const codigoBusca = /^go/i.test(q) || dig.length >= 4;

  const termos = PALAVRAS(q);
  let base = modelo
    ? BENEFICIOS_GO.filter((b) => (modelo === "65" ? b.nfce !== false : b.nfe !== false))
    : BENEFICIOS_GO;
  // Filtra por CST compatível (ex.: só Isenção quando a nota usa CST 40).
  if (opts?.cst) base = base.filter((b) => b.cst === opts.cst);

  const res = base.filter((b) => {
    if (codigoBusca && norm(b.codigo).includes(norm(q.replace(/\s/g, "")))) return true;
    if (codigoBusca && dig && b.codigo.includes(dig)) return true;
    const alvo = norm(b.descricao + " " + b.fundamento);
    return termos.every((t) => alvo.includes(t));
  });

  // Código exato primeiro, depois descrição mais curta (mais específica).
  res.sort((a, b) => {
    const ax = norm(a.codigo) === norm(q.replace(/\s/g, "")) ? 0 : 1;
    const bx = norm(b.codigo) === norm(q.replace(/\s/g, "")) ? 0 : 1;
    return ax - bx || a.descricao.length - b.descricao.length;
  });
  return res.slice(0, limite);
}

// Retorna o benefício de um código exato (validação/preview), ou null.
export function obterBeneficioGO(codigo: string): Beneficio | null {
  const c = codigo.trim().toUpperCase();
  return BENEFICIOS_GO.find((b) => b.codigo === c) ?? null;
}
