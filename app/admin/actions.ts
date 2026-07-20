"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { exigirAdmin, exigirAdminMaster } from "@/lib/admin";
import { hashSenha, lerSessaoCompleta } from "@/lib/auth";
import { codigoMunicipio } from "@/lib/nfe/municipios";
import { enviarEmail, htmlCobranca } from "@/lib/email";
import { baseUrlServidor } from "@/lib/base-url";
import { logoBase64, LOGO_CID } from "@/lib/logo-email";
import { precoComDesconto } from "@/lib/assinatura";
import {
  statusConfigAsaas,
  salvarConfigAsaas as salvarConfigAsaasStore,
  type AsaasConfigStatus,
  type AsaasAmbiente,
} from "@/lib/asaas-config";

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ----------------------------------------------------------------------------
// Usuários
// ----------------------------------------------------------------------------
export type UsuarioResumo = {
  id: string;
  email: string;
  nome: string;
  role: "USER" | "SUPORTE" | "ADMIN" | "CONTADOR";
  ativo: boolean;
  plano: string | null;
  statusLicenca: string | null;
  validadeEm: string | null;
  empresas: number;
  criadoEm: string;
  equipe: boolean;
  // Empresas pelas quais o membro de equipe entrou (só preenchido p/ equipe).
  empresasNomes: string[];
};

// Assinante com a equipe dele pendurada — é assim que o painel lista.
export type UsuarioComEquipe = UsuarioResumo & { membros: UsuarioResumo[] };

// Quem assina é quem tem licença própria ou é dono do cadastro de alguma
// empresa (Emitente.userId). Quem só foi convidado para a empresa de outro é
// equipe: não aparece solto na lista, aparece dentro do titular dele.
//
// Atenção: o papel "dono" do AcessoEmpresa NÃO serve como critério — a empresa
// pode ter vários donos operacionais, e um convidado promovido a dono continua
// não sendo o assinante.
export async function listarUsuarios(): Promise<UsuarioComEquipe[]> {
  await exigirAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      licenca: { include: { plano: true } },
      _count: { select: { acessos: true, empresas: true } },
      acessos: { select: { empresaId: true } },
    },
  });

  // empresaId → titular (dono do cadastro) e nome, p/ ligar membro ao assinante.
  const empresas = await prisma.emitente.findMany({
    select: { id: true, userId: true, razaoSocial: true, nomeFantasia: true },
  });
  const titularDaEmpresa = new Map(empresas.map((e) => [e.id, e.userId]));
  const nomeDaEmpresa = new Map(empresas.map((e) => [e.id, e.nomeFantasia || e.razaoSocial]));

  const eEquipe = (u: (typeof users)[number]) =>
    u.role === "USER" && !u.licenca && u._count.empresas === 0;

  const resumo = (u: (typeof users)[number]): UsuarioResumo => ({
    id: u.id,
    email: u.email,
    nome: u.nome ?? "",
    role: u.role,
    ativo: u.ativo,
    plano: u.licenca?.plano?.nome ?? null,
    statusLicenca: u.licenca?.status ?? null,
    validadeEm: u.licenca?.validadeEm?.toISOString() ?? null,
    empresas: u._count.acessos,
    criadoEm: u.createdAt.toISOString(),
    equipe: eEquipe(u),
    empresasNomes: eEquipe(u)
      ? [...new Set(u.acessos.map((a) => nomeDaEmpresa.get(a.empresaId)).filter((n): n is string => !!n))]
      : [],
  });

  const assinantes = users.filter((u) => !eEquipe(u));
  const membrosPorTitular = new Map<string, UsuarioResumo[]>();
  // Membro sem titular identificável (empresa apagada, dado inconsistente) não
  // pode sumir do painel — vira assinante solto, com a flag de equipe à mostra.
  const orfaos: UsuarioResumo[] = [];

  for (const u of users.filter(eEquipe)) {
    const titulares = [...new Set(
      u.acessos.map((a) => titularDaEmpresa.get(a.empresaId)).filter((id): id is string => !!id && id !== u.id),
    )];
    if (titulares.length === 0) {
      orfaos.push(resumo(u));
      continue;
    }
    // Acesso a empresas de titulares diferentes: aparece dentro de cada um.
    for (const t of titulares) {
      membrosPorTitular.set(t, [...(membrosPorTitular.get(t) ?? []), resumo(u)]);
    }
  }

  return [
    ...assinantes.map((u) => ({ ...resumo(u), membros: membrosPorTitular.get(u.id) ?? [] })),
    ...orfaos.map((u) => ({ ...u, membros: [] })),
  ];
}

export type UsuarioDetalhe = {
  id: string;
  email: string;
  nome: string;
  role: "USER" | "SUPORTE" | "ADMIN" | "CONTADOR";
  ativo: boolean;
  cpfCnpj: string | null;
  telefone: string | null;
  criadoEm: string;
  licenca: { planoId: string | null; plano: string | null; status: string; validadeEm: string | null; descontoTipo: string; descontoValor: number } | null;
  empresas: { id: string; razaoSocial: string; cnpj: string; papel: string }[];
  faturas: { id: string; planoNome: string; competencia: string; valor: number; vencimento: string; status: string; pagaEm: string | null; metodo: string | null; bankSlipUrl: string | null; linhaDigitavel: string | null; invoiceUrl: string | null; emailStatus: string | null; emailEm: string | null; emailErro: string | null }[];
};

export async function detalheUsuario(userId: string): Promise<UsuarioDetalhe | null> {
  await exigirAdmin();
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      licenca: { include: { plano: true } },
      acessos: { include: { empresa: { select: { id: true, razaoSocial: true, cnpj: true } } } },
      faturas: { orderBy: { competencia: "desc" } },
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    nome: u.nome ?? "",
    role: u.role,
    ativo: u.ativo,
    cpfCnpj: u.cpfCnpj,
    telefone: u.telefone,
    criadoEm: u.createdAt.toISOString(),
    licenca: u.licenca
      ? {
          planoId: u.licenca.planoId,
          plano: u.licenca.plano?.nome ?? null,
          status: u.licenca.status,
          validadeEm: u.licenca.validadeEm?.toISOString() ?? null,
          descontoTipo: u.licenca.descontoTipo,
          descontoValor: Number(u.licenca.descontoValor),
        }
      : null,
    empresas: u.acessos.map((a) => ({
      id: a.empresa.id,
      razaoSocial: a.empresa.razaoSocial,
      cnpj: a.empresa.cnpj,
      papel: a.papel,
    })),
    faturas: u.faturas.map((f) => ({
      id: f.id,
      planoNome: f.planoNome,
      competencia: f.competencia,
      valor: Number(f.valor),
      vencimento: f.vencimento.toISOString(),
      status: f.status,
      pagaEm: f.pagaEm?.toISOString() ?? null,
      metodo: f.metodo,
      bankSlipUrl: f.bankSlipUrl,
      linhaDigitavel: f.linhaDigitavel,
      invoiceUrl: f.invoiceUrl,
      emailStatus: f.emailStatus,
      emailEm: f.emailEm?.toISOString() ?? null,
      emailErro: f.emailErro,
    })),
  };
}

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

export async function criarUsuario(input: {
  email: string;
  senha: string;
  nome: string;
  role: "USER" | "SUPORTE" | "ADMIN" | "CONTADOR";
  ativo?: boolean;
  // Licença opcional definida já na criação (espelha a aba "Licença" do editar).
  licenca?: {
    planoId: string | null;
    status: "TRIAL" | "ATIVA" | "EXPIRADA" | "SUSPENSA" | "CANCELADA";
    validadeEm: string | null; // ISO date (yyyy-mm-dd) ou null
  } | null;
}): Promise<Resultado> {
  try {
    // Criar ADMIN/SUPORTE exige ser admin master.
    if (input.role === "ADMIN" || input.role === "SUPORTE") await exigirAdminMaster();
    else await exigirAdmin();

    const email = input.email.trim().toLowerCase();
    if (!emailValido(email)) return { ok: false, erro: "E-mail inválido." };
    if (input.senha.length < 8) return { ok: false, erro: "Senha deve ter ao menos 8 caracteres." };
    if (await prisma.user.findUnique({ where: { email } })) {
      return { ok: false, erro: "Já existe usuário com este e-mail." };
    }
    const u = await prisma.user.create({
      data: {
        email,
        senhaHash: await hashSenha(input.senha),
        nome: input.nome || null,
        role: input.role,
        ativo: input.ativo ?? true,
      },
    });

    // Licença informada no stepper de criação tem prioridade.
    if (input.licenca && input.licenca.planoId) {
      await prisma.licenca.create({
        data: {
          userId: u.id,
          planoId: input.licenca.planoId,
          status: input.licenca.status,
          validadeEm: input.licenca.validadeEm ? new Date(input.licenca.validadeEm) : null,
        },
      });
      // Gera faturas dos períodos cobertos (gerarFaturasInterno pula TRIAL).
      await gerarFaturasInterno(u.id);
    } else if (input.role === "USER") {
      // Fallback: usuário comum ganha trial de 7 dias no plano mais básico.
      const planoBasico = await prisma.plano.findFirst({
        where: { ativo: true },
        orderBy: { ordem: "asc" },
        select: { id: true },
      });
      const validade = new Date();
      validade.setDate(validade.getDate() + 7);
      await prisma.licenca.create({
        data: { userId: u.id, planoId: planoBasico?.id ?? null, status: "TRIAL", validadeEm: validade },
      });
    }
    return { ok: true, id: u.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function atualizarUsuario(
  userId: string,
  input: { nome: string; email: string; role: "USER" | "SUPORTE" | "ADMIN" | "CONTADOR"; ativo: boolean; cpfCnpj?: string },
): Promise<Resultado> {
  try {
    if (input.role === "ADMIN" || input.role === "SUPORTE") await exigirAdminMaster();
    else await exigirAdmin();

    const email = input.email.trim().toLowerCase();
    if (!emailValido(email)) return { ok: false, erro: "E-mail inválido." };
    const dono = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (dono && dono.id !== userId) return { ok: false, erro: "E-mail já usado por outro usuário." };

    // CPF/CNPJ opcional; quando vier, valida o tamanho (11 ou 14 dígitos).
    let cpfCnpj: string | null | undefined;
    if (input.cpfCnpj !== undefined) {
      const limpo = input.cpfCnpj.replace(/\D/g, "");
      if (limpo && limpo.length !== 11 && limpo.length !== 14) {
        return { ok: false, erro: "CPF/CNPJ inválido (use 11 ou 14 dígitos)." };
      }
      cpfCnpj = limpo || null;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { nome: input.nome || null, email, role: input.role, ativo: input.ativo, ...(cpfCnpj !== undefined ? { cpfCnpj } : {}) },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// Exclui o usuário e tudo que cascateia (empresas, licença, faturas, acessos).
// Irreversível — exige admin master e bloqueia excluir a própria conta.
export async function excluirUsuario(userId: string): Promise<Resultado> {
  try {
    await exigirAdminMaster();
    const sess = await lerSessaoCompleta();
    if (sess?.uid === userId) return { ok: false, erro: "Você não pode excluir a própria conta." };
    const alvo = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
    await prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function redefinirSenha(userId: string, senha: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    if (senha.length < 8) return { ok: false, erro: "Senha deve ter ao menos 8 caracteres." };
    await prisma.user.update({ where: { id: userId }, data: { senhaHash: await hashSenha(senha) } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Integração Asaas (config criptografada no banco) — admin master
// ----------------------------------------------------------------------------
export async function obterConfigAsaas(): Promise<AsaasConfigStatus> {
  await exigirAdminMaster();
  return statusConfigAsaas();
}

export async function salvarConfigAsaas(input: {
  apiKey?: string;
  ambiente: AsaasAmbiente;
  webhookToken?: string;
  limparWebhookToken?: boolean;
}): Promise<Resultado> {
  try {
    await exigirAdminMaster();
    if (input.ambiente !== "sandbox" && input.ambiente !== "producao") {
      return { ok: false, erro: "Ambiente inválido." };
    }
    await salvarConfigAsaasStore(input);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function testarConexaoAsaas(): Promise<Resultado> {
  try {
    await exigirAdminMaster();
    const { verificarConexao } = await import("@/lib/asaas");
    await verificarConexao();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Empresas (admin) — criar p/ usuário e vincular
// ----------------------------------------------------------------------------
export type EmpresaAdmin = { id: string; razaoSocial: string; cnpj: string };

export async function listarEmpresasAdmin(): Promise<EmpresaAdmin[]> {
  await exigirAdmin();
  const rows = await prisma.emitente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true, cnpj: true },
  });
  return rows;
}

export async function criarEmpresaParaUsuario(input: {
  userId: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  crt: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  ambiente: "homologacao" | "producao";
}): Promise<Resultado> {
  try {
    await exigirAdmin();
    if (!input.razaoSocial.trim() || !input.cnpj.trim()) {
      return { ok: false, erro: "Razão social e CNPJ obrigatórios." };
    }
    let codMunicipio = "";
    try { codMunicipio = codigoMunicipio(input.municipio); } catch { /* fica vazio */ }

    const empresa = await prisma.emitente.create({
      data: {
        userId: input.userId,
        razaoSocial: input.razaoSocial,
        cnpj: input.cnpj.replace(/\D/g, ""),
        ie: input.inscricaoEstadual.replace(/\D/g, ""),
        crt: input.crt,
        cep: input.cep.replace(/\D/g, ""),
        logradouro: input.logradouro,
        numero: input.numero,
        bairro: input.bairro,
        codMunicipio,
        municipio: input.municipio,
        uf: input.uf,
        ambiente: input.ambiente === "producao" ? "PRODUCAO" : "HOMOLOGACAO",
      },
    });
    await prisma.acessoEmpresa.create({ data: { userId: input.userId, empresaId: empresa.id, papel: "dono" } });
    return { ok: true, id: empresa.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint/i.test(msg)) return { ok: false, erro: "Esse usuário já tem empresa com este CNPJ." };
    return { ok: false, erro: msg };
  }
}

export async function vincularUsuarioEmpresa(input: {
  userId: string;
  empresaId: string;
  papel: "dono" | "membro";
}): Promise<Resultado> {
  try {
    await exigirAdmin();
    await prisma.acessoEmpresa.upsert({
      where: { userId_empresaId: { userId: input.userId, empresaId: input.empresaId } },
      update: { papel: input.papel },
      create: { userId: input.userId, empresaId: input.empresaId, papel: input.papel },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function desvincularUsuarioEmpresa(userId: string, empresaId: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    await prisma.acessoEmpresa.deleteMany({ where: { userId, empresaId } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Planos (CRUD)
// ----------------------------------------------------------------------------
export type PlanoDados = {
  id?: string;
  nome: string;
  descricao: string;
  preco: number;
  precoAntigo: number; // 0 = sem "de"
  sobConsulta: boolean;
  categoria: string;
  periodicidade: string;
  limiteEmpresas: number;
  limiteUsuarios: number;
  beneficioIds: string[];
  ativo: boolean;
  popular: boolean;
  permiteTrial: boolean;
  ordem: number;
};

export type Beneficio = { id: string; chave: string; nome: string };

// ----------------------------------------------------------------------------
// Categorias de plano
// ----------------------------------------------------------------------------
export type CategoriaPlano = { id: string; nome: string; ordem: number };

export async function listarCategorias(): Promise<CategoriaPlano[]> {
  await exigirAdmin();
  const rows = await prisma.categoriaPlano.findMany({ orderBy: { ordem: "asc" } });
  return rows.map((c) => ({ id: c.id, nome: c.nome, ordem: c.ordem }));
}

export async function criarCategoria(nome: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    const n = nome.trim();
    if (!n) return { ok: false, erro: "Nome da categoria é obrigatório." };
    const existe = await prisma.categoriaPlano.findUnique({ where: { nome: n } });
    if (existe) return { ok: false, erro: "Já existe uma categoria com este nome." };
    const count = await prisma.categoriaPlano.count();
    const c = await prisma.categoriaPlano.create({ data: { nome: n, ordem: count } });
    return { ok: true, id: c.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function renomearCategoria(id: string, nome: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    const n = nome.trim();
    if (!n) return { ok: false, erro: "Nome da categoria é obrigatório." };
    const atual = await prisma.categoriaPlano.findUnique({ where: { id } });
    if (!atual) return { ok: false, erro: "Categoria não encontrada." };
    if (atual.nome === n) return { ok: true };
    const colisao = await prisma.categoriaPlano.findUnique({ where: { nome: n } });
    if (colisao) return { ok: false, erro: "Já existe uma categoria com este nome." };
    // renomeia e reaponta os planos que usavam o nome antigo.
    await prisma.$transaction([
      prisma.categoriaPlano.update({ where: { id }, data: { nome: n } }),
      prisma.plano.updateMany({ where: { categoria: atual.nome }, data: { categoria: n } }),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function moverCategoria(id: string, direcao: "cima" | "baixo"): Promise<Resultado> {
  try {
    await exigirAdmin();
    const ordenadas = await prisma.categoriaPlano.findMany({ orderBy: { ordem: "asc" } });
    const i = ordenadas.findIndex((c) => c.id === id);
    if (i < 0) return { ok: false, erro: "Categoria não encontrada." };
    const j = direcao === "cima" ? i - 1 : i + 1;
    if (j < 0 || j >= ordenadas.length) return { ok: true }; // já no limite
    const a = ordenadas[i], b = ordenadas[j];
    // troca a ordem entre os dois vizinhos (normaliza por índice para evitar empates).
    await prisma.$transaction([
      prisma.categoriaPlano.update({ where: { id: a.id }, data: { ordem: j } }),
      prisma.categoriaPlano.update({ where: { id: b.id }, data: { ordem: i } }),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function definirPlanoPopular(id: string, popular: boolean): Promise<Resultado> {
  try {
    await exigirAdmin();
    // popular é único: ao marcar um, desmarca os demais.
    await prisma.$transaction([
      prisma.plano.updateMany({ data: { popular: false } }),
      ...(popular ? [prisma.plano.update({ where: { id }, data: { popular: true } })] : []),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function excluirCategoria(id: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    await prisma.categoriaPlano.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function listarBeneficios(): Promise<Beneficio[]> {
  await exigirAdmin();
  const rows = await prisma.beneficio.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } });
  return rows.map((b) => ({ id: b.id, chave: b.chave, nome: b.nome }));
}

// ----------------------------------------------------------------------------
// CRUD do catálogo de benefícios
// ----------------------------------------------------------------------------
export type BeneficioDados = {
  id?: string;
  chave: string;
  nome: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  features: string[];
  emUso?: number; // planos que usam (read-only)
};

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export async function listarBeneficiosAdmin(): Promise<Required<BeneficioDados>[]> {
  await exigirAdmin();
  const rows = await prisma.beneficio.findMany({
    where: { oculto: false },
    orderBy: { ordem: "asc" },
    include: { _count: { select: { planos: true } } },
  });
  return rows.map((b) => ({
    id: b.id,
    chave: b.chave,
    nome: b.nome,
    descricao: b.descricao ?? "",
    ordem: b.ordem,
    ativo: b.ativo,
    features: b.features,
    emUso: b._count.planos,
  }));
}

export async function salvarBeneficio(dados: BeneficioDados): Promise<Resultado> {
  try {
    await exigirAdmin();
    if (!dados.nome.trim()) return { ok: false, erro: "Nome é obrigatório." };
    const chave = (dados.chave.trim() ? slug(dados.chave) : slug(dados.nome)) || slug(dados.nome);
    if (!chave) return { ok: false, erro: "Não foi possível gerar a chave." };

    const conflito = await prisma.beneficio.findUnique({ where: { chave }, select: { id: true } });
    if (conflito && conflito.id !== dados.id) return { ok: false, erro: `Já existe um benefício com a chave "${chave}".` };

    const data = { chave, nome: dados.nome, descricao: dados.descricao || null, ordem: dados.ordem, ativo: dados.ativo, features: dados.features ?? [] };
    if (dados.id) {
      await prisma.beneficio.update({ where: { id: dados.id }, data });
      return { ok: true, id: dados.id };
    }
    const b = await prisma.beneficio.create({ data });
    return { ok: true, id: b.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function excluirBeneficio(id: string): Promise<Resultado> {
  try {
    await exigirAdminMaster();
    await prisma.beneficio.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function listarPlanos(): Promise<Required<PlanoDados>[]> {
  await exigirAdmin();
  const rows = await prisma.plano.findMany({
    orderBy: { ordem: "asc" },
    include: { beneficios: { orderBy: { ordem: "asc" }, select: { id: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? "",
    preco: Number(p.preco),
    precoAntigo: p.precoAntigo ? Number(p.precoAntigo) : 0,
    sobConsulta: p.sobConsulta,
    categoria: p.categoria ?? "",
    periodicidade: p.periodicidade,
    limiteEmpresas: p.limiteEmpresas,
    limiteUsuarios: p.limiteUsuarios,
    beneficioIds: p.beneficios.map((b) => b.id),
    ativo: p.ativo,
    popular: p.popular,
    permiteTrial: p.permiteTrial,
    ordem: p.ordem,
  }));
}

export async function salvarPlano(dados: PlanoDados): Promise<Resultado> {
  try {
    await exigirAdmin();
    if (!dados.nome.trim()) return { ok: false, erro: "Nome do plano é obrigatório." };
    const base = {
      nome: dados.nome,
      descricao: dados.descricao || null,
      preco: dados.preco,
      precoAntigo: dados.precoAntigo > 0 ? dados.precoAntigo : null,
      sobConsulta: dados.sobConsulta,
      categoria: dados.categoria.trim() || null,
      periodicidade: dados.periodicidade,
      limiteEmpresas: dados.limiteEmpresas,
      limiteUsuarios: dados.limiteUsuarios,
      ativo: dados.ativo,
      popular: dados.popular,
      permiteTrial: dados.permiteTrial,
      ordem: dados.ordem,
    };
    const conexao = dados.beneficioIds.map((id) => ({ id }));
    if (dados.id) {
      await prisma.plano.update({ where: { id: dados.id }, data: { ...base, beneficios: { set: conexao } } });
      return { ok: true, id: dados.id };
    }
    const p = await prisma.plano.create({ data: { ...base, beneficios: { connect: conexao } } });
    return { ok: true, id: p.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function excluirPlano(id: string): Promise<Resultado> {
  try {
    await exigirAdminMaster();
    const usos = await prisma.licenca.count({ where: { planoId: id } });
    if (usos > 0) return { ok: false, erro: "Plano em uso por licenças — não pode ser excluído." };
    await prisma.plano.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Licença
// ----------------------------------------------------------------------------
export async function definirLicenca(input: {
  userId: string;
  planoId: string | null;
  status: "TRIAL" | "ATIVA" | "EXPIRADA" | "SUSPENSA" | "CANCELADA";
  validadeEm: string | null; // ISO date (yyyy-mm-dd) ou null
  descontoTipo?: "valor" | "percent";
  descontoValor?: number;
}): Promise<Resultado> {
  try {
    await exigirAdmin();
    const validade = input.validadeEm ? new Date(input.validadeEm) : null;
    const descontoTipo = input.descontoTipo ?? "valor";
    const descontoValor = Math.max(0, input.descontoValor ?? 0);
    await prisma.licenca.upsert({
      where: { userId: input.userId },
      update: { planoId: input.planoId, status: input.status, validadeEm: validade, descontoTipo, descontoValor },
      create: { userId: input.userId, planoId: input.planoId, status: input.status, validadeEm: validade, descontoTipo, descontoValor },
    });
    // Gera as faturas dos períodos cobertos pelo plano/validade (já com desconto).
    await gerarFaturasInterno(input.userId);
    // Reflete o desconto nas faturas ainda EM ABERTO (não mexe em pagas/canceladas).
    await sincronizarDescontoFaturas(input.userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Faturas (cobranças por período, geradas do plano + validade)
// ----------------------------------------------------------------------------

// Gera as faturas dos PRÓXIMOS 3 MESES (mês atual + 2), respeitando a validade.
// Não sobrescreve faturas existentes (preserva pagamentos já marcados).
async function gerarFaturasInterno(userId: string): Promise<void> {
  const lic = await prisma.licenca.findUnique({ where: { userId }, include: { plano: true } });
  if (!lic?.plano) return;
  // TRIAL é gratuito — período de avaliação não gera cobrança.
  if (lic.status === "TRIAL") return;

  const preco = precoComDesconto(Number(lic.plano.preco), lic.descontoTipo, Number(lic.descontoValor));
  const fim = lic.validadeEm;
  const hoje = new Date();
  const diaVenc = Math.min(lic.inicioEm.getDate(), 28);

  for (let i = 0; i < 3; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const vencimento = new Date(d.getFullYear(), d.getMonth(), diaVenc);
    // Não gera além da validade da licença.
    if (fim && vencimento > fim) break;

    const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const atrasada = vencimento < hoje;
    await prisma.fatura.upsert({
      where: { userId_competencia: { userId, competencia } },
      update: {},
      create: {
        userId,
        planoNome: lic.plano.nome,
        competencia,
        valor: preco,
        vencimento,
        status: atrasada ? "ATRASADA" : "PENDENTE",
      },
    });
  }
}

// Aplica o preço com desconto às faturas ainda em aberto (PENDENTE/ATRASADA).
// Faturas pagas/canceladas ficam intactas. Chamado ao salvar a licença.
async function sincronizarDescontoFaturas(userId: string): Promise<void> {
  const lic = await prisma.licenca.findUnique({ where: { userId }, include: { plano: true } });
  if (!lic?.plano) return;
  const preco = precoComDesconto(Number(lic.plano.preco), lic.descontoTipo, Number(lic.descontoValor));
  await prisma.fatura.updateMany({
    where: { userId, status: { in: ["PENDENTE", "ATRASADA"] } },
    data: { valor: preco },
  });
}

export async function gerarFaturas(userId: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    await gerarFaturasInterno(userId);

    // Auto-envia o e-mail de cobrança APENAS das faturas do mês atual ou vencidas
    // (não das futuras — evita disparar 3 e-mails de uma vez) e só das que ainda
    // não tiveram envio bem-sucedido (emailStatus null/FALHA) — não reenvia em cada clique.
    const fimMes = new Date();
    fimMes.setMonth(fimMes.getMonth() + 1, 0);
    fimMes.setHours(23, 59, 59, 999);
    const aEnviar = await prisma.fatura.findMany({
      where: {
        userId,
        status: { in: ["PENDENTE", "ATRASADA"] },
        vencimento: { lte: fimMes },
        OR: [{ emailStatus: null }, { emailStatus: "FALHA" }],
      },
      select: { id: true },
    });
    for (const f of aEnviar) await enviarCobrancaFatura(f.id, false);

    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// Envia o e-mail de cobrança de uma fatura ao assinante e GRAVA o status do envio
// na própria fatura (emailStatus/emailEm/emailErro) p/ o badge no admin. Garante um
// tokenPublico p/ o link de pagamento (/pagar/[token]). `reenvio` diferencia o rótulo
// ENVIADO (1º envio, ao gerar) de REENVIADO (botão reenviar). Não lança: registra a
// falha na fatura e devolve o erro. Usado por gerarFaturas (auto) e reenviarEmailFatura.
async function enviarCobrancaFatura(faturaId: string, reenvio: boolean): Promise<Resultado> {
  const fatura = await prisma.fatura.findUnique({
    where: { id: faturaId },
    include: { user: { select: { nome: true, email: true } } },
  });
  if (!fatura) return { ok: false, erro: "Fatura não encontrada." };
  if (fatura.status === "PAGA" || fatura.status === "CANCELADA") {
    return { ok: false, erro: "Fatura já paga/cancelada — não há cobrança a enviar." };
  }
  const para = fatura.user.email?.trim();
  if (!para) return { ok: false, erro: "O assinante não tem e-mail cadastrado." };

  try {
    // Garante token público p/ o link de pagamento.
    let token = fatura.tokenPublico;
    if (!token) {
      token = randomUUID().replace(/-/g, "");
      await prisma.fatura.update({ where: { id: fatura.id }, data: { tokenPublico: token } });
    }

    const pagarUrl = `${await baseUrlServidor()}/pagar/${token}`;
    const logo = await logoBase64().catch(() => null);
    const html = htmlCobranca({
      nome: fatura.user.nome ?? para,
      plano: fatura.planoNome,
      valor: Number(fatura.valor),
      vencimento: fatura.vencimento,
      pagarUrl,
      atrasada: fatura.status === "ATRASADA",
      logoCid: logo ? LOGO_CID : undefined,
    });
    await enviarEmail({
      para,
      assunto: fatura.status === "ATRASADA"
        ? "Sua mensalidade Easy-NFe está em atraso"
        : "Sua mensalidade Easy-NFe está a vencer",
      html,
      anexos: logo ? [{ filename: "easy-nfe.png", content: logo, contentId: LOGO_CID }] : undefined,
    });
    await prisma.fatura.update({
      where: { id: fatura.id },
      data: { emailStatus: reenvio ? "REENVIADO" : "ENVIADO", emailEm: new Date(), emailErro: null },
    });
    return { ok: true, id: para };
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e);
    if (/RESEND_API_KEY/.test(msg)) msg = "Envio de e-mail não configurado no servidor.";
    await prisma.fatura.update({
      where: { id: fatura.id },
      data: { emailStatus: "FALHA", emailEm: new Date(), emailErro: msg.slice(0, 300) },
    }).catch(() => {});
    return { ok: false, erro: msg };
  }
}

// Reenvia manualmente (botão no admin) o e-mail de cobrança. Retorna o e-mail de
// destino em `id` p/ feedback na UI. Marca a fatura como REENVIADO/FALHA.
export async function reenviarEmailFatura(faturaId: string): Promise<Resultado> {
  await exigirAdmin();
  return enviarCobrancaFatura(faturaId, true);
}

export async function marcarFaturaPaga(input: {
  faturaId: string;
  data: string; // ISO (yyyy-mm-dd)
  metodo: string;
}): Promise<Resultado> {
  try {
    await exigirAdmin();
    await prisma.fatura.update({
      where: { id: input.faturaId },
      data: { status: "PAGA", pagaEm: input.data ? new Date(input.data) : new Date(), metodo: input.metodo },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function marcarFaturaPendente(faturaId: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    const f = await prisma.fatura.findUnique({ where: { id: faturaId } });
    if (!f) return { ok: false, erro: "Fatura não encontrada." };
    const atrasada = f.vencimento < new Date();
    await prisma.fatura.update({
      where: { id: faturaId },
      data: { status: atrasada ? "ATRASADA" : "PENDENTE", pagaEm: null, metodo: null },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function excluirFatura(id: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    await prisma.fatura.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Cobrança da assinatura via boleto (Asaas) — conta única do easy-nfe.
// ----------------------------------------------------------------------------
export type BoletoResultado =
  | { ok: true; bankSlipUrl: string | null; linhaDigitavel: string | null; invoiceUrl: string | null }
  | { ok: false; erro: string };

export async function gerarBoletoAssinatura(input: {
  userId: string;
  cpfCnpj: string;
  telefone?: string;
  competencia: string; // "2026-06"
  valor: number;
  vencimento: string; // "2026-06-10"
}): Promise<BoletoResultado> {
  try {
    await exigirAdmin();
    const { criarOuAtualizarCliente, criarCobrancaBoleto, obterLinhaDigitavel } = await import("@/lib/asaas");

    const cpf = input.cpfCnpj.replace(/\D/g, "");
    if (cpf.length !== 11 && cpf.length !== 14) {
      return { ok: false, erro: "CPF/CNPJ do assinante inválido." };
    }
    if (!(input.valor > 0)) return { ok: false, erro: "Valor inválido." };

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { licenca: { include: { plano: true } } },
    });
    if (!user) return { ok: false, erro: "Usuário não encontrado." };

    // Garante o cliente no Asaas (reaproveita o id salvo).
    const cliente = await criarOuAtualizarCliente({
      id: user.asaasCustomerId,
      nome: user.nome || user.email,
      cpfCnpj: cpf,
      email: user.email,
      telefone: input.telefone || user.telefone,
      externalReference: user.id,
    });

    const planoNome = user.licenca?.plano?.nome ?? "Assinatura Easy-NFe";
    const cobranca = await criarCobrancaBoleto({
      customer: cliente.id,
      value: input.valor,
      dueDate: input.vencimento,
      description: `${planoNome} — competência ${input.competencia}`,
      externalReference: `${user.id}:${input.competencia}`,
    });

    let linhaDigitavel: string | null = null;
    try {
      linhaDigitavel = (await obterLinhaDigitavel(cobranca.id)).identificationField;
    } catch {
      /* linha digitável pode demorar a ficar pronta — segue sem ela */
    }

    // Persiste dados do assinante + a fatura/boleto.
    await prisma.user.update({
      where: { id: user.id },
      data: { cpfCnpj: cpf, telefone: input.telefone || user.telefone, asaasCustomerId: cliente.id },
    });

    await prisma.fatura.upsert({
      where: { userId_competencia: { userId: user.id, competencia: input.competencia } },
      create: {
        userId: user.id, planoNome, competencia: input.competencia, valor: input.valor,
        vencimento: new Date(input.vencimento), status: "PENDENTE", metodo: "boleto",
        asaasPaymentId: cobranca.id, bankSlipUrl: cobranca.bankSlipUrl, invoiceUrl: cobranca.invoiceUrl, linhaDigitavel,
      },
      update: {
        valor: input.valor, vencimento: new Date(input.vencimento), metodo: "boleto",
        asaasPaymentId: cobranca.id, bankSlipUrl: cobranca.bankSlipUrl, invoiceUrl: cobranca.invoiceUrl, linhaDigitavel,
      },
    });

    return { ok: true, bankSlipUrl: cobranca.bankSlipUrl, linhaDigitavel, invoiceUrl: cobranca.invoiceUrl };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
