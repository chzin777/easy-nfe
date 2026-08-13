// Envia (ou só pré-visualiza) o e-mail de reativação para um usuário cujo
// teste terminou. Os números vêm do banco — nada é escrito à mão.
//
// Uso:
//   npx tsx scripts/email-reativacao.mjs preview <email> [arquivo.html]
//   npx tsx scripts/email-reativacao.mjs enviar  <email>
//
// `preview` NÃO envia nada: grava o HTML em disco para conferência.
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { prisma } from "../lib/prisma.ts";
import { enviarEmail, htmlReativacao } from "../lib/email.ts";
import { logoBase64, LOGO_CID } from "../lib/logo-email.ts";

const [, , cmd, email, saida] = process.argv;

if (!cmd || !email) {
  console.error("uso: npx tsx scripts/email-reativacao.mjs <preview|enviar> <email> [arquivo.html]");
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase() },
  include: {
    licenca: { include: { plano: true } },
    acessos: { include: { empresa: { select: { id: true, razaoSocial: true } } } },
  },
});
if (!user) {
  console.error(`Usuário não encontrado: ${email}`);
  process.exit(1);
}
if (!user.licenca?.plano) {
  console.error("Usuário sem plano na licença — não dá para montar o e-mail.");
  process.exit(1);
}

// Uso real da conta: o argumento do e-mail é o trabalho que já está lá dentro.
const acesso = user.acessos[0];
let uso;
let empresaNome;
if (acesso) {
  empresaNome = acesso.empresa.razaoSocial;
  const [notas, clientes, produtos] = await Promise.all([
    prisma.nota.count({ where: { emitenteId: acesso.empresaId, status: "AUTORIZADA" } }),
    prisma.cliente.count({ where: { empresaId: acesso.empresaId } }),
    prisma.produto.count({ where: { empresaId: acesso.empresaId } }),
  ]);
  if (notas || clientes || produtos) uso = { notas, clientes, produtos };
}

const html = htmlReativacao({
  nome: user.nome ?? user.email,
  plano: user.licenca.plano.nome,
  valor: Number(user.licenca.plano.preco),
  fimTeste: user.licenca.validadeEm ?? new Date(),
  entrarUrl: "https://www.easynfe.digital/login",
  empresa: empresaNome,
  uso,
  // No preview a logo não vai por cid (não existe anexo): fica sem imagem,
  // o header roxo com o nome já identifica a marca.
  logoCid: cmd === "enviar" ? LOGO_CID : undefined,
});

const assunto = `${(user.nome ?? "").split(" ")[0] || "Olá"}, reative sua conta e volte a emitir notas`;

if (cmd === "preview") {
  const destino = saida ?? "preview-reativacao.html";
  await writeFile(destino, html, "utf8");
  console.log(`Preview gravado em ${destino}`);
  console.log(`Para: ${user.email}`);
  console.log(`Assunto: ${assunto}`);
  console.log(`Plano: ${user.licenca.plano.nome} · R$ ${Number(user.licenca.plano.preco).toFixed(2)}`);
  console.log(`Fim do teste: ${user.licenca.validadeEm?.toLocaleDateString("pt-BR") ?? "—"}`);
  console.log(`Uso: ${uso ? JSON.stringify(uso) : "sem dados"}`);
  console.log("\nNADA foi enviado. Para enviar de verdade: ... enviar " + user.email);
} else if (cmd === "enviar") {
  await enviarEmail({
    para: user.email,
    assunto,
    html,
    anexos: [{ filename: "easy-nfe.png", content: await logoBase64(), contentId: LOGO_CID }],
  });
  console.log(`Enviado para ${user.email}.`);
} else {
  console.error(`Comando desconhecido: ${cmd}`);
  process.exit(1);
}

await prisma.$disconnect();
