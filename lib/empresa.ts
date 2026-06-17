import "server-only";
import { prisma } from "./prisma";
import { lerSessao, lerSessaoCompleta, lerEmpresaAtiva } from "./auth";

// Acesso total às funcionalidades + qualquer empresa. NÃO implica painel admin.
// CONTADOR tem o mesmo acesso operacional de admin, mas sem o painel administrativo.
export function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPORTE" || role === "CONTADOR";
}

// userId da sessão ou erro.
export async function exigirUsuario(): Promise<string> {
  const uid = await lerSessao();
  if (!uid) throw new Error("Não autenticado.");
  return uid;
}

// Sessão completa (uid + role) ou erro.
export async function exigirSessao(): Promise<{ uid: string; role: string }> {
  const s = await lerSessaoCompleta();
  if (!s) throw new Error("Não autenticado.");
  return s;
}

// id da empresa ativa. Usuário comum: validada por acesso M—N.
// Admin/suporte: acessam QUALQUER empresa do sistema.
export async function empresaAtivaId(): Promise<string | null> {
  const { uid, role } = await exigirSessao();
  const admin = isAdminRole(role);
  const eid = await lerEmpresaAtiva();

  if (eid) {
    if (admin) {
      const ok = await prisma.emitente.findUnique({ where: { id: eid }, select: { id: true } });
      if (ok) return ok.id;
    } else {
      const ok = await prisma.acessoEmpresa.findUnique({
        where: { userId_empresaId: { userId: uid, empresaId: eid } },
        select: { empresaId: true },
      });
      if (ok) return ok.empresaId;
    }
  }

  if (admin) {
    const primeira = await prisma.emitente.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return primeira?.id ?? null;
  }
  const primeiro = await prisma.acessoEmpresa.findFirst({
    where: { userId: uid },
    orderBy: { createdAt: "asc" },
    select: { empresaId: true },
  });
  return primeiro?.empresaId ?? null;
}

// id da empresa ativa ou erro (para operações que exigem empresa).
export async function exigirEmpresa(): Promise<string> {
  const id = await empresaAtivaId();
  if (!id) {
    throw new Error("Nenhuma empresa configurada. Cadastre uma empresa em Configurações.");
  }
  return id;
}

// Plano vigente do usuário (via licença) + quantas empresas ele já é DONO.
// Usado p/ limitar quantas empresas próprias o usuário pode cadastrar.
export async function limiteEmpresasDoUsuario(
  uid: string,
): Promise<{ limite: number; usadas: number; podeAdicionar: boolean }> {
  const licenca = await prisma.licenca.findUnique({
    where: { userId: uid },
    include: { plano: true },
  });
  // Sem plano: 1 empresa por padrão.
  const limite = licenca?.plano?.limiteEmpresas ?? 1;
  const usadas = await prisma.acessoEmpresa.count({ where: { userId: uid, papel: "dono" } });
  const podeAdicionar = limite < 0 || usadas < limite;
  return { limite, usadas, podeAdicionar };
}

// Limite de membros (equipe) de UMA empresa, conforme o plano do usuário logado.
export async function limiteEquipe(
  uid: string,
  empresaId: string,
): Promise<{ limite: number; usados: number; podeAdicionar: boolean }> {
  const licenca = await prisma.licenca.findUnique({ where: { userId: uid }, include: { plano: true } });
  const limite = licenca?.plano?.limiteUsuarios ?? 1;
  // Conta membros (papel != dono) com acesso à empresa.
  const usados = await prisma.acessoEmpresa.count({ where: { empresaId, papel: { not: "dono" } } });
  const podeAdicionar = limite < 0 || usados < limite;
  return { limite, usados, podeAdicionar };
}
