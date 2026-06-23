// Aviso heurístico de coerência NCM × nome do produto. NÃO bloqueia — só alerta
// quando o nome sugere uma família fiscal e o NCM informado foge dela. A
// classificação correta é responsabilidade do emitente; isto é só uma dica para
// pegar erro grosseiro (ex.: carne bovina com NCM de caprino).
//
// Cada regra: palavras-chave no nome → prefixos de NCM esperados (2-4 dígitos).

type Regra = { rotulo: string; termos: string[]; prefixos: string[] };

const REGRAS: Regra[] = [
  {
    // Carne salgada/seca (charque, carne de sol) = posição 0210, NÃO 0201/0204.
    rotulo: "carne salgada/seca",
    termos: ["carne de sol", "carne seca", "carne salgada", "charque", "jerked", "carne do sertao", "carne de sertao"],
    prefixos: ["0210"],
  },
  {
    rotulo: "carne / produto cárneo",
    termos: ["carne", "bovin", "boi", "suin", "porco", "frango", "ave", "peito", "coxa",
      "picanha", "costela", "alcatra", "acem", "patinho", "linguica", "salsicha", "bacon",
      "presunto", "mortadela", "charque", "carne de sol", "carne seca", "pernil", "fraldinha",
      "maminha", "cupim", "file", "miudo", "figado", "buchada", "pescado", "peixe", "tilapia"],
    // 02 (carnes in natura), 0210 (salgadas/secas), 16 (preparações de carne)
    prefixos: ["02", "16"],
  },
  {
    rotulo: "laticínio",
    termos: ["leite", "queijo", "manteiga", "iogurte", "requeijao", "creme de leite", "nata"],
    prefixos: ["04"],
  },
  {
    rotulo: "ovo",
    termos: ["ovo", "ovos"],
    prefixos: ["0407", "0408"],
  },
];

function norm(s: string): string {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Retorna um aviso quando o nome casa com uma regra mas o NCM (8 dígitos) não
// começa com nenhum prefixo esperado. Caso contrário, null.
export function avisoNcmIncoerente(nome: string, ncm: string): string | null {
  const dig = String(ncm).replace(/\D/g, "");
  if (dig.length !== 8) return null; // só avalia NCM completo
  const n = norm(nome);
  if (!n.trim()) return null;

  for (const r of REGRAS) {
    const casa = r.termos.some((t) => n.includes(t));
    if (!casa) continue;
    const ok = r.prefixos.some((p) => dig.startsWith(p));
    if (ok) return null; // casou com a família esperada — sem aviso
    return `O nome sugere ${r.rotulo}, mas o NCM ${dig} foge do esperado (${r.prefixos.join(", ")}…). Confirme a classificação fiscal.`;
  }
  return null;
}
