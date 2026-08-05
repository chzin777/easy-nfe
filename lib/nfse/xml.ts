import type { DadosDPS } from "./types";

// Monta o XML da DPS (NFS-e Padrão Nacional).
//
// Regras que o XSD impõe e que quebram a emissão em silêncio se ignoradas:
//  - a ordem dos elementos é <xs:sequence>: trocar dois campos de lugar rejeita;
//  - valores monetários vão como string com exatamente 2 casas ("169.00");
//  - dhEmi precisa do fuso real (-03:00), não UTC nem string montada na mão;
//  - o Id da DPS tem 45 caracteres com números zero-preenchidos.

const NS = "http://www.sped.fazenda.gov.br/nfse";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const dig = (s: string) => (s ?? "").replace(/\D/g, "");
const n2 = (v: number) => v.toFixed(2);
const tag = (nome: string, valor?: string | null) =>
  valor === undefined || valor === null || valor === "" ? "" : `<${nome}>${esc(valor)}</${nome}>`;

// Data/hora no fuso de Brasília com offset explícito. Fazer isso com fatia de
// string do toISOString() produz horário errado — o valor tem que ser convertido.
export function dhBrasilia(d: Date): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(d); // "2026-07-13 16:53:35"
  return `${partes.replace(" ", "T")}-03:00`;
}

export function dataBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(d);
}

// Id da DPS — 45 caracteres:
//   "DPS" + cLocEmi(7) + tpInsc(1) + CNPJ/CPF(14) + serie(5) + nDPS(15)
// tpInsc: 1 = CPF, 2 = CNPJ. CPF entra preenchido com zeros à esquerda até 14.
export function idDps(dados: DadosDPS): string {
  const doc = dig(dados.prestador.cnpj);
  const tpInsc = doc.length === 11 ? "1" : "2";
  return (
    "DPS" +
    dig(dados.cLocEmi).padStart(7, "0") +
    tpInsc +
    doc.padStart(14, "0") +
    String(dados.serie).padStart(5, "0") +
    String(dados.numero).padStart(15, "0")
  );
}

function enderecoXml(e: DadosDPS["tomador"]["endereco"]): string {
  return (
    `<end>` +
    `<endNac>${tag("cMun", dig(e.cMun))}${tag("CEP", dig(e.cep))}</endNac>` +
    tag("xLgr", e.logradouro) +
    tag("nro", e.numero) +
    tag("xCpl", e.complemento) +
    tag("xBairro", e.bairro) +
    `</end>`
  );
}

function prestadorXml(p: DadosDPS["prestador"]): string {
  const doc = dig(p.cnpj);
  return (
    `<prest>` +
    (doc.length === 11 ? tag("CPF", doc) : tag("CNPJ", doc)) +
    tag("IM", dig(p.im ?? "")) +
    tag("fone", dig(p.fone ?? "")) +
    tag("email", p.email) +
    `<regTrib>` +
    tag("opSimpNac", p.regTrib.opSimpNac) +
    tag("regApTribSN", p.regTrib.regApTribSN) +
    tag("regEspTrib", p.regTrib.regEspTrib) +
    `</regTrib>` +
    `</prest>`
  );
}

function tomadorXml(t: DadosDPS["tomador"]): string {
  const doc = dig(t.cnpj ?? t.cpf ?? "");
  return (
    `<toma>` +
    (doc.length === 11 ? tag("CPF", doc) : tag("CNPJ", doc)) +
    tag("IM", dig(t.im ?? "")) +
    tag("xNome", t.nome) +
    enderecoXml(t.endereco) +
    tag("fone", dig(t.fone ?? "")) +
    tag("email", t.email) +
    `</toma>`
  );
}

function valoresXml(v: DadosDPS["valores"]): string {
  // Alíquota só entra quando o ISS é devido E o prestador é optante do Simples.
  // Fora do Simples quem calcula o ISS é a prefeitura, e informar pAliq é
  // rejeição (E0617). opSimpNac = 1 é "não optante".
  const podeAliquota = v.tribISSQN === "1" && v.opSimpNac !== undefined && v.opSimpNac !== "1";
  const tribMun =
    `<tribMun>` +
    tag("tribISSQN", v.tribISSQN) +
    // Ordem do XSD: tpImunidade vem antes de tpRetISSQN. Só vale p/ imune.
    (v.tribISSQN === "2" ? tag("tpImunidade", v.tpImunidade ?? "0") : "") +
    tag("tpRetISSQN", v.tpRetISSQN) +
    (podeAliquota && v.aliquotaISS != null ? `<pAliq>${n2(v.aliquotaISS)}</pAliq>` : "") +
    `</tribMun>`;

  const tribFed = v.pisCofins
    ? `<tribFed><piscofins>${tag("CST", v.pisCofins.cst)}${tag("tpRetPisCofins", v.pisCofins.tpRet)}</piscofins></tribFed>`
    : "";

  // totTrib é obrigatório no XSD e aceita uma escolha entre quatro grupos.
  // Optante do Simples usa o percentual da alíquota do Simples, ou indTotTrib=0
  // ("não informar valor estimado", Decreto 8.264/2014). Não optante não pode
  // usar nenhum dos dois (E0713), então vai o percentual por esfera — federal e
  // estadual em zero, municipal com a alíquota do ISS.
  const totTrib = !podeAliquota
    ? `<totTrib><pTotTrib>` +
      `<pTotTribFed>${n2(0)}</pTotTribFed>` +
      `<pTotTribEst>${n2(0)}</pTotTribEst>` +
      `<pTotTribMun>${n2(v.aliquotaISS ?? 0)}</pTotTribMun>` +
      `</pTotTrib></totTrib>`
    : v.pTotTribSN != null
      ? `<totTrib><pTotTribSN>${n2(v.pTotTribSN)}</pTotTribSN></totTrib>`
      : `<totTrib><indTotTrib>0</indTotTrib></totTrib>`;

  return (
    `<valores>` +
    `<vServPrest><vServ>${n2(v.valorServico)}</vServ></vServPrest>` +
    `<trib>${tribMun}${tribFed}${totTrib}</trib>` +
    `</valores>`
  );
}

// Alíquota e ISS que a prefeitura aplicou de fato, lidos do XML da NFS-e
// autorizada. Fora do Simples é ela quem calcula, então o que o usuário digitou
// é só estimativa — o que vale é isto.
export function valoresAplicados(xmlNfse: string): { aliqISS?: number; valorISS?: number } {
  return { aliqISS: num(xmlNfse, "pAliqAplic"), valorISS: num(xmlNfse, "vISSQN") };
}

// --- Leitura do XML autorizado -----------------------------------------------
// A NFS-e devolvida traz a DPS inteira embutida, então um leitor por nome de
// tag alcança tanto o que o fisco calculou (infNFSe/valores) quanto o que foi
// declarado (DPS/infDPS/valores). Os nomes não colidem entre os dois blocos.

const tagRe = (nome: string) => new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${nome}>`);

function txt(xml: string, nome: string): string | undefined {
  const m = tagRe(nome).exec(xml);
  const v = m?.[1]?.trim();
  return v ? v : undefined;
}

function num(xml: string, nome: string): number | undefined {
  const v = txt(xml, nome);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Tudo que o DANFSe imprime além do que já está no banco: os tributos que a
// prefeitura apurou, as retenções federais e os textos que só o fisco preenche
// (nome da atividade, município de incidência, NBS).
export type TributosNfse = {
  // identificação devolvida pelo fisco
  nNFSe?: string;
  dhProc?: string;
  verAplic?: string;
  xLocEmi?: string;
  xLocPrestacao?: string;
  xLocIncid?: string;
  xTribNac?: string;
  xTribMun?: string;
  xNBS?: string;
  // DPS que originou a nota
  nDPS?: string;
  serieDPS?: string;
  dhEmiDPS?: string;
  // regime do prestador
  opSimpNac?: string;
  regApTribSN?: string;
  regEspTrib?: string;
  // valores declarados
  vServ?: number;
  vDescIncond?: number;
  vDescCond?: number;
  vDedRed?: number;
  // ISSQN apurado
  vBC?: number;
  pAliqAplic?: number;
  vISSQN?: number;
  tpRetISSQN?: string;
  tribISSQN?: string;
  tpImunidade?: string;
  nProcesso?: string;
  // tributação federal
  cstPisCofins?: string;
  tpRetPisCofins?: string;
  vPis?: number;
  vCofins?: number;
  vRetCSLL?: number;
  vRetIRRF?: number;
  vRetCP?: number;
  // totais
  vTotalRet?: number;
  vLiq?: number;
  vTotTrib?: number;
  pTotTribSN?: number;
  pTotTribFed?: number;
  pTotTribEst?: number;
  pTotTribMun?: number;
  // IBS/CBS (reforma) — só sai impresso quando o fisco devolve algum valor
  vBCIBSCBS?: number;
  vCBS?: number;
  vIBSEst?: number;
  vIBSMun?: number;
};

// Lê o XML da NFS-e autorizada (ou, na falta dele, a DPS assinada).
export function tributosNfse(xml: string | null | undefined): TributosNfse {
  if (!xml) return {};
  return {
    nNFSe: txt(xml, "nNFSe"),
    dhProc: txt(xml, "dhProc"),
    verAplic: txt(xml, "verAplic"),
    xLocEmi: txt(xml, "xLocEmi"),
    xLocPrestacao: txt(xml, "xLocPrestacao"),
    xLocIncid: txt(xml, "xLocIncid"),
    xTribNac: txt(xml, "xTribNac"),
    xTribMun: txt(xml, "xTribMun"),
    xNBS: txt(xml, "xNBS"),
    nDPS: txt(xml, "nDPS"),
    serieDPS: txt(xml, "serie"),
    dhEmiDPS: txt(xml, "dhEmi"),
    opSimpNac: txt(xml, "opSimpNac"),
    regApTribSN: txt(xml, "regApTribSN"),
    regEspTrib: txt(xml, "regEspTrib"),
    vServ: num(xml, "vServ"),
    vDescIncond: num(xml, "vDescIncond"),
    vDescCond: num(xml, "vDescCond"),
    vDedRed: num(xml, "vDedRed"),
    vBC: num(xml, "vBC"),
    pAliqAplic: num(xml, "pAliqAplic"),
    vISSQN: num(xml, "vISSQN"),
    tpRetISSQN: txt(xml, "tpRetISSQN"),
    tribISSQN: txt(xml, "tribISSQN"),
    tpImunidade: txt(xml, "tpImunidade"),
    nProcesso: txt(xml, "nProcesso"),
    cstPisCofins: txt(xml, "CST"),
    tpRetPisCofins: txt(xml, "tpRetPisCofins"),
    vPis: num(xml, "vPis"),
    vCofins: num(xml, "vCofins"),
    vRetCSLL: num(xml, "vRetCSLL"),
    vRetIRRF: num(xml, "vRetIRRF"),
    vRetCP: num(xml, "vRetCP"),
    vTotalRet: num(xml, "vTotalRet"),
    vLiq: num(xml, "vLiq"),
    vTotTrib: num(xml, "vTotTrib"),
    pTotTribSN: num(xml, "pTotTribSN"),
    pTotTribFed: num(xml, "pTotTribFed"),
    pTotTribEst: num(xml, "pTotTribEst"),
    pTotTribMun: num(xml, "pTotTribMun"),
    vBCIBSCBS: num(xml, "vBCIBSCBS"),
    vCBS: num(xml, "vCBS"),
    vIBSEst: num(xml, "vIBSUF") ?? num(xml, "vIBSEst"),
    vIBSMun: num(xml, "vIBSMun"),
  };
}

// Endereço do QR Code do DANFSe (NT 008/2026): portal nacional + chave de
// acesso. Produção restrita tem host próprio.
export function urlConsultaNfse(chave: string, ambiente: "producao" | "homologacao"): string {
  const host = ambiente === "producao" ? "www.nfse.gov.br" : "www.producaorestrita.nfse.gov.br";
  return `https://${host}/ConsultaPublica/?tpc=1&chave=${chave}`;
}

// XML da DPS pronto para assinar. A assinatura entra como irmã de <infDPS>,
// dentro de <DPS> — ver assinarDps().
export function montarDps(dados: DadosDPS, verAplic: string): { xml: string; id: string } {
  const id = idDps(dados);
  const s = dados.servico;

  const xml =
    `<DPS xmlns="${NS}" versao="1.00">` +
    `<infDPS Id="${id}">` +
    tag("tpAmb", dados.ambiente) +
    tag("dhEmi", dhBrasilia(dados.emitidaEm)) +
    tag("verAplic", verAplic) +
    tag("serie", String(dados.serie)) +
    tag("nDPS", String(dados.numero)) +
    tag("dCompet", dataBrasilia(dados.competencia)) +
    tag("tpEmit", dados.tpEmit) +
    tag("cLocEmi", dig(dados.cLocEmi)) +
    prestadorXml(dados.prestador) +
    tomadorXml(dados.tomador) +
    `<serv>` +
    `<locPrest>${tag("cLocPrestacao", dig(s.cLocPrestacao))}</locPrest>` +
    `<cServ>` +
    tag("cTribNac", dig(s.cTribNac)) +
    tag("cTribMun", dig(s.cTribMun ?? "")) +
    tag("xDescServ", s.descricao) +
    tag("cNBS", dig(s.cNBS ?? "")) +
    `</cServ>` +
    `</serv>` +
    valoresXml(dados.valores) +
    `</infDPS>` +
    `</DPS>`;

  return { xml, id };
}
