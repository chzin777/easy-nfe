// Acesso à configuração fiscal salva no navegador (protótipo, pré-Supabase).
//
// - Config não-secreta (emitente, ambiente, numeração, metadados do cert)
//   fica em localStorage e persiste entre sessões.
// - O certificado (.pfx + senha) é SEGREDO: fica só em sessionStorage, some ao
//   fechar a aba e nunca toca o disco. Em produção isso migra p/ Supabase + KMS.

export type EmitenteConfig = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  crt: string;
  telefone: string;
  email: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
  };
};

export type AmbienteConfig = {
  ambiente: "homologacao" | "producao";
  serie: string;
  proxNFe: string;
  proxNFCe: string;
  csc: string;
  idCsc: string;
};

export type CertGuardado = { pfxBase64: string; senha: string };

const CONFIG_KEY = "easy-nfe-config";
const CERT_KEY = "easy-nfe-cert";

export function lerConfig(): {
  emit?: EmitenteConfig;
  amb?: AmbienteConfig;
  certMeta?: unknown;
} {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function salvarCert(cert: CertGuardado): void {
  sessionStorage.setItem(CERT_KEY, JSON.stringify(cert));
}

export function lerCert(): CertGuardado | null {
  try {
    const raw = sessionStorage.getItem(CERT_KEY);
    return raw ? (JSON.parse(raw) as CertGuardado) : null;
  } catch {
    return null;
  }
}

export function temCert(): boolean {
  return lerCert() !== null;
}

export function limparCert(): void {
  sessionStorage.removeItem(CERT_KEY);
}
