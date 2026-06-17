// Estruturas de entrada para montagem da NF-e (modelo 55).
// Desacopladas dos tipos de UI (lib/types.ts) — só o que o XML precisa.

export type EnderecoNFe = {
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
  municipio: string; // nome; o código IBGE é resolvido por municipios.ts
  uf: string;
  cep: string; // só dígitos
  fone?: string; // só dígitos
};

export type EmitenteNFe = {
  cnpj: string; // só dígitos
  xNome: string;
  xFant?: string;
  ie: string; // só dígitos
  crt: string; // 1 Simples | 2 Simples excesso | 3 Regime Normal
  ender: EnderecoNFe;
};

export type DestinatarioNFe = {
  doc: string; // CPF ou CNPJ, só dígitos
  xNome: string;
  ie?: string;
  indIEDest: string; // 1 contribuinte | 2 isento | 9 não contribuinte
  ender: EnderecoNFe;
};

export type ItemNFe = {
  cProd: string;
  cEAN: string; // GTIN ou "SEM GTIN"
  xProd: string;
  ncm: string;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  orig: string; // 0-8
  cest?: string;
};

export type DadosNFe = {
  tpAmb: "1" | "2"; // 1 produção | 2 homologação
  cUF: string; // código IBGE da UF (GO = 52)
  serie: string;
  nNF: string; // número da nota
  natOp: string;
  emit: EmitenteNFe;
  dest: DestinatarioNFe;
  itens: ItemNFe[];
  infCpl?: string;
  modFrete: string; // 0-4, 9
};

export type ResultadoEmissao = {
  ok: boolean;
  cStat: string | null;
  xMotivo: string | null;
  chave: string;
  nProt: string | null;
  xmlAutorizado: string | null; // nfeProc completo, quando autorizada
  xmlEnviado: string; // NFe assinada que foi transmitida
};

export type ResultadoEvento = {
  ok: boolean;
  cStat: string | null;
  xMotivo: string | null;
  nProt: string | null;
};

export type ResultadoStatus = {
  ok: boolean;
  cStat: string | null;
  xMotivo: string | null;
};
