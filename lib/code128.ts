// CODE-128 subconjunto C — o código de barras exigido no DANFE para a chave de
// acesso (44 dígitos). Puro, sem dependência: devolve as larguras dos módulos
// alternando barra/espaço, começando por barra.

// Larguras (3 barras + 3 espaços = 11 módulos) de cada valor 0-106.
// 103/104/105 = Start A/B/C · 106 = Stop (13 módulos).
const PADROES = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

const START_C = 105;
const STOP = 106;

// Larguras dos módulos (barra, espaço, barra, ...) para uma sequência de dígitos.
// Dígito ímpar não existe em chave de NF-e (44), mas completa com zero à esquerda
// para nunca gerar código inválido.
export function code128c(digitos: string): number[] {
  const d = digitos.replace(/\D/g, "");
  const par = d.length % 2 === 0 ? d : "0" + d;

  const valores: number[] = [START_C];
  for (let i = 0; i < par.length; i += 2) valores.push(Number(par.slice(i, i + 2)));

  // Dígito verificador: (start + Σ posição × valor) mod 103.
  let soma = START_C;
  for (let i = 1; i < valores.length; i++) soma += i * valores[i];
  valores.push(soma % 103, STOP);

  return valores.flatMap((v) => PADROES[v].split("").map(Number));
}
