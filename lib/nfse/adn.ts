import type { Certificado } from "@/lib/nfe/cert";
import { deGzipB64, explicarErro, requisicao } from "./http";
import type {
  AmbienteNFSe,
  DFeDistribuido,
  LoteDFe,
  StatusDistribuicao,
  TipoDocumentoDFe,
  TipoEventoDFe,
} from "./types";

// Distribuição de DFe do ADN (Ambiente de Dados Nacional) para o contribuinte.
//
// É o equivalente da NFS-e ao NFeDistribuicaoDFe da NF-e: o fisco mantém uma
// fila numerada por NSU com tudo que interessa ao CNPJ — NFS-e emitidas contra
// ele como tomador, eventos, cancelamentos. O contribuinte guarda o último NSU
// lido e pede do seguinte em diante.
//
// Endpoints (mTLS com o A1 da empresa, mesmo certificado da emissão):
//   GET /contribuintes/DFe/{NSU}?cnpjConsulta=&lote=      → lote a partir do NSU
//   GET /contribuintes/NFSe/{chave}/Eventos               → eventos de uma nota
const HOST: Record<AmbienteNFSe, string> = {
  "1": "adn.nfse.gov.br",
  "2": "adn.producaorestrita.nfse.gov.br",
};

const BASE = "/contribuintes";

type RespostaBruta = {
  StatusProcessamento?: string;
  LoteDFe?: {
    NSU?: number;
    ChaveAcesso?: string;
    TipoDocumento?: string;
    TipoEvento?: string;
    ArquivoXml?: string;
    DataHoraGeracao?: string;
  }[];
  Alertas?: { Codigo?: string; Descricao?: string; Complemento?: string }[];
  Erros?: { Codigo?: string; Descricao?: string; Complemento?: string }[];
  TipoAmbiente?: string;
  VersaoAplicativo?: string;
  DataHoraProcessamento?: string;
};

// O ArquivoXml vem GZip+Base64. Se vier vazio ou corrompido, preservamos o
// documento na lista com xml indefinido em vez de derrubar o lote inteiro —
// perder o NSU é pior que perder um XML.
function converter(d: NonNullable<RespostaBruta["LoteDFe"]>[number]): DFeDistribuido {
  let xml: string | undefined;
  if (d.ArquivoXml) {
    try {
      xml = deGzipB64(d.ArquivoXml);
    } catch {
      xml = undefined;
    }
  }
  return {
    nsu: d.NSU ?? 0,
    chaveAcesso: d.ChaveAcesso,
    tipoDocumento: (d.TipoDocumento ?? "NENHUM") as TipoDocumentoDFe,
    tipoEvento: d.TipoEvento as TipoEventoDFe | undefined,
    geradoEm: d.DataHoraGeracao ? new Date(d.DataHoraGeracao) : undefined,
    xml,
  };
}

const frase = (m: { Codigo?: string; Descricao?: string; Complemento?: string }) =>
  [m.Codigo, m.Descricao, m.Complemento].filter(Boolean).join(" — ");

// O ADN responde 404 quando a fila acabou, mas com corpo completo e o motivo
// dentro de "Erros" (E2220). Só REJEICAO é falha de verdade; fila vazia é
// resposta normal, então o motivo vira alerta, não erro.
function interpretar(body: string, nsuPedido: number): LoteDFe | null {
  let j: RespostaBruta;
  try {
    j = JSON.parse(body) as RespostaBruta;
  } catch {
    return null;
  }
  if (!j.StatusProcessamento) return null;

  const avisos = [...(j.Alertas ?? []), ...(j.Erros ?? [])].map(frase).filter(Boolean);

  if (j.StatusProcessamento === "REJEICAO") {
    return {
      ok: false,
      erro: avisos.join("; ") || "Distribuição rejeitada pelo ADN.",
      mensagens: (j.Erros ?? []).map((e) => ({ codigo: e.Codigo, descricao: [e.Descricao, e.Complemento].filter(Boolean).join(" — ") })),
    };
  }

  const documentos = (j.LoteDFe ?? []).map(converter);
  return {
    ok: true,
    status: j.StatusProcessamento as StatusDistribuicao,
    documentos,
    // Sem documentos, o cursor não anda: fica no último NSU já lido.
    ultimoNSU: documentos.reduce((max, d) => (d.nsu > max ? d.nsu : max), nsuPedido - 1),
    alertas: avisos,
  };
}

// Busca um lote de documentos a partir do NSU informado.
//
// `lote = true` (padrão do serviço) devolve vários documentos de uma vez; com
// `false` vem só o documento daquele NSU exato. `cnpjConsulta` só é necessário
// quando o certificado é de matriz e a consulta é de uma filial.
export async function distribuirDFe(
  nsu: number,
  ambiente: AmbienteNFSe,
  cert: Certificado,
  opcoes: { cnpjConsulta?: string; lote?: boolean } = {},
): Promise<LoteDFe> {
  const query = new URLSearchParams();
  if (opcoes.cnpjConsulta) query.set("cnpjConsulta", opcoes.cnpjConsulta.replace(/\D/g, ""));
  if (opcoes.lote === false) query.set("lote", "false");
  const qs = query.toString();

  try {
    const r = await requisicao(HOST[ambiente], "GET", `${BASE}/DFe/${nsu}${qs ? `?${qs}` : ""}`, cert);
    // Vale tanto no 200 quanto no 404 — o corpo é o mesmo formato.
    return interpretar(r.body, nsu) ?? { ok: false, ...explicarErro(r.body), status: r.status };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// Percorre a fila do NSU informado até acabar, devolvendo tudo junto.
//
// O serviço limita o tamanho do lote, então uma sincronização completa precisa
// de várias chamadas. `maxLotes` existe para não prender o processo quando a
// fila está muito atrasada — o que sobrar entra na próxima rodada, já que o
// último NSU lido é devolvido.
export async function sincronizarDFe(
  aPartirDoNSU: number,
  ambiente: AmbienteNFSe,
  cert: Certificado,
  opcoes: { cnpjConsulta?: string; maxLotes?: number } = {},
): Promise<
  | { ok: true; documentos: DFeDistribuido[]; ultimoNSU: number; completo: boolean }
  | { ok: false; erro: string; ultimoNSU: number; documentos: DFeDistribuido[] }
> {
  const maxLotes = opcoes.maxLotes ?? 20;
  const documentos: DFeDistribuido[] = [];
  let nsu = aPartirDoNSU;

  for (let i = 0; i < maxLotes; i++) {
    const lote = await distribuirDFe(nsu + 1, ambiente, cert, { cnpjConsulta: opcoes.cnpjConsulta });
    if (!lote.ok) return { ok: false, erro: lote.erro, ultimoNSU: nsu, documentos };
    if (lote.status !== "DOCUMENTOS_LOCALIZADOS" || !lote.documentos.length) {
      return { ok: true, documentos, ultimoNSU: nsu, completo: true };
    }
    documentos.push(...lote.documentos);
    // Guarda contra lote que não avança o NSU — evitaria laço infinito.
    if (lote.ultimoNSU <= nsu) return { ok: true, documentos, ultimoNSU: nsu, completo: true };
    nsu = lote.ultimoNSU;
  }

  return { ok: true, documentos, ultimoNSU: nsu, completo: false };
}

// Eventos vinculados a uma NFS-e (cancelamento, confirmação de tomador etc.).
export async function eventosDaNfse(
  chaveAcesso: string,
  ambiente: AmbienteNFSe,
  cert: Certificado,
): Promise<LoteDFe> {
  try {
    const r = await requisicao(HOST[ambiente], "GET", `${BASE}/NFSe/${chaveAcesso}/Eventos`, cert);
    return interpretar(r.body, 1) ?? { ok: false, ...explicarErro(r.body), status: r.status };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
