import "server-only";
import { prisma } from "./prisma";
import { enviarEmail, htmlNotaFiscal, type Anexo } from "./email";
import { aplicarTemplate } from "./whatsapp";
import { logoBase64, LOGO_CID } from "./logo-email";
import { gerarPdfNotaBase64, type NotaPdf } from "./danfe-pdf-servidor";

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

// Tudo que o e-mail + o PDF de resumo precisam.
const INCLUDE = {
  modelo: true, protocolo: true, emitidaEm: true, ambiente: true,
  cliente: { select: { nome: true, email: true, documento: true } },
  emitente: {
    select: {
      razaoSocial: true, email: true, cnpj: true, ie: true,
      logradouro: true, numero: true, bairro: true, municipio: true, uf: true, cep: true,
    },
  },
  itens: { select: { nome: true, unidade: true, quantidade: true, precoUnitario: true, valorTotal: true } },
} as const;

type NotaEmail = {
  numero: number;
  serie: number;
  modelo: string;
  chaveAcesso: string | null;
  protocolo: string | null;
  valorTotal: unknown;
  xmlAutorizado: string | null;
  emitidaEm: Date;
  ambiente: string;
  cliente: { nome: string; email: string | null; documento: string };
  emitente: {
    razaoSocial: string; email: string | null; cnpj: string; ie: string;
    logradouro: string; numero: string; bairro: string; municipio: string; uf: string; cep: string;
  };
  itens: { nome: string; unidade: string | null; quantidade: unknown; precoUnitario: unknown; valorTotal: unknown }[];
};

function paraNotaPdf(n: NotaEmail): NotaPdf {
  return {
    numero: n.numero, serie: n.serie, modelo: n.modelo,
    chaveAcesso: n.chaveAcesso, protocolo: n.protocolo, valorTotal: n.valorTotal,
    emitidaEm: n.emitidaEm, ambiente: n.ambiente,
    emitente: n.emitente, cliente: { nome: n.cliente.nome, documento: n.cliente.documento },
    itens: n.itens,
  };
}

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

// Envia a nota por e-mail (SEMPRE PDF + XML). `pdfBase64` (opcional) é o DANFE
// oficial gerado no navegador (envio manual); sem ele, gera um PDF de resumo no
// servidor (envio automático). A logo vai como imagem inline (acima do header).
// From = domínio do Easy-NFe (Resend); Reply-To = e-mail da empresa emitente.
export async function enviarNotaEmail(opts: {
  nota: NotaEmail;
  cfg: { assunto: string | null; corpo: string | null; enviarXml: boolean } | null;
  para: string;
  pdfBase64?: string | null;
}): Promise<void> {
  const logo = await logoBase64().catch(() => null);

  // PDF: usa o do navegador quando veio; senão gera o resumo no servidor.
  let pdf = opts.pdfBase64 ?? null;
  if (!pdf && logo) {
    try { pdf = gerarPdfNotaBase64(paraNotaPdf(opts.nota), logo); } catch { pdf = null; }
  }
  const temXml = Boolean((opts.cfg?.enviarXml ?? true) && opts.nota.xmlAutorizado);

  const { assunto, html } = montarEmailNota(opts.nota, opts.cfg, {
    temPdf: Boolean(pdf), temXml, logoCid: logo ? LOGO_CID : undefined,
  });

  const anexos: Anexo[] = [];
  if (logo) anexos.push({ filename: "easy-nfe.png", content: logo, contentId: LOGO_CID });
  if (pdf) anexos.push({ filename: `NF-e-${opts.nota.numero}.pdf`, content: pdf });
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

// Disparo automático após autorização (mirror do WhatsApp). Best-effort: falha
// nunca quebra a emissão. Anexa PDF (resumo do servidor) + XML.
export async function dispararNotaEmail(empresaId: string, notaId: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const cfg = await prisma.configEmailNota.findUnique({ where: { empresaId } });
    if (!cfg?.ativaEmissao) return;

    const nota = await prisma.nota.findUnique({
      where: { id: notaId },
      select: { numero: true, serie: true, chaveAcesso: true, valorTotal: true, xmlAutorizado: true, ...INCLUDE },
    });
    if (!nota) return;
    const para = nota.cliente.email?.trim();
    if (!para) return; // sem e-mail do cliente, não envia

    await enviarNotaEmail({ nota, cfg, para });
  } catch (e) {
    console.error("dispararNotaEmail (ignorado)", e);
  }
}

// Carrega a nota (escopada à empresa) no formato usado pelo envio manual.
export async function carregarNotaParaEmail(empresaId: string, notaId: string) {
  return prisma.nota.findFirst({
    where: { id: notaId, emitenteId: empresaId },
    select: { numero: true, serie: true, chaveAcesso: true, valorTotal: true, xmlAutorizado: true, ...INCLUDE },
  });
}
