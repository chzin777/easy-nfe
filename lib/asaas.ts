import "server-only";
import { configAsaasEfetiva } from "./asaas-config";

// Cliente da API Asaas (cobrança da assinatura SaaS). Conta única do easy-nfe.
// Config vem do painel admin (criptografada no banco) com fallback p/ env
// (ASAAS_API_KEY / ASAAS_AMBIENTE).

async function asaas<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const cfg = await configAsaasEfetiva();
  if (!cfg) throw new Error("Asaas não configurado. Configure a chave de API no painel administrativo.");
  const base =
    cfg.ambiente === "producao" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

  const res = await fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      access_token: cfg.apiKey,
      "User-Agent": "easy-nfe",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const texto = await res.text();
  const dados = texto ? JSON.parse(texto) : {};
  if (!res.ok) {
    const msg = dados?.errors?.[0]?.description || `Asaas HTTP ${res.status}`;
    throw new Error(msg);
  }
  return dados as T;
}

export type AsaasCliente = { id: string };
export type AsaasCobranca = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
};

// Cria (ou atualiza) o cliente Asaas. Reaproveita pelo id quando já existe.
export async function criarOuAtualizarCliente(p: {
  id?: string | null;
  nome: string;
  cpfCnpj: string;
  email?: string | null;
  telefone?: string | null;
  externalReference?: string;
}): Promise<AsaasCliente> {
  const body = {
    name: p.nome,
    cpfCnpj: p.cpfCnpj.replace(/\D/g, ""),
    email: p.email || undefined,
    mobilePhone: p.telefone ? p.telefone.replace(/\D/g, "") : undefined,
    externalReference: p.externalReference,
  };
  if (p.id) return asaas<AsaasCliente>(`/customers/${p.id}`, { method: "POST", body });
  return asaas<AsaasCliente>(`/customers`, { method: "POST", body });
}

// Cria uma cobrança via boleto. dueDate no formato YYYY-MM-DD.
export async function criarCobrancaBoleto(p: {
  customer: string;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}): Promise<AsaasCobranca> {
  return asaas<AsaasCobranca>(`/payments`, {
    method: "POST",
    body: {
      customer: p.customer,
      billingType: "BOLETO",
      value: p.value,
      dueDate: p.dueDate,
      description: p.description,
      externalReference: p.externalReference,
    },
  });
}

// Cria cobrança como LINK de pagamento (cliente escolhe Pix, boleto ou cartão).
// billingType UNDEFINED → Asaas devolve invoiceUrl (checkout) com todas as opções.
export async function criarCobrancaLink(p: {
  customer: string;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}): Promise<AsaasCobranca> {
  return asaas<AsaasCobranca>(`/payments`, {
    method: "POST",
    body: {
      customer: p.customer,
      billingType: "UNDEFINED",
      value: p.value,
      dueDate: p.dueDate,
      description: p.description,
      externalReference: p.externalReference,
    },
  });
}

// Linha digitável + código de barras do boleto.
export async function obterLinhaDigitavel(paymentId: string): Promise<{ identificationField: string | null; barCode: string | null; nossoNumero: string | null }> {
  return asaas(`/payments/${paymentId}/identificationField`);
}

// Consulta uma cobrança (status atual).
export async function consultarCobranca(paymentId: string): Promise<AsaasCobranca & { customer: string }> {
  return asaas(`/payments/${paymentId}`);
}

// Valida a chave/ambiente fazendo uma chamada leve. Lança em caso de erro.
export async function verificarConexao(): Promise<{ ok: true }> {
  await asaas(`/customers?limit=1`);
  return { ok: true };
}
