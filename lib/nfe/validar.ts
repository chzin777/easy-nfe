// Pré-validação do XML antes de enviar à SEFAZ.
//
// A rejeição 225 (falha de schema) não diz qual campo reprovou. A causa mais
// comum é campo vazio — o schema 4.00 não aceita tag sem conteúdo. Aqui
// varremos o XML montado e, achando tag vazia, devolvemos o nome do campo e a
// seção (empresa, cliente, item N...) para o usuário corrigir o cadastro.

const GRUPOS: Record<string, string> = {
  ide: "identificação da nota",
  emit: "empresa",
  enderEmit: "endereço da empresa",
  dest: "cliente",
  enderDest: "endereço do cliente",
  entrega: "local de entrega",
  retirada: "local de retirada",
  transp: "transporte",
  transporta: "transportadora",
  vol: "volumes",
  pag: "pagamento",
  infAdic: "informações adicionais",
  NFref: "nota referenciada",
};

const CAMPOS: Record<string, string> = {
  xLgr: "Logradouro",
  nro: "Número",
  xCpl: "Complemento",
  xBairro: "Bairro",
  cMun: "Código do município",
  xMun: "Município",
  UF: "UF",
  CEP: "CEP",
  fone: "Telefone",
  email: "E-mail",
  CNPJ: "CNPJ",
  CPF: "CPF",
  xNome: "Nome / razão social",
  xFant: "Nome fantasia",
  IE: "Inscrição estadual",
  IM: "Inscrição municipal",
  CNAE: "CNAE",
  CRT: "Regime tributário (CRT)",
  cProd: "Código do produto",
  cEAN: "Código de barras",
  cEANTrib: "Código de barras",
  xProd: "Descrição do produto",
  NCM: "NCM",
  CEST: "CEST",
  cBenef: "Código de benefício fiscal",
  CFOP: "CFOP",
  uCom: "Unidade",
  uTrib: "Unidade",
  natOp: "Natureza da operação",
  infCpl: "Informações complementares",
  esp: "Espécie dos volumes",
  marca: "Marca dos volumes",
  nVol: "Numeração dos volumes",
  xEnder: "Endereço da transportadora",
  refNFe: "Chave da nota referenciada",
};

// Lista os campos vazios do XML, já em texto para o usuário.
export function camposVazios(xml: string): string[] {
  const re = /<(\/?)([A-Za-z][\w]*)([^>]*?)(\/?)>/g;
  const pilha: { nome: string; attrs: string; fim: number }[] = [];
  const achados: string[] = [];
  let m: RegExpExecArray | null;

  const secao = (): string => {
    for (let i = pilha.length - 1; i >= 0; i--) {
      const { nome, attrs } = pilha[i];
      if (nome === "det") {
        const n = /nItem="(\d+)"/.exec(attrs)?.[1];
        return n ? `item ${n}` : "itens";
      }
      if (GRUPOS[nome]) return GRUPOS[nome];
    }
    return "nota";
  };
  const registrar = (nome: string) => {
    const desc = `${CAMPOS[nome] ?? nome} (${secao()})`;
    if (!achados.includes(desc)) achados.push(desc);
  };

  while ((m = re.exec(xml))) {
    const [tok, fecha, nome, attrs, auto] = m;
    if (tok.startsWith("<?")) continue;
    if (auto) {
      registrar(nome);
      continue;
    }
    if (!fecha) {
      pilha.push({ nome, attrs, fim: m.index + tok.length });
      continue;
    }
    const topo = pilha.pop();
    if (topo && topo.nome === nome && xml.slice(topo.fim, m.index).trim() === "") {
      registrar(nome);
    }
  }
  return achados;
}

// Lança erro com mensagem amigável se houver campo vazio. A mensagem não pode
// conter "error/null/undefined" (o handler da emissão troca essas por genérica).
export function exigirSemCamposVazios(xml: string): void {
  const vazios = camposVazios(xml);
  if (!vazios.length) return;
  throw new Error(
    `Nota não enviada: ${vazios.length > 1 ? "campos obrigatórios vazios" : "campo obrigatório vazio"} — ` +
      `${vazios.join("; ")}. Preencha no cadastro correspondente e emita de novo.`,
  );
}
