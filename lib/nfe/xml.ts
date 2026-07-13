import { montarChave } from "./chave";
import { montarQrCode } from "./qrcode";
import { codigoUF, type TpEmis } from "./ufs";
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

// Escapa E trunca ao maxLength do schema NF-e 4.00. Campos de texto (xNome, xProd,
// endereço...) têm limite rígido; nomes/razões sociais reais passam de 60 e estouram
// o schema (rejeição 225 — ex.: razão social de associação com 105 chars em dest/xNome).
// Trunca no limite (a SEFAZ aceita o nome cortado) em vez de deixar a nota ser recusada.
function escLim(s: string, max: number): string {
  const t = s.trim();
  return esc(t.length > max ? t.slice(0, max) : t);
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
    `<xLgr>${escLim(e.xLgr, 60)}</xLgr><nro>${escLim(e.nro, 60)}</nro>` +
    (e.xCpl ? `<xCpl>${escLim(e.xCpl, 60)}</xCpl>` : "") +
    `<xBairro>${escLim(e.xBairro, 60)}</xBairro>` +
    `<cMun>${cMun}</cMun><xMun>${escLim(e.municipio, 60)}</xMun><UF>${e.uf}</UF>` +
    `<CEP>${cep}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais>` +
    (e.fone ? `<fone>${e.fone.replace(/\D/g, "")}</fone>` : "") +
    `</${tag}>`
  );
}

// Bloco ICMS conforme o regime (CRT). Simples Nacional usa CSOSN; sem cálculo de
// imposto destacado (CSOSN 102). Regime Normal usa CST 40 (isenta) p/ manter a nota
// válida sem alíquotas cadastradas — refinar quando o cadastro de produto trouxer
// situação tributária própria.
// cBenef: 8-10 alfanuméricos (ex.: GO811053). UF como GO rejeita CST isenta
// sem o código (cStat 930). ATENÇÃO: no schema 4.00 o cBenef é filho de <prod>
// (após CEST, antes de CFOP) — NÃO do grupo ICMS. Pô-lo no ICMS40 gera cStat 225.
function cBenefTag(cBenef?: string): string {
  const c = (cBenef ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{8,10}$/.test(c) ? `<cBenef>${c}</cBenef>` : "";
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Monta o grupo ICMS e devolve também vBC/vICMS do item p/ somar nos totais.
// Simples Nacional → CSOSN 102 (sem imposto destacado).
// Regime Normal: CST 40 (isenta, padrão) ou CST 20 (redução de base de cálculo).
function icmsXml(crt: string, item: ItemNFe, base: number): { xml: string; vBC: number; vICMS: number } {
  const orig = item.orig;
  if (crt === "1" || crt === "2") {
    return { xml: `<ICMS><ICMSSN102><orig>${orig}</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`, vBC: 0, vICMS: 0 };
  }
  if (item.cst === "20") {
    // Redução de base de cálculo. modBC=3 (valor da operação).
    const pRed = Math.min(Math.max(item.reducaoBaseIcms ?? 0, 0), 100);
    const pICMS = Math.max(item.aliquotaIcms ?? 0, 0);
    const vBC = r2(base * (1 - pRed / 100));
    const vICMS = r2(vBC * (pICMS / 100));
    const xml =
      `<ICMS><ICMS20>` +
      `<orig>${orig}</orig><CST>20</CST><modBC>3</modBC>` +
      `<pRedBC>${n2(pRed)}</pRedBC><vBC>${n2(vBC)}</vBC>` +
      `<pICMS>${n2(pICMS)}</pICMS><vICMS>${n2(vICMS)}</vICMS>` +
      `</ICMS20></ICMS>`;
    return { xml, vBC, vICMS };
  }
  // ICMS40 (CST 40 isenta): orig, CST. Sem cBenef aqui (vai no <prod>).
  return { xml: `<ICMS><ICMS40><orig>${orig}</orig><CST>40</CST></ICMS40></ICMS>`, vBC: 0, vICMS: 0 };
}

function detXml(item: ItemNFe, nItem: number, crt: string): { xml: string; vBC: number; vICMS: number } {
  const vProd = item.qCom * item.vUnCom;
  // Desconto do item (vDesc) — limitado ao valor do produto. Só inclui se > 0.
  const vDesc = Math.min(Math.max(item.vDesc ?? 0, 0), vProd);
  const descTag = vDesc > 0 ? `<vDesc>${n2(vDesc)}</vDesc>` : "";
  const icms = icmsXml(crt, item, vProd - vDesc);
  // CEST tem EXATAMENTE 7 dígitos no schema 4.00. Valor inválido (ex.: 8 dígitos)
  // gera rejeição 225 — então só inclui quando bater os 7 dígitos.
  const cestDig = (item.cest ?? "").replace(/\D/g, "");
  const cestTag = cestDig.length === 7 ? `<CEST>${cestDig}</CEST>` : "";
  const xml =
    `<det nItem="${nItem}">` +
    `<prod>` +
    `<cProd>${escLim(item.cProd, 60)}</cProd><cEAN>${esc(item.cEAN)}</cEAN>` +
    `<xProd>${escLim(item.xProd, 120)}</xProd><NCM>${item.ncm}</NCM>` +
    cestTag +
    cBenefTag(item.cBenef) + // schema: cBenef em <prod>, após CEST e antes do CFOP
    `<CFOP>${item.cfop}</CFOP><uCom>${esc(item.uCom)}</uCom>` +
    `<qCom>${n4(item.qCom)}</qCom><vUnCom>${n10(item.vUnCom)}</vUnCom>` +
    `<vProd>${n2(vProd)}</vProd><cEANTrib>${esc(item.cEAN)}</cEANTrib>` +
    `<uTrib>${esc(item.uCom)}</uTrib><qTrib>${n4(item.qCom)}</qTrib>` +
    `<vUnTrib>${n10(item.vUnCom)}</vUnTrib>` +
    descTag +
    `<indTot>1</indTot>` +
    `</prod>` +
    `<imposto>` +
    icms.xml +
    `<PIS><PISNT><CST>07</CST></PISNT></PIS>` +
    `<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>` +
    `</imposto>` +
    `</det>`;
  return { xml, vBC: icms.vBC, vICMS: icms.vICMS };
}

// Monta a <NFe> não assinada e devolve também a chave de acesso.
// dhEmi e os campos variáveis de chave (cNF) são passados de fora p/ ser determinístico.
// Quando mod=65 (NFC-e) devolve também o <infNFeSupl> (QR Code), que o emissor
// injeta após a assinatura (ordem do schema: infNFe → infNFeSupl → Signature).
export function montarNFe(
  dados: DadosNFe,
  dhEmi: string,
  cNF: string,
): {
  xml: string;
  chave: string;
  infNFeSupl: string | null;
  qrCode: string | null;
  urlChave: string | null;
} {
  const mod = dados.mod ?? "55";
  const nfce = mod === "65";
  const uf = dados.uf.toUpperCase();
  const cUF = codigoUF(uf);
  if (!cUF) throw new Error(`UF do emitente inválida: ${dados.uf}`);

  // Contingência SVC (tpEmis 6/7): só existe na NF-e 55 e exige dhCont + xJust.
  const tpEmis: TpEmis = dados.tpEmis ?? "1";
  if (tpEmis !== "1") {
    if (nfce) throw new Error("NFC-e não tem contingência SVC — a contingência do modelo 65 é offline.");
    if (!dados.dhCont) throw new Error("Contingência exige a data/hora de entrada (dhCont).");
    const just = dados.xJust?.trim() ?? "";
    if (just.length < 15 || just.length > 256) {
      throw new Error("A justificativa da contingência deve ter de 15 a 256 caracteres.");
    }
  }

  const cnpj = dados.emit.cnpj.replace(/\D/g, "");
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const chave = montarChave({
    cUF,
    aamm,
    cnpj,
    mod,
    serie: dados.serie,
    nNF: dados.nNF,
    tpEmis,
    cNF,
  });

  const vProdTotal = dados.itens.reduce((s, i) => s + i.qCom * i.vUnCom, 0);
  const vDescTotal = dados.itens.reduce(
    (s, i) => s + Math.min(Math.max(i.vDesc ?? 0, 0), i.qCom * i.vUnCom),
    0,
  );
  const vTotal = vProdTotal - vDescTotal; // vNF (líquido)
  const cMunFG = dados.emit.ender.cMun ?? "";
  const detsArr = dados.itens.map((it, i) => detXml(it, i + 1, dados.emit.crt));
  const dets = detsArr.map((d) => d.xml).join("");
  const vBCTotal = detsArr.reduce((s, d) => s + d.vBC, 0);
  const vICMSTotal = detsArr.reduce((s, d) => s + d.vICMS, 0);

  // NFC-e: DANFE em cupom (tpImp=4), operação presencial (indPres=1), sempre interna
  // (idDest=1). NF-e 55: DANFE normal (tpImp=1), indPres=1 (mantido como já estava).
  const tpImp = nfce ? "4" : "1";

  // Em contingência, dhCont/xJust fecham o <ide> (depois de verProc).
  const cont =
    tpEmis === "1"
      ? ""
      : `<dhCont>${dados.dhCont}</dhCont><xJust>${escLim(dados.xJust ?? "", 256)}</xJust>`;

  const ide =
    `<ide>` +
    `<cUF>${cUF}</cUF><cNF>${cNF}</cNF><natOp>${esc(dados.natOp)}</natOp>` +
    `<mod>${mod}</mod><serie>${dados.serie}</serie><nNF>${dados.nNF}</nNF>` +
    `<dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest>` +
    `<cMunFG>${cMunFG}</cMunFG><tpImp>${tpImp}</tpImp><tpEmis>${tpEmis}</tpEmis>` +
    `<cDV>${chave.slice(-1)}</cDV><tpAmb>${dados.tpAmb}</tpAmb><finNFe>1</finNFe>` +
    `<indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi>` +
    `<verProc>easy-nfe-1.0</verProc>` +
    cont +
    `</ide>`;

  const emit =
    `<emit>` +
    `<CNPJ>${cnpj}</CNPJ><xNome>${escLim(dados.emit.xNome, 60)}</xNome>` +
    (dados.emit.xFant ? `<xFant>${escLim(dados.emit.xFant, 60)}</xFant>` : "") +
    enderXml("enderEmit", dados.emit.ender) +
    `<IE>${dados.emit.ie.replace(/\D/g, "")}</IE><CRT>${dados.emit.crt}</CRT>` +
    `</emit>`;

  // dest é opcional na NFC-e (consumidor não identificado). Quando ausente,
  // omite todo o bloco. Quando presente, monta conforme o schema 4.00.
  const d = dados.dest;
  const dest = d
    ? `<dest>` +
      tagDoc(d.doc) +
      `<xNome>${escLim(d.xNome, 60)}</xNome>` +
      // enderDest é opcional no schema; só inclui se houver logradouro (evita tags vazias = rejeição 225).
      (d.ender?.xLgr?.trim() ? enderXml("enderDest", d.ender) : "") +
      // Schema NFe 4.00: indIEDest precede IE. Inverter gera rejeição 225 (falha de schema).
      `<indIEDest>${d.indIEDest}</indIEDest>` +
      (d.indIEDest === "1" && d.ie ? `<IE>${d.ie.replace(/\D/g, "")}</IE>` : "") +
      `</dest>`
    : "";

  const total =
    `<total><ICMSTot>` +
    `<vBC>${n2(vBCTotal)}</vBC><vICMS>${n2(vICMSTotal)}</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>` +
    `<vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>` +
    `<vProd>${n2(vProdTotal)}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>${n2(vDescTotal)}</vDesc>` +
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

  // QR Code (NFC-e). Sem CSC/idCSC não há como gerar o hash → erro explícito.
  let infNFeSupl: string | null = null;
  let qrCode: string | null = null;
  let urlChave: string | null = null;
  if (nfce) {
    if (!dados.csc || !dados.idCsc) {
      throw new Error(
        "NFC-e exige CSC e ID do CSC (cIdToken). Cadastre-os em Configurações antes de emitir.",
      );
    }
    ({ qrCode, urlChave } = montarQrCode({
      chave,
      uf,
      tpAmb: dados.tpAmb,
      idCsc: dados.idCsc,
      csc: dados.csc,
    }));
    infNFeSupl =
      `<infNFeSupl>` +
      `<qrCode>${esc(qrCode)}</qrCode>` +
      `<urlChave>${urlChave}</urlChave>` +
      `</infNFeSupl>`;
  }

  return { xml, chave, infNFeSupl, qrCode, urlChave };
}
