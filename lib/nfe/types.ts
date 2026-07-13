// Estruturas de entrada para montagem da NF-e (modelo 55) e da NFC-e (65).
// Desacopladas dos tipos de UI (lib/types.ts) — só o que o XML precisa.

import type { TpEmis } from "./ufs";

export type EnderecoNFe = {
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
  municipio: string; // nome do município
  cMun?: string; // código IBGE (7 dígitos) já resolvido — preferido quando presente
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
  vDesc?: number; // desconto do item (já calculado, em R$)
  orig: string; // 0-8
  cest?: string;
  cBenef?: string; // código de benefício fiscal (GO etc.) p/ CST 40/41/50
  cst?: string; // tributação ICMS (regime normal): "40" isenção (padrão) | "20" redução de BC
  aliquotaIcms?: number; // pICMS p/ CST 20
  reducaoBaseIcms?: number; // pRedBC % p/ CST 20
};

export type DadosNFe = {
  tpAmb: "1" | "2"; // 1 produção | 2 homologação
  mod?: "55" | "65"; // modelo do documento (default 55)
  uf: string; // sigla da UF do emitente — resolve cUF, autorizadora e URLs do QR
  serie: string;
  // Contingência (só NF-e 55): 6 = SVC-AN, 7 = SVC-RS, conforme a UF. Entra na
  // chave de acesso (posição 35) e exige dhCont + xJust.
  tpEmis?: TpEmis;
  dhCont?: string; // AAAA-MM-DDThh:mm:ss-03:00 — entrada em contingência
  xJust?: string; // justificativa, 15-256 chars
  nNF: string; // número da nota
  natOp: string;
  emit: EmitenteNFe;
  dest?: DestinatarioNFe | null; // opcional na NFC-e (consumidor não identificado)
  itens: ItemNFe[];
  infCpl?: string;
  modFrete: string; // 0-4, 9
  // CSC + idCSC (cIdToken) — obrigatórios para gerar o QR Code da NFC-e.
  csc?: string;
  idCsc?: string;
};

export type ResultadoEmissao = {
  ok: boolean;
  cStat: string | null;
  xMotivo: string | null;
  chave: string;
  tpEmis: TpEmis; // o efetivamente usado (1 normal | 6 SVC-AN | 7 SVC-RS)
  nProt: string | null;
  xmlAutorizado: string | null; // nfeProc completo, quando autorizada
  xmlEnviado: string; // NFe assinada que foi transmitida
  qrCode?: string | null; // conteúdo do QR Code (NFC-e)
  urlChave?: string | null; // URL de consulta por chave (NFC-e)
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
