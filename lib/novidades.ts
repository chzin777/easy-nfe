// Novidades da versão — fonte única para o carrossel do painel e para a seção
// da landing. Mexer aqui muda os dois lugares.
//
// `versao` entra na chave que guarda o "já vi isso" do usuário: subindo a
// versão, o carrossel volta a aparecer para todo mundo.

export const VERSAO_NOVIDADES = "2026-07";

export type Novidade = {
  titulo: string;
  desc: string;
  // Marca curta na etiqueta do card.
  tag: string;
  // Qual desenho usar — cada tela mapeia para o próprio SVG.
  icone: "servico" | "lista" | "espelho" | "catalogo" | "empresa" | "entrada" | "tutorial";
  // Para onde o card leva dentro do app (o carrossel do painel usa).
  href?: string;
};

export const NOVIDADES: Novidade[] = [
  {
    titulo: "Nota de serviço",
    desc: "Emita NFS-e pelo Padrão Nacional direto na tela de nova nota. Uma nota por serviço prestado, sem falar com a prefeitura.",
    tag: "Novo",
    icone: "servico",
    href: "/notas/nova",
  },
  {
    titulo: "Venda e serviço na mesma lista",
    desc: "Notas emitidas mostra os dois tipos, com um seletor para ver só as de venda ou só as de serviço.",
    tag: "Novo",
    icone: "lista",
    href: "/notas",
  },
  {
    titulo: "Espelho da nota de serviço",
    desc: "O DANFSe com os mesmos botões da nota de venda: baixar PDF, salvar XML e cancelar.",
    tag: "Novo",
    icone: "espelho",
    href: "/notas",
  },
  {
    titulo: "Catálogo de serviços",
    desc: "Cadastre o que você faz uma vez e reaproveite. A classificação é buscada pela lista da LC 116 pelo nome do serviço.",
    tag: "Novo",
    icone: "catalogo",
    href: "/servicos",
  },
  {
    titulo: "Comércio, serviço ou os dois",
    desc: "O cadastro de empresa pergunta o que você faz e cobra a inscrição certa: estadual, municipal ou as duas.",
    tag: "Melhoria",
    icone: "empresa",
    href: "/configuracoes",
  },
  {
    titulo: "Notas recebidas num lugar só",
    desc: "As notas de serviço que seus fornecedores emitem contra você chegam sozinhas, na mesma caixa das notas de produto.",
    tag: "Novo",
    icone: "entrada",
    href: "/recebidas",
  },
  {
    titulo: "Tutorial em todas as telas",
    desc: "Cada tela explica o que faz e o que costuma dar errado, em português de gente.",
    tag: "Melhoria",
    icone: "tutorial",
  },
];
