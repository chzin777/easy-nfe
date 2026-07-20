import "server-only";
import { prisma } from "./prisma";
import { lerSessaoCompleta } from "./auth";
import { isAdminRole, uidDaLicencaVigente } from "./empresa";

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

  // Membro de equipe não tem licença própria: quem rege o acesso dele é a
  // licença do dono da empresa. Senão a equipe seguiria emitindo com o dono
  // bloqueado por inadimplência.
  const pagante = await uidDaLicencaVigente(s.uid);
  const proprio = pagante === s.uid;
  const posse = proprio ? "Sua licença" : "A licença da empresa";
  const acao = proprio ? "Fale com o administrador." : "Fale com o responsável pela empresa.";

  const lic = await prisma.licenca.findUnique({ where: { userId: pagante } });

  // Status definidos manualmente que bloqueiam.
  if (lic?.status === "CANCELADA") return { bloqueado: true, mensagem: `${posse} foi cancelada. ${acao}` };
  if (lic?.status === "SUSPENSA") return { bloqueado: true, mensagem: `${posse} está suspensa. ${acao}` };

  const hoje = new Date();
  const vencidas = await prisma.fatura.findMany({
    where: { userId: pagante, status: { in: ["PENDENTE", "ATRASADA"] }, vencimento: { lt: hoje } },
    orderBy: { vencimento: "asc" },
  });

  if (vencidas.length === 0) {
    return { bloqueado: lic?.status === "EXPIRADA", mensagem: lic?.status === "EXPIRADA" ? `${posse} está expirada. ${acao}` : undefined };
  }

  // Marca as vencidas ainda PENDENTE como ATRASADA (mantém o painel coerente).
  await prisma.fatura.updateMany({
    where: { userId: pagante, status: "PENDENTE", vencimento: { lt: hoje } },
    data: { status: "ATRASADA" },
  });

  const maisAntiga = vencidas[0];
  const diasAtraso = Math.floor((hoje.getTime() - maisAntiga.vencimento.getTime()) / 86_400_000);
  const alvoBloqueio = new Date(maisAntiga.vencimento.getTime() + DIAS_TOLERANCIA * 86_400_000);

  if (diasAtraso >= DIAS_TOLERANCIA) {
    if (lic && lic.status !== "EXPIRADA") {
      await prisma.licenca.update({ where: { userId: pagante }, data: { status: "EXPIRADA" } });
    }
    return {
      bloqueado: true,
      mensagem: proprio
        ? "Sua licença está expirada por fatura em atraso. Regularize o pagamento para voltar a emitir."
        : "A licença da empresa está expirada por fatura em atraso. Fale com o responsável pela empresa.",
    };
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
