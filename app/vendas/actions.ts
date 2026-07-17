"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import type { DescontoTipo } from "@/app/notas/actions";

// ---------------------------------------------------------------------------
// Vendas sem emissão de nota fiscal. Registro NÃO fiscal de venda concluída —
// controle de caixa/estoque. Opcionalmente baixa estoque e/ou lança na
// caderneta (fiado). Documento sem valor fiscal; aparece nos relatórios.
// ---------------------------------------------------------------------------

export type FormaPagamento = "dinheiro" | "pix" | "cartao" | "fiado" | "outro";

export type ItemVendaInput = {
  produtoId: string;
  quantidade: number;
  descTipo: DescontoTipo;
  descValor: number;
};

export type VendaInput = {
  clienteId: string | null;
  formaPagamento: FormaPagamento;
  observacoes?: string;
  data?: string | null; // ISO date (yyyy-mm-dd)
  desconto: { tipo: DescontoTipo; valor: number };
  baixaEstoque: boolean;
  itens: ItemVendaInput[];
};

export type VendaItemUI = {
  id: string;
  produtoId: string | null;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number;
};

export type VendaCompleta = {
  id: string;
  numero: number;
  status: "concluida" | "cancelada";
  clienteId: string | null;
  clienteNome: string;
  formaPagamento: FormaPagamento;
  observacoes: string;
  baixaEstoque: boolean;
  fiado: boolean;
  valorTotal: number;
  data: string;
  criadoEm: string;
  itens: VendaItemUI[];
};

// Desconto sobre uma base (R$ ou %), limitado ao próprio valor.
function calcDesc(base: number, tipo: DescontoTipo, valor: number): number {
  if (!valor || valor <= 0) return 0;
  const v = tipo === "percent" ? (base * valor) / 100 : valor;
  return Math.min(Math.max(v, 0), base);
}

type VendaRow = {
  id: string; numero: number; status: string;
  clienteId: string | null; formaPagamento: string; observacoes: string | null;
  baixaEstoque: boolean; fiado: boolean; valorTotal: unknown; data: Date; createdAt: Date;
  cliente: { nome: string } | null;
  itens: { id: string; produtoId: string | null; nome: string; unidade: string | null; quantidade: unknown; precoUnitario: unknown; valorTotal: unknown }[];
};

function paraUI(v: VendaRow): VendaCompleta {
  return {
    id: v.id,
    numero: v.numero,
    status: v.status === "CANCELADA" ? "cancelada" : "concluida",
    clienteId: v.clienteId,
    clienteNome: v.cliente?.nome ?? "Consumidor",
    formaPagamento: (v.formaPagamento as FormaPagamento) || "dinheiro",
    observacoes: v.observacoes ?? "",
    baixaEstoque: v.baixaEstoque,
    fiado: v.fiado,
    valorTotal: Number(v.valorTotal),
    data: v.data.toISOString(),
    criadoEm: v.createdAt.toISOString(),
    itens: v.itens.map((i) => ({
      id: i.id,
      produtoId: i.produtoId,
      nome: i.nome,
      unidade: i.unidade ?? "UN",
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  };
}

const INCLUDE = { cliente: { select: { nome: true } }, itens: true } as const;

export async function listarVendas(): Promise<VendaCompleta[]> {
  await exigirFeature("vendas");
  const empresaId = await exigirEmpresa();
  const rows = await prisma.venda.findMany({
    where: { empresaId },
    orderBy: [{ data: "desc" }, { numero: "desc" }],
    include: INCLUDE,
  });
  return rows.map(paraUI);
}

export async function criarVenda(
  input: VendaInput,
): Promise<{ ok: true; venda: VendaCompleta } | { ok: false; erro: string }> {
  try {
    await exigirFeature("vendas");
    const empresaId = await exigirEmpresa();

    // Snapshot dos produtos + total (preço de venda cadastrado).
    const ids = input.itens.map((i) => i.produtoId);
    const produtos = await prisma.produto.findMany({ where: { empresaId, id: { in: ids } } });
    const porId = new Map(produtos.map((p) => [p.id, p]));

    const linhas = input.itens
      .filter((i) => porId.has(i.produtoId) && i.quantidade > 0)
      .map((i) => {
        const p = porId.get(i.produtoId)!;
        const preco = Number(p.preco);
        const bruto = i.quantidade * preco;
        const total = Math.round((bruto - calcDesc(bruto, i.descTipo, i.descValor)) * 100) / 100;
        return {
          produto: p,
          data: {
            produtoId: p.id, nome: p.nome, unidade: p.unidade,
            quantidade: i.quantidade, precoUnitario: preco,
            descontoTipo: i.descTipo, descontoValor: i.descValor, valorTotal: total,
          },
        };
      });

    if (!linhas.length) return { ok: false, erro: "Adicione ao menos um produto à venda." };

    const liquidoItens = linhas.reduce((s, l) => s + l.data.valorTotal, 0);
    const geral = calcDesc(liquidoItens, input.desconto.tipo, input.desconto.valor);
    const total = Math.round((liquidoItens - geral) * 100) / 100;

    const fiado = input.formaPagamento === "fiado";
    if (fiado && !input.clienteId) {
      return { ok: false, erro: "Venda fiado exige um cliente selecionado." };
    }

    const dataVenda = input.data ? new Date(input.data + "T12:00:00") : new Date();

    const venda = await prisma.$transaction(async (tx) => {
      const ult = await tx.venda.findFirst({
        where: { empresaId }, orderBy: { numero: "desc" }, select: { numero: true },
      });
      const numero = (ult?.numero ?? 0) + 1;

      const v = await tx.venda.create({
        data: {
          numero, empresaId,
          clienteId: input.clienteId || null,
          status: "CONCLUIDA",
          formaPagamento: input.formaPagamento,
          observacoes: input.observacoes || null,
          descontoTipo: input.desconto.tipo,
          descontoValor: input.desconto.valor,
          valorTotal: total,
          baixaEstoque: input.baixaEstoque,
          fiado,
          data: dataVenda,
          itens: { create: linhas.map((l) => l.data) },
        },
        include: INCLUDE,
      });

      // Baixa de estoque (só produtos com controle ativo).
      if (input.baixaEstoque) {
        for (const l of linhas) {
          if (!l.produto.controlaEstoque) continue;
          const novoSaldo = Math.round((Number(l.produto.estoque) - l.data.quantidade) * 1e4) / 1e4;
          await tx.produto.update({ where: { id: l.produto.id }, data: { estoque: novoSaldo } });
          await tx.movimentoEstoque.create({
            data: {
              empresaId, produtoId: l.produto.id, vendaId: v.id, tipo: "SAIDA",
              quantidade: l.data.quantidade, saldoApos: novoSaldo,
              motivo: `Venda #${numero} (sem nota)`,
            },
          });
        }
      }

      // Fiado: lança DÉBITO na caderneta do cliente.
      if (fiado && input.clienteId) {
        await tx.lancamentoFiado.create({
          data: {
            empresaId, clienteId: input.clienteId, tipo: "DEBITO",
            valor: total, descricao: `Venda #${numero} (sem nota)`, data: dataVenda,
          },
        });
      }

      return v;
    });

    return { ok: true, venda: paraUI(venda) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// Cancela a venda: estorna a baixa de estoque (DEVOLUCAO) e remove o débito
// fiado correspondente. Mantém o registro como CANCELADA (histórico).
export async function cancelarVenda(
  id: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    await exigirFeature("vendas");
    const empresaId = await exigirEmpresa();
    const venda = await prisma.venda.findFirst({
      where: { id, empresaId },
      include: { movimentos: true, itens: true },
    });
    if (!venda) return { ok: false, erro: "Venda não encontrada." };
    if (venda.status === "CANCELADA") return { ok: false, erro: "Venda já cancelada." };

    await prisma.$transaction(async (tx) => {
      // Estorna cada movimento de saída, devolvendo ao estoque.
      for (const m of venda.movimentos) {
        if (m.tipo !== "SAIDA") continue;
        const prod = await tx.produto.findUnique({ where: { id: m.produtoId } });
        if (!prod) continue;
        const novoSaldo = Math.round((Number(prod.estoque) + Number(m.quantidade)) * 1e4) / 1e4;
        await tx.produto.update({ where: { id: m.produtoId }, data: { estoque: novoSaldo } });
        await tx.movimentoEstoque.create({
          data: {
            empresaId, produtoId: m.produtoId, vendaId: venda.id, tipo: "DEVOLUCAO",
            quantidade: Number(m.quantidade), saldoApos: novoSaldo,
            motivo: `Cancelamento venda #${venda.numero}`,
          },
        });
      }

      // Estorna o fiado: lança CRÉDITO abatendo o débito da venda.
      if (venda.fiado && venda.clienteId) {
        await tx.lancamentoFiado.create({
          data: {
            empresaId, clienteId: venda.clienteId, tipo: "CREDITO",
            valor: Number(venda.valorTotal), descricao: `Estorno venda #${venda.numero}`,
            data: new Date(),
          },
        });
      }

      await tx.venda.update({ where: { id: venda.id }, data: { status: "CANCELADA" } });
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
