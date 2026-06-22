import "server-only";
import { prisma } from "./prisma";
import { encriptar, decriptar } from "./crypto";

// Configuração da integração Asaas, persistida criptografada no banco
// (ConfigSistema, chave "asaas"). Fallback para variáveis de ambiente quando
// não houver config salva (compatibilidade).

export type AsaasAmbiente = "sandbox" | "producao";

export type AsaasConfig = {
  apiKey: string;
  ambiente: AsaasAmbiente;
  webhookToken: string;
};

const CHAVE = "asaas";

// Lê a config salva (descriptografada). Retorna null se não houver no banco.
export async function lerConfigAsaasSalva(): Promise<AsaasConfig | null> {
  const row = await prisma.configSistema.findUnique({ where: { chave: CHAVE } });
  if (!row) return null;
  try {
    const dados = JSON.parse(decriptar(row.valor)) as Partial<AsaasConfig>;
    return {
      apiKey: dados.apiKey ?? "",
      ambiente: dados.ambiente === "producao" ? "producao" : "sandbox",
      webhookToken: dados.webhookToken ?? "",
    };
  } catch {
    return null;
  }
}

// Config efetiva (banco com fallback p/ env). Usada pelo cliente Asaas.
export async function configAsaasEfetiva(): Promise<AsaasConfig | null> {
  const salva = await lerConfigAsaasSalva();
  const apiKey = salva?.apiKey || process.env.ASAAS_API_KEY || "";
  if (!apiKey) return null;
  const ambEnv = (process.env.ASAAS_AMBIENTE || "").toLowerCase();
  const ambiente: AsaasAmbiente =
    salva?.ambiente ?? (ambEnv === "producao" || ambEnv === "production" ? "producao" : "sandbox");
  const webhookToken = salva?.webhookToken || process.env.ASAAS_WEBHOOK_TOKEN || "";
  return { apiKey, ambiente, webhookToken };
}

// Salva (criptografado) a config. Campos vazios mantêm o valor anterior quando
// indicado (ex.: não reescreve a API key se o admin deixou o campo em branco).
export async function salvarConfigAsaas(input: {
  apiKey?: string;
  ambiente: AsaasAmbiente;
  webhookToken?: string;
}): Promise<void> {
  const atual = await lerConfigAsaasSalva();
  const cfg: AsaasConfig = {
    apiKey: input.apiKey?.trim() ? input.apiKey.trim() : atual?.apiKey ?? "",
    ambiente: input.ambiente,
    webhookToken: input.webhookToken?.trim() ? input.webhookToken.trim() : atual?.webhookToken ?? "",
  };
  const valor = encriptar(JSON.stringify(cfg));
  await prisma.configSistema.upsert({
    where: { chave: CHAVE },
    update: { valor },
    create: { chave: CHAVE, valor },
  });
}

// Status p/ a UI (sem expor a chave inteira).
export type AsaasConfigStatus = {
  configurado: boolean;
  ambiente: AsaasAmbiente;
  apiKeyMascarada: string; // ex.: "••••••••abcd"
  temWebhookToken: boolean;
  origem: "banco" | "env" | "nenhuma";
};

export async function statusConfigAsaas(): Promise<AsaasConfigStatus> {
  const salva = await lerConfigAsaasSalva();
  const efetiva = await configAsaasEfetiva();
  const apiKey = efetiva?.apiKey ?? "";
  const mascarar = (k: string) => (k.length <= 4 ? "••••" : "••••••••" + k.slice(-4));
  return {
    configurado: !!apiKey,
    ambiente: efetiva?.ambiente ?? "sandbox",
    apiKeyMascarada: apiKey ? mascarar(apiKey) : "",
    temWebhookToken: !!efetiva?.webhookToken,
    origem: salva?.apiKey ? "banco" : process.env.ASAAS_API_KEY ? "env" : "nenhuma",
  };
}
