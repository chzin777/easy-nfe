import "server-only";
import { prisma } from "./prisma";
import { lerSessaoCompleta } from "./auth";
import { isAdminRole } from "./empresa";

const DIAS_TOLERANCIA = 7;

export type EstadoLicenca = {
  bloqueado: boolean;
  mensagem?: string;
  // aviso (dentro da tolerância): dados p/ banner + timer
  aviso?: {
    competencia: string;
    valor: number;
    diasAtraso: number;
    alvoBloqueio: string; // ISO: quando o acesso será bloqueado
  };
};

// Avalia a licença do usuário logado com base nas faturas vencidas não pagas.
// >= 7 dias de atraso → licença EXPIRADA + bloqueio. Dentro de 7 dias → aviso.
export async function estadoLicencaUsuario(): Promise<EstadoLicenca> {
  const s = await lerSessaoCompleta();
  if (!s) return { bloqueado: false };
  if (isAdminRole(s.role)) return { bloqueado: false }; // admin/suporte nunca bloqueiam

  const lic = await prisma.licenca.findUnique({ where: { userId: s.uid } });

  // Status definidos manualmente que bloqueiam.
  if (lic?.status === "CANCELADA") return { bloqueado: true, mensagem: "Sua licença foi cancelada. Fale com o administrador." };
  if (lic?.status === "SUSPENSA") return { bloqueado: true, mensagem: "Sua licença está suspensa. Fale com o administrador." };

  const hoje = new Date();
  const vencidas = await prisma.fatura.findMany({
    where: { userId: s.uid, status: { in: ["PENDENTE", "ATRASADA"] }, vencimento: { lt: hoje } },
    orderBy: { vencimento: "asc" },
  });

  if (vencidas.length === 0) {
    return { bloqueado: lic?.status === "EXPIRADA", mensagem: lic?.status === "EXPIRADA" ? "Sua licença está expirada. Fale com o administrador." : undefined };
  }

  // Marca as vencidas ainda PENDENTE como ATRASADA (mantém o painel coerente).
  await prisma.fatura.updateMany({
    where: { userId: s.uid, status: "PENDENTE", vencimento: { lt: hoje } },
    data: { status: "ATRASADA" },
  });

  const maisAntiga = vencidas[0];
  const diasAtraso = Math.floor((hoje.getTime() - maisAntiga.vencimento.getTime()) / 86_400_000);
  const alvoBloqueio = new Date(maisAntiga.vencimento.getTime() + DIAS_TOLERANCIA * 86_400_000);

  if (diasAtraso >= DIAS_TOLERANCIA) {
    if (lic && lic.status !== "EXPIRADA") {
      await prisma.licenca.update({ where: { userId: s.uid }, data: { status: "EXPIRADA" } });
    }
    return { bloqueado: true, mensagem: "Sua licença está expirada por fatura em atraso. Regularize o pagamento para voltar a emitir." };
  }

  return {
    bloqueado: false,
    aviso: {
      competencia: maisAntiga.competencia,
      valor: Number(maisAntiga.valor),
      diasAtraso,
      alvoBloqueio: alvoBloqueio.toISOString(),
    },
  };
}
