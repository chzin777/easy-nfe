// Parser de NF-e (leiaute nacional, namespace http://www.portalfiscal.inf.br/nfe).
// Browser-only: usa DOMParser. Chame a partir de um Client Component.

export type NfeItem = {
  nItem: number;
  cProd: string;
  cEAN: string;
  xProd: string;
  ncm: string;
  cest: string;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
};

export type NfePessoa = {
  documento: string;
  nome: string;
  ie: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
};

export type ParsedNFe = {
  chave: string;
  numero: string;
  serie: string;
  modelo: string;
  natOp: string;
  dhEmi: string;
  emitente: NfePessoa;
  destinatario: NfePessoa;
  itens: NfeItem[];
  valorProdutos: number;
  valorNota: number;
  // Dados de autorização (protNFe) — presentes em XML já autorizado (procNFe).
  protocolo: string; // nProt
  autorizadaEm: string; // dhRecbto
  autorizada: boolean; // cStat 100/150
  xml: string; // XML original, guardado p/ importar como nota emitida
};

function el(parent: Element | Document, tag: string): Element | null {
  return parent.getElementsByTagName(tag)[0] ?? null;
}

function txt(parent: Element | Document | null, tag: string): string {
  if (!parent) return "";
  const e = parent.getElementsByTagName(tag)[0];
  return e?.textContent?.trim() ?? "";
}

function num(parent: Element | Document | null, tag: string): number {
  const v = txt(parent, tag);
  if (!v) return 0;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function lerPessoa(bloco: Element | null): NfePessoa {
  if (!bloco) {
    return {
      documento: "", nome: "", ie: "", logradouro: "", numero: "",
      bairro: "", municipio: "", uf: "", cep: "", telefone: "",
    };
  }
  const ender = el(bloco, "enderEmit") ?? el(bloco, "enderDest");
  const documento = txt(bloco, "CNPJ") || txt(bloco, "CPF");
  return {
    documento,
    nome: txt(bloco, "xNome"),
    ie: txt(bloco, "IE"),
    logradouro: txt(ender, "xLgr"),
    numero: txt(ender, "nro"),
    bairro: txt(ender, "xBairro"),
    municipio: txt(ender, "xMun"),
    uf: txt(ender, "UF"),
    cep: txt(ender, "CEP"),
    telefone: txt(ender, "fone"),
  };
}

export function parseNFe(xml: string): ParsedNFe {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML inválido ou malformado.");
  }

  const infNFe = el(doc, "infNFe");
  if (!infNFe) {
    throw new Error("Não é um XML de NF-e (tag infNFe ausente).");
  }

  const chaveBruta = infNFe.getAttribute("Id") ?? "";
  const chave = chaveBruta.replace(/^NFe/, "");

  const ide = el(infNFe, "ide");
  const emit = el(infNFe, "emit");
  const dest = el(infNFe, "dest");
  const total = el(infNFe, "total");

  // Autorização (só existe em procNFe — XML já autorizado pela SEFAZ).
  const infProt = el(doc, "infProt");
  const cStat = txt(infProt, "cStat");

  const dets = Array.from(infNFe.getElementsByTagName("det"));
  const itens: NfeItem[] = dets.map((det, i) => {
    const prod = el(det, "prod");
    const cEAN = txt(prod, "cEAN");
    return {
      nItem: parseInt(det.getAttribute("nItem") ?? String(i + 1), 10),
      cProd: txt(prod, "cProd"),
      cEAN: cEAN === "SEM GTIN" ? "" : cEAN,
      xProd: txt(prod, "xProd"),
      ncm: txt(prod, "NCM"),
      cest: txt(prod, "CEST"),
      cfop: txt(prod, "CFOP"),
      uCom: txt(prod, "uCom"),
      qCom: num(prod, "qCom"),
      vUnCom: num(prod, "vUnCom"),
      vProd: num(prod, "vProd"),
    };
  });

  return {
    chave,
    numero: txt(ide, "nNF"),
    serie: txt(ide, "serie"),
    modelo: txt(ide, "mod"),
    natOp: txt(ide, "natOp"),
    dhEmi: txt(ide, "dhEmi") || txt(ide, "dEmi"),
    emitente: lerPessoa(emit),
    destinatario: lerPessoa(dest),
    itens,
    valorProdutos: num(total, "vProd"),
    valorNota: num(total, "vNF"),
    protocolo: txt(infProt, "nProt"),
    autorizadaEm: txt(infProt, "dhRecbto"),
    autorizada: cStat === "100" || cStat === "150",
    xml,
  };
}
