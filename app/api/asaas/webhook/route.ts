import { prisma } from "@/lib/prisma";
import { configAsaasEfetiva } from "@/lib/asaas-config";

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

  let body: { event?: string; payment?: { id?: string; billingType?: string; paymentDate?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const event = body.event;
  const paymentId = body.payment?.id;
  if (!event || !paymentId) return Response.json({ ok: true, ignored: true });

  const fatura = await prisma.fatura.findUnique({
    where: { asaasPaymentId: paymentId },
    include: { user: { include: { licenca: { include: { plano: true } } } } },
  });
  if (!fatura) return Response.json({ ok: true, semFatura: true });

  if (PAGOS.has(event)) {
    // Tipo real do pagamento do link (PIX/BOLETO/CREDIT_CARD → pix/boleto/cartao).
    const bt = (body.payment?.billingType ?? "").toUpperCase();
    const metodo = bt === "PIX" ? "pix" : bt === "CREDIT_CARD" ? "cartao" : bt === "BOLETO" ? "boleto" : "asaas";
    const pagaEm = body.payment?.paymentDate ? new Date(body.payment.paymentDate) : new Date();
    await prisma.fatura.update({
      where: { id: fatura.id },
      data: { status: "PAGA", pagaEm, metodo },
    });

    // Renova a licença: ATIVA + estende a validade conforme a periodicidade do plano.
    const lic = fatura.user.licenca;
    if (lic) {
      const anual = lic.plano?.periodicidade === "anual";
      const base = lic.validadeEm && lic.validadeEm > new Date() ? new Date(lic.validadeEm) : new Date();
      if (anual) base.setFullYear(base.getFullYear() + 1);
      else base.setMonth(base.getMonth() + 1);
      await prisma.licenca.update({
        where: { userId: fatura.userId },
        data: { status: "ATIVA", validadeEm: base },
      });
    }
  } else if (VENCIDOS.has(event)) {
    await prisma.fatura.update({ where: { id: fatura.id }, data: { status: "ATRASADA" } });
  }

  return Response.json({ ok: true });
}
