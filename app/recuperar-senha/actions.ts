"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashSenha } from "@/lib/auth";
import { enviarEmail, htmlRedefinicaoSenha } from "@/lib/email";

export type RecuperarResultado = { erro: string } | { ok: true };
export type RedefinirResultado = { erro: string } | { ok: true };

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const VALIDADE_MIN = 60; // link expira em 1 hora

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

// Base pública p/ montar o link: APP_URL se definido, senão o host da requisição.
async function baseUrl(): Promise<string> {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Passo 1: usuário informa o e-mail. Sempre respondemos "ok" (não revelamos se
// o e-mail existe — evita enumeração de contas). O e-mail só sai se houver conta.
export async function solicitarRedefinicao(
  _prev: RecuperarResultado | null,
  formData: FormData,
): Promise<RecuperarResultado> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailValido(email)) return { erro: "Informe um e-mail válido." };

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, ativo: true },
    });

    if (user && user.ativo) {
      // Invalida pedidos anteriores ainda pendentes deste usuário.
      await prisma.redefinicaoSenha.deleteMany({
        where: { userId: user.id, usadoEm: null },
      });

      const tokenBruto = randomBytes(32).toString("hex");
      const expiraEm = new Date(Date.now() + VALIDADE_MIN * 60 * 1000);
      await prisma.redefinicaoSenha.create({
        data: { userId: user.id, tokenHash: sha256(tokenBruto), expiraEm },
      });

      const link = `${await baseUrl()}/redefinir-senha?token=${tokenBruto}`;
      try {
        await enviarEmail({
          para: email,
          assunto: "Redefinição de senha — Easy-NFe",
          html: htmlRedefinicaoSenha(link),
        });
      } catch (e) {
        // Não revela a falha ao cliente; registra p/ diagnóstico.
        console.error("solicitarRedefinicao: envio de e-mail falhou", e);
      }
    }

    return { ok: true };
  } catch (e) {
    console.error("solicitarRedefinicao", e);
    // Mesmo em erro, resposta genérica p/ não vazar informação.
    return { ok: true };
  }
}

// Passo 2: usuário abre o link e define a nova senha.
export async function redefinirSenha(
  _prev: RedefinirResultado | null,
  formData: FormData,
): Promise<RedefinirResultado> {
  const token = String(formData.get("token") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (!token) return { erro: "Link inválido. Solicite a redefinição novamente." };
  if (senha.length < 8) return { erro: "A senha deve ter ao menos 8 caracteres." };
  if (senha !== confirmar) return { erro: "As senhas não coincidem." };

  try {
    const registro = await prisma.redefinicaoSenha.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, userId: true, usadoEm: true, expiraEm: true },
    });

    if (!registro || registro.usadoEm || registro.expiraEm < new Date()) {
      return { erro: "Link inválido ou expirado. Solicite a redefinição novamente." };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: registro.userId },
        data: { senhaHash: await hashSenha(senha) },
      }),
      prisma.redefinicaoSenha.update({
        where: { id: registro.id },
        data: { usadoEm: new Date() },
      }),
    ]);

    return { ok: true };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}
