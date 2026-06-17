"use server";

import { prisma } from "@/lib/prisma";
import { exigirAdmin, exigirAdminMaster } from "@/lib/admin";
import { hashSenha } from "@/lib/auth";
import { codigoMunicipio } from "@/lib/nfe/municipios";

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ----------------------------------------------------------------------------
// Usuários
// ----------------------------------------------------------------------------
export type UsuarioResumo = {
  id: string;
  email: string;
  nome: string;
  role: "USER" | "SUPORTE" | "ADMIN";
  ativo: boolean;
  plano: string | null;
  statusLicenca: string | null;
  validadeEm: string | null;
  empresas: number;
  criadoEm: string;
};

export async function listarUsuarios(): Promise<UsuarioResumo[]> {
  await exigirAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { licenca: { include: { plano: true } }, _count: { select: { acessos: true } } },
  });
  return users.map((u) => ({
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
  }));
}

export type UsuarioDetalhe = {
  id: string;
  email: string;
  nome: string;
  role: "USER" | "SUPORTE" | "ADMIN";
  ativo: boolean;
  criadoEm: string;
  licenca: { planoId: string | null; plano: string | null; status: string; validadeEm: string | null } | null;
  empresas: { id: string; razaoSocial: string; cnpj: string; papel: string }[];
  faturas: { id: string; planoNome: string; competencia: string; valor: number; vencimento: string; status: string; pagaEm: string | null; metodo: string | null }[];
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
    criadoEm: u.createdAt.toISOString(),
    licenca: u.licenca
      ? {
          planoId: u.licenca.planoId,
          plano: u.licenca.plano?.nome ?? null,
          status: u.licenca.status,
          validadeEm: u.licenca.validadeEm?.toISOString() ?? null,
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
    })),
  };
}

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

export async function criarUsuario(input: {
  email: string;
  senha: string;
  nome: string;
  role: "USER" | "SUPORTE" | "ADMIN";
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
      data: { email, senhaHash: await hashSenha(input.senha), nome: input.nome || null, role: input.role },
    });

    // Usuários comuns ganham trial de 7 dias no plano mais básico (menor ordem).
    if (input.role === "USER") {
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
  input: { nome: string; email: string; role: "USER" | "SUPORTE" | "ADMIN"; ativo: boolean },
): Promise<Resultado> {
  try {
    if (input.role === "ADMIN" || input.role === "SUPORTE") await exigirAdminMaster();
    else await exigirAdmin();

    const email = input.email.trim().toLowerCase();
    if (!emailValido(email)) return { ok: false, erro: "E-mail inválido." };
    const dono = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (dono && dono.id !== userId) return { ok: false, erro: "E-mail já usado por outro usuário." };

    await prisma.user.update({
      where: { id: userId },
      data: { nome: input.nome || null, email, role: input.role, ativo: input.ativo },
    });
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
  periodicidade: string;
  limiteEmpresas: number;
  limiteUsuarios: number;
  recursos: string[];
  ativo: boolean;
  ordem: number;
};

export async function listarPlanos(): Promise<Required<PlanoDados>[]> {
  await exigirAdmin();
  const rows = await prisma.plano.findMany({ orderBy: { ordem: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? "",
    preco: Number(p.preco),
    periodicidade: p.periodicidade,
    limiteEmpresas: p.limiteEmpresas,
    limiteUsuarios: p.limiteUsuarios,
    recursos: p.recursos,
    ativo: p.ativo,
    ordem: p.ordem,
  }));
}

export async function salvarPlano(dados: PlanoDados): Promise<Resultado> {
  try {
    await exigirAdmin();
    if (!dados.nome.trim()) return { ok: false, erro: "Nome do plano é obrigatório." };
    const data = {
      nome: dados.nome,
      descricao: dados.descricao || null,
      preco: dados.preco,
      periodicidade: dados.periodicidade,
      limiteEmpresas: dados.limiteEmpresas,
      limiteUsuarios: dados.limiteUsuarios,
      recursos: dados.recursos.filter((r) => r.trim()),
      ativo: dados.ativo,
      ordem: dados.ordem,
    };
    if (dados.id) {
      await prisma.plano.update({ where: { id: dados.id }, data });
      return { ok: true, id: dados.id };
    }
    const p = await prisma.plano.create({ data });
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
}): Promise<Resultado> {
  try {
    await exigirAdmin();
    const validade = input.validadeEm ? new Date(input.validadeEm) : null;
    await prisma.licenca.upsert({
      where: { userId: input.userId },
      update: { planoId: input.planoId, status: input.status, validadeEm: validade },
      create: { userId: input.userId, planoId: input.planoId, status: input.status, validadeEm: validade },
    });
    // Gera as faturas dos períodos cobertos pelo plano/validade.
    await gerarFaturasInterno(input.userId);
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

  const preco = Number(lic.plano.preco);
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

export async function gerarFaturas(userId: string): Promise<Resultado> {
  try {
    await exigirAdmin();
    await gerarFaturasInterno(userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
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
