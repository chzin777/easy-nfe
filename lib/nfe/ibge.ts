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

async function mapaDaUF(uf: string): Promise<Map<string, string>> {
  const u = uf.toUpperCase();
  const cache = cachePorUF.get(u);
  if (cache) return cache;

  const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${u}/municipios`);
  if (!r.ok) throw new Error(`Não foi possível consultar a base de municípios do IBGE (HTTP ${r.status}).`);
  const lista = (await r.json()) as { id: number; nome: string }[];

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
