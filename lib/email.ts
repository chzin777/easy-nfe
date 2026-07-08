import "server-only";
import { Resend } from "resend";

// Cliente Resend criado sob demanda (evita quebrar o build quando a chave
// ainda não está configurada). Lança se faltar a chave no envio.
let cliente: Resend | null = null;
function resend(): Resend {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("RESEND_API_KEY não configurado.");
  cliente ??= new Resend(chave);
  return cliente;
}

const REMETENTE = process.env.RESEND_FROM || "Easy-NFe <onboarding@resend.dev>";

// content = base64 (sem prefixo data:). contentId => imagem inline (cid:) no HTML.
export type Anexo = { filename: string; content: string; contentId?: string };

export async function enviarEmail(opcoes: {
  para: string;
  assunto: string;
  html: string;
  anexos?: Anexo[];
  responderPara?: string;
  remetente?: string; // sobrescreve o From (ex.: "Empresa <nao-responder@easynfe.digital>")
}): Promise<void> {
  const { error } = await resend().emails.send({
    from: opcoes.remetente || REMETENTE,
    to: opcoes.para,
    subject: opcoes.assunto,
    html: opcoes.html,
    replyTo: opcoes.responderPara,
    attachments: opcoes.anexos?.map((a) => ({ filename: a.filename, content: a.content, contentId: a.contentId })),
  });
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------------------
// Casca visual dos e-mails transacionais — cabeçalho com marca (gradiente roxo
// #5227ff→#7c3aed), corpo em card branco e rodapé. Usa tabelas + estilos inline
// (exigência dos clientes de e-mail). `preheader` é o texto de prévia (oculto).
// ----------------------------------------------------------------------------
export function emailShell(opts: {
  preheader?: string;
  corpo: string; // HTML já pronto do miolo
  rodape?: string; // linha extra no rodapé (ex.: dados da empresa)
  logoCid?: string; // quando presente, mostra a logo ACIMA do card (separada do header)
  tituloHeader?: string; // texto do header roxo (padrão: wordmark Easy-NFe)
}): string {
  const { preheader = "", corpo, rodape, logoCid, tituloHeader } = opts;
  // Logo isolada, sobre o fundo da página, acima do card (separada do header).
  const logo = logoCid
    ? `<tr><td align="center" style="padding:4px 12px 18px"><img src="cid:${logoCid}" alt="Easy-NFe" height="40" style="height:40px;width:auto;display:block"></td></tr>`
    : "";
  const header = tituloHeader
    ? `<span style="font-size:18px;font-weight:700;letter-spacing:-.2px;color:#ffffff">${tituloHeader}</span>`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:-.4px;color:#ffffff">Easy<span style="color:#d6c8ff">-NFe</span></span>`;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f1f0f7;">
  <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
        ${logo}
        <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px -12px rgba(82,39,255,.25)">
        <tr><td style="background:linear-gradient(135deg,#5227ff 0%,#7c3aed 100%);padding:26px 32px">
          ${header}
        </td></tr>
        <tr><td style="padding:32px">${corpo}</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #eceaf6;background:#faf9ff">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#98a2b3">
            ${rodape ? rodape + "<br>" : ""}
            Enviado por <strong style="color:#5227ff">Easy-NFe</strong> · emissão de notas fiscais simplificada.
          </p>
        </td></tr>
      </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const txtParaHtml = (s: string) => escapar(s).replace(/\r?\n/g, "<br>");

// Botão de ação (CTA) roxo reaproveitável.
function botao(url: string, rotulo: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0"><tr><td style="border-radius:10px;background:linear-gradient(135deg,#5227ff,#7c3aed)">
    <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${rotulo}</a>
  </td></tr></table>`;
}

// ----------------------------------------------------------------------------
// E-mail da NF-e ao cliente. `corpoTexto` é o texto editável da empresa (com
// placeholders já substituídos); vira parágrafos. Abaixo, um card com os dados
// da nota. O DANFE (PDF) e o XML vão como anexos.
// ----------------------------------------------------------------------------
export function htmlNotaFiscal(vars: {
  corpoTexto: string;
  empresa: string;
  cliente: string;
  numero: number | string;
  serie: number | string;
  chave: string;
  valor: number;
  temPdf?: boolean;
  temXml?: boolean;
  logoCid?: string;
}): string {
  const anexosTxt =
    vars.temPdf && vars.temXml ? "O <strong>DANFE (PDF)</strong> e o <strong>XML</strong> da nota seguem em anexo neste e-mail."
      : vars.temPdf ? "O <strong>DANFE (PDF)</strong> da nota segue em anexo neste e-mail."
      : vars.temXml ? "O <strong>XML</strong> da nota segue em anexo neste e-mail."
      : "";
  const corpo = `
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#344054">${txtParaHtml(vars.corpoTexto)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceaf6;border-radius:12px;overflow:hidden;margin:4px 0 8px">
      <tr><td style="padding:14px 18px;background:#faf9ff;border-bottom:1px solid #eceaf6">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#98a2b3;font-weight:700">Nota Fiscal Eletrônica</span>
      </td></tr>
      ${linhaInfo("Emitente", escapar(vars.empresa))}
      ${linhaInfo("Número / Série", `${vars.numero} / ${vars.serie}`)}
      ${linhaInfo("Valor total", `<strong style="color:#5227ff;font-size:15px">${fmtBRL(vars.valor)}</strong>`)}
      ${linhaInfo("Chave de acesso", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#475467;word-break:break-all">${escapar(vars.chave)}</span>`, true)}
    </table>
    ${anexosTxt ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#98a2b3">📎 ${anexosTxt}</p>` : ""}`;
  return emailShell({
    preheader: `NF-e nº ${vars.numero} — ${vars.empresa}`,
    corpo,
    rodape: escapar(vars.empresa),
    logoCid: vars.logoCid,
    tituloHeader: "Nota Fiscal Eletrônica",
  });
}

function linhaInfo(rotulo: string, valor: string, ultima = false): string {
  return `<tr><td style="padding:12px 18px${ultima ? "" : ";border-bottom:1px solid #f2f0fa"}">
    <span style="font-size:12px;color:#98a2b3">${rotulo}</span><br>
    <span style="font-size:14px;color:#1d2939">${valor}</span>
  </td></tr>`;
}

// ----------------------------------------------------------------------------
// E-mail de cobrança da mensalidade Easy-NFe (SaaS) ao assinante.
// ----------------------------------------------------------------------------
export function htmlCobranca(vars: {
  nome: string;
  plano: string;
  valor: number;
  vencimento: Date;
  pagarUrl: string;
  atrasada: boolean;
  logoCid?: string;
}): string {
  const venc = vars.vencimento.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const selo = vars.atrasada
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#fdecec;color:#dc2626;font-size:12px;font-weight:700">Pagamento em atraso</span>`
    : `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#efeaff;color:#5227ff;font-size:12px;font-weight:700">Mensalidade a vencer</span>`;
  const corpo = `
    ${selo}
    <h1 style="margin:16px 0 8px;font-size:22px;color:#161b26">Olá, ${escapar(vars.nome.split(" ")[0] || vars.nome)}!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#344054">
      ${vars.atrasada
        ? "Identificamos que a mensalidade do seu plano Easy-NFe está em aberto. Para manter a emissão de notas ativa, regularize o pagamento abaixo."
        : "Sua mensalidade do Easy-NFe está próxima do vencimento. Garanta a continuidade da emissão de notas pagando de forma rápida por Pix ou boleto."}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceaf6;border-radius:12px;overflow:hidden;margin:0 0 20px">
      ${linhaInfo("Plano", escapar(vars.plano))}
      ${linhaInfo("Valor", `<strong style="color:#5227ff;font-size:16px">${fmtBRL(vars.valor)}</strong>`)}
      ${linhaInfo("Vencimento", venc, true)}
    </table>
    ${botao(vars.pagarUrl, "Pagar agora")}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#98a2b3">
      Se você já efetuou o pagamento, desconsidere este e-mail. Dúvidas? É só responder esta mensagem.
    </p>`;
  return emailShell({
    preheader: vars.atrasada ? "Sua mensalidade Easy-NFe está em atraso" : "Sua mensalidade Easy-NFe está a vencer",
    corpo,
    logoCid: vars.logoCid,
  });
}

// ----------------------------------------------------------------------------
// E-mail de confirmação de pagamento — enviado automaticamente ao assinante
// quando o pagamento do plano é confirmado (webhook Asaas). Marca roxa no header,
// selo verde de sucesso. `validadeEm` = nova data de validade da licença (opcional).
// ----------------------------------------------------------------------------
export function htmlPagamentoConfirmado(vars: {
  nome: string;
  plano: string;
  valor: number;
  pagaEm: Date;
  metodo?: string;
  validadeEm?: Date;
  logoCid?: string;
}): string {
  const dataPag = vars.pagaEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const rotuloMetodo: Record<string, string> = { pix: "Pix", boleto: "Boleto", cartao: "Cartão de crédito", asaas: "Asaas" };
  const metodo = vars.metodo ? (rotuloMetodo[vars.metodo] ?? vars.metodo) : null;
  const validade = vars.validadeEm
    ? vars.validadeEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const corpo = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td>
      <span style="display:inline-block;padding:5px 14px;border-radius:999px;background:#e7f8ef;color:#059669;font-size:12px;font-weight:700">✓ Pagamento confirmado</span>
    </td></tr></table>
    <h1 style="margin:4px 0 8px;font-size:22px;color:#161b26">Obrigado, ${escapar(vars.nome.split(" ")[0] || vars.nome)}!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#344054">
      Recebemos o pagamento da sua mensalidade do Easy-NFe. Sua assinatura está
      <strong style="color:#059669">ativa</strong> e a emissão de notas segue liberada.${
        validade ? ` Seu acesso está garantido até <strong>${validade}</strong>.` : ""
      }
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceaf6;border-radius:12px;overflow:hidden;margin:0 0 8px">
      <tr><td style="padding:14px 18px;background:#faf9ff;border-bottom:1px solid #eceaf6">
        <span style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#98a2b3;font-weight:700">Comprovante</span>
      </td></tr>
      ${linhaInfo("Plano", escapar(vars.plano))}
      ${linhaInfo("Valor pago", `<strong style="color:#059669;font-size:16px">${fmtBRL(vars.valor)}</strong>`)}
      ${linhaInfo("Data do pagamento", dataPag)}
      ${metodo ? linhaInfo("Forma de pagamento", escapar(metodo), !validade) : ""}
      ${validade ? linhaInfo("Válido até", validade, true) : ""}
    </table>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#98a2b3">
      Guarde este e-mail como comprovante. Dúvidas? É só responder esta mensagem.
    </p>`;
  return emailShell({
    preheader: "Pagamento confirmado — sua assinatura Easy-NFe está ativa",
    corpo,
    logoCid: vars.logoCid,
  });
}

// Template do e-mail de redefinição de senha. Marca #5227ff (roxo).
export function htmlRedefinicaoSenha(link: string): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">
    <h1 style="font-size:20px;margin:0 0 8px">Redefinição de senha</h1>
    <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 24px">
      Recebemos um pedido para redefinir a senha da sua conta Easy-NFe.
      Clique no botão abaixo para criar uma nova senha. O link expira em 1 hora.
    </p>
    <a href="${link}" style="display:inline-block;background:#5227ff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px">
      Redefinir minha senha
    </a>
    <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:24px 0 0">
      Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.
    </p>
    <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:12px 0 0;word-break:break-all">
      Ou copie e cole este link no navegador:<br>${link}
    </p>
  </div>`;
}
