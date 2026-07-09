"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";

// Caderneta é uma extensão do cadastro de clientes: quem tem "clientes" no
// plano usa fiado. Evita vender/semear uma feature separada.
const FEATURE = "clientes";

export type TipoLancamento = "DEBITO" | "CREDITO";

// Conta = visão agregada do fiado de um cliente (saldo + totais).
export type ContaFiado = {
  clienteId: string;
  clienteNome: string;
  documento: string;
  telefone: string;
  saldo: number; // devedor: > 0 = cliente deve; <= 0 = quitado/adiantado
  totalCompras: number; // Σ débitos
  totalPago: number; // Σ créditos
  qtdLancamentos: number;
  ultimoLancamento: string; // ISO
};

export type LancamentoFiado = {
  id: string;
  tipo: TipoLancamento;
  valor: number;
  descricao: string;
  data: string; // ISO
};

// Lista as contas com movimento, agregadas por cliente. Volume de fiado é
// pequeno — agrega em memória (evita 2 groupBy separados por tipo).
export async function listarCaderneta(): Promise<{ contas: ContaFiado[]; totalDevedor: number }> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.lancamentoFiado.findMany({
    where: { empresaId },
    include: { cliente: { select: { nome: true, documento: true, telefone: true } } },
    orderBy: { data: "desc" }, // 1º visto por cliente = mais recente
  });

  const map = new Map<string, ContaFiado>();
  for (const r of rows) {
    let c = map.get(r.clienteId);
    if (!c) {
      c = {
        clienteId: r.clienteId,
        clienteNome: r.cliente.nome,
        documento: r.cliente.documento,
        telefone: r.cliente.telefone ?? "",
        saldo: 0,
        totalCompras: 0,
        totalPago: 0,
        qtdLancamentos: 0,
        ultimoLancamento: r.data.toISOString(),
      };
      map.set(r.clienteId, c);
    }
    const v = Number(r.valor);
    if (r.tipo === "DEBITO") {
      c.totalCompras += v;
      c.saldo += v;
    } else {
      c.totalPago += v;
      c.saldo -= v;
    }
    c.qtdLancamentos += 1;
  }

  const contas = [...map.values()].sort((a, b) => b.saldo - a.saldo);
  const totalDevedor = contas.reduce((s, c) => s + Math.max(0, c.saldo), 0);
  return { contas, totalDevedor };
}

// Extrato de um cliente (mais recente primeiro).
export async function listarLancamentos(clienteId: string): Promise<LancamentoFiado[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.lancamentoFiado.findMany({
    where: { empresaId, clienteId },
    orderBy: { data: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo as TipoLancamento,
    valor: Number(r.valor),
    descricao: r.descricao ?? "",
    data: r.data.toISOString(),
  }));
}

export type NovoLancamento = {
  clienteId: string;
  tipo: TipoLancamento;
  valor: number;
  descricao?: string;
  data?: string; // "YYYY-MM-DD" (opcional; default = hoje)
};

export async function registrarLancamento(input: NovoLancamento): Promise<void> {
  await exigirFeature(FEATURE);
  const empresaId = await exigirEmpresa();

  if (!input.clienteId) throw new Error("Selecione um cliente.");
  if (!(input.valor > 0)) throw new Error("Informe um valor maior que zero.");

  // Garante que o cliente é da empresa ativa.
  const cli = await prisma.cliente.findFirst({
    where: { id: input.clienteId, empresaId },
    select: { id: true },
  });
  if (!cli) throw new Error("Cliente não encontrado.");

  await prisma.lancamentoFiado.create({
    data: {
      empresaId,
      clienteId: input.clienteId,
      tipo: input.tipo,
      valor: input.valor,
      descricao: input.descricao?.trim() || null,
      // Data no formato YYYY-MM-DD vira meio-dia local p/ não escorregar de dia
      // por fuso ao serializar como UTC.
      data: input.data ? new Date(`${input.data}T12:00:00`) : undefined,
    },
  });
}

export async function excluirLancamento(id: string): Promise<void> {
  await exigirFeature(FEATURE);
  const empresaId = await exigirEmpresa();
  await prisma.lancamentoFiado.deleteMany({ where: { id, empresaId } });
}
