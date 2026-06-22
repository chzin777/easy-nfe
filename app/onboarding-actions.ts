"use server";

import { prisma } from "@/lib/prisma";
import { empresaAtivaId, exigirSessao } from "@/lib/empresa";

export type OnboardingEstado = {
  role: string;
  temEmpresa: boolean;
  produtos: number;
  clientes: number;
  transportadoras: number;
};

// Estado dos "primeiros passos" do usuário logado (empresa + cadastros básicos).
export async function estadoOnboarding(): Promise<OnboardingEstado> {
  const { role } = await exigirSessao();
  const empresaId = await empresaAtivaId();
  if (!empresaId) {
    return { role, temEmpresa: false, produtos: 0, clientes: 0, transportadoras: 0 };
  }
  const [produtos, clientes, transportadoras] = await Promise.all([
    prisma.produto.count({ where: { empresaId } }),
    prisma.cliente.count({ where: { empresaId } }),
    prisma.transportadora.count({ where: { empresaId } }),
  ]);
  return { role, temEmpresa: true, produtos, clientes, transportadoras };
}
