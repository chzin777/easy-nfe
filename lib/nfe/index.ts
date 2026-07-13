import { carregarCertificado, type Certificado } from "./cert";
import { dataHoraBrasilia } from "./chave";
import { assinar } from "./sign";
import { montarNFe } from "./xml";
import { extrai, extraiBloco, soap } from "./soap";
import { codigoUF, contingenciaDaUF, type Modelo, type TpAmb } from "./ufs";
import type {
  DadosNFe,
  ResultadoEmissao,
  ResultadoEvento,
  ResultadoStatus,
} from "./types";

export { carregarCertificado, contingenciaDaUF, codigoUF };
export type { Certificado };
export * from "./types";

// Alvo de uma consulta/emissão: a UF do emitente + o modelo definem a
// autorizadora (própria, SVRS ou SVAN) — ver lib/nfe/ufs.ts.
type Alvo = { uf: string; mod: Modelo; tpAmb: TpAmb };

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
// Com tpEmis 6/7 checa a SVC — é assim que se confirma que a contingência está
// no ar antes de emitir nela.
export async function consultarStatus(
  cert: Certificado,
  alvo: Alvo & { tpEmis?: "1" | "6" | "7" },
): Promise<ResultadoStatus> {
  const cUF = codigoUF(alvo.uf);
  if (!cUF) throw new Error(`UF inválida: ${alvo.uf}`);
  const cons =
    `<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${alvo.tpAmb}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ>`;
  const r = await soap(alvo, "status", cons, cert);
  const cStat = extrai(r.body, "cStat");
  return { ok: cStat === "107", cStat, xMotivo: extrai(r.body, "xMotivo") };
}

// Consulta a situação de uma NF-e pela chave (NfeConsultaProtocolo). Devolve o
// cStat do protocolo (100 = autorizada) e o nProt, p/ recuperar/cancelar notas
// que ficaram fora do sistema. Read-only.
export async function consultarNFe(
  cert: Certificado,
  alvo: Alvo & { chave: string },
): Promise<{ cStat: string | null; xMotivo: string | null; nProt: string | null; protNFe: string | null }> {
  const cons =
    `<consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${alvo.tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${alvo.chave}</chNFe></consSitNFe>`;
  const r = await soap(alvo, "consulta", cons, cert);
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

  const tpEmis = dados.tpEmis ?? "1";
  const r = await soap(
    { uf: dados.uf, mod: dados.mod ?? "55", tpAmb: dados.tpAmb, tpEmis },
    "autoriza",
    enviNFe,
    cert,
  );

  const prot = extraiBloco(r.body, "protNFe");
  const cStat = prot ? extrai(prot, "cStat") : extrai(r.body, "cStat");
  const xMotivo = prot ? extrai(prot, "xMotivo") : extrai(r.body, "xMotivo");
  const nProt = prot ? extrai(prot, "nProt") : null;
  const ok = cStat === AUTORIZADA;

  const xmlAutorizado =
    ok && prot
      ? `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${nfeAssinada}${prot}</nfeProc>`
      : null;

  return { ok, cStat, xMotivo, chave, tpEmis, nProt, xmlAutorizado, xmlEnviado: nfeAssinada, qrCode, urlChave };
}

// Cancela uma NF-e autorizada (evento 110111). Exige nProt e justificativa (15-255 chars).
// O evento sempre vai para a autorizadora normal da UF — inclusive para nota
// autorizada em contingência SVC (a SVC não recebe cancelamento).
export async function cancelarNFe(
  cert: Certificado,
  params: Alvo & {
    cnpj: string;
    chave: string;
    nProt: string;
    justificativa: string;
  },
): Promise<ResultadoEvento> {
  const cUF = codigoUF(params.uf);
  if (!cUF) throw new Error(`UF inválida: ${params.uf}`);
  const cnpj = params.cnpj.replace(/\D/g, "");
  const dh = dataHoraBrasilia();
  const nSeq = "1";
  const idEvento = `ID110111${params.chave}${nSeq.padStart(2, "0")}`;

  const infEvento =
    `<infEvento Id="${idEvento}">` +
    `<cOrgao>${cUF}</cOrgao><tpAmb>${params.tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ>` +
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

  const r = await soap(
    { uf: params.uf, mod: params.mod, tpAmb: params.tpAmb },
    "evento",
    envEvento,
    cert,
  );
  const ret = extraiBloco(r.body, "retEvento");
  const cStat = ret ? extrai(ret, "cStat") : extrai(r.body, "cStat");
  const xMotivo = ret ? extrai(ret, "xMotivo") : extrai(r.body, "xMotivo");
  // 135 = evento registrado e vinculado, 155 = registrado fora de prazo.
  const ok = cStat === "135" || cStat === "155";
  return { ok, cStat, xMotivo, nProt: ret ? extrai(ret, "nProt") : null };
}
