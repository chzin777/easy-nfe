"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";

// ---------------------------------------------------------------------------
// Fonte de dados dos relatórios PDF. Cada dataset devolve linhas já
// normalizadas (primitivos) — o cliente escolhe quais colunas exibir/exportar.
// ---------------------------------------------------------------------------

export type Dataset = "produtos" | "estoque" | "notas" | "clientes" | "vendas" | "financeiro";

export type FiltroRelatorio = {
  de?: string | null; // ISO date (yyyy-mm-dd)
  ate?: string | null;
};

export type LinhaRelatorio = Record<string, string | number>;

const STATUS_NOTA: Record<string, string> = {
  RASCUNHO: "Rascunho", AUTORIZADA: "Autorizada", CANCELADA: "Cancelada",
  REJEITADA: "Rejeitada", DENEGADA: "Denegada",
};

function intervalo(f: FiltroRelatorio): { gte?: Date; lte?: Date } {
  const r: { gte?: Date; lte?: Date } = {};
  if (f.de) r.gte = new Date(f.de + "T00:00:00");
  if (f.ate) r.lte = new Date(f.ate + "T23:59:59");
  return r;
}

export async function dadosRelatorio(dataset: Dataset, filtro: FiltroRelatorio = {}): Promise<LinhaRelatorio[]> {
  await exigirFeature("dashboard");
  const empresaId = await exigirEmpresa();

  switch (dataset) {
    case "produtos": {
      const rows = await prisma.produto.findMany({
        where: { empresaId },
        orderBy: { codigoInterno: "asc" },
        include: { categoria: { select: { nome: true } } },
      });
      return rows.map((p) => {
        const preco = Number(p.preco);
        const custo = p.precoCusto == null ? 0 : Number(p.precoCusto);
        const margem = preco > 0 && custo > 0 ? ((preco - custo) / preco) * 100 : 0;
        return {
          codigo: p.codigoInterno,
          nome: p.nome,
          marca: p.marca ?? "",
          categoria: p.categoria?.nome ?? "",
          unidade: p.unidade,
          ncm: p.ncm,
          gtin: p.codigoBarras ?? "",
          preco,
          custo,
          margem: Math.round(margem * 10) / 10,
        };
      });
    }

    case "estoque": {
      const rows = await prisma.produto.findMany({
        where: { empresaId, controlaEstoque: true },
        orderBy: { nome: "asc" },
        include: { categoria: { select: { nome: true } } },
      });
      return rows.map((p) => {
        const saldo = Number(p.estoque);
        const min = Number(p.estoqueMinimo);
        const custo = p.precoCusto == null ? 0 : Number(p.precoCusto);
        const situacao = saldo <= 0 ? "Zerado" : min > 0 && saldo <= min ? "Baixo" : "Em dia";
        return {
          codigo: p.codigoInterno,
          nome: p.nome,
          categoria: p.categoria?.nome ?? "",
          unidade: p.unidade,
          saldo,
          minimo: min,
          custo,
          valorEstoque: Math.round(saldo * custo * 100) / 100,
          situacao,
        };
      });
    }

    case "notas": {
      const rows = await prisma.nota.findMany({
        where: { emitenteId: empresaId, autorizadaEm: intervalo(filtro) },
        orderBy: { numero: "desc" },
        include: { cliente: { select: { nome: true } } },
      });
      return rows.map((n) => ({
        numero: n.numero,
        serie: n.serie,
        modelo: n.modelo,
        status: STATUS_NOTA[n.status] ?? n.status,
        cliente: n.cliente?.nome ?? "",
        emitidaEm: n.autorizadaEm ? n.autorizadaEm.toISOString().slice(0, 10).split("-").reverse().join("/") : "",
        valorTotal: Number(n.valorTotal),
        chave: n.chaveAcesso ?? "",
      }));
    }

    case "clientes": {
      const rows = await prisma.cliente.findMany({
        where: { empresaId },
        orderBy: { codigoInterno: "asc" },
        include: { categoria: { select: { nome: true } } },
      });
      return rows.map((c) => ({
        codigo: c.codigoInterno,
        nome: c.nome,
        documento: c.documento,
        tipo: c.tipoContribuinte === "1" ? "Contribuinte" : c.tipoContribuinte === "2" ? "Isento" : "Não contribuinte",
        categoria: c.categoria?.nome ?? "",
        telefone: c.telefone ?? "",
        email: c.email ?? "",
        cidade: c.municipio ?? "",
        uf: c.uf ?? "",
      }));
    }

    case "vendas": {
      const rows = await prisma.venda.findMany({
        where: { empresaId, data: intervalo(filtro) },
        orderBy: { data: "desc" },
        include: { cliente: { select: { nome: true } }, itens: { select: { id: true } } },
      });
      const PAG: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão", fiado: "Fiado", outro: "Outro" };
      return rows.map((v) => ({
        numero: v.numero,
        data: v.data.toISOString().slice(0, 10).split("-").reverse().join("/"),
        cliente: v.cliente?.nome ?? "Consumidor",
        pagamento: PAG[v.formaPagamento] ?? v.formaPagamento,
        itens: v.itens.length,
        total: Number(v.valorTotal),
        status: v.status === "CANCELADA" ? "Cancelada" : "Concluída",
      }));
    }

    case "financeiro": {
      const range = intervalo(filtro);
      const [notas, vendas] = await Promise.all([
        prisma.nota.findMany({
          where: { emitenteId: empresaId, status: "AUTORIZADA", autorizadaEm: range },
          select: { autorizadaEm: true, valorTotal: true },
        }),
        prisma.venda.findMany({
          where: { empresaId, status: "CONCLUIDA", data: range },
          select: { data: true, valorTotal: true },
        }),
      ]);
      // Agrega por mês (yyyy-mm).
      const mapa = new Map<string, { notasQtd: number; notasValor: number; vendasQtd: number; vendasValor: number }>();
      const get = (k: string) => {
        let m = mapa.get(k);
        if (!m) { m = { notasQtd: 0, notasValor: 0, vendasQtd: 0, vendasValor: 0 }; mapa.set(k, m); }
        return m;
      };
      for (const n of notas) {
        const d = n.autorizadaEm ?? new Date();
        const k = d.toISOString().slice(0, 7);
        const m = get(k); m.notasQtd++; m.notasValor += Number(n.valorTotal);
      }
      for (const v of vendas) {
        const k = v.data.toISOString().slice(0, 7);
        const m = get(k); m.vendasQtd++; m.vendasValor += Number(v.valorTotal);
      }
      return [...mapa.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([k, m]) => {
          const [ano, mes] = k.split("-");
          return {
            mes: `${mes}/${ano}`,
            notasQtd: m.notasQtd,
            faturamentoNotas: Math.round(m.notasValor * 100) / 100,
            vendasQtd: m.vendasQtd,
            faturamentoVendas: Math.round(m.vendasValor * 100) / 100,
            faturamentoTotal: Math.round((m.notasValor + m.vendasValor) * 100) / 100,
          };
        });
    }
  }
}
