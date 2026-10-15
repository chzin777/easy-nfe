// Resolve o código IBGE de município (cMun, 7 dígitos) sem manter tabela local.
// Usa a API pública do IBGE, cacheando a lista de municípios por UF em memória.

const cachePorUF = new Map<string, Map<string, string>>();

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

// HTTP GET via node:https com rejectUnauthorized: false — mesma estratégia da
// função soap() em lib/nfe/soap.ts. Alguns ambientes (Docker, runtimes sem
// bundle de CAs) falham com UNABLE_TO_VERIFY_LEAF_SIGNATURE ao usar fetch
// nativo. Como esta é uma API pública read-only (IBGE), sem dados sensíveis,
// o fallback é seguro e consistente com o restante do projeto.
async function httpsGet(url: string): Promise<{ status: number; body: string }> {
  const https = await import("node:https");
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : 443,
        path: u.pathname + u.search,
        method: "GET",
        rejectUnauthorized: false,
        timeout: 15_000,
        headers: { Accept: "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timeout ao consultar IBGE.")));
    req.on("error", reject);
    req.end();
  });
}

async function mapaDaUF(uf: string): Promise<Map<string, string>> {
  const u = uf.toUpperCase();
  const cache = cachePorUF.get(u);
  if (cache) return cache;

  const r = await httpsGet(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${u}/municipios`);
  if (r.status < 200 || r.status >= 300) throw new Error(`Não foi possível consultar a base de municípios do IBGE (HTTP ${r.status}).`);
  const lista = JSON.parse(r.body) as { id: number; nome: string }[];

  const mapa = new Map<string, string>();
  for (const m of lista) mapa.set(normalizar(m.nome), String(m.id));
  cachePorUF.set(u, mapa);
  return mapa;
}

// Código IBGE (7 dígitos) por nome do município + UF. Aceita um código já pronto
// (passa direto) e cai p/ a API quando recebe o nome.
export async function resolverCodMunicipio(municipioOuCodigo: string, uf: string): Promise<string> {
  const digitos = municipioOuCodigo.replace(/\D/g, "");
  if (digitos.length === 7) return digitos; // já é um cMun válido

  const mapa = await mapaDaUF(uf);
  const code = mapa.get(normalizar(municipioOuCodigo));
  if (!code) {
    throw new Error(`Município "${municipioOuCodigo}/${uf}" não encontrado na base do IBGE. Confira a grafia do município no cadastro.`);
  }
  return code;
}
