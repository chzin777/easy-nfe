// Chave de acesso (44 dígitos) e dígito verificador mod 11.

export function dvMod11(chave43: string): string {
  let peso = 2;
  let soma = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return String(resto === 0 || resto === 1 ? 0 : 11 - resto);
}

export function montarChave(p: {
  cUF: string;
  aamm: string;
  cnpj: string;
  mod: string;
  serie: string;
  nNF: string;
  tpEmis: string;
  cNF: string;
}): string {
  const base =
    p.cUF +
    p.aamm +
    p.cnpj +
    p.mod +
    p.serie.padStart(3, "0") +
    p.nNF.padStart(9, "0") +
    p.tpEmis +
    p.cNF.padStart(8, "0");
  return base + dvMod11(base);
}

// dhEmi no formato YYYY-MM-DDThh:mm:ss-03:00 (horário de Brasília, sem libs de TZ).
export function dataHoraBrasilia(): string {
  const agora = new Date(Date.now() - 3 * 3600_000); // desloca p/ UTC-3
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${agora.getUTCFullYear()}-${p(agora.getUTCMonth() + 1)}-${p(agora.getUTCDate())}` +
    `T${p(agora.getUTCHours())}:${p(agora.getUTCMinutes())}:${p(agora.getUTCSeconds())}-03:00`
  );
}
