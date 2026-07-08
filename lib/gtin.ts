// Consulta de código de barras (GTIN/EAN) via API Cosmos (Bluesoft) — REST, sem
// mTLS. Devolve nome, marca e NCM do produto a partir do código. A base oficial
// da SEFAZ (CCG-GTIN) exige client-cert por renegociação TLS que o Node não
// consegue apresentar (retorna 403), por isso usamos a Cosmos.
//
// Requer COSMOS_TOKEN no ambiente (token grátis em https://cosmos.bluesoft.com.br).

const ENDPOINT = "https://api.cosmos.bluesoft.com.br/gtins";

export type ResultadoGtin =
  | { ok: true; gtin: string; nome: string; marca: string; ncm: string; cest: string }
  | { ok: false; erro: string; naoEncontrado?: boolean; semToken?: boolean };

type CosmosResp = {
  description?: string;
  gtin?: number | string;
  ncm?: { code?: string; description?: string } | null;
  brand?: { name?: string } | null;
  cest?: Array<{ cest?: string }> | null;
};

export async function consultarGtin(gtin: string): Promise<ResultadoGtin> {
  const g = (gtin || "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(g.length)) {
    return { ok: false, erro: "Código de barras deve ter 8, 12, 13 ou 14 dígitos (GTIN/EAN)." };
  }

  const token = process.env.COSMOS_TOKEN;
  if (!token) {
    return { ok: false, semToken: true, erro: "Consulta por código de barras não configurada (COSMOS_TOKEN ausente)." };
  }

  let resp: Response;
  try {
    resp = await fetch(`${ENDPOINT}/${g}.json`, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "X-Cosmos-Token": token,
        // Cosmos rejeita (403) requisições sem User-Agent próprio.
        "User-Agent": "easy-nfe/1.0",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError" ? "Consulta demorou demais — tente de novo." : "Falha ao consultar o código de barras.";
    return { ok: false, erro: msg };
  }

  if (resp.status === 404) {
    return { ok: false, naoEncontrado: true, erro: "Código de barras não encontrado na base. Preencha os dados manualmente." };
  }
  if (resp.status === 429) {
    return { ok: false, erro: "Limite de consultas atingido no momento — tente novamente em instantes." };
  }
  if (!resp.ok) {
    return { ok: false, erro: `Não foi possível consultar (HTTP ${resp.status}).` };
  }

  const d = (await resp.json()) as CosmosResp;
  const cest = d.cest?.map((c) => (c.cest ?? "").replace(/\D/g, "")).find((c) => c.length === 7) ?? "";

  return {
    ok: true,
    gtin: g, // mantém o código bipado (preserva zeros à esquerda que a Cosmos perde)
    nome: (d.description ?? "").trim(),
    marca: (d.brand?.name ?? "").trim(),
    ncm: (d.ncm?.code ?? "").replace(/\D/g, ""),
    cest,
  };
}
