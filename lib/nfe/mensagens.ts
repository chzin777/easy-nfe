// Traduz códigos de rejeição da SEFAZ (cStat) em explicações claras + o que fazer.
// Função pura — pode ser usada no client. Cobre as rejeições mais comuns; demais
// caem no texto genérico com o xMotivo original.

// corrige: dica de qual cadastro abrir p/ resolver ("produto" | "cliente").
type Explicacao = { resumo: string; acao: string; corrige?: "produto" | "cliente" };

const MAPA: Record<string, Explicacao> = {
  "204": {
    resumo: "Essa nota já foi emitida antes (duplicidade).",
    acao: "Verifique no histórico — provavelmente ela já existe autorizada.",
  },
  "209": {
    resumo: "A Inscrição Estadual da SUA empresa está inválida para a SEFAZ.",
    acao: "Confira a IE em Configurações › Empresa emitente.",
  },
  "215": {
    resumo: "O arquivo da nota saiu fora do padrão exigido pela SEFAZ.",
    acao: "Erro interno na geração — tente de novo; persistindo, avise o suporte.",
  },
  "225": {
    resumo: "O arquivo da nota saiu fora do padrão (schema) exigido pela SEFAZ.",
    acao: "É um problema interno do sistema, não do seu cadastro. Tente emitir de novo; se continuar, avise o suporte com o número da nota.",
  },
  "226": {
    resumo: "A UF do emitente não bate com a UF do serviço da SEFAZ.",
    acao: "Confira o estado (UF) da empresa em Configurações.",
  },
  "228": {
    resumo: "A data de emissão está muito atrasada.",
    acao: "Emita novamente agora — a nota usa a data/hora atual.",
  },
  "233": {
    resumo: "A Inscrição Estadual do destinatário está inválida.",
    acao: "Corrija a IE do cliente, ou marque-o como não contribuinte.",
  },
  "247": {
    resumo: "A nota foi enviada para o ambiente errado (homologação x produção).",
    acao: "Confira o ambiente em Configurações › Ambiente de emissão.",
  },
  "252": {
    resumo: "Ambiente da nota diferente do ambiente do serviço.",
    acao: "Ajuste o ambiente (homologação/produção) em Configurações.",
  },
  "301": {
    resumo: "Cliente com Inscrição Estadual, mas marcado como isento/não contribuinte.",
    acao: "Acerte o tipo de contribuinte do cliente no cadastro.",
  },
  "302": {
    resumo: "Inscrição Estadual do cliente não confere com o cadastro da SEFAZ.",
    acao: "Verifique a IE do cliente.",
  },
  "539": {
    resumo: "Já existe uma nota com essa chave, mas com conteúdo diferente.",
    acao: "A numeração pode estar repetida — confira a numeração em Configurações.",
  },
  "598": {
    resumo: "A empresa não está credenciada para emitir NF-e em produção nessa UF.",
    acao: "Faça o credenciamento na SEFAZ do seu estado antes de emitir em produção.",
  },
  "930": {
    resumo: "Produto isento (CST 40) sem o Código de Benefício Fiscal exigido pela UF.",
    acao: "Cadastre o Código do benefício (cBenef) no produto — use a busca da tabela de GO.",
    corrige: "produto",
  },
  "931": {
    resumo: "O Código de Benefício Fiscal não combina com a tributação (CST 40 = isenção).",
    acao: "Troque por um código do tipo Isenção na busca da tabela de GO (a nota sai isenta).",
    corrige: "produto",
  },
};

export function explicarRejeicao(
  cStat: string | null,
  xMotivo: string | null,
): { resumo: string; acao: string | null; corrige?: "produto" | "cliente" } {
  if (cStat && MAPA[cStat]) return MAPA[cStat];
  return {
    resumo: xMotivo || "A SEFAZ recusou a nota.",
    acao: cStat ? `Código ${cStat}. Se não souber resolver, envie esse código ao suporte.` : null,
  };
}
