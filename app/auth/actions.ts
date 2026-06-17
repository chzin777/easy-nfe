"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  verificarSenha,
  criarSessao,
  destruirSessao,
  definirEmpresaAtiva,
  lerSessaoCompleta,
} from "@/lib/auth";

export type AuthResultado = { erro: string } | { ok: true };

// Papel do usuário logado (p/ a UI decidir mostrar link do painel admin).
export async function papelAtual(): Promise<string | null> {
  return (await lerSessaoCompleta())?.role ?? null;
}

// Após autenticar: define empresa ativa (1ª acessível) e decide destino.
async function aposLogin(userId: string, role: string): Promise<string> {
  // Admin/suporte vão para a home; acessam o painel pela sidebar.
  if (role === "ADMIN" || role === "SUPORTE") {
    const primeira = await prisma.emitente.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (primeira) await definirEmpresaAtiva(primeira.id);
    return "/painel";
  }

  const acesso = await prisma.acessoEmpresa.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { empresaId: true },
  });
  if (acesso) {
    await definirEmpresaAtiva(acesso.empresaId);
    return "/painel";
  }
  // Sem empresa: manda configurar a primeira.
  return "/configuracoes";
}

export async function entrar(
  _prev: AuthResultado | null,
  formData: FormData,
): Promise<AuthResultado> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  let destino: string;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo || !(await verificarSenha(senha, user.senhaHash))) {
      return { erro: "E-mail ou senha incorretos." };
    }
    await criarSessao(user.id, user.role);
    destino = await aposLogin(user.id, user.role);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
  // redirect() lança NEXT_REDIRECT — fica fora do try p/ não ser capturado.
  redirect(destino);
}

export async function sair(): Promise<void> {
  await destruirSessao();
  redirect("/login");
}
