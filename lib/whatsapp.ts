import "server-only";
import { prisma } from "./prisma";
import { temFeature } from "./permissoes";

// ----------------------------------------------------------------------------
// Cliente do worker de WhatsApp.
//
// O envio de NF-e por WhatsApp usa o WhatsApp PRÓPRIO do usuário, pareado via
// QR Code. Isso exige a lib Baileys (WhatsApp Web não-oficial) rodando num
// processo SEMPRE-LIGADO com socket persistente — algo que NÃO roda em
// serverless (a função morre entre requests e derruba a sessão). Por isso a
// sessão fica num worker externo (VPS / Fly.io / Oracle Cloud always-free) e o
// app Next fala com ele por HTTP.
//
// Contrato do worker (todos sob Authorization: Bearer <WHATSAPP_WORKER_TOKEN>):
//   GET  /sessao/:empresaId/status     -> { conectado, telefone?, qr? }
//   POST /sessao/:empresaId/conectar   -> { conectado, telefone?, qr? }  (inicia/retoma)
//   POST /sessao/:empresaId/desconectar-> { ok: true }
//   POST /enviar                       -> { ok: true }   body: PayloadEnvio
//
// `qr` é a STRING crua do QR do Baileys — o front renderiza com qrcode.react.
// Em /enviar o worker recebe o XML autorizado e MONTA o DANFE em PDF do lado
// dele (gerar PDF no servidor do app exigiria browser headless).
// ----------------------------------------------------------------------------

const WORKER_URL = process.env.WHATSAPP_WORKER_URL?.replace(/\/$/, "");
const WORKER_TOKEN = process.env.WHATSAPP_WORKER_TOKEN;

// Mensagem padrão quando a empresa não personalizou o template.
// Placeholders: {cliente} {numero} {chave} {empresa} {valor}
export const TEMPLATE_PADRAO =
  "Olá {cliente}! 👋\n\n" +
  "Sua nota fiscal nº {numero} foi emitida por {empresa}.\n" +
  "Valor: {valor}\n" +
  "Chave de acesso: {chave}\n\n" +
  "O DANFE em PDF segue em anexo. Obrigado pela preferência!";

export function workerConfigurado(): boolean {
  return Boolean(WORKER_URL && WORKER_TOKEN);
}

export type WhatsAppStatus = {
  conectado: boolean;
  telefone?: string | null;
  qr?: string | null; // string crua do QR (renderizar no front), null quando conectado
};

async function worker<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  if (!workerConfigurado()) {
    throw new Error("Serviço de WhatsApp não configurado no servidor (WHATSAPP_WORKER_URL/TOKEN).");
  }
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_TOKEN}`,
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Não foi possível falar com o serviço de WhatsApp. Tente novamente em instantes.");
  }
  const dados = (await res.json().catch(() => null)) as
    | (T & { erro?: string })
    | null;
  if (!res.ok) {
    throw new Error(dados?.erro || `Serviço de WhatsApp respondeu ${res.status}.`);
  }
  return dados as T;
}

export function statusSessao(empresaId: string): Promise<WhatsAppStatus> {
  return worker<WhatsAppStatus>(`/sessao/${empresaId}/status`);
}

export function conectarSessao(empresaId: string): Promise<WhatsAppStatus> {
  return worker<WhatsAppStatus>(`/sessao/${empresaId}/conectar`, { method: "POST" });
}

export function desconectarSessao(empresaId: string): Promise<{ ok: true }> {
  return worker<{ ok: true }>(`/sessao/${empresaId}/desconectar`, { method: "POST" });
}

export type PayloadEnvio = {
  empresaId: string;
  telefone: string;
  mensagem: string;
  chave: string;
  xml: string; // XML autorizado — worker gera o DANFE a partir dele
  enviarDanfe: boolean;
};

export function enviarMensagemNota(payload: PayloadEnvio): Promise<{ ok: true }> {
  return worker<{ ok: true }>(`/enviar`, { method: "POST", body: payload });
}

// Substitui {placeholders} no template pela tabela de variáveis.
export function aplicarTemplate(
  tpl: string,
  vars: Record<string, string>,
): string {
  return tpl.replace(/\{(\w+)\}/g, (m, chave: string) =>
    chave in vars ? vars[chave] : m,
  );
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Disparo automático após a nota ser autorizada. Best-effort: qualquer falha é
// engolida (não pode quebrar a emissão). Chamado via `after()` na server action
// de emissão para não atrasar a resposta ao usuário.
export async function dispararNotaWhatsApp(
  empresaId: string,
  notaId: string,
): Promise<void> {
  try {
    if (!workerConfigurado()) return;

    const cfg = await prisma.configWhatsApp.findUnique({ where: { empresaId } });
    if (!cfg?.ativaEmissao) return;
    if (!(await temFeature("integracao_whatsapp"))) return;

    const nota = await prisma.nota.findUnique({
      where: { id: notaId },
      include: {
        cliente: { select: { nome: true, telefone: true } },
        emitente: { select: { razaoSocial: true } },
      },
    });
    if (!nota?.xmlAutorizado) return;
    const telefone = nota.cliente.telefone?.trim();
    if (!telefone) return;

    const mensagem = aplicarTemplate(cfg.template || TEMPLATE_PADRAO, {
      cliente: nota.cliente.nome,
      numero: String(nota.numero),
      chave: nota.chaveAcesso ?? "",
      empresa: nota.emitente.razaoSocial,
      valor: fmtBRL(Number(nota.valorTotal)),
    });

    await enviarMensagemNota({
      empresaId,
      telefone,
      mensagem,
      chave: nota.chaveAcesso ?? "",
      xml: nota.xmlAutorizado,
      enviarDanfe: cfg.enviarDanfe,
    });
  } catch {
    // silencioso de propósito — envio é acessório à emissão
  }
}
