// Avisa os assinantes sobre as novidades da versão. A lista de novidades vem de
// lib/novidades.ts — a mesma que o painel e a landing usam.
//
// Uso:
//   npx tsx --conditions react-server scripts/email-novidades.mjs lista
//   npx tsx --conditions react-server scripts/email-novidades.mjs preview [arquivo.html]
//   npx tsx --conditions react-server scripts/email-novidades.mjs enviar [--um <email>]
//
// `lista` e `preview` NÃO enviam nada. `enviar` dispara de verdade, um a um,
// com pausa entre os envios para não estourar o limite do Resend.
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { prisma } from "../lib/prisma.ts";
import { enviarEmail, htmlNovidades } from "../lib/email.ts";
import { logoBase64, LOGO_CID } from "../lib/logo-email.ts";
import { NOVIDADES } from "../lib/novidades.ts";

const [, , cmd, ...resto] = process.argv;
const ENTRAR = "https://www.easynfe.digital/login";

if (!["lista", "preview", "enviar"].includes(cmd ?? "")) {
  console.error("uso: npx tsx scripts/email-novidades.mjs <lista|preview|enviar> [arquivo.html] [--um <email>]");
  process.exit(1);
}

const umIdx = resto.indexOf("--um");
const somenteEste = umIdx >= 0 ? resto[umIdx + 1]?.toLowerCase() : null;

// Assinantes = quem tem licença ativa ou em teste. Sem licença e conta de
// administração ficam de fora: não são clientes.
const users = await prisma.user.findMany({
  where: {
    role: "USER",
    licenca: { status: { in: ["ATIVA", "TRIAL"] } },
    ...(somenteEste ? { email: somenteEste } : {}),
  },
  include: { licenca: { include: { plano: true } } },
  orderBy: { email: "asc" },
});

const assuntoDe = (nome) =>
  `${(nome ?? "").split(" ")[0] || "Novidade"}, agora o Easy-NFe emite nota de serviço`;

const htmlDe = (u, comLogo) =>
  htmlNovidades({
    nome: u.nome ?? u.email,
    entrarUrl: ENTRAR,
    novidades: NOVIDADES.map((n) => ({ titulo: n.titulo, desc: n.desc, tag: n.tag })),
    // No preview não há anexo, então a logo por cid não resolveria.
    logoCid: comLogo ? LOGO_CID : undefined,
  });

if (cmd === "lista") {
  console.log(`${users.length} destinatário(s):`);
  for (const u of users) {
    console.log(` · ${u.email} — ${u.nome ?? "(sem nome)"} — ${u.licenca.status} ${u.licenca.plano?.nome ?? ""}`);
  }
  console.log("\nNADA foi enviado.");
} else if (cmd === "preview") {
  const u = users[0];
  if (!u) { console.error("Nenhum destinatário."); process.exit(1); }
  const destino = resto.find((a) => a.endsWith(".html")) ?? "preview-novidades.html";
  await writeFile(destino, htmlDe(u, false), "utf8");
  console.log(`Preview gravado em ${destino} (montado com os dados de ${u.email})`);
  console.log(`Assunto: ${assuntoDe(u.nome)}`);
  console.log(`Novidades no corpo: ${NOVIDADES.length}`);
  console.log("\nNADA foi enviado.");
} else {
  const logo = await logoBase64();
  let ok = 0;
  for (const u of users) {
    try {
      await enviarEmail({
        para: u.email,
        assunto: assuntoDe(u.nome),
        html: htmlDe(u, true),
        anexos: [{ filename: "logo.png", content: logo, contentId: LOGO_CID }],
      });
      ok++;
      console.log(`enviado: ${u.email}`);
    } catch (e) {
      console.error(`FALHOU: ${u.email} — ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  console.log(`\n${ok}/${users.length} enviado(s).`);
}

await prisma.$disconnect();
