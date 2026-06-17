// Códigos IBGE de município (cMun) usados na NF-e.
// O cadastro de emitente/cliente guarda só o nome — aqui resolvemos o código.
// Cobre as cidades dos dados-semente; outras precisam ser adicionadas.

const POR_NOME: Record<string, string> = {
  GOIANIA: "5208707",
  "APARECIDA DE GOIANIA": "5201405",
  ANAPOLIS: "5201108",
  RIOVERDE: "5218805",
  "RIO VERDE": "5218805",
  CATALAO: "5205109",
};

function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toUpperCase()
    .trim();
}

// Resolve o código IBGE a partir do nome do município.
// Lança erro claro se a cidade não estiver mapeada (em vez de gerar NF-e inválida).
export function codigoMunicipio(nome: string): string {
  const cod = POR_NOME[normalizar(nome)];
  if (!cod) {
    throw new Error(
      `Código IBGE do município "${nome}" não cadastrado. ` +
        `Adicione-o em lib/nfe/municipios.ts.`,
    );
  }
  return cod;
}
