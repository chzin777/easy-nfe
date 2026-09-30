export type TipoOrcamento = "produto" | "servico" | "ambos";

export function tipoOrcamentoDe(
  tipoNota: string,
  itens?: { produtoId?: string | null; servicoId?: string | null }[],
): TipoOrcamento {
  if (tipoNota.startsWith("misto")) return "ambos";
  if (tipoNota === "nfse") return "servico";
  if (itens && itens.some((i) => i.produtoId) && itens.some((i) => i.servicoId)) return "ambos";
  if (itens && itens.some((i) => i.servicoId) && !itens.some((i) => i.produtoId)) return "servico";
  return "produto";
}
