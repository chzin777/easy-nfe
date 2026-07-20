"use client";

import type { Produto } from "@/lib/types";
import type { DescontoTipo } from "../actions";

// Rascunho da emissão em andamento (localStorage). Sair da página no meio da
// emissão — para corrigir um produto, por exemplo — não pode custar o trabalho
// já feito. Ao voltar, o app oferece retomar; e ao retomar, os dados do
// catálogo são relidos do banco (preço novo entra no lugar do antigo).
const CHAVE = "easy-nfe:rascunho-nota-v1";
// Rascunho velho provavelmente é lixo esquecido, não trabalho em andamento.
const VALIDADE_MS = 3 * 24 * 60 * 60 * 1000;

export type ItemRascunho = {
  produtoId: string;
  quantidade: number;
  descTipo: DescontoTipo;
  descValor: number;
  // Preço só é guardado quando o operador mexeu nele. Se ele não mexeu,
  // o preço tem que vir do cadastro na hora de retomar (pode ter mudado).
  precoAjustado?: number;
  salvarPreco?: boolean;
  // Preço de cadastro vigente quando o rascunho foi salvo — serve só para
  // avisar "o preço destes itens mudou" ao retomar.
  precoVisto: number;
};

export type Rascunho = {
  em: number;
  tipoNota: string;
  clienteId: string;
  transportadoraId: string;
  modFrete: string;
  info: string;
  descNota: { tipo: DescontoTipo; valor: number };
  itens: ItemRascunho[];
};

export function salvarRascunho(r: Omit<Rascunho, "em">): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...r, em: Date.now() }));
  } catch {
    // Sem localStorage (aba privada, cota cheia): rascunho é conveniência.
  }
}

export function limparRascunho(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
}

export function lerRascunho(): Rascunho | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const r = JSON.parse(cru) as Rascunho;
    if (!r?.itens?.length || typeof r.em !== "number") return null;
    if (Date.now() - r.em > VALIDADE_MS) {
      limparRascunho();
      return null;
    }
    return r;
  } catch {
    limparRascunho();
    return null;
  }
}

// Reidrata os itens do rascunho contra o catálogo ATUAL. Produto que sumiu do
// cadastro (ou de outra empresa) é descartado; nome e preço vêm do banco,
// preservando só o ajuste manual que o operador tinha feito.
export function reidratarItens(
  itens: ItemRascunho[],
  produtos: Produto[],
): {
  itens: {
    produtoId: string;
    nome: string;
    quantidade: number;
    precoUnitario: number;
    precoOriginal: number;
    salvarPreco: boolean;
    descTipo: DescontoTipo;
    descValor: number;
  }[];
  descartados: number;
  precosMudaram: number;
} {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  let precosMudaram = 0;
  const vivos = [];

  for (const i of itens) {
    const p = porId.get(i.produtoId);
    if (!p) continue;
    const ajustado = typeof i.precoAjustado === "number" && i.precoAjustado > 0;
    if (!ajustado && Number(i.precoVisto) !== Number(p.preco)) precosMudaram++;
    vivos.push({
      produtoId: p.id,
      nome: p.nome,
      quantidade: i.quantidade,
      precoUnitario: ajustado ? i.precoAjustado! : p.preco,
      precoOriginal: p.preco,
      salvarPreco: !!i.salvarPreco && ajustado,
      descTipo: i.descTipo ?? ("valor" as DescontoTipo),
      descValor: i.descValor ?? 0,
    });
  }

  return { itens: vivos, descartados: itens.length - vivos.length, precosMudaram };
}
