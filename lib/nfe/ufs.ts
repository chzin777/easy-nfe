// Registry das autorizadoras da SEFAZ por UF.
//
// Cada UF é atendida por uma autorizadora — a própria SEFAZ estadual ou uma
// Sefaz Virtual (SVRS / SVAN). A escolha muda por MODELO: BA, PE e MA têm
// autorizadora própria na NF-e (55) mas usam a SVRS na NFC-e (65).
//
// Quando a autorizadora de origem sai do ar, a NF-e 55 pode ser emitida em
// contingência por uma Sefaz Virtual de Contingência (SVC-AN ou SVC-RS,
// conforme a UF). A NFC-e não tem SVC: sua contingência é offline (tpEmis=9).
//
// Fontes cruzadas (Portal Nacional da NF-e, sped-nfe, ACBr) — jul/2026.

export type Servico = "status" | "autoriza" | "retAutoriza" | "consulta" | "evento";
export type Modelo = "55" | "65";
export type TpAmb = "1" | "2"; // 1 produção | 2 homologação
// 1 normal | 6 contingência SVC-AN | 7 contingência SVC-RS
export type TpEmis = "1" | "6" | "7";

type Urls = Record<Servico, string>;
type PorAmbiente = Record<TpAmb, Urls>;

// Código IBGE da UF (cUF) — vai na chave de acesso e no cMunFG.
export const UF_IBGE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

export function codigoUF(uf: string): string | null {
  return UF_IBGE[uf?.toUpperCase()] ?? null;
}

// ----------------------------------------------------------------------------
// Autorizadora por UF
// ----------------------------------------------------------------------------

// NF-e (55). Autorizadoras próprias: AM, BA, GO, MG, MS, MT, PE, PR, RS, SP.
// SVAN atende só MA. As demais UFs vão para a SVRS.
const AUTORIZADORA_55: Record<string, string> = {
  AC: "SVRS", AL: "SVRS", AM: "AM", AP: "SVRS", BA: "BA",
  CE: "SVRS", DF: "SVRS", ES: "SVRS", GO: "GO", MA: "SVAN",
  MG: "MG", MS: "MS", MT: "MT", PA: "SVRS", PB: "SVRS",
  PE: "PE", PI: "SVRS", PR: "PR", RJ: "SVRS", RN: "SVRS",
  RO: "SVRS", RR: "SVRS", RS: "RS", SC: "SVRS", SE: "SVRS",
  SP: "SP", TO: "SVRS",
};

// NFC-e (65). Próprias: AM, GO, MG, MS, MT, PR, RS, SP. BA, PE e MA — que têm
// autorizadora própria na 55 — usam SVRS aqui.
const AUTORIZADORA_65: Record<string, string> = {
  AC: "SVRS", AL: "SVRS", AM: "AM", AP: "SVRS", BA: "SVRS",
  CE: "SVRS", DF: "SVRS", ES: "SVRS", GO: "GO", MA: "SVRS",
  MG: "MG", MS: "MS", MT: "MT", PA: "SVRS", PB: "SVRS",
  PE: "SVRS", PI: "SVRS", PR: "PR", RJ: "SVRS", RN: "SVRS",
  RO: "SVRS", RR: "SVRS", RS: "RS", SC: "SVRS", SE: "SVRS",
  SP: "SP", TO: "SVRS",
};

// Sefaz Virtual de Contingência da UF (só NF-e 55). Define o tpEmis: 6 = SVC-AN,
// 7 = SVC-RS. Usar a SVC errada é rejeição certa.
const SVC_POR_UF: Record<string, "SVC-AN" | "SVC-RS"> = {
  AC: "SVC-AN", AL: "SVC-AN", AM: "SVC-RS", AP: "SVC-AN", BA: "SVC-RS",
  CE: "SVC-AN", DF: "SVC-AN", ES: "SVC-AN", GO: "SVC-RS", MA: "SVC-RS",
  MG: "SVC-AN", MS: "SVC-RS", MT: "SVC-RS", PA: "SVC-AN", PB: "SVC-AN",
  PE: "SVC-RS", PI: "SVC-AN", PR: "SVC-RS", RJ: "SVC-AN", RN: "SVC-AN",
  RO: "SVC-AN", RR: "SVC-AN", RS: "SVC-AN", SC: "SVC-AN", SE: "SVC-AN",
  SP: "SVC-AN", TO: "SVC-AN",
};

// ----------------------------------------------------------------------------
// Endpoints (versão 4.00). Paths NÃO são uniformes entre autorizadoras
// (AM/MT usam NfeConsulta4 e RecepcaoEvento4; SP é tudo minúsculo) — estão
// verbatim de propósito.
// ----------------------------------------------------------------------------

const WS_55: Record<string, PorAmbiente> = {
  AM: {
    "1": {
      status: "https://nfe.sefaz.am.gov.br/services2/services/NfeStatusServico4",
      autoriza: "https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4",
      retAutoriza: "https://nfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4",
      consulta: "https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4",
      evento: "https://nfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4",
    },
    "2": {
      status: "https://homnfe.sefaz.am.gov.br/services2/services/NfeStatusServico4",
      autoriza: "https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4",
      retAutoriza: "https://homnfe.sefaz.am.gov.br/services2/services/NfeRetAutorizacao4",
      consulta: "https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4",
      evento: "https://homnfe.sefaz.am.gov.br/services2/services/RecepcaoEvento4",
    },
  },
  BA: {
    "1": {
      status: "https://nfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx",
      autoriza: "https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx",
      consulta: "https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
      evento: "https://nfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    },
    "2": {
      status: "https://hnfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx",
      autoriza: "https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx",
      retAutoriza: "https://hnfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx",
      consulta: "https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
      evento: "https://hnfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    },
  },
  GO: {
    "1": {
      status: "https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4",
      autoriza: "https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",
      retAutoriza: "https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4",
      consulta: "https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4",
      evento: "https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://homolog.sefaz.go.gov.br/nfe/services/NFeStatusServico4",
      autoriza: "https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",
      retAutoriza: "https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4",
      consulta: "https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4",
      evento: "https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4",
    },
  },
  MG: {
    "1": {
      status: "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4",
      autoriza: "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4",
      retAutoriza: "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4",
      consulta: "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4",
      evento: "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4",
      autoriza: "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4",
      retAutoriza: "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4",
      consulta: "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4",
      evento: "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4",
    },
  },
  MS: {
    "1": {
      status: "https://nfe.sefaz.ms.gov.br/ws/NFeStatusServico4",
      autoriza: "https://nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4",
      retAutoriza: "https://nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4",
      consulta: "https://nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4",
      evento: "https://nfe.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://hom.nfe.sefaz.ms.gov.br/ws/NFeStatusServico4",
      autoriza: "https://hom.nfe.sefaz.ms.gov.br/ws/NFeAutorizacao4",
      retAutoriza: "https://hom.nfe.sefaz.ms.gov.br/ws/NFeRetAutorizacao4",
      consulta: "https://hom.nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4",
      evento: "https://hom.nfe.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4",
    },
  },
  MT: {
    "1": {
      status: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4",
      autoriza: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4",
      retAutoriza: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4",
      consulta: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4",
      evento: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4",
    },
    "2": {
      status: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4",
      autoriza: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4",
      retAutoriza: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeRetAutorizacao4",
      consulta: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4",
      evento: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/RecepcaoEvento4",
    },
  },
  PE: {
    "1": {
      status: "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4",
      autoriza: "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4",
      retAutoriza: "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4",
      consulta: "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4",
      evento: "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4",
      autoriza: "https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeAutorizacao4",
      retAutoriza: "https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRetAutorizacao4",
      consulta: "https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4",
      evento: "https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeRecepcaoEvento4",
    },
  },
  PR: {
    "1": {
      status: "https://nfe.sefa.pr.gov.br/nfe/NFeStatusServico4",
      autoriza: "https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4",
      retAutoriza: "https://nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4",
      consulta: "https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4",
      evento: "https://nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4",
      autoriza: "https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4",
      retAutoriza: "https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4",
      consulta: "https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4",
      evento: "https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4",
    },
  },
  RS: {
    "1": {
      status: "https://nfe.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfe.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfe.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfe.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
    "2": {
      status: "https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfe-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
  },
  SP: {
    "1": {
      status: "https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
      autoriza: "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
      retAutoriza: "https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx",
      consulta: "https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx",
      evento: "https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx",
    },
    "2": {
      status: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
      autoriza: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
      retAutoriza: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx",
      consulta: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx",
      evento: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx",
    },
  },
  SVRS: {
    "1": {
      status: "https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
    "2": {
      status: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
  },
  // SVAN e SVC-AN compartilham a mesma infra (unificação feita pela RFB) — os
  // endpoints 4.00 são idênticos. Não usar o host legado svc.fazenda.gov.br.
  SVAN: {
    "1": {
      status: "https://www.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx",
      autoriza: "https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx",
      retAutoriza: "https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx",
      consulta: "https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
      evento: "https://www.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    },
    "2": {
      status: "https://hom.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx",
      autoriza: "https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx",
      retAutoriza: "https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx",
      consulta: "https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
      evento: "https://hom.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    },
  },
};

WS_55["SVC-AN"] = WS_55.SVAN;
WS_55["SVC-RS"] = WS_55.SVRS;

const WS_65: Record<string, PorAmbiente> = {
  AM: {
    "1": {
      status: "https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4",
      autoriza: "https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4",
      retAutoriza: "https://nfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4",
      consulta: "https://nfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4",
      evento: "https://nfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4",
    },
    "2": {
      status: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4",
      autoriza: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4",
      retAutoriza: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4",
      consulta: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4",
      evento: "https://homnfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4",
    },
  },
  // GO atende NFC-e no mesmo webservice da NF-e.
  GO: WS_55.GO,
  MG: {
    "1": {
      status: "https://nfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4",
      autoriza: "https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4",
      retAutoriza: "https://nfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4",
      consulta: "https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4",
      evento: "https://nfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4",
      autoriza: "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4",
      retAutoriza: "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4",
      consulta: "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4",
      evento: "https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4",
    },
  },
  MS: {
    "1": {
      status: "https://nfce.sefaz.ms.gov.br/ws/NFeStatusServico4",
      autoriza: "https://nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4",
      retAutoriza: "https://nfce.sefaz.ms.gov.br/ws/NFeRetAutorizacao4",
      consulta: "https://nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4",
      evento: "https://nfce.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://hom.nfce.sefaz.ms.gov.br/ws/NFeStatusServico4",
      autoriza: "https://hom.nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4",
      retAutoriza: "https://hom.nfce.sefaz.ms.gov.br/ws/NFeRetAutorizacao4",
      consulta: "https://hom.nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4",
      evento: "https://hom.nfce.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4",
    },
  },
  MT: {
    "1": {
      status: "https://nfce.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4",
      autoriza: "https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4",
      retAutoriza: "https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4",
      consulta: "https://nfce.sefaz.mt.gov.br/nfcews/services/NfeConsulta4",
      evento: "https://nfce.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4",
    },
    "2": {
      status: "https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4",
      autoriza: "https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4",
      retAutoriza: "https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4",
      consulta: "https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeConsulta4",
      evento: "https://homologacao.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4",
    },
  },
  PR: {
    "1": {
      status: "https://nfce.sefa.pr.gov.br/nfce/NFeStatusServico4",
      autoriza: "https://nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4",
      retAutoriza: "https://nfce.sefa.pr.gov.br/nfce/NFeRetAutorizacao4",
      consulta: "https://nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4",
      evento: "https://nfce.sefa.pr.gov.br/nfce/NFeRecepcaoEvento4",
    },
    "2": {
      status: "https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeStatusServico4",
      autoriza: "https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4",
      retAutoriza: "https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeRetAutorizacao4",
      consulta: "https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4",
      evento: "https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeRecepcaoEvento4",
    },
  },
  RS: {
    "1": {
      status: "https://nfce.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfce.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfce.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfce.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfce.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
    "2": {
      status: "https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfce-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
  },
  SP: {
    "1": {
      status: "https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx",
      autoriza: "https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx",
      consulta: "https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx",
      evento: "https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx",
    },
    "2": {
      status: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx",
      autoriza: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx",
      retAutoriza: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx",
      consulta: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx",
      evento: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx",
    },
  },
  SVRS: {
    "1": {
      status: "https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfce.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
    "2": {
      status: "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
      autoriza: "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
      retAutoriza: "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx",
      consulta: "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
      evento: "https://nfce-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
  },
};

// ----------------------------------------------------------------------------
// QR Code da NFC-e — URL do QR e URL de consulta por chave, por UF.
// São valores DIFERENTES e a SEFAZ valida os dois (rejeição 395 / 878).
// ----------------------------------------------------------------------------

type QrUrls = { urlQrCode: string; urlChave: string };

const QRCODE: Record<string, Record<TpAmb, QrUrls>> = {
  AC: {
    "1": { urlQrCode: "http://www.sefaznet.ac.gov.br/nfce/qrcode", urlChave: "www.sefaznet.ac.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.hml.sefaznet.ac.gov.br/nfce/qrcode", urlChave: "www.sefaznet.ac.gov.br/nfce/consulta" },
  },
  AL: {
    "1": { urlQrCode: "http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp", urlChave: "www.sefaz.al.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp", urlChave: "www.sefaz.al.gov.br/nfce/consulta" },
  },
  AM: {
    "1": { urlQrCode: "https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp", urlChave: "www.sefaz.am.gov.br/nfce/consulta" },
    "2": { urlQrCode: "https://sistemas.sefaz.am.gov.br/nfceweb-hom/consultarNFCe.jsp", urlChave: "www.sefaz.am.gov.br/nfce/consulta" },
  },
  AP: {
    "1": { urlQrCode: "https://www.sefaz.ap.gov.br/nfce/nfcep.php", urlChave: "www.sefaz.ap.gov.br/nfce/consulta" },
    "2": { urlQrCode: "https://www.sefaz.ap.gov.br/nfcehml/nfce.php", urlChave: "www.sefaz.ap.gov.br/nfce/consulta" },
  },
  BA: {
    "1": { urlQrCode: "http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx", urlChave: "http://www.sefaz.ba.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://hnfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx", urlChave: "http://hinternet.sefaz.ba.gov.br/nfce/consulta" },
  },
  CE: {
    "1": { urlQrCode: "http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html", urlChave: "www.sefaz.ce.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://nfceh.sefaz.ce.gov.br/pages/ShowNFCe.html", urlChave: "www.sefaz.ce.gov.br/nfce/consulta" },
  },
  DF: {
    "1": { urlQrCode: "http://www.fazenda.df.gov.br/nfce/qrcode", urlChave: "www.fazenda.df.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://dec.fazenda.df.gov.br/ConsultarNFCe.aspx", urlChave: "www.fazenda.df.gov.br/nfce/consulta" },
  },
  ES: {
    "1": { urlQrCode: "http://app.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx", urlChave: "www.sefaz.es.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://homologacao.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx", urlChave: "www.sefaz.es.gov.br/nfce/consulta" },
  },
  // GO: URL atualizada pelo Informe Técnico 2025.003 (vigente 16/06/2025).
  // Usar a URL antiga (nfe.sefaz.go.gov.br/nfeweb/...) gera rejeição 395.
  GO: {
    "1": { urlQrCode: "https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe", urlChave: "https://www.sefaz.go.gov.br/nfce/consulta" },
    "2": { urlQrCode: "https://nfewebhomolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe", urlChave: "https://www.sefaz.go.gov.br/nfce/consulta" },
  },
  MA: {
    "1": { urlQrCode: "http://www.nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp", urlChave: "www.sefaz.ma.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.hom.nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp", urlChave: "www.sefaz.ma.gov.br/nfce/consulta" },
  },
  MG: {
    "1": { urlQrCode: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml", urlChave: "https://portalsped.fazenda.mg.gov.br/portalnfce" },
    "2": { urlQrCode: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml", urlChave: "https://hportalsped.fazenda.mg.gov.br/portalnfce" },
  },
  MS: {
    "1": { urlQrCode: "http://www.dfe.ms.gov.br/nfce/qrcode", urlChave: "http://www.dfe.ms.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.dfe.ms.gov.br/nfce/qrcode", urlChave: "http://www.dfe.ms.gov.br/nfce/consulta" },
  },
  MT: {
    "1": { urlQrCode: "http://www.sefaz.mt.gov.br/nfce/consultanfce", urlChave: "http://www.sefaz.mt.gov.br/nfce/consultanfce" },
    "2": { urlQrCode: "http://homologacao.sefaz.mt.gov.br/nfce/consultanfce", urlChave: "http://homologacao.sefaz.mt.gov.br/nfce/consultanfce" },
  },
  PA: {
    "1": { urlQrCode: "https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam", urlChave: "www.sefa.pa.gov.br/nfce/consulta" },
    "2": { urlQrCode: "https://appnfc.sefa.pa.gov.br/portal-homologacao/view/consultas/nfce/nfceForm.seam", urlChave: "www.sefa.pa.gov.br/nfce/consulta" },
  },
  PB: {
    "1": { urlQrCode: "http://www.sefaz.pb.gov.br/nfce", urlChave: "www.sefaz.pb.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.sefaz.pb.gov.br/nfcehom", urlChave: "www.sefaz.pb.gov.br/nfcehom" },
  },
  PE: {
    "1": { urlQrCode: "http://nfce.sefaz.pe.gov.br/nfce/consulta", urlChave: "nfce.sefaz.pe.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://nfcehomolog.sefaz.pe.gov.br/nfce/consulta", urlChave: "nfce.sefaz.pe.gov.br/nfce/consulta" },
  },
  PI: {
    "1": { urlQrCode: "http://www.sefaz.pi.gov.br/nfce/qrcode", urlChave: "www.sefaz.pi.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.sefaz.pi.gov.br/nfce/qrcode", urlChave: "www.sefaz.pi.gov.br/nfce/consulta" },
  },
  PR: {
    "1": { urlQrCode: "http://www.fazenda.pr.gov.br/nfce/qrcode", urlChave: "http://www.fazenda.pr.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.fazenda.pr.gov.br/nfce/qrcode", urlChave: "http://www.fazenda.pr.gov.br/nfce/consulta" },
  },
  RJ: {
    "1": { urlQrCode: "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode", urlChave: "www.fazenda.rj.gov.br/nfce/consulta" },
    "2": { urlQrCode: "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode", urlChave: "www.fazenda.rj.gov.br/nfce/consulta" },
  },
  RN: {
    "1": { urlQrCode: "http://nfce.set.rn.gov.br/consultarNFCe.aspx", urlChave: "www.set.rn.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://hom.nfce.set.rn.gov.br/consultarNFCe.aspx", urlChave: "www.set.rn.gov.br/nfce/consulta" },
  },
  RO: {
    "1": { urlQrCode: "http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp", urlChave: "www.sefin.ro.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp", urlChave: "www.sefin.ro.gov.br/nfce/consulta" },
  },
  RR: {
    "1": { urlQrCode: "https://www.sefaz.rr.gov.br/nfce/servlet/qrcode", urlChave: "www.sefaz.rr.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://200.174.88.103:8080/nfce/servlet/qrcode", urlChave: "www.sefaz.rr.gov.br/nfce/consulta" },
  },
  RS: {
    "1": { urlQrCode: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx", urlChave: "www.sefaz.rs.gov.br/nfce/consulta" },
    "2": { urlQrCode: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx", urlChave: "www.sefaz.rs.gov.br/nfce/consulta" },
  },
  SC: {
    "1": { urlQrCode: "https://sat.sef.sc.gov.br/nfce/consulta", urlChave: "https://sat.sef.sc.gov.br/nfce/consulta" },
    "2": { urlQrCode: "https://hom.sat.sef.sc.gov.br/nfce/consulta", urlChave: "https://hom.sat.sef.sc.gov.br/nfce/consulta" },
  },
  SE: {
    "1": { urlQrCode: "http://www.nfce.se.gov.br/nfce/qrcode", urlChave: "http://www.nfce.se.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://www.hom.nfe.se.gov.br/nfce/qrcode", urlChave: "http://www.hom.nfe.se.gov.br/nfce/consulta" },
  },
  SP: {
    "1": { urlQrCode: "https://www.nfce.fazenda.sp.gov.br/qrcode", urlChave: "https://www.nfce.fazenda.sp.gov.br/consulta" },
    "2": { urlQrCode: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode", urlChave: "https://www.homologacao.nfce.fazenda.sp.gov.br/consulta" },
  },
  TO: {
    "1": { urlQrCode: "http://www.sefaz.to.gov.br/nfce/qrcode", urlChave: "www.sefaz.to.gov.br/nfce/consulta" },
    "2": { urlQrCode: "http://homologacao.sefaz.to.gov.br/nfce/qrcode", urlChave: "http://homologacao.sefaz.to.gov.br/nfce/consulta.jsf" },
  },
};

// ----------------------------------------------------------------------------
// Resolução
// ----------------------------------------------------------------------------

export type Destino = {
  uf: string; // sigla do emitente
  mod: Modelo;
  tpAmb: TpAmb;
  tpEmis?: TpEmis; // 6/7 desviam a NF-e 55 para a SVC
};

// Nome da autorizadora que atende o destino — a SVC entra na frente da própria
// UF quando a nota é emitida em contingência.
export function autorizadora(d: Destino): string {
  if (d.mod === "55" && (d.tpEmis === "6" || d.tpEmis === "7")) {
    return d.tpEmis === "6" ? "SVC-AN" : "SVC-RS";
  }
  const uf = d.uf.toUpperCase();
  const nome = (d.mod === "65" ? AUTORIZADORA_65 : AUTORIZADORA_55)[uf];
  if (!nome) throw new Error(`UF sem autorizadora conhecida: ${d.uf}`);
  return nome;
}

// SVC da UF, e o tpEmis correspondente (6 = SVC-AN, 7 = SVC-RS).
export function contingenciaDaUF(uf: string): { autorizadora: "SVC-AN" | "SVC-RS"; tpEmis: "6" | "7" } {
  const svc = SVC_POR_UF[uf?.toUpperCase()];
  if (!svc) throw new Error(`UF sem contingência SVC conhecida: ${uf}`);
  return { autorizadora: svc, tpEmis: svc === "SVC-AN" ? "6" : "7" };
}

export function endpoint(d: Destino, servico: Servico): string {
  const nome = autorizadora(d);
  const tabela = d.mod === "65" ? WS_65 : WS_55;
  const url = tabela[nome]?.[d.tpAmb]?.[servico];
  if (!url) {
    throw new Error(`Webservice não disponível: ${servico} · modelo ${d.mod} · ${nome} · ambiente ${d.tpAmb}.`);
  }
  return url;
}

// URLs do QR Code (NFC-e) da UF. urlQrCode e urlChave são distintas — a SEFAZ
// valida as duas.
export function urlsQrCode(uf: string, tpAmb: TpAmb): QrUrls {
  const q = QRCODE[uf?.toUpperCase()]?.[tpAmb];
  if (!q) throw new Error(`UF sem URL de consulta de NFC-e cadastrada: ${uf}`);
  return q;
}
