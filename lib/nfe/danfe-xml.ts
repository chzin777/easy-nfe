// Leitura do XML autorizado (nfeProc) para o DANFE. O documento impresso tem
// que espelhar o que a SEFAZ autorizou — então valores, tributos e CFOP saem
// daqui, não de recálculo em cima do banco.

import { extrai, extraiBloco } from "./soap";

export type TotaisNFe = {
  vBC: number; vICMS: number; vBCST: number; vST: number;
  vProd: number; vFrete: number; vSeg: number; vDesc: number;
  vOutro: number; vIPI: number; vNF: number;
};

export type ItemNFe = {
  codigo: string;
  nome: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number; // vProd − vDesc (líquido, igual ao resto do sistema)
  // Tributação do item. `cst` é o CSOSN (Simples) ou o CST (regime normal).
  cst: string;
  vBC: number;
  vICMS: number;
  pICMS: number;
  vIPI: number;
  pIPI: number;
};

function num(bloco: string | null, tag: string): number {
  if (!bloco) return 0;
  const v = extrai(bloco, tag);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function txt(bloco: string | null, tag: string): string {
  return (bloco && extrai(bloco, tag)) || "";
}

// Devolve null quando o XML não é um nfeProc utilizável (nota sem autorização).
export function lerNFe(xml: string | null): { totais: TotaisNFe; itens: ItemNFe[] } | null {
  if (!xml) return null;
  const tot = extraiBloco(xml, "ICMSTot");
  if (!tot) return null;

  const totais: TotaisNFe = {
    vBC: num(tot, "vBC"), vICMS: num(tot, "vICMS"),
    vBCST: num(tot, "vBCST"), vST: num(tot, "vST"),
    vProd: num(tot, "vProd"), vFrete: num(tot, "vFrete"),
    vSeg: num(tot, "vSeg"), vDesc: num(tot, "vDesc"),
    vOutro: num(tot, "vOutro"), vIPI: num(tot, "vIPI"),
    vNF: num(tot, "vNF"),
  };

  const itens: ItemNFe[] = [];
  for (const m of xml.matchAll(/<det\b[^>]*>[\s\S]*?<\/det>/g)) {
    const det = m[0];
    const prod = extraiBloco(det, "prod");
    // CST de ICMS mora dentro do bloco ICMS — fora dele, <CST> é de PIS/COFINS.
    const icms = extraiBloco(det, "ICMS");
    const ipi = extraiBloco(det, "IPI");
    const vProd = num(prod, "vProd");
    const vDesc = num(prod, "vDesc");

    itens.push({
      codigo: txt(prod, "cProd"),
      nome: txt(prod, "xProd"),
      ncm: txt(prod, "NCM"),
      cfop: txt(prod, "CFOP"),
      unidade: txt(prod, "uCom"),
      quantidade: num(prod, "qCom"),
      precoUnitario: num(prod, "vUnCom"),
      valorTotal: vProd - vDesc,
      cst: txt(icms, "CSOSN") || txt(icms, "CST"),
      vBC: num(icms, "vBC"),
      vICMS: num(icms, "vICMS"),
      pICMS: num(icms, "pICMS"),
      vIPI: num(ipi, "vIPI"),
      pIPI: num(ipi, "pIPI"),
    });
  }

  return { totais, itens };
}
