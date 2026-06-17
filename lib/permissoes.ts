import "server-only";
import { prisma } from "./prisma";
import { lerSessaoCompleta } from "./auth";
import { isAdminRole } from "./empresa";
import { FEATURES } from "./features";

const TODAS = FEATURES.map((f) => f.chave);

// Features de um plano = união das features dos seus benefícios.
// O benefício especial "tudo_anterior" agrega as features do plano de nível abaixo.
async function featuresDoPlano(planoId: string, visitados = new Set<string>()): Promise<Set<string>> {
  if (visitados.has(planoId)) return new Set();
  visitados.add(planoId);

  const plano = await prisma.plano.findUnique({
    where: { id: planoId },
    include: { beneficios: { select: { chave: true, features: true } } },
  });
  if (!plano) return new Set();

  const set = new Set<string>();
  let herda = false;
  for (const b of plano.beneficios) {
    if (b.chave === "tudo_anterior") herda = true;
    for (const f of b.features) set.add(f);
  }

  if (herda) {
    const anterior = await prisma.plano.findFirst({
      where: { ordem: { lt: plano.ordem } },
      orderBy: { ordem: "desc" },
      select: { id: true },
    });
    if (anterior) {
      for (const f of await featuresDoPlano(anterior.id, visitados)) set.add(f);
    }
  }
  return set;
}

// Features do usuário logado. Admin/suporte têm todas.
export async function featuresDoUsuario(): Promise<{ admin: boolean; features: Set<string> }> {
  const s = await lerSessaoCompleta();
  if (!s) return { admin: false, features: new Set() };
  if (isAdminRole(s.role)) return { admin: true, features: new Set(TODAS) };

  const lic = await prisma.licenca.findUnique({ where: { userId: s.uid }, select: { planoId: true } });
  if (!lic?.planoId) return { admin: false, features: new Set() };
  return { admin: false, features: await featuresDoPlano(lic.planoId) };
}

export async function temFeature(chave: string): Promise<boolean> {
  const { admin, features } = await featuresDoUsuario();
  return admin || features.has(chave);
}

// Lança se o usuário não tiver a feature (uso em server actions).
export async function exigirFeature(chave: string): Promise<void> {
  if (!(await temFeature(chave))) {
    throw new Error("Seu plano não inclui este recurso. Faça upgrade para utilizá-lo.");
  }
}

// Lista (array) das features do usuário — para a UI (sidebar etc).
export async function minhasFeatures(): Promise<string[]> {
  const { features } = await featuresDoUsuario();
  return [...features];
}
