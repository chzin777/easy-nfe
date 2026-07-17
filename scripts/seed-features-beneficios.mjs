// Mapeia as funcionalidades (features) nos benefícios já existentes. Uso: npx tsx scripts/seed-features-beneficios.mjs
import "dotenv/config";
import { prisma } from "../lib/prisma.ts";

// Cada benefício libera estas features. "emissao_ilimitada" carrega o pacote básico (core).
const MAPA = {
  emissao_ilimitada: ["produtos", "clientes", "transportadoras", "emitir_nfe", "notas_listar", "dashboard", "vendas"],
  danfe: ["danfe", "nota_cancelar"],
  cert_a1: [],
  import_xml: ["importar_xml"],
  suporte_email: [],
  nfe_email: ["integracao_email"],
  whatsapp: ["integracao_whatsapp"],
  multiusuario: ["multiusuario"],
  suporte_prioritario: ["suporte_prioritario"],
  ecommerce: ["integracao_ecommerce"],
  dfe: ["dfe"],
  nfce_nfse: ["emitir_nfce", "emitir_nfse"],
  api: ["api"],
  gerente: [],
  orcamentos: ["orcamentos"],
  controle_estoque: ["estoque"],
};

for (const [chave, features] of Object.entries(MAPA)) {
  const b = await prisma.beneficio.findUnique({ where: { chave } });
  if (b) {
    await prisma.beneficio.update({ where: { chave }, data: { features } });
    console.log(`${chave} → [${features.join(", ")}]`);
  }
}
await prisma.$disconnect();
