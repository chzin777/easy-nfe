"use server";

import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/empresa";

// Onboarding/tutoriais marcados como vistos POR USUÁRIO (persistido no banco),
// para não reaparecerem em outro navegador/dispositivo.

export async function tourVisto(chave: string): Promise<boolean> {
  try {
    const uid = await exigirUsuario();
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { toursVistos: true } });
    return !!u?.toursVistos.includes(chave);
  } catch {
    // Em erro/sem sessão não incomoda o usuário com o tutorial.
    return true;
  }
}

export async function marcarTourVisto(chave: string): Promise<void> {
  try {
    const uid = await exigirUsuario();
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { toursVistos: true } });
    if (u && !u.toursVistos.includes(chave)) {
      await prisma.user.update({
        where: { id: uid },
        data: { toursVistos: { set: [...u.toursVistos, chave] } },
      });
    }
  } catch {
    /* ignora — marcar tour não é crítico */
  }
}
