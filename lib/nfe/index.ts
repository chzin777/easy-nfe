import { carregarCertificado, type Certificado } from "./cert";
import { dataHoraBrasilia } from "./chave";
import { assinar } from "./sign";
import { montarNFe } from "./xml";
import { extrai, extraiBloco, soap } from "./soap";
import type {
  DadosNFe,
  ResultadoEmissao,
  ResultadoEvento,
  ResultadoStatus,
} from "./types";

export { carregarCertificado };
export type { Certificado };
export * from "./types";

// cStat de autorização concedida (NF-e) e de lote/serviço em operação.
const AUTORIZADA = "100";

// cNF: código numérico aleatório de 8 dígitos, obrigatoriamente ≠ nNF (regra cStat 897).
function gerarCNF(nNF: string): string {
  let cNF: string;
  do {
    cNF = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
  } while (cNF === nNF.padStart(8, "0"));
  return cNF;
}

// Consulta o status do serviço (smoke test do webservice + certificado).
export async function consultarStatus(
  cert: Certificado,
  tpAmb: "1" | "2",
  cUF: string,
): Promise<ResultadoStatus> {
  const cons =
    `<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`;
  const r = await soap(tpAmb, "status", cons, cert);
  const cStat = extrai(r.body, "cStat");
  return { ok: cStat === "107", cStat, xMotivo: extrai(r.body, "xMotivo") };
}

// Consulta a situação de uma NF-e pela chave (NfeConsultaProtocolo). Devolve o
// cStat do protocolo (100 = autorizada) e o nProt, p/ recuperar/cancelar notas
// que ficaram fora do sistema. Read-only.
export async function consultarNFe(
  cert: Certificado,
  tpAmb: "1" | "2",
  chave: string,
): Promise<{ cStat: string | null; xMotivo: string | null; nProt: string | null; protNFe: string | null }> {
  const cons =
    `<consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`;
  const r = await soap(tpAmb, "consulta", cons, cert);
  const prot = extraiBloco(r.body, "protNFe");
  // cStat do protNFe = situação da NF-e (100 autorizada, 101 cancelada, etc).
  // Sem protNFe, cai no cStat do retorno (217 = não consta, etc).
  const cStat = prot ? extrai(prot, "cStat") : extrai(r.body, "cStat");
  const xMotivo = prot ? extrai(prot, "xMotivo") : extrai(r.body, "xMotivo");
  const nProt = prot ? extrai(prot, "nProt") : null;
  return { cStat, xMotivo, nProt, protNFe: prot };
}

// Monta, assina e transmite a NF-e (autorização síncrona). Não persiste nada.
export async function emitirNFe(
  cert: Certificado,
  dados: DadosNFe,
): Promise<ResultadoEmissao> {
  const dhEmi = dataHoraBrasilia();
  const cNF = gerarCNF(dados.nNF);
  const { xml, chave, infNFeSupl, qrCode, urlChave } = montarNFe(dados, dhEmi, cNF);
  const assinada0 = assinar(xml, `NFe${chave}`, cert, "infNFe");
  // NFC-e: <infNFeSupl> entra entre </infNFe> e <Signature> (ordem do schema).
  // A assinatura referencia só infNFe, então injetar depois não a invalida.
  const nfeAssinada = infNFeSupl
    ? assinada0.replace(/<Signature\b/, `${infNFeSupl}<Signature`)
    : assinada0;

  const enviNFe =
    `<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>1</idLote><indSinc>1</indSinc>${nfeAssinada}</enviNFe>`;

  const r = await soap(dados.tpAmb, "autoriza", enviNFe, cert);

  const prot = extraiBloco(r.body, "protNFe");
  const cStat = prot ? extrai(prot, "cStat") : extrai(r.body, "cStat");
  const xMotivo = prot ? extrai(prot, "xMotivo") : extrai(r.body, "xMotivo");
  const nProt = prot ? extrai(prot, "nProt") : null;
  const ok = cStat === AUTORIZADA;

  const xmlAutorizado =
    ok && prot
      ? `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${nfeAssinada}${prot}</nfeProc>`
      : null;

  return { ok, cStat, xMotivo, chave, nProt, xmlAutorizado, xmlEnviado: nfeAssinada, qrCode, urlChave };
}

// Cancela uma NF-e autorizada (evento 110111). Exige nProt e justificativa (15-255 chars).
export async function cancelarNFe(
  cert: Certificado,
  params: {
    tpAmb: "1" | "2";
    cUF: string;
    cnpj: string;
    chave: string;
    nProt: string;
    justificativa: string;
  },
): Promise<ResultadoEvento> {
  const cnpj = params.cnpj.replace(/\D/g, "");
  const dh = dataHoraBrasilia();
  const nSeq = "1";
  const idEvento = `ID110111${params.chave}${nSeq.padStart(2, "0")}`;

  const infEvento =
    `<infEvento Id="${idEvento}">` +
    `<cOrgao>${params.cUF}</cOrgao><tpAmb>${params.tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${params.chave}</chNFe><dhEvento>${dh}</dhEvento><tpEvento>110111</tpEvento>` +
    `<nSeqEvento>${nSeq}</nSeqEvento><verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00"><descEvento>Cancelamento</descEvento>` +
    `<nProt>${params.nProt}</nProt>` +
    `<xJust>${params.justificativa.replace(/[<>&]/g, " ")}</xJust></detEvento></infEvento>`;
  const evento = `<evento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">${infEvento}</evento>`;
  const eventoAssinado = assinar(evento, idEvento, cert, "infEvento");
  const envEvento =
    `<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<idLote>1</idLote>${eventoAssinado}</envEvento>`;

  const r = await soap(params.tpAmb, "evento", envEvento, cert);
  const ret = extraiBloco(r.body, "retEvento");
  const cStat = ret ? extrai(ret, "cStat") : extrai(r.body, "cStat");
  const xMotivo = ret ? extrai(ret, "xMotivo") : extrai(r.body, "xMotivo");
  // 135 = evento registrado e vinculado, 155 = registrado fora de prazo.
  const ok = cStat === "135" || cStat === "155";
  return { ok, cStat, xMotivo, nProt: ret ? extrai(ret, "nProt") : null };
}
