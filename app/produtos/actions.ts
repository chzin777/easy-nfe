"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import { consultarGtin } from "@/lib/gtin";
import type { Produto } from "@/lib/types";
import type { ProdutoImport } from "@/lib/produtos-modelo";

type ProdutoRow = {
  id: string;
  codigoInterno: number;
  codigoBarras: string | null;
  nome: string;
  marca: string | null;
  peso: unknown;
  unidade: string;
  ncm: string;
  origem: string;
  preco: unknown;
  descricao: string | null;
  categoriaId: string | null;
  categoria?: { nome: string } | null;
  cst: string | null;
  aliquotaIcms: unknown;
  reducaoBaseIcms: unknown;
  cest: string | null;
  codigoBeneficio: string | null;
  creditoPresumidoIcms: string | null;
  reguladoAnp: boolean;
  estoque: unknown;
  estoqueMinimo: unknown;
  controlaEstoque: boolean;
};

function paraUI(p: ProdutoRow): Produto {
  return {
    id: p.id,
    codigoInterno: p.codigoInterno,
    codigoBarras: p.codigoBarras ?? "",
    nome: p.nome,
    marca: p.marca ?? "",
    peso: p.peso == null ? 0 : Number(p.peso),
    unidade: p.unidade,
    ncm: p.ncm,
    origem: p.origem,
    preco: Number(p.preco),
    descricao: p.descricao ?? "",
    categoriaId: p.categoriaId ?? "",
    categoriaNome: p.categoria?.nome ?? "",
    cst: p.cst ?? "40",
    aliquotaIcms: p.aliquotaIcms == null ? 0 : Number(p.aliquotaIcms),
    reducaoBaseIcms: p.reducaoBaseIcms == null ? 0 : Number(p.reducaoBaseIcms),
    cest: p.cest ?? "",
    codigoBeneficio: p.codigoBeneficio ?? "",
    creditoPresumidoIcms: p.creditoPresumidoIcms ?? "",
    reguladoAnp: p.reguladoAnp,
    estoque: p.estoque == null ? 0 : Number(p.estoque),
    estoqueMinimo: p.estoqueMinimo == null ? 0 : Number(p.estoqueMinimo),
    controlaEstoque: p.controlaEstoque,
  };
}

export type ProdutoInput = Omit<Produto, "id" | "codigoInterno" | "categoriaNome">;

// Campos persistidos (sem os derivados). peso 0 / categoria "" viram null.
function paraDados(input: ProdutoInput) {
  return {
    codigoBarras: input.codigoBarras || null,
    nome: input.nome,
    marca: input.marca || null,
    peso: input.peso > 0 ? input.peso : null,
    unidade: input.unidade,
    ncm: input.ncm,
    origem: input.origem,
    preco: input.preco,
    descricao: input.descricao || null,
    categoriaId: input.categoriaId || null,
    cst: input.cst || "40",
    aliquotaIcms: input.cst === "20" && input.aliquotaIcms > 0 ? input.aliquotaIcms : null,
    reducaoBaseIcms: input.cst === "20" && input.reducaoBaseIcms > 0 ? input.reducaoBaseIcms : null,
    cest: input.cest || null,
    codigoBeneficio: input.codigoBeneficio || null,
    creditoPresumidoIcms: input.creditoPresumidoIcms || null,
    reguladoAnp: input.reguladoAnp,
    controlaEstoque: input.controlaEstoque,
    estoqueMinimo: input.estoqueMinimo >= 0 ? input.estoqueMinimo : 0,
  };
}

export async function listarProdutos(): Promise<Produto[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.produto.findMany({
    where: { empresaId },
    orderBy: { codigoInterno: "asc" },
    include: { categoria: { select: { nome: true } } },
  });
  return rows.map(paraUI);
}

export async function criarProduto(input: ProdutoInput): Promise<Produto> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  // estoque inicial só na criação (depois muda via emissão/ajuste, nunca pelo form).
  const estoqueInicial = input.controlaEstoque && input.estoque > 0 ? input.estoque : 0;
  const p = await prisma.produto.create({
    data: { empresaId, ...paraDados(input), estoque: estoqueInicial },
    include: { categoria: { select: { nome: true } } },
  });
  if (estoqueInicial > 0) {
    await prisma.movimentoEstoque.create({
      data: {
        empresaId, produtoId: p.id, tipo: "ENTRADA",
        quantidade: estoqueInicial, saldoApos: estoqueInicial, motivo: "Estoque inicial",
      },
    });
  }
  return paraUI(p);
}

export async function atualizarProduto(id: string, input: ProdutoInput): Promise<Produto> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  // updateMany garante escopo por empresa (não atualiza produto de outra empresa).
  await prisma.produto.updateMany({
    where: { id, empresaId },
    data: paraDados(input),
  });
  const p = await prisma.produto.findFirstOrThrow({
    where: { id, empresaId },
    include: { categoria: { select: { nome: true } } },
  });
  return paraUI(p);
}

// Importação em massa (CSV/XLSX). Recebe linhas já mapeadas por chave; revalida
// no servidor e cria em lote. Ignora linhas com erro (nome/NCM faltando).
export async function importarProdutos(
  itens: ProdutoImport[],
): Promise<{ criados: number; ignorados: number; erros: string[] }> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();

  // Guard final: exige nome e NCM (já validados no cliente, revalidados aqui).
  const erros: string[] = [];
  const validos: ProdutoImport[] = [];
  itens.forEach((it, idx) => {
    const nome = (it.nome ?? "").trim();
    const ncm = (it.ncm ?? "").replace(/\D/g, "");
    if (!nome) erros.push(`Linha ${idx + 1}: nome obrigatório.`);
    else if (!ncm) erros.push(`Linha ${idx + 1}: NCM obrigatório.`);
    else validos.push({ ...it, nome, ncm, preco: Number(it.preco) || 0 });
  });

  if (validos.length) {
    await prisma.produto.createMany({
      data: validos.map((i) => ({
        empresaId,
        codigoBarras: i.codigoBarras || null,
        nome: i.nome,
        unidade: i.unidade,
        ncm: i.ncm,
        origem: i.origem,
        preco: i.preco,
        descricao: i.descricao || null,
        cest: i.cest || null,
        codigoBeneficio: i.codigoBeneficio || null,
        creditoPresumidoIcms: i.creditoPresumidoIcms || null,
        reguladoAnp: i.reguladoAnp,
      })),
    });
  }

  return { criados: validos.length, ignorados: itens.length - validos.length, erros };
}

// Cadastro por bipagem: cria os produtos e, se controlarEstoque, já dá entrada
// com a quantidade contada (registra o movimento ENTRADA como estoque inicial).
// Só cria linhas com nome + NCM de 8 dígitos.
export type ProdutoBipagem = {
  codigoBarras: string;
  nome: string;
  unidade: string;
  ncm: string;
  preco: number;
  cest: string;
  quantidade: number;
};

export async function criarProdutosBipagem(
  itens: ProdutoBipagem[],
  controlarEstoque: boolean,
): Promise<{ criados: number; ignorados: number }> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();

  const validos = itens.filter((i) => i.nome.trim() && i.ncm.replace(/\D/g, "").length === 8);

  for (const i of validos) {
    const qtd = controlarEstoque && i.quantidade > 0 ? i.quantidade : 0;
    await prisma.$transaction(async (tx) => {
      const p = await tx.produto.create({
        data: {
          empresaId,
          codigoBarras: i.codigoBarras || null,
          nome: i.nome.trim(),
          unidade: i.unidade,
          ncm: i.ncm.replace(/\D/g, ""),
          origem: "0",
          preco: Number(i.preco) || 0,
          cest: i.cest || null,
          controlaEstoque: controlarEstoque,
          estoque: qtd,
        },
      });
      if (qtd > 0) {
        await tx.movimentoEstoque.create({
          data: {
            empresaId, produtoId: p.id, tipo: "ENTRADA",
            quantidade: qtd, saldoApos: qtd, motivo: "Bipagem — estoque inicial",
          },
        });
      }
    });
  }

  return { criados: validos.length, ignorados: itens.length - validos.length };
}

export async function excluirProduto(id: string): Promise<void> {
  await exigirFeature("produtos");
  const empresaId = await exigirEmpresa();
  await prisma.produto.deleteMany({ where: { id, empresaId } });
}

// Ajuste manual de estoque. `novoSaldo` = saldo final desejado; registra o
// movimento (ENTRADA/SAIDA/AJUSTE conforme o delta) e atualiza o produto.
export async function ajustarEstoque(
  produtoId: string,
  novoSaldo: number,
  motivo?: string,
): Promise<{ ok: true; estoque: number } | { ok: false; erro: string }> {
  try {
    await exigirFeature("produtos");
    const empresaId = await exigirEmpresa();
    if (!Number.isFinite(novoSaldo)) return { ok: false, erro: "Saldo inválido." };
    const saldo = Math.round(novoSaldo * 1e4) / 1e4; // 4 casas

    const prod = await prisma.produto.findFirst({ where: { id: produtoId, empresaId } });
    if (!prod) return { ok: false, erro: "Produto não encontrado." };

    const atual = Number(prod.estoque);
    const delta = saldo - atual;
    if (delta === 0) return { ok: true, estoque: atual };

    await prisma.$transaction([
      prisma.produto.update({ where: { id: produtoId }, data: { estoque: saldo } }),
      prisma.movimentoEstoque.create({
        data: {
          empresaId, produtoId, tipo: "AJUSTE",
          quantidade: Math.abs(delta), saldoApos: saldo,
          motivo: motivo?.trim() || "Ajuste manual",
        },
      }),
    ]);
    return { ok: true, estoque: saldo };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export type MovimentoEstoqueRow = {
  id: string;
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE" | "DEVOLUCAO";
  quantidade: number;
  saldoApos: number;
  motivo: string | null;
  notaId: string | null;
  createdAt: string;
};

// Histórico de movimentos de um produto (mais recentes primeiro).
export async function listarMovimentosEstoque(produtoId: string): Promise<MovimentoEstoqueRow[]> {
  const empresaId = await exigirEmpresa();
  const rows = await prisma.movimentoEstoque.findMany({
    where: { empresaId, produtoId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    quantidade: Number(m.quantidade),
    saldoApos: Number(m.saldoApos),
    motivo: m.motivo,
    notaId: m.notaId,
    createdAt: m.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Entrada de estoque a partir do XML de uma NF-e de compra/recebida.
// Casa por GTIN, senão por nome; produto não encontrado é criado (opcional).
// Idempotente por (empresa, chave): reimportar a mesma nota não duplica.
// ---------------------------------------------------------------------------
export type ItemEntradaXml = {
  cEAN?: string;
  xProd: string;
  ncm?: string;
  uCom?: string;
  qCom: number;
  vUnCom: number;
};

export type EntradaXmlInput = {
  chave: string;
  numero?: string;
  serie?: string;
  modelo?: string;
  fornecedorNome?: string;
  fornecedorDoc?: string;
  valorTotal?: number;
  itens: ItemEntradaXml[];
  criarFaltantes: boolean; // cria produto p/ item sem correspondência no catálogo
};

export type EntradaXmlResultado =
  | { ok: true; criados: number; atualizados: number; ignorados: number; entradaId: string }
  | { ok: false; erro: string; jaImportada?: boolean; propria?: boolean };

// Classificação automática de um XML na importação.
//  - tipo "entrada" → NF-e recebida (emitente ≠ empresa): dá entrada no estoque
//  - tipo "saida"   → NF-e emitida pela empresa em outro sistema: vira Nota
//  - jaImportada    → já registrada antes (dedup na tabela do respectivo tipo)
export type TipoImport = "entrada" | "saida";
export type AnaliseChave = { tipo: TipoImport; jaImportada: boolean };

// Recebe (chave, CNPJ do emitente) de cada XML e devolve, por chave, o tipo
// (comparando o emitente com o CNPJ da própria empresa) e se já foi importada.
export async function analisarChavesImport(
  itens: { chave: string; emitenteDoc: string }[],
): Promise<Record<string, AnaliseChave>> {
  await exigirFeature("importar_xml");
  const empresaId = await exigirEmpresa();
  const empresa = await prisma.emitente.findUniqueOrThrow({
    where: { id: empresaId },
    select: { cnpj: true },
  });
  const ownCnpj = empresa.cnpj.replace(/\D/g, "");

  const out: Record<string, AnaliseChave> = {};
  const entradaChaves: string[] = [];
  const saidaChaves: string[] = [];

  for (const it of itens) {
    const chave = (it.chave ?? "").replace(/\D/g, "");
    if (chave.length !== 44) continue;
    const emit = (it.emitenteDoc ?? "").replace(/\D/g, "");
    const tipo: TipoImport = emit && emit === ownCnpj ? "saida" : "entrada";
    out[chave] = { tipo, jaImportada: false };
    (tipo === "saida" ? saidaChaves : entradaChaves).push(chave);
  }
  if (!entradaChaves.length && !saidaChaves.length) return out;

  const [entradas, saidas] = await Promise.all([
    entradaChaves.length
      ? prisma.entradaEstoque.findMany({
          where: { empresaId, chave: { in: entradaChaves } },
          select: { chave: true },
        })
      : Promise.resolve([]),
    saidaChaves.length
      ? prisma.nota.findMany({
          where: { emitenteId: empresaId, chaveAcesso: { in: saidaChaves } },
          select: { chaveAcesso: true },
        })
      : Promise.resolve([]),
  ]);
  for (const e of entradas) if (out[e.chave]) out[e.chave].jaImportada = true;
  for (const n of saidas) if (n.chaveAcesso && out[n.chaveAcesso]) out[n.chaveAcesso].jaImportada = true;

  return out;
}

export async function importarEntradaXml(input: EntradaXmlInput): Promise<EntradaXmlResultado> {
  try {
    await exigirFeature("importar_xml");
    const empresaId = await exigirEmpresa();

    const chave = (input.chave ?? "").replace(/\D/g, "");
    if (chave.length !== 44) return { ok: false, erro: "XML sem chave de acesso válida (44 dígitos)." };
    if (!input.itens.length) return { ok: false, erro: "A nota não tem itens." };

    // NF emitida dentro do próprio easy-nfe não é entrada de compra.
    const propria = await prisma.nota.findFirst({
      where: { emitenteId: empresaId, chaveAcesso: chave },
      select: { id: true },
    });
    if (propria) {
      return {
        ok: false,
        propria: true,
        erro: "Esta NF-e foi emitida pela sua empresa no easy-nfe — não pode ser importada como entrada.",
      };
    }

    // Dedup: mesma nota já dá entrada uma vez só.
    const existente = await prisma.entradaEstoque.findUnique({
      where: { empresaId_chave: { empresaId, chave } },
    });
    if (existente) {
      return { ok: false, jaImportada: true, erro: "Esta nota já teve entrada lançada no estoque." };
    }

    // Catálogo atual p/ casar itens (GTIN tem prioridade, senão nome).
    const catalogo = await prisma.produto.findMany({
      where: { empresaId },
      select: { id: true, nome: true, codigoBarras: true },
    });
    const porGtin = new Map(catalogo.filter((p) => p.codigoBarras).map((p) => [p.codigoBarras!, p.id]));
    const porNome = new Map(catalogo.map((p) => [p.nome.toLowerCase(), p.id]));

    let criados = 0, atualizados = 0, ignorados = 0;

    const entrada = await prisma.$transaction(async (tx) => {
      const ent = await tx.entradaEstoque.create({
        data: {
          empresaId, chave,
          numero: input.numero || null,
          serie: input.serie || null,
          modelo: input.modelo || null,
          fornecedorNome: input.fornecedorNome || null,
          fornecedorDoc: input.fornecedorDoc || null,
          valorTotal: input.valorTotal && input.valorTotal > 0 ? input.valorTotal : null,
        },
      });

      for (const it of input.itens) {
        const qtd = Number(it.qCom);
        if (!(qtd > 0)) { ignorados++; continue; }

        let produtoId = (it.cEAN && porGtin.get(it.cEAN)) || porNome.get(it.xProd.toLowerCase());

        if (!produtoId) {
          if (!input.criarFaltantes) { ignorados++; continue; }
          const novo = await tx.produto.create({
            data: {
              empresaId,
              codigoBarras: it.cEAN || null,
              nome: it.xProd,
              unidade: it.uCom || "UN",
              ncm: (it.ncm || "").replace(/\D/g, ""),
              origem: "0",
              preco: it.vUnCom > 0 ? it.vUnCom : 0,
              controlaEstoque: true,
              estoque: 0,
            },
          });
          produtoId = novo.id;
          porNome.set(it.xProd.toLowerCase(), novo.id);
          if (it.cEAN) porGtin.set(it.cEAN, novo.id);
          criados++;
        } else {
          atualizados++;
        }

        // Entrada habilita o controle de estoque do produto e soma a quantidade.
        const upd = await tx.produto.update({
          where: { id: produtoId },
          data: { controlaEstoque: true, estoque: { increment: qtd } },
        });
        await tx.movimentoEstoque.create({
          data: {
            empresaId, produtoId, entradaId: ent.id, tipo: "ENTRADA",
            quantidade: qtd, saldoApos: Number(upd.estoque),
            custoUnitario: it.vUnCom > 0 ? it.vUnCom : null,
            motivo: `Entrada NF ${input.numero ?? ""}`.trim(),
          },
        });
      }
      return ent;
    });

    return { ok: true, criados, atualizados, ignorados, entradaId: entrada.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // corrida na unique (empresa, chave)
    if (/Unique constraint|P2002/i.test(msg)) {
      return { ok: false, jaImportada: true, erro: "Esta nota já teve entrada lançada no estoque." };
    }
    return { ok: false, erro: msg };
  }
}

// ---------------------------------------------------------------------------
// Importar NF-e de SAÍDA emitida em outro sistema — traz a nota (já autorizada)
// para dentro do easy-nfe como Nota AUTORIZADA (histórico/consulta). Não emite
// nada na SEFAZ nem baixa estoque; apenas registra o documento existente.
// Idempotente pela chave de acesso (unique global em Nota.chaveAcesso).
// ---------------------------------------------------------------------------
export type ItemNotaSaida = {
  xProd: string;
  ncm?: string;
  cfop?: string;
  uCom?: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
};

export type NotaSaidaInput = {
  chave: string;
  numero: string;
  serie: string;
  modelo: string;
  natOp?: string;
  emitenteDoc: string; // CNPJ do emitente no XML — deve ser a própria empresa
  autorizada: boolean;
  protocolo?: string;
  autorizadaEm?: string; // ISO/dhRecbto do XML
  xml: string;
  valorTotal: number;
  destinatario: {
    documento: string;
    nome: string;
    ie?: string;
    telefone?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
  };
  itens: ItemNotaSaida[];
};

export type NotaSaidaResultado =
  | { ok: true; notaId: string; clienteCriado: boolean }
  | { ok: false; erro: string; jaImportada?: boolean; naoPropria?: boolean };

export async function importarNotaSaida(input: NotaSaidaInput): Promise<NotaSaidaResultado> {
  try {
    await exigirFeature("importar_xml");
    const empresaId = await exigirEmpresa();
    const empresa = await prisma.emitente.findUniqueOrThrow({ where: { id: empresaId } });

    const chave = (input.chave ?? "").replace(/\D/g, "");
    if (chave.length !== 44) return { ok: false, erro: "XML sem chave de acesso válida (44 dígitos)." };
    if (!input.itens.length) return { ok: false, erro: "A nota não tem itens." };
    if (!input.autorizada) {
      return { ok: false, erro: "XML não está autorizado (sem protocolo de autorização) — só é possível importar notas já autorizadas pela SEFAZ." };
    }

    // Só importa notas emitidas pela PRÓPRIA empresa (mesmo CNPJ do emitente).
    const docEmit = (input.emitenteDoc ?? "").replace(/\D/g, "");
    if (docEmit && docEmit !== empresa.cnpj.replace(/\D/g, "")) {
      return {
        ok: false,
        naoPropria: true,
        erro: "Esta NF-e foi emitida por outro CNPJ — não é uma nota de saída da sua empresa. Para lançar mercadoria recebida, use a importação de Entrada.",
      };
    }

    // Dedup: a mesma nota (chave) já foi trazida antes.
    const existente = await prisma.nota.findUnique({ where: { chaveAcesso: chave } });
    if (existente) {
      return { ok: false, jaImportada: true, erro: "Esta nota já foi importada." };
    }

    // Casa o destinatário como cliente (por documento); cria se não existir.
    const destDoc = (input.destinatario.documento ?? "").replace(/\D/g, "");
    let clienteId: string;
    let clienteCriado = false;
    const clienteExistente = destDoc
      ? await prisma.cliente.findFirst({ where: { empresaId, documento: destDoc } })
      : await prisma.cliente.findFirst({ where: { empresaId, padrao: true } });

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else if (destDoc) {
      const ie = (input.destinatario.ie ?? "").trim();
      const tipoContribuinte = /^ISENTO$/i.test(ie) ? "2" : ie ? "1" : "9";
      const novoCli = await prisma.cliente.create({
        data: {
          empresaId,
          tipoContribuinte,
          documento: destDoc,
          nome: input.destinatario.nome || "Cliente importado",
          inscricaoEstadual: ie || null,
          telefone: input.destinatario.telefone || null,
          cep: input.destinatario.cep || null,
          logradouro: input.destinatario.logradouro || null,
          numero: input.destinatario.numero || null,
          bairro: input.destinatario.bairro || null,
          municipio: input.destinatario.municipio || null,
          uf: input.destinatario.uf || null,
        },
      });
      clienteId = novoCli.id;
      clienteCriado = true;
    } else {
      return { ok: false, erro: "A nota não tem destinatário e não há cliente padrão configurado." };
    }

    const numero = parseInt((input.numero ?? "").replace(/\D/g, ""), 10) || 0;
    const serie = parseInt((input.serie ?? "").replace(/\D/g, ""), 10) || 1;
    const modelo = input.modelo || "55";

    const nota = await prisma.nota.create({
      data: {
        numero,
        serie,
        modelo,
        naturezaOperacao: input.natOp || "VENDA DE MERCADORIA",
        tipoNota: `${modelo}-saida`,
        emitenteId: empresaId,
        clienteId,
        status: "AUTORIZADA",
        ambiente: empresa.ambiente,
        valorTotal: input.valorTotal > 0 ? input.valorTotal : 0,
        chaveAcesso: chave,
        protocolo: input.protocolo || null,
        autorizadaEm: input.autorizadaEm ? new Date(input.autorizadaEm) : new Date(),
        xmlAutorizado: input.xml,
        informacoesAdicionais: "Importada de outro sistema.",
        itens: {
          create: input.itens.map((it) => ({
            nome: it.xProd,
            ncm: it.ncm || null,
            cfop: it.cfop || null,
            unidade: it.uCom || null,
            quantidade: it.qCom,
            precoUnitario: it.vUnCom,
            valorTotal: it.vProd > 0 ? it.vProd : it.qCom * it.vUnCom,
          })),
        },
      },
    });

    return { ok: true, notaId: nota.id, clienteCriado };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint|P2002/i.test(msg)) {
      return { ok: false, jaImportada: true, erro: "Esta nota já foi importada." };
    }
    return { ok: false, erro: msg };
  }
}

// ---------------------------------------------------------------------------
// Consulta por código de barras (GTIN) via API Cosmos. Preenche nome/marca/NCM/
// CEST a partir do código — pra quem só tem o produto físico na mão, sem nota
// nem planilha. Ver lib/gtin.ts.
// ---------------------------------------------------------------------------
export type BuscaGtin =
  | { ok: true; gtin: string; nome: string; marca: string; ncm: string; cest: string }
  | { ok: false; erro: string; naoEncontrado?: boolean };

export async function buscarPorGtin(gtin: string): Promise<BuscaGtin> {
  try {
    await exigirFeature("produtos");
    const r = await consultarGtin(gtin);
    if (!r.ok) return { ok: false, erro: r.erro, naoEncontrado: r.naoEncontrado };
    return { ok: true, gtin: r.gtin, nome: r.nome, marca: r.marca, ncm: r.ncm, cest: r.cest };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// codigo = só dígitos. completo = true quando tem 8 dígitos (válido p/ NF-e);
// false = posição geral (capítulo/posição), serve só pra refinar a busca.
export type NcmSugestao = { codigo: string; descricao: string; completo: boolean };

// Busca NCMs oficiais por termo na tabela da BrasilAPI (grátis, sem chave).
export async function buscarNcm(termo: string): Promise<NcmSugestao[]> {
  const q = termo.trim();
  if (q.length < 2) return [];
  try {
    const resp = await fetch(
      `https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return [];
    const dados = (await resp.json()) as Array<{ codigo?: string; descricao?: string }>;
    return dados
      .filter((d) => d.codigo && d.descricao)
      .map((d) => {
        const digitos = d.codigo!.replace(/\D/g, "");
        // Remove tags HTML e asteriscos da descrição oficial.
        const descricao = d.descricao!.replace(/<[^>]+>/g, "").replace(/\*/g, "").trim();
        return { codigo: digitos, descricao, completo: digitos.length === 8 };
      })
      .filter((d) => d.codigo.length >= 2 && d.codigo.length <= 8)
      // 8 dígitos primeiro, depois por código.
      .sort((a, b) => Number(b.completo) - Number(a.completo) || a.codigo.localeCompare(b.codigo))
      .slice(0, 40);
  } catch {
    return [];
  }
}
