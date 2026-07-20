export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Máscaras de exibição. Todas toleram valor já formatado, incompleto ou vazio:
// se não bate com o tamanho esperado, devolvem o que veio, sem inventar dígito.
const so = (v: string) => (v ?? "").replace(/\D/g, "");

// 00.000.000/0000-00 (CNPJ) ou 000.000.000-00 (CPF), conforme o tamanho.
export function formatCpfCnpj(valor: string): string {
  const d = so(valor);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return valor ?? "";
}

// (00) 00000-0000 (celular) ou (00) 0000-0000 (fixo).
export function formatTelefone(valor: string): string {
  const d = so(valor);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return valor ?? "";
}

// 00000-000
export function formatCep(valor: string): string {
  const d = so(valor);
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, "$1-$2");
  return valor ?? "";
}

export function formatData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
