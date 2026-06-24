// Catálogo de funcionalidades do sistema que um benefício pode liberar.
// Usado no painel (seleção) e, futuramente, no controle de acesso.

export type Feature = { chave: string; nome: string; categoria: string };

export const FEATURES: Feature[] = [
  // Cadastros
  { chave: "produtos", nome: "Cadastro de produtos", categoria: "Cadastros" },
  { chave: "clientes", nome: "Cadastro de clientes", categoria: "Cadastros" },
  { chave: "fornecedores", nome: "Cadastro de fornecedores", categoria: "Cadastros" },
  { chave: "transportadoras", nome: "Cadastro de transportadoras", categoria: "Cadastros" },

  // Emissão
  { chave: "orcamentos", nome: "Orçamentos (funil de vendas)", categoria: "Emissão" },
  { chave: "emitir_nfe", nome: "Emitir NF-e (mod. 55)", categoria: "Emissão" },
  { chave: "emitir_nfce", nome: "Emitir NFC-e (mod. 65)", categoria: "Emissão" },
  { chave: "emitir_nfse", nome: "Emitir NFS-e (serviço)", categoria: "Emissão" },
  { chave: "notas_listar", nome: "Ver notas emitidas", categoria: "Emissão" },
  { chave: "nota_cancelar", nome: "Cancelar nota", categoria: "Emissão" },
  { chave: "danfe", nome: "Gerar/imprimir DANFE", categoria: "Emissão" },
  { chave: "importar_xml", nome: "Importar XML", categoria: "Emissão" },
  { chave: "dfe", nome: "Captura de notas recebidas (DF-e)", categoria: "Emissão" },

  // Integrações
  { chave: "integracao_email", nome: "Envio por e-mail", categoria: "Integrações" },
  { chave: "integracao_whatsapp", nome: "Envio por WhatsApp", categoria: "Integrações" },
  { chave: "integracao_ecommerce", nome: "Integração e-commerce / marketplaces", categoria: "Integrações" },
  { chave: "api", nome: "API de integração", categoria: "Integrações" },

  // Gestão
  { chave: "dashboard", nome: "Dashboard e gráficos", categoria: "Gestão" },
  { chave: "multiempresa", nome: "Multiempresa (vários CNPJs)", categoria: "Gestão" },
  { chave: "multiusuario", nome: "Equipe / multiusuário", categoria: "Gestão" },
  { chave: "relatorios", nome: "Relatórios fiscais", categoria: "Gestão" },

  // Suporte
  { chave: "suporte_prioritario", nome: "Suporte prioritário via WhatsApp", categoria: "Suporte" },
];

export const FEATURE_NOME: Record<string, string> = Object.fromEntries(
  FEATURES.map((f) => [f.chave, f.nome]),
);
