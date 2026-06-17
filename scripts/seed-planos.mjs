// Cria os 3 planos padrão (idempotente por nome). Uso: npx tsx scripts/seed-planos.mjs
import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

const PLANOS = [
  {
    nome: "Básico",
    descricao: "Para quem está começando a emitir notas.",
    preco: 49.9,
    periodicidade: "mensal",
    limiteEmpresas: 1,
    ordem: 1,
    recursos: [
      "1 empresa (CNPJ)",
      "Emissão ilimitada de NF-e (modelo 55)",
      "DANFE em PDF e cancelamento",
      "Certificado digital A1",
      "Importação de XML",
      "Suporte por e-mail",
    ],
  },
  {
    nome: "Profissional",
    descricao: "Para empresas em crescimento e equipes.",
    preco: 129.9,
    periodicidade: "mensal",
    limiteEmpresas: 3,
    ordem: 2,
    recursos: [
      "Até 3 empresas (CNPJ)",
      "Tudo do Básico",
      "Envio automático de NF-e por e-mail",
      "Integração com WhatsApp",
      "Multiusuário (equipe)",
      "Suporte prioritário por WhatsApp",
    ],
  },
  {
    nome: "Empresarial",
    descricao: "Operação completa com integração ao ERP.",
    preco: 299.9,
    periodicidade: "mensal",
    limiteEmpresas: -1,
    ordem: 3,
    recursos: [
      "Empresas ilimitadas",
      "Tudo do Profissional",
      "Integração com Winthor (ERP)",
      "API de integração",
      "Gerente de conta dedicado",
    ],
  },
];

for (const p of PLANOS) {
  const existe = await prisma.plano.findFirst({ where: { nome: p.nome } });
  if (existe) {
    await prisma.plano.update({ where: { id: existe.id }, data: { ...p, ativo: true } });
    console.log("atualizado:", p.nome);
  } else {
    await prisma.plano.create({ data: { ...p, ativo: true } });
    console.log("criado:", p.nome);
  }
}

await prisma.$disconnect();
