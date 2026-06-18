import { montarChave } from "./chave";
import type { DadosNFe, EnderecoNFe, ItemNFe } from "./types";

// Escapa caracteres reservados de XML em conteúdo textual.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const n2 = (v: number) => v.toFixed(2);
const n4 = (v: number) => v.toFixed(4);
const n10 = (v: number) => v.toFixed(10);

// CPF/CNPJ -> tag correta pelo tamanho.
function tagDoc(doc: string): string {
  const d = doc.replace(/\D/g, "");
  return d.length === 14 ? `<CNPJ>${d}</CNPJ>` : `<CPF>${d}</CPF>`;
}

function enderXml(tag: string, e: EnderecoNFe): string {
  const cMun = e.cMun ?? "";
  const cep = e.cep.replace(/\D/g, "");
  return (
    `<${tag}>` +
    `<xLgr>${esc(e.xLgr)}</xLgr><nro>${esc(e.nro)}</nro>` +
    (e.xCpl ? `<xCpl>${esc(e.xCpl)}</xCpl>` : "") +
    `<xBairro>${esc(e.xBairro)}</xBairro>` +
    `<cMun>${cMun}</cMun><xMun>${esc(e.municipio)}</xMun><UF>${e.uf}</UF>` +
    `<CEP>${cep}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais>` +
    (e.fone ? `<fone>${e.fone.replace(/\D/g, "")}</fone>` : "") +
    `</${tag}>`
  );
}

// Bloco ICMS conforme o regime (CRT). Simples Nacional usa CSOSN; sem cálculo de
// imposto destacado (CSOSN 102). Regime Normal usa CST 40 (isenta) p/ manter a nota
// válida sem alíquotas cadastradas — refinar quando o cadastro de produto trouxer
// situação tributária própria.
function icmsXml(crt: string, orig: string): string {
  if (crt === "1" || crt === "2") {
    return `<ICMS><ICMSSN102><orig>${orig}</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`;
  }
  return `<ICMS><ICMS40><orig>${orig}</orig><CST>40</CST></ICMS40></ICMS>`;
}

function detXml(item: ItemNFe, nItem: number, crt: string): string {
  const vProd = item.qCom * item.vUnCom;
  return (
    `<det nItem="${nItem}">` +
    `<prod>` +
    `<cProd>${esc(item.cProd)}</cProd><cEAN>${esc(item.cEAN)}</cEAN>` +
    `<xProd>${esc(item.xProd)}</xProd><NCM>${item.ncm}</NCM>` +
    (item.cest ? `<CEST>${item.cest}</CEST>` : "") +
    `<CFOP>${item.cfop}</CFOP><uCom>${esc(item.uCom)}</uCom>` +
    `<qCom>${n4(item.qCom)}</qCom><vUnCom>${n10(item.vUnCom)}</vUnCom>` +
    `<vProd>${n2(vProd)}</vProd><cEANTrib>${esc(item.cEAN)}</cEANTrib>` +
    `<uTrib>${esc(item.uCom)}</uTrib><qTrib>${n4(item.qCom)}</qTrib>` +
    `<vUnTrib>${n10(item.vUnCom)}</vUnTrib><indTot>1</indTot>` +
    `</prod>` +
    `<imposto>` +
    icmsXml(crt, item.orig) +
    `<PIS><PISNT><CST>07</CST></PISNT></PIS>` +
    `<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>` +
    `</imposto>` +
    `</det>`
  );
}

// Monta a <NFe> não assinada e devolve também a chave de acesso.
// dhEmi e os campos variáveis de chave (cNF) são passados de fora p/ ser determinístico.
export function montarNFe(
  dados: DadosNFe,
  dhEmi: string,
  cNF: string,
): { xml: string; chave: string } {
  const cnpj = dados.emit.cnpj.replace(/\D/g, "");
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const chave = montarChave({
    cUF: dados.cUF,
    aamm,
    cnpj,
    mod: "55",
    serie: dados.serie,
    nNF: dados.nNF,
    tpEmis: "1",
    cNF,
  });

  const vTotal = dados.itens.reduce((s, i) => s + i.qCom * i.vUnCom, 0);
  const cMunFG = dados.emit.ender.cMun ?? "";
  const dets = dados.itens.map((it, i) => detXml(it, i + 1, dados.emit.crt)).join("");

  const ide =
    `<ide>` +
    `<cUF>${dados.cUF}</cUF><cNF>${cNF}</cNF><natOp>${esc(dados.natOp)}</natOp>` +
    `<mod>55</mod><serie>${dados.serie}</serie><nNF>${dados.nNF}</nNF>` +
    `<dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest>` +
    `<cMunFG>${cMunFG}</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis>` +
    `<cDV>${chave.slice(-1)}</cDV><tpAmb>${dados.tpAmb}</tpAmb><finNFe>1</finNFe>` +
    `<indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi>` +
    `<verProc>easy-nfe-1.0</verProc>` +
    `</ide>`;

  const emit =
    `<emit>` +
    `<CNPJ>${cnpj}</CNPJ><xNome>${esc(dados.emit.xNome)}</xNome>` +
    (dados.emit.xFant ? `<xFant>${esc(dados.emit.xFant)}</xFant>` : "") +
    enderXml("enderEmit", dados.emit.ender) +
    `<IE>${dados.emit.ie.replace(/\D/g, "")}</IE><CRT>${dados.emit.crt}</CRT>` +
    `</emit>`;

  const d = dados.dest;
  const dest =
    `<dest>` +
    tagDoc(d.doc) +
    `<xNome>${esc(d.xNome)}</xNome>` +
    // enderDest é opcional no schema; só inclui se houver logradouro (evita tags vazias = rejeição 225).
    (d.ender?.xLgr?.trim() ? enderXml("enderDest", d.ender) : "") +
    // Schema NFe 4.00: indIEDest precede IE. Inverter gera rejeição 225 (falha de schema).
    `<indIEDest>${d.indIEDest}</indIEDest>` +
    (d.indIEDest === "1" && d.ie ? `<IE>${d.ie.replace(/\D/g, "")}</IE>` : "") +
    `</dest>`;

  const total =
    `<total><ICMSTot>` +
    `<vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>` +
    `<vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${n2(vTotal)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc>` +
    `<vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS>` +
    `<vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${n2(vTotal)}</vNF><vTotTrib>0.00</vTotTrib>` +
    `</ICMSTot></total>`;

  const transp = `<transp><modFrete>${dados.modFrete}</modFrete></transp>`;
  const pag = `<pag><detPag><indPag>0</indPag><tPag>01</tPag><vPag>${n2(vTotal)}</vPag></detPag></pag>`;
  const infAdic = dados.infCpl
    ? `<infAdic><infCpl>${esc(dados.infCpl)}</infCpl></infAdic>`
    : "";

  const xml =
    `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<infNFe versao="4.00" Id="NFe${chave}">` +
    ide +
    emit +
    dest +
    dets +
    total +
    transp +
    pag +
    infAdic +
    `</infNFe></NFe>`;

  return { xml, chave };
}
