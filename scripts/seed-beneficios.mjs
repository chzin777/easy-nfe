// Cria o catálogo de benefícios e vincula aos planos. Uso: npx tsx scripts/seed-beneficios.mjs
import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

const CATALOGO = [
  { chave: "emissao_ilimitada", nome: "Emissão ilimitada de NF-e (mod. 55)", ordem: 1 },
  { chave: "danfe", nome: "DANFE em PDF e cancelamento", ordem: 2 },
  { chave: "cert_a1", nome: "Certificado digital A1", ordem: 3 },
  { chave: "import_xml", nome: "Importação de XML", ordem: 4 },
  { chave: "suporte_email", nome: "Suporte por e-mail", ordem: 5 },
  { chave: "nfe_email", nome: "Envio automático de NF-e por e-mail", ordem: 6 },
  { chave: "whatsapp", nome: "Integração com WhatsApp", ordem: 7 },
  { chave: "multiusuario", nome: "Multiusuário (equipe)", ordem: 8 },
  { chave: "suporte_prioritario", nome: "Suporte prioritário por WhatsApp", ordem: 9 },
  { chave: "ecommerce", nome: "Integração com e-commerce e marketplaces", ordem: 10 },
  { chave: "dfe", nome: "Captura de notas recebidas (DF-e)", ordem: 11 },
  { chave: "nfce_nfse", nome: "NFC-e e NFS-e", ordem: 12 },
  { chave: "api", nome: "API de integração", ordem: 13 },
  { chave: "gerente", nome: "Gerente de conta dedicado", ordem: 14 },
  { chave: "orcamentos", nome: "Orçamentos", ordem: 15 },
  { chave: "controle_estoque", nome: "Controle de estoque", ordem: 16 },
];

for (const b of CATALOGO) {
  await prisma.beneficio.upsert({ where: { chave: b.chave }, update: { nome: b.nome, ordem: b.ordem }, create: b });
}
const byChave = Object.fromEntries((await prisma.beneficio.findMany()).map((b) => [b.chave, b.id]));
const conectar = (chaves) => ({ set: chaves.map((c) => ({ id: byChave[c] })) });

const PLANOS = {
  "Básico": ["emissao_ilimitada", "danfe", "cert_a1", "import_xml", "suporte_email"],
  "Profissional": ["emissao_ilimitada", "danfe", "cert_a1", "import_xml", "ecommerce", "nfe_email", "whatsapp", "multiusuario", "suporte_prioritario", "controle_estoque"],
  "Empresarial": ["emissao_ilimitada", "danfe", "cert_a1", "ecommerce", "nfe_email", "whatsapp", "multiusuario", "dfe", "nfce_nfse", "api", "gerente", "controle_estoque"],
};

for (const [nome, chaves] of Object.entries(PLANOS)) {
  const p = await prisma.plano.findFirst({ where: { nome } });
  if (p) {
    await prisma.plano.update({ where: { id: p.id }, data: { beneficios: conectar(chaves) } });
    console.log(`vinculado: ${nome} (${chaves.length} benefícios)`);
  }
}

await prisma.$disconnect();
