// Domínio do sistema de emissão de NF-e (protótipo de UI).
// Sem persistência real ainda — Supabase entra em fase posterior.

export type Produto = {
  id: string;
  codigoInterno: number; // sequencial
  codigoBarras: string; // cEAN / GTIN
  nome: string;
  unidade: string; // sigla da unidade de medida
  ncm: string;
  origem: string; // código da tabela de origem (0-8)
  preco: number;
  descricao: string;
  // Configurações fiscais
  cest: string;
  codigoBeneficio: string;
  creditoPresumidoIcms: string;
  reguladoAnp: boolean;
};

export type Endereco = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
};

export type Contato = {
  telefone: string;
  email: string;
};

export type Cliente = {
  id: string;
  codigoInterno: number;
  tipoContribuinte: string; // 1 / 2 / 9
  documento: string; // CPF ou CNPJ
  nome: string;
  inscricaoEstadual: string;
  contato: Contato;
  endereco: Endereco;
};

export type Transportadora = {
  id: string;
  codigoInterno: number;
  tipoTransporte: string; // modalidade de frete (0-4, 9)
  documento: string; // CPF ou CNPJ
  nome: string;
  inscricaoEstadual: string;
  contato: Contato;
  endereco: Endereco;
};

export type StatusNota =
  | "autorizada"
  | "rascunho"
  | "cancelada"
  | "rejeitada"
  | "denegada";

export type ItemNota = {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
};

export type Nota = {
  id: string;
  numero: number;
  tipoNota: string; // ex.: "55-saida" (NF-e) / "65-saida" (NFC-e)
  clienteId: string;
  clienteNome: string;
  transportadoraId: string | null;
  itens: ItemNota[];
  informacoesAdicionais: string;
  status: StatusNota;
  emitidaEm: string; // ISO date
  valorTotal: number;
  chaveAcesso: string;
};

// Opção genérica para selects.
export type Opcao = { value: string; label: string };
