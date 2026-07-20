// Helpers de dados compartilhados entre a página (Server Component) e os
// blocos de exportação (Client Components).
//
// IMPORTANTE: este arquivo NÃO pode ter "use client". Exports de um módulo
// client viram referências que só existem no navegador — chamar uma função
// dessas durante o render no servidor derruba a página em runtime (e o build
// não acusa, porque /painel é dinâmica).

// Linha genérica de exportação: o cabeçalho sai das chaves do primeiro objeto.
export type LinhaExport = Record<string, string | number>;

// Valor monetário para planilha: número puro, sem "R$" nem separador de
// milhar — em texto o Excel não soma.
export function num(v: number): number {
  return Math.round(v * 100) / 100;
}
