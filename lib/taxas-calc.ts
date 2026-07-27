// Matemática das taxas do gateway. Sem "server-only" de propósito: o simulador
// do painel administrativo roda no cliente com a mesma conta do servidor.
//
// A fonte da verdade de uma fatura JÁ PAGA é sempre o `netValue` do Asaas
// (Fatura.taxa com taxaOrigem = "asaas"). Esta tabela é estimativa: as taxas
// variam por negociação e o Asaas ainda cobra extras por cobrança (pacote de
// notificações por e-mail/SMS, WhatsApp, nota fiscal avulsa) — é o que faz a
// taxa real de um Pix passar dos R$ 1,99 de tabela.
//
// Padrões = tabela pública do Asaas (asaas.com/precos-e-taxas).

export type TabelaTaxas = {
  pixFixo: number; // R$ por cobrança Pix recebida
  pixPercent: number;
  boletoFixo: number; // R$ por boleto pago
  boletoPercent: number;
  cartaoFixo: number; // R$ por transação no crédito
  cartaoPercent: number; // à vista
  cartaoPercent2a6: number;
  cartaoPercent7a12: number;
  cartaoPercent13a21: number;
  debitoFixo: number;
  debitoPercent: number;
  // Extras cobrados por cobrança, somados a qualquer método (notificações etc.).
  extraPorCobranca: number;
  // Informativo — não entra no custo da fatura, aparece como custo fixo.
  transferenciaFixo: number; // TED
};

export const TAXAS_PADRAO: TabelaTaxas = {
  pixFixo: 1.99,
  pixPercent: 0,
  boletoFixo: 1.99,
  boletoPercent: 0,
  cartaoFixo: 0.49,
  cartaoPercent: 2.99,
  cartaoPercent2a6: 3.49,
  cartaoPercent7a12: 3.99,
  cartaoPercent13a21: 4.29,
  debitoFixo: 0.35,
  debitoPercent: 1.89,
  extraPorCobranca: 0,
  transferenciaFixo: 5.0,
};

export const arred = (n: number) => Math.round(n * 100) / 100;

// Percentual do crédito conforme o nº de parcelas.
export function percentCartao(t: TabelaTaxas, parcelas: number): number {
  if (parcelas <= 1) return t.cartaoPercent;
  if (parcelas <= 6) return t.cartaoPercent2a6;
  if (parcelas <= 12) return t.cartaoPercent7a12;
  return t.cartaoPercent13a21;
}

export type MetodoTaxa = "pix" | "boleto" | "cartao" | "debito";

export const ROTULO_METODO: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão de crédito",
  debito: "Cartão de débito",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  asaas: "Checkout Asaas",
  _sem: "Sem método",
};

// Estima o que o gateway retém numa cobrança de `valor` pelo método informado.
// Nunca passa do próprio valor — cobrança de R$ 1,00 no Pix não gera líquido
// negativo.
export function estimarTaxa(
  metodo: MetodoTaxa,
  valor: number,
  t: TabelaTaxas,
  parcelas = 1,
): number {
  let fixo = 0;
  let percent = 0;
  if (metodo === "pix") { fixo = t.pixFixo; percent = t.pixPercent; }
  else if (metodo === "boleto") { fixo = t.boletoFixo; percent = t.boletoPercent; }
  else if (metodo === "debito") { fixo = t.debitoFixo; percent = t.debitoPercent; }
  else { fixo = t.cartaoFixo; percent = percentCartao(t, parcelas); }

  const bruto = fixo + t.extraPorCobranca + (valor * percent) / 100;
  return arred(Math.min(Math.max(bruto, 0), Math.max(valor, 0)));
}

// Normaliza o `metodo` gravado na fatura para um método tarifado. Retorna null
// quando o recebimento não passou pelo gateway (dinheiro, transferência
// direta) — nesses casos não há taxa a atribuir.
export function metodoTarifado(metodo?: string | null): MetodoTaxa | null {
  const v = (metodo ?? "").toLowerCase();
  if (v === "pix") return "pix";
  if (v === "boleto") return "boleto";
  if (v === "cartao" || v === "cartão" || v === "credito") return "cartao";
  if (v === "debito" || v === "débito") return "debito";
  // "asaas" = pago pelo checkout sem método discriminado; tarifa como Pix, o
  // caminho mais comum do link de pagamento.
  if (v === "asaas") return "pix";
  return null;
}

// Custo efetivo em % sobre o bruto — o número que importa quando o ticket é
// baixo (R$ 1,99 numa cobrança de R$ 5,00 é 39,8%).
export function percentEfetivo(bruto: number, taxa: number): number {
  if (bruto <= 0) return 0;
  return arred((taxa / bruto) * 100);
}

// Valor mínimo em que a taxa cai abaixo de `alvo`% do bruto. Responde direto a
// "a partir de quanto vale a pena cobrar nesse método".
export function valorParaTaxaAbaixoDe(
  metodo: MetodoTaxa,
  alvoPercent: number,
  t: TabelaTaxas,
  parcelas = 1,
): number | null {
  const fixo =
    (metodo === "pix" ? t.pixFixo : metodo === "boleto" ? t.boletoFixo : metodo === "debito" ? t.debitoFixo : t.cartaoFixo) +
    t.extraPorCobranca;
  const percent =
    metodo === "pix" ? t.pixPercent : metodo === "boleto" ? t.boletoPercent : metodo === "debito" ? t.debitoPercent : percentCartao(t, parcelas);
  // fixo + v*p/100 <= v*alvo/100  →  v >= fixo / ((alvo - p)/100)
  const folga = (alvoPercent - percent) / 100;
  if (folga <= 0) return null; // o percentual sozinho já estoura o alvo
  return arred(fixo / folga);
}
