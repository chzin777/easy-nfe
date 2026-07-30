// Tipos da NFS-e Padrão Nacional (SPED / gov.br).
//
// O documento que o contribuinte assina e transmite é a DPS (Declaração de
// Prestação de Serviço). O fisco devolve a NFS-e com chave de acesso de 50
// dígitos. Uma DPS = uma NFS-e.
//
// Fonte da estrutura: XML de NFS-e real autorizada em Goiânia (padrão nacional,
// xmlns http://www.sped.fazenda.gov.br/nfse) + documentação do portal gov.br/nfse.

export type AmbienteNFSe = "1" | "2"; // 1 produção | 2 produção restrita (homologação)

// Regime tributário do prestador.
export type RegTrib = {
  // 1 = optante MEI | 2 = optante ME/EPP | 3 = optante (demais) | 4 = não optante.
  // No XML de referência (MEI de Goiânia) veio 3.
  opSimpNac: string;
  // Regime de apuração no Simples. Só quando opSimpNac indica optante.
  regApTribSN?: string;
  // 0 = nenhum. Demais códigos = regime especial municipal.
  regEspTrib: string;
};

export type PrestadorDPS = {
  cnpj: string; // só dígitos
  im?: string; // inscrição municipal
  fone?: string;
  email?: string;
  regTrib: RegTrib;
};

export type EnderecoDPS = {
  cMun: string; // IBGE 7 dígitos
  cep: string; // só dígitos
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
};

export type TomadorDPS = {
  cnpj?: string; // um dos dois
  cpf?: string;
  im?: string;
  nome: string;
  endereco: EnderecoDPS;
  fone?: string;
  email?: string;
};

export type ServicoDPS = {
  cLocPrestacao: string; // IBGE 7 do município onde o serviço foi prestado
  cTribNac: string; // 6 dígitos (LC 116 desdobrada)
  cTribMun?: string; // código municipal
  descricao: string; // xDescServ
  cNBS?: string; // 9 dígitos
};

export type ValoresDPS = {
  valorServico: number;
  // 1 = tributável | 2 = imune | 3 = exportação | 4 = não incidência
  tribISSQN: string;
  // 1 = não retido | 2 = retido pelo tomador | 3 = retido pelo intermediário
  tpRetISSQN: string;
  // Tipo de imunidade (0-5). Obrigatório, e só permitido, quando tribISSQN = 2.
  tpImunidade?: string;
  aliquotaISS?: number; // pAliq — omitido quando não tributável
  // Regime do Simples do prestador (mesmo código do regTrib). Quem não é
  // optante não pode informar alíquota: quem calcula o ISS é a prefeitura.
  opSimpNac?: string;
  // Simples Nacional informa a alíquota efetiva total; fora do Simples o campo
  // do XSD é outro, por isso o tipo separa os dois casos.
  pTotTribSN?: number;
  pisCofins?: { cst: string; tpRet: string };
};

export type DadosDPS = {
  ambiente: AmbienteNFSe;
  serie: number;
  numero: number; // nDPS
  emitidaEm: Date; // dhEmi
  competencia: Date; // dCompet (só a data)
  cLocEmi: string; // IBGE 7 do município do emitente
  // 1 = prestador | 2 = tomador | 3 = intermediário
  tpEmit: string;
  prestador: PrestadorDPS;
  tomador: TomadorDPS;
  servico: ServicoDPS;
  valores: ValoresDPS;
  infoAdicional?: string;
};

// --- Distribuição de DFe (ADN) ---

export type StatusDistribuicao = "REJEICAO" | "NENHUM_DOCUMENTO_LOCALIZADO" | "DOCUMENTOS_LOCALIZADOS";

export type TipoDocumentoDFe = "NENHUM" | "DPS" | "PEDIDO_REGISTRO_EVENTO" | "NFSE" | "EVENTO" | "CNC";

export type TipoEventoDFe =
  | "CANCELAMENTO"
  | "SOLICITACAO_CANCELAMENTO_ANALISE_FISCAL"
  | "CANCELAMENTO_POR_SUBSTITUICAO"
  | "CANCELAMENTO_DEFERIDO_ANALISE_FISCAL"
  | "CANCELAMENTO_INDEFERIDO_ANALISE_FISCAL"
  | "CONFIRMACAO_PRESTADOR"
  | "REJEICAO_PRESTADOR"
  | "CONFIRMACAO_TOMADOR"
  | "REJEICAO_TOMADOR"
  | "CONFIRMACAO_INTERMEDIARIO"
  | "REJEICAO_INTERMEDIARIO"
  | "CONFIRMACAO_TACITA"
  | "ANULACAO_REJEICAO"
  | "CANCELAMENTO_POR_OFICIO"
  | "BLOQUEIO_POR_OFICIO"
  | "DESBLOQUEIO_POR_OFICIO"
  | "INCLUSAO_NFSE_DAN"
  | "TRIBUTOS_NFSE_RECOLHIDOS";

// Um documento da fila de distribuição. O XML já vem descompactado.
export type DFeDistribuido = {
  nsu: number;
  chaveAcesso?: string;
  tipoDocumento: TipoDocumentoDFe;
  tipoEvento?: TipoEventoDFe;
  geradoEm?: Date;
  xml?: string;
};

export type LoteDFe =
  | {
      ok: true;
      status: StatusDistribuicao;
      documentos: DFeDistribuido[];
      ultimoNSU: number;
      alertas: string[];
    }
  | {
      ok: false;
      erro: string;
      status?: number;
      mensagens?: { codigo?: string; descricao?: string }[];
    };

// Retorno da SEFIN Nacional ao transmitir a DPS.
export type ResultadoNFSe =
  | {
      ok: true;
      chaveAcesso: string; // 50 dígitos
      idDps: string;
      xmlNfse: string; // XML da NFS-e autorizada (já descompactado)
      xmlDps: string; // DPS assinada que foi enviada
    }
  | {
      ok: false;
      erro: string;
      status?: number;
      // Mensagens de rejeição devolvidas pelo fisco, quando houver.
      mensagens?: { codigo?: string; descricao?: string }[];
      xmlDps?: string;
    };
