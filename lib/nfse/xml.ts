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
  const tribMun =
    `<tribMun>` +
    tag("tribISSQN", v.tribISSQN) +
    tag("tpRetISSQN", v.tpRetISSQN) +
    // Alíquota só faz sentido quando o ISS é devido.
    (v.tribISSQN === "1" && v.aliquotaISS != null ? `<pAliq>${n2(v.aliquotaISS)}</pAliq>` : "") +
    `</tribMun>`;

  const tribFed = v.pisCofins
    ? `<tribFed><piscofins>${tag("CST", v.pisCofins.cst)}${tag("tpRetPisCofins", v.pisCofins.tpRet)}</piscofins></tribFed>`
    : "";

  const totTrib =
    v.pTotTribSN != null ? `<totTrib><pTotTribSN>${n2(v.pTotTribSN)}</pTotTribSN></totTrib>` : "";

  return (
    `<valores>` +
    `<vServPrest><vServ>${n2(v.valorServico)}</vServ></vServPrest>` +
    `<trib>${tribMun}${tribFed}${totTrib}</trib>` +
    `</valores>`
  );
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
