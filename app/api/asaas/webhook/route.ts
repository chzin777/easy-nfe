import { prisma } from "@/lib/prisma";
import { configAsaasEfetiva } from "@/lib/asaas-config";
import { ativarPorPagamento, metodoDoBillingType } from "@/lib/assinatura";

// Webhook do Asaas: confirma pagamento da assinatura e renova a licença.
// Configure no painel Asaas a URL deste endpoint + um token; o mesmo token deve
// estar em ASAAS_WEBHOOK_TOKEN. O Asaas envia no header "asaas-access-token".

const PAGOS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"]);
const VENCIDOS = new Set(["PAYMENT_OVERDUE"]);

export async function POST(req: Request) {
  // Token configurado no painel admin (ou env). Se definido, valida o header.
  const token = (await configAsaasEfetiva())?.webhookToken;
  if (token) {
    const recebido = req.headers.get("asaas-access-token");
    if (recebido !== token) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  let body: { event?: string; payment?: { id?: string; billingType?: string; paymentDate?: string; value?: number; subscription?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const event = body.event;
  const paymentId = body.payment?.id;
  if (!event || !paymentId) return Response.json({ ok: true, ignored: true });

  const metodo = metodoDoBillingType(body.payment?.billingType);
  const pagaEm = body.payment?.paymentDate ? new Date(body.payment.paymentDate) : new Date();

  const fatura = await prisma.fatura.findUnique({ where: { asaasPaymentId: paymentId }, select: { id: true } });

  if (fatura) {
    if (PAGOS.has(event)) {
      await ativarPorPagamento(fatura.id, metodo, pagaEm);
    } else if (VENCIDOS.has(event)) {
      await prisma.fatura.update({ where: { id: fatura.id }, data: { status: "ATRASADA" } });
    }
    return Response.json({ ok: true });
  }

  // Renovação recorrente (cartão): pagamento novo de uma assinatura conhecida.
  // Cria a fatura do ciclo já PAGA e estende a licença.
  if (PAGOS.has(event) && body.payment?.subscription) {
    const lic = await prisma.licenca.findFirst({
      where: { asaasSubscriptionId: body.payment.subscription },
      include: { plano: true },
    });
    if (lic) {
      const comp = `${pagaEm.getFullYear()}-${String(pagaEm.getMonth() + 1).padStart(2, "0")}`;
      const nova = await prisma.fatura.upsert({
        where: { userId_competencia: { userId: lic.userId, competencia: comp } },
        update: { asaasPaymentId: paymentId, metodo },
        create: {
          userId: lic.userId,
          planoNome: lic.plano?.nome ?? "Assinatura Easy-NFe",
          competencia: comp,
          valor: body.payment?.value ?? Number(lic.plano?.preco ?? 0),
          vencimento: pagaEm,
          status: "PENDENTE",
          metodo,
          asaasPaymentId: paymentId,
        },
        select: { id: true },
      });
      await ativarPorPagamento(nova.id, metodo, pagaEm);
    }
    return Response.json({ ok: true, recorrente: true });
  }

  return Response.json({ ok: true, semFatura: true });
}
