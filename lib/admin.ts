import "server-only";
import { lerSessaoCompleta } from "./auth";

// Garante que o usuário logado é ADMIN ou SUPORTE. Lança se não for.
export async function exigirAdmin(): Promise<{ uid: string; role: string }> {
  const s = await lerSessaoCompleta();
  if (!s || (s.role !== "ADMIN" && s.role !== "SUPORTE")) {
    throw new Error("Acesso restrito ao administrador.");
  }
  return s;
}

// Só ADMIN pode mexer em outros admins / planos sensíveis.
export async function exigirAdminMaster(): Promise<{ uid: string; role: string }> {
  const s = await lerSessaoCompleta();
  if (!s || s.role !== "ADMIN") {
    throw new Error("Ação restrita ao administrador master.");
  }
  return s;
}
