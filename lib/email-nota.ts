import "server-only";
import { prisma } from "./prisma";
import { enviarEmail, htmlNotaFiscal, type Anexo } from "./email";
import { aplicarTemplate } from "./whatsapp";
import { logoBase64, LOGO_CID } from "./logo-email";

// Assunto/corpo padrão quando a empresa não personalizou.
// Placeholders: {cliente} {numero} {serie} {chave} {empresa} {valor}
export const ASSUNTO_EMAIL_PADRAO = "Nota Fiscal nº {numero} — {empresa}";
export const CORPO_EMAIL_PADRAO =
  "Olá {cliente}!\n\n" +
  "Segue a sua Nota Fiscal Eletrônica nº {numero}, emitida por {empresa}, no valor de {valor}.\n\n" +
  "O DANFE (PDF) e o XML da nota estão anexados a este e-mail. Qualquer dúvida, é só responder esta mensagem.\n\n" +
  "Obrigado pela preferência!";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const INCLUDE = {
  cliente: { select: { nome: true, email: true } },
  emitente: { select: { razaoSocial: true, email: true } },
} as const;

type NotaEmail = {
  numero: number;
  serie: number;
  chaveAcesso: string | null;
  valorTotal: unknown;
  xmlAutorizado: string | null;
  cliente: { nome: string; email: string | null };
  emitente: { razaoSocial: string; email: string | null };
};

// Monta o e-mail (assunto + HTML branded) a partir da nota + config da empresa.
export function montarEmailNota(
  nota: NotaEmail,
  cfg: { assunto: string | null; corpo: string | null } | null,
  anexos?: { temPdf?: boolean; temXml?: boolean; logoCid?: string },
): { assunto: string; html: string } {
  const valor = Number(nota.valorTotal);
  const vars = {
    cliente: nota.cliente.nome,
    numero: String(nota.numero),
    serie: String(nota.serie),
    chave: nota.chaveAcesso ?? "",
    empresa: nota.emitente.razaoSocial,
    valor: fmtBRL(valor),
  };
  const assunto = aplicarTemplate(cfg?.assunto || ASSUNTO_EMAIL_PADRAO, vars);
  const corpoTexto = aplicarTemplate(cfg?.corpo || CORPO_EMAIL_PADRAO, vars);
  const html = htmlNotaFiscal({
    corpoTexto,
    empresa: nota.emitente.razaoSocial,
    cliente: nota.cliente.nome,
    numero: nota.numero,
    serie: nota.serie,
    chave: nota.chaveAcesso ?? "",
    valor,
    temPdf: anexos?.temPdf ?? false,
    temXml: anexos?.temXml ?? false,
    logoCid: anexos?.logoCid,
  });
  return { assunto, html };
}

// Envia a nota por e-mail. O DANFE em PDF (`pdfBase64`) é SEMPRE o gerado no
// navegador — o mesmo do site — e chega aqui já pronto. O XML autorizado é
// anexado do banco. A logo vai como imagem inline (acima do header).
// From = domínio do Easy-NFe (Resend); Reply-To = e-mail da empresa emitente.
export async function enviarNotaEmail(opts: {
  nota: NotaEmail;
  cfg: { assunto: string | null; corpo: string | null; enviarXml: boolean } | null;
  para: string;
  pdfBase64?: string | null;
}): Promise<void> {
  const logo = await logoBase64().catch(() => null);
  const pdf = opts.pdfBase64 ?? null;
  const temXml = Boolean((opts.cfg?.enviarXml ?? true) && opts.nota.xmlAutorizado);

  const { assunto, html } = montarEmailNota(opts.nota, opts.cfg, {
    temPdf: Boolean(pdf), temXml, logoCid: logo ? LOGO_CID : undefined,
  });

  const anexos: Anexo[] = [];
  if (logo) anexos.push({ filename: "easy-nfe.png", content: logo, contentId: LOGO_CID });
  if (pdf) anexos.push({ filename: `DANFE-${opts.nota.numero}.pdf`, content: pdf });
  if (temXml && opts.nota.xmlAutorizado) {
    const nome = `${opts.nota.chaveAcesso || opts.nota.numero}.xml`;
    anexos.push({ filename: nome, content: Buffer.from(opts.nota.xmlAutorizado, "utf8").toString("base64") });
  }

  await enviarEmail({
    para: opts.para,
    assunto,
    html,
    anexos: anexos.length ? anexos : undefined,
    responderPara: opts.nota.emitente.email || undefined,
  });
}

// Preferência de envio automático por e-mail + destinatário (e-mail do cliente).
// Usada pelo cliente logo após emitir p/ decidir se dispara o envio (com o PDF
// real do DANFE gerado no navegador).
export async function preferenciaAutoEmailNota(
  empresaId: string,
  notaId: string,
): Promise<{ ativo: boolean; para: string | null }> {
  if (!process.env.RESEND_API_KEY) return { ativo: false, para: null };
  const cfg = await prisma.configEmailNota.findUnique({ where: { empresaId } });
  if (!cfg?.ativaEmissao) return { ativo: false, para: null };
  const nota = await prisma.nota.findFirst({
    where: { id: notaId, emitenteId: empresaId },
    select: { cliente: { select: { email: true } } },
  });
  const para = nota?.cliente.email?.trim() || null;
  return { ativo: Boolean(para), para };
}

// Carrega a nota (escopada à empresa) no formato usado pelo envio por e-mail.
export async function carregarNotaParaEmail(empresaId: string, notaId: string) {
  return prisma.nota.findFirst({
    where: { id: notaId, emitenteId: empresaId },
    select: { numero: true, serie: true, chaveAcesso: true, valorTotal: true, xmlAutorizado: true, ...INCLUDE },
  });
}
