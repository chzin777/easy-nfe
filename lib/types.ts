// Domínio do sistema de emissão de NF-e (protótipo de UI).
// Sem persistência real ainda — Supabase entra em fase posterior.

export type Produto = {
  id: string;
  codigoInterno: number; // sequencial
  codigoBarras: string; // cEAN / GTIN
  nome: string;
  marca: string;
  peso: number; // peso líquido em kg (0 = não informado)
  unidade: string; // sigla da unidade de medida
  ncm: string;
  origem: string; // código da tabela de origem (0-8)
  preco: number;
  descricao: string;
  categoriaId: string; // "" = sem categoria
  categoriaNome: string; // rótulo (derivado) p/ listagem
  // Configurações fiscais
  cst: string; // tributação ICMS (regime normal): "40" isenção (padrão) | "20" redução de BC
  aliquotaIcms: number; // pICMS p/ CST 20 (0 = não usado)
  reducaoBaseIcms: number; // pRedBC % p/ CST 20 (0 = não usado)
  cest: string;
  codigoBeneficio: string;
  creditoPresumidoIcms: string;
  reguladoAnp: boolean;
  // Estoque
  estoque: number; // saldo atual
  controlaEstoque: boolean; // opt-in: baixa na emissão de NF-e
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
  padrao: boolean; // "Consumidor final" do sistema (fixo, não excluível)
  tipoContribuinte: string; // 1 / 2 / 9
  documento: string; // CPF ou CNPJ
  nome: string;
  inscricaoEstadual: string;
  categoriaId: string; // "" = sem categoria
  categoriaNome: string; // rótulo (derivado) p/ listagem
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
