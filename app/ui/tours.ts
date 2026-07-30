import type { SlideTour } from "./Tour";
import {
  IconArquivo, IconCaixa, IconCarrinho, IconDinheiro, IconEntrada, IconFerramenta,
  IconGrafico, IconLista, IconPessoa, IconCaminhao, IconEngrenagem, IconAlerta,
} from "./tourIcones";

// Conteúdo dos tutoriais, um por tela. A chave é o que fica gravado como "já
// vi" — mudou o texto de forma relevante, sobe a versão para reabrir.
export type Tour = { chave: string; titulo: string; slides: SlideTour[] };

const AZUL = "from-blue-500 to-indigo-600";
const ROXO = "from-violet-500 to-purple-600";
const VERDE = "from-emerald-500 to-teal-600";
const AMBAR = "from-amber-500 to-orange-600";

// A rota mais específica ganha: /notas/nova é procurada antes de /notas.
export const TOURS: Record<string, Tour> = {
  "/painel": {
    chave: "tour-painel-v1",
    titulo: "O painel",
    slides: [
      {
        titulo: "Os três números do topo",
        texto: "Faturamento é o que você emitiu em notas autorizadas. Lucro bruto é o que sobra depois do custo dos produtos. Ticket médio é quanto vale a nota típica.",
        dica: "Lucro só aparece nos produtos que têm custo cadastrado.",
        cor: ROXO, icone: IconGrafico,
      },
      {
        titulo: "Comparação com o período anterior",
        texto: "A setinha embaixo de cada número compara com o mesmo intervalo imediatamente anterior. Verde subiu, vermelho caiu.",
        cor: AZUL, icone: IconGrafico,
      },
      {
        titulo: "Filtro de período",
        texto: "Muda tudo na tela de uma vez — números, gráficos e listas. Cada bloco exporta os próprios dados em PDF ou planilha.",
        cor: VERDE, icone: IconArquivo,
      },
    ],
  },

  "/notas/nova": {
    // Chave antiga preservada: quem já viu o tutorial não vê de novo.
    chave: "nova-nota-v1",
    titulo: "Como emitir uma nota",
    slides: [
      {
        titulo: "Tipo e destinatário",
        texto: "Escolha o tipo da nota e o cliente que vai receber. Não tem o cliente? Dá para cadastrar na hora pelo próprio seletor. Escolhendo NFS-e, o formulário todo muda — serviço não tem produtos nem transporte.",
        dica: "Confira o endereço do cliente: ele vai no XML.",
        cor: AZUL, icone: IconPessoa,
      },
      {
        titulo: "Produtos",
        texto: "Busque o produto, informe a quantidade e clique em Adicionar. Repita para cada item. Dá para ajustar com os botões + / − e remover.",
        dica: "O total é calculado sozinho conforme você adiciona.",
        cor: ROXO, icone: IconCaixa,
      },
      {
        titulo: "Transporte",
        texto: "Selecione a modalidade do frete. Para CIF, FOB ou sem ocorrência a transportadora é opcional; para transporte de terceiros ela é obrigatória.",
        cor: VERDE, icone: IconCaminhao,
      },
      {
        titulo: "Conferência e emissão",
        texto: "Revise destinatário, produtos, valores e transporte. Clique em Emitir para transmitir à SEFAZ.",
        dica: "Depois de emitir você vê o status e a chave de acesso.",
        cor: AMBAR, icone: IconArquivo,
      },
    ],
  },

  "/notas": {
    chave: "tour-notas-v2",
    titulo: "Notas emitidas",
    slides: [
      {
        titulo: "Tudo que já saiu",
        texto: "Lista das notas transmitidas, com status. Autorizada é a que valeu; rejeitada foi recusada pela SEFAZ e o motivo aparece no detalhe.",
        cor: AZUL, icone: IconLista,
      },
      {
        titulo: "Venda e serviço juntos",
        texto: "Os botões no alto da lista separam as notas de venda (mercadoria) das de serviço (mão de obra). Nota de serviço é imposto de prefeitura; nota de venda é de estado.",
        dica: "Peça é nota de venda; mão de obra é nota de serviço. Muita empresa emite as duas.",
        cor: ROXO, icone: IconFerramenta,
      },
      {
        titulo: "Antes da primeira de serviço",
        texto: "A empresa precisa da inscrição municipal preenchida em Configurações e do CNPJ credenciado no portal nacional. Sem a inscrição, a nota não sai.",
        cor: AMBAR, icone: IconEngrenagem,
      },
      {
        titulo: "O que dá para fazer",
        texto: "Clicando na nota você vê o DANFE, baixa o PDF e o XML, manda por e-mail e cancela quando ainda estiver no prazo.",
        dica: "Cancelamento tem prazo legal contado da autorização.",
        cor: VERDE, icone: IconArquivo,
      },
    ],
  },

  "/orcamentos": {
    chave: "tour-orcamentos-v1",
    titulo: "Orçamentos",
    slides: [
      {
        titulo: "Antes da nota",
        texto: "Orçamento é a proposta: mesmos produtos e valores, sem valor fiscal. Serve para o cliente aprovar antes de você emitir.",
        cor: AZUL, icone: IconArquivo,
      },
      {
        titulo: "O funil",
        texto: "Cada orçamento anda por etapas — rascunho, enviado, em negociação, aprovado. Arraste o cartão para mudar de etapa.",
        cor: ROXO, icone: IconGrafico,
      },
      {
        titulo: "Fechar a venda",
        texto: "Aprovado, o botão Fechar venda transforma o orçamento em NF-e de verdade, sem redigitar nada. Também dá para salvar o PDF e mandar para o cliente.",
        cor: VERDE, icone: IconDinheiro,
      },
    ],
  },

  "/vendas": {
    chave: "tour-vendas-v1",
    titulo: "Vendas sem nota",
    slides: [
      {
        titulo: "Para o que serve",
        texto: "Registra a venda que não gerou documento fiscal. Entra no controle de estoque e no faturamento gerencial, mas não vai para a SEFAZ.",
        dica: "Não substitui a nota fiscal quando ela é obrigatória.",
        cor: AMBAR, icone: IconCarrinho,
      },
    ],
  },

  "/caderneta": {
    chave: "tour-caderneta-v1",
    titulo: "Caderneta",
    slides: [
      {
        titulo: "O fiado organizado",
        texto: "Cada cliente tem uma conta. Lançamento de dívida aumenta o saldo, pagamento diminui. O total em aberto aparece no topo.",
        cor: AMBAR, icone: IconDinheiro,
      },
    ],
  },

  "/recebidas": {
    chave: "tour-recebidas-v1",
    titulo: "Notas recebidas",
    slides: [
      {
        titulo: "A caixa de entrada",
        texto: "Notas que outras empresas emitiram contra o seu CNPJ. Produto vem da SEFAZ, serviço vem do sistema nacional — as duas aparecem aqui, e as abas separam se você quiser.",
        cor: AZUL, icone: IconEntrada,
      },
      {
        titulo: "Buscar novas",
        texto: "O botão vai no governo e traz o que chegou desde a última vez. Nada novo é resposta normal, não é erro.",
        dica: "A tarja na linha mostra o que aconteceu com a nota: cancelada, confirmada.",
        cor: VERDE, icone: IconLista,
      },
    ],
  },

  "/importar": {
    chave: "tour-importar-v1",
    titulo: "Importar XML",
    slides: [
      {
        titulo: "Nota de compra vira cadastro",
        texto: "Solte o XML da nota que você recebeu. O sistema lê os produtos e dá entrada no estoque, sem digitar item por item.",
        dica: "Serve também para importar notas de saída já emitidas em outro sistema.",
        cor: ROXO, icone: IconEntrada,
      },
    ],
  },

  "/produtos": {
    chave: "tour-produtos-v1",
    titulo: "Produtos",
    slides: [
      {
        titulo: "O catálogo",
        texto: "O que a nota precisa saber de cada produto: nome, preço, unidade e o NCM, que é como o fisco identifica a mercadoria.",
        dica: "Sem NCM certo a nota é rejeitada. Na dúvida, pergunte ao contador.",
        cor: ROXO, icone: IconCaixa,
      },
      {
        titulo: "Custo e lucro",
        texto: "Preencha o preço de custo se quiser ver lucro no painel. Sem custo, o sistema mostra faturamento mas não consegue calcular margem.",
        cor: VERDE, icone: IconDinheiro,
      },
      {
        titulo: "Cadastro em massa",
        texto: "Dá para importar uma planilha ou bipar código de barras para cadastrar vários de uma vez.",
        cor: AZUL, icone: IconLista,
      },
    ],
  },

  "/servicos": {
    chave: "tour-servicos-v1",
    titulo: "Serviços",
    slides: [
      {
        titulo: "O catálogo de mão de obra",
        texto: "O equivalente ao de produtos, para nota de serviço. Cada serviço leva o código nacional que o fisco usa para identificar o que foi feito.",
        cor: ROXO, icone: IconFerramenta,
      },
      {
        titulo: "Não precisa decorar código",
        texto: "Use a busca da classificação: digite o que a empresa faz — para-brisa, troca de óleo, consultoria — e escolha da lista. O código sai preenchido.",
        dica: "A alíquota do ISS é da sua cidade e varia por serviço. O contador informa.",
        cor: AZUL, icone: IconLista,
      },
    ],
  },

  "/estoque": {
    chave: "tour-estoque-v1",
    titulo: "Estoque",
    slides: [
      {
        titulo: "Saldo e movimento",
        texto: "Cada produto que controla estoque tem saldo. Emitir nota dá baixa, importar XML de compra dá entrada, e você pode ajustar na mão.",
        dica: "Nas configurações dá para bloquear a emissão quando não há saldo.",
        cor: VERDE, icone: IconCaixa,
      },
    ],
  },

  "/clientes": {
    chave: "tour-clientes-v1",
    titulo: "Clientes",
    slides: [
      {
        titulo: "Quem recebe a nota",
        texto: "CPF ou CNPJ e endereço completo são obrigatórios — vão no XML. Digitando o CNPJ o sistema busca os dados sozinho.",
        dica: "Endereço incompleto é a causa mais comum de rejeição.",
        cor: AZUL, icone: IconPessoa,
      },
    ],
  },

  "/fornecedores": {
    chave: "tour-fornecedores-v1",
    titulo: "Fornecedores",
    slides: [
      {
        titulo: "Quem fatura contra você",
        texto: "Cadastre para identificar a origem das notas que chegam. Não é obrigatório para emitir.",
        cor: AZUL, icone: IconEntrada,
      },
    ],
  },

  "/transportadoras": {
    chave: "tour-transportadoras-v1",
    titulo: "Transportadoras",
    slides: [
      {
        titulo: "Quem leva a mercadoria",
        texto: "Só é exigida quando o frete é por conta de terceiros. Para CIF, FOB e sem ocorrência, a nota sai sem transportadora.",
        cor: VERDE, icone: IconCaminhao,
      },
    ],
  },

  "/relatorios": {
    chave: "tour-relatorios-v1",
    titulo: "Relatórios",
    slides: [
      {
        titulo: "Para o contador e para você",
        texto: "Escolha o período e o relatório. Tudo exporta em PDF ou planilha, pronto para mandar.",
        cor: AMBAR, icone: IconArquivo,
      },
    ],
  },

  "/eventos": {
    chave: "tour-eventos-v1",
    titulo: "Eventos",
    slides: [
      {
        titulo: "O histórico do que aconteceu",
        texto: "Cancelamentos, cartas de correção e manifestações registradas na SEFAZ ficam aqui, com data e protocolo.",
        cor: AZUL, icone: IconLista,
      },
    ],
  },

  "/configuracoes": {
    chave: "tour-configuracoes-v1",
    titulo: "Configurações",
    slides: [
      {
        titulo: "Comece pelo certificado",
        texto: "Sem o certificado A1 enviado, nada é transmitido. Ele é a assinatura da empresa e vale por um ano.",
        dica: "Fique de olho na validade: certificado vencido para a emissão.",
        cor: AMBAR, icone: IconAlerta,
      },
      {
        titulo: "Homologação x produção",
        texto: "Em homologação as notas não valem nada e servem para testar. Só vire para produção quando estiver confiante.",
        cor: ROXO, icone: IconEngrenagem,
      },
      {
        titulo: "Numeração e padrões",
        texto: "Série e próximo número de cada tipo de nota ficam aqui, junto com os padrões que agilizam a tela de emitir.",
        dica: "Mudar o próximo número por engano gera rejeição por número duplicado.",
        cor: AZUL, icone: IconEngrenagem,
      },
    ],
  },
};

// Rota → tutorial, casando o prefixo mais longo (/notas/nova antes de /notas).
export function tourDaRota(pathname: string): Tour | null {
  const chaves = Object.keys(TOURS).sort((a, b) => b.length - a.length);
  const achou = chaves.find((r) => pathname === r || pathname.startsWith(r + "/"));
  return achou ? TOURS[achou] : null;
}
