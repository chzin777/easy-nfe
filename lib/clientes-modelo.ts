// Modelo padrão de importação de clientes (CSV/XLSX).
import type { ColunaModelo, LinhaValidada } from "@/app/ui/ImportarPlanilhaModal";

export type ClienteImport = {
  tipoContribuinte: string;
  documento: string;
  nome: string;
  inscricaoEstadual: string;
  telefone: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
};

export const COLUNAS_CLIENTE: ColunaModelo[] = [
  { key: "nome", header: "Nome", obrigatorio: true, exemplo: "Comercial Silva LTDA", aliases: ["razao social", "razão social", "nome/razao social"] },
  { key: "documento", header: "CPF/CNPJ", obrigatorio: true, exemplo: "12345678000190", aliases: ["documento", "cpf", "cnpj", "cpf cnpj"] },
  { key: "tipoContribuinte", header: "Tipo de contribuinte", obrigatorio: false, exemplo: "1", aliases: ["tipo contribuinte", "contribuinte"] },
  { key: "inscricaoEstadual", header: "Inscricao estadual", obrigatorio: false, exemplo: "", aliases: ["inscrição estadual", "ie"] },
  { key: "telefone", header: "Telefone", obrigatorio: false, exemplo: "62999990000", aliases: ["fone", "celular"] },
  { key: "email", header: "Email", obrigatorio: false, exemplo: "contato@empresa.com", aliases: ["e-mail"] },
  { key: "cep", header: "CEP", obrigatorio: false, exemplo: "74000000" },
  { key: "logradouro", header: "Logradouro", obrigatorio: false, exemplo: "Rua das Flores", aliases: ["endereco", "endereço", "rua"] },
  { key: "numero", header: "Numero", obrigatorio: false, exemplo: "100", aliases: ["número", "nro"] },
  { key: "complemento", header: "Complemento", obrigatorio: false, exemplo: "" },
  { key: "bairro", header: "Bairro", obrigatorio: false, exemplo: "Centro" },
  { key: "municipio", header: "Municipio", obrigatorio: false, exemplo: "Goiania", aliases: ["município", "cidade"] },
  { key: "uf", header: "UF", obrigatorio: false, exemplo: "GO", aliases: ["estado"] },
];

const TIPOS_VALIDOS = new Set(["1", "2", "9"]);

export function validarLinhaCliente(
  bruto: Record<string, string>,
  linha: number,
): LinhaValidada<ClienteImport> {
  const erros: string[] = [];
  const avisos: string[] = [];

  const nome = (bruto.nome ?? "").trim();
  if (!nome) erros.push("Nome é obrigatório.");

  const documento = (bruto.documento ?? "").replace(/\D/g, "");
  if (!documento) erros.push("CPF/CNPJ é obrigatório.");
  else if (documento.length !== 11 && documento.length !== 14) avisos.push(`Documento "${documento}" não tem 11 (CPF) nem 14 (CNPJ) dígitos.`);

  // tipo de contribuinte: usa o informado se válido; senão deduz pelo documento.
  let tipo = (bruto.tipoContribuinte ?? "").replace(/\D/g, "").charAt(0);
  if (!TIPOS_VALIDOS.has(tipo)) tipo = documento.length === 14 ? "1" : "9";

  const uf = (bruto.uf ?? "").trim().toUpperCase().slice(0, 2);

  const item: ClienteImport = {
    nome,
    documento,
    tipoContribuinte: tipo,
    inscricaoEstadual: (bruto.inscricaoEstadual ?? "").trim(),
    telefone: (bruto.telefone ?? "").trim(),
    email: (bruto.email ?? "").trim(),
    cep: (bruto.cep ?? "").replace(/\D/g, ""),
    logradouro: (bruto.logradouro ?? "").trim(),
    numero: (bruto.numero ?? "").trim(),
    complemento: (bruto.complemento ?? "").trim(),
    bairro: (bruto.bairro ?? "").trim(),
    municipio: (bruto.municipio ?? "").trim(),
    uf,
  };

  return { linha, item, erros, avisos };
}
