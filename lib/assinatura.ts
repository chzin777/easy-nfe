import "server-only";
import { prisma } from "./prisma";

// Preço da fatura após o desconto especial da licença. tipo: "percent" | "valor".
// "valor" = R$ fixo abatido por fatura; "percent" = % sobre o preço do plano.
// Usado tanto na geração admin quanto nos fluxos self-serve (trial/renovação).
export function precoComDesconto(preco: number, tipo: string, valor: number): number {
  if (!valor || valor <= 0) return preco;
  const d = tipo === "percent" ? (preco * valor) / 100 : valor;
  return Math.max(0, Math.round((preco - d) * 100) / 100);
}

// Marca a fatura como paga e ativa/estende a licença do usuário conforme a
// periodicidade do plano. Idempotente (chamar 2x não duplica validade além do
// período já concedido para faturas já pagas).
export async function ativarPorPagamento(
  faturaId: string,
  metodo: string,
  pagaEm: Date,
): Promise<void> {
  const fatura = await prisma.fatura.findUnique({ where: { id: faturaId } });
  if (!fatura) return;
  if (fatura.status === "PAGA") return; // já processada

  const lic = await prisma.licenca.findUnique({
    where: { userId: fatura.userId },
    include: { plano: true },
  });
  const base = lic?.validadeEm && lic.validadeEm > new Date() ? new Date(lic.validadeEm) : new Date();
  if (lic?.plano?.periodicidade === "anual") base.setFullYear(base.getFullYear() + 1);
  else base.setMonth(base.getMonth() + 1);

  await prisma.$transaction([
    prisma.fatura.update({ where: { id: fatura.id }, data: { status: "PAGA", pagaEm, metodo } }),
    ...(lic
      ? [prisma.licenca.update({ where: { userId: fatura.userId }, data: { status: "ATIVA", validadeEm: base } })]
      : []),
  ]);
}

// Normaliza o billingType do Asaas para o nosso rótulo de método.
export function metodoDoBillingType(bt?: string | null): string {
  const v = (bt ?? "").toUpperCase();
  return v === "PIX" ? "pix" : v === "CREDIT_CARD" ? "cartao" : v === "BOLETO" ? "boleto" : "asaas";
}
