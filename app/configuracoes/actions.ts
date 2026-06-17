"use server";

import forge from "node-forge";
import { prisma } from "@/lib/prisma";
import {
  exigirUsuario,
  exigirSessao,
  isAdminRole,
  empresaAtivaId,
  exigirEmpresa,
  limiteEmpresasDoUsuario,
  limiteEquipe,
} from "@/lib/empresa";
import { definirEmpresaAtiva, hashSenha } from "@/lib/auth";
import { codigoMunicipio } from "@/lib/nfe/municipios";
import { encriptar } from "@/lib/crypto";
import { temFeature } from "@/lib/permissoes";

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export type CertInfo = {
  ok: true;
  titular: string; // CN do certificado
  cnpj: string; // CNPJ extraído do CN (e-CNPJ) quando disponível
  emissor: string; // AC emissora
  validoDe: string; // ISO
  validoAte: string; // ISO
  expirado: boolean;
  diasRestantes: number;
};

export type CertErro = { ok: false; erro: string };

// Lê um certificado A1 (.pfx/.p12) e devolve os metadados.
// NÃO persiste o arquivo nem a senha — apenas inspeciona em memória.
export async function inspecionarCertificado(
  pfxBase64: string,
  senha: string,
): Promise<CertInfo | CertErro> {
  try {
    const der = forge.util.decode64(pfxBase64);
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bag = certBags[forge.pki.oids.certBag]?.[0];
    const cert = bag?.cert;
    if (!cert) {
      return { ok: false, erro: "Nenhum certificado encontrado no arquivo." };
    }

    const cn =
      (cert.subject.getField("CN")?.value as string | undefined) ?? "Desconhecido";
    const emissor =
      (cert.issuer.getField("CN")?.value as string | undefined) ?? "—";

    // e-CNPJ ICP-Brasil: CN no formato "RAZAO SOCIAL:00000000000000".
    const matchCnpj = cn.match(/:(\d{14})\s*$/);
    const cnpj = matchCnpj
      ? matchCnpj[1].replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : "";
    const titular = cn.replace(/:(\d{14})\s*$/, "").trim();

    const notBefore = cert.validity.notBefore;
    const notAfter = cert.validity.notAfter;
    const agora = Date.now();
    const diasRestantes = Math.floor((notAfter.getTime() - agora) / 86_400_000);

    return {
      ok: true,
      titular,
      cnpj,
      emissor,
      validoDe: notBefore.toISOString(),
      validoAte: notAfter.toISOString(),
      expirado: notAfter.getTime() < agora,
      diasRestantes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Senha incorreta normalmente estoura "Invalid password" / MAC verify failure.
    if (/password|mac|integrity/i.test(msg)) {
      return { ok: false, erro: "Senha do certificado incorreta." };
    }
    return { ok: false, erro: "Arquivo inválido ou não é um certificado A1 (.pfx)." };
  }
}

// ----------------------------------------------------------------------------
// Empresas (emitentes) — CRUD escopado ao usuário logado + empresa ativa.
// ----------------------------------------------------------------------------

export type EnderecoForm = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
};

export type EmpresaDados = {
  id?: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  crt: string;
  telefone: string;
  email: string;
  endereco: EnderecoForm;
  ambiente: "homologacao" | "producao";
  serie: string;
  proximoNumero: string;
};

export type EmpresaResumo = { id: string; razaoSocial: string; cnpj: string; ativa: boolean };

export async function listarEmpresas(): Promise<EmpresaResumo[]> {
  const { uid, role } = await exigirSessao();
  const ativaId = await empresaAtivaId();

  // Admin/suporte enxergam todas as empresas do sistema.
  if (isAdminRole(role)) {
    const rows = await prisma.emitente.findMany({
      orderBy: { razaoSocial: "asc" },
      select: { id: true, razaoSocial: true, cnpj: true },
    });
    return rows.map((e) => ({ ...e, ativa: e.id === ativaId }));
  }

  const acessos = await prisma.acessoEmpresa.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "asc" },
    include: { empresa: { select: { id: true, razaoSocial: true, cnpj: true } } },
  });
  return acessos.map((a) => ({
    id: a.empresa.id,
    razaoSocial: a.empresa.razaoSocial,
    cnpj: a.empresa.cnpj,
    ativa: a.empresa.id === ativaId,
  }));
}

export async function obterEmpresaAtiva(): Promise<EmpresaDados | null> {
  const id = await empresaAtivaId(); // já valida acesso do usuário
  if (!id) return null;
  const e = await prisma.emitente.findUnique({ where: { id } });
  if (!e) return null;
  return {
    id: e.id,
    razaoSocial: e.razaoSocial,
    nomeFantasia: e.nomeFantasia ?? "",
    cnpj: e.cnpj,
    inscricaoEstadual: e.ie,
    crt: e.crt,
    telefone: e.telefone ?? "",
    email: e.email ?? "",
    endereco: {
      cep: e.cep,
      logradouro: e.logradouro,
      numero: e.numero,
      complemento: e.complemento ?? "",
      bairro: e.bairro,
      municipio: e.municipio,
      uf: e.uf,
    },
    ambiente: e.ambiente === "PRODUCAO" ? "producao" : "homologacao",
    serie: String(e.serie),
    proximoNumero: String(e.proximoNumero),
  };
}

function resolverCodMunicipio(municipio: string): string {
  try {
    return codigoMunicipio(municipio);
  } catch {
    return "";
  }
}

// Cria (sem id) ou atualiza (com id) a empresa. Sempre define como ativa. Devolve o id.
export async function salvarEmpresa(dados: EmpresaDados): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  try {
    const userId = await exigirUsuario();
    if (!dados.razaoSocial.trim() || !dados.cnpj.trim()) {
      return { ok: false, erro: "Razão social e CNPJ são obrigatórios." };
    }
    const dadosBase = {
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia || null,
      cnpj: dados.cnpj.replace(/\D/g, ""),
      ie: dados.inscricaoEstadual.replace(/\D/g, ""),
      crt: dados.crt,
      cep: dados.endereco.cep.replace(/\D/g, ""),
      logradouro: dados.endereco.logradouro,
      numero: dados.endereco.numero,
      complemento: dados.endereco.complemento || null,
      bairro: dados.endereco.bairro,
      codMunicipio: resolverCodMunicipio(dados.endereco.municipio),
      municipio: dados.endereco.municipio,
      uf: dados.endereco.uf,
      telefone: dados.telefone || null,
      email: dados.email || null,
      ambiente: dados.ambiente === "producao" ? ("PRODUCAO" as const) : ("HOMOLOGACAO" as const),
      serie: Number(dados.serie) || 1,
      proximoNumero: Number(dados.proximoNumero) || 1,
    };

    const { role } = await exigirSessao();
    const admin = isAdminRole(role);

    let id: string;
    if (dados.id) {
      // Edição: admin edita qualquer empresa; usuário comum só as que tem acesso.
      if (!admin) {
        const acesso = await prisma.acessoEmpresa.findUnique({
          where: { userId_empresaId: { userId, empresaId: dados.id } },
          select: { id: true },
        });
        if (!acesso) return { ok: false, erro: "Empresa não encontrada." };
      }
      await prisma.emitente.update({ where: { id: dados.id }, data: dadosBase });
      id = dados.id;
    } else {
      // Nova empresa própria: usuário comum respeita o limite do plano.
      if (!admin) {
        const lim = await limiteEmpresasDoUsuario(userId);
        // Sem o benefício "multiempresa", o teto é 1 — independente do limite do plano.
        const temMulti = await temFeature("multiempresa");
        const limiteEfetivo = temMulti ? lim.limite : 1;
        const podeAdicionar = limiteEfetivo < 0 || lim.usadas < limiteEfetivo;
        if (!podeAdicionar) {
          return {
            ok: false,
            erro: temMulti
              ? `Seu plano permite ${lim.limite} empresa(s) e você já tem ${lim.usadas}. Faça upgrade para adicionar mais.`
              : "Seu plano permite apenas 1 empresa. Faça upgrade para multiempresa.",
          };
        }
      }
      const criada = await prisma.emitente.create({ data: { userId, ...dadosBase } });
      await prisma.acessoEmpresa.create({
        data: { userId, empresaId: criada.id, papel: "dono" },
      });
      id = criada.id;
    }
    await definirEmpresaAtiva(id);
    return { ok: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint|already exists/i.test(msg)) {
      return { ok: false, erro: "Você já tem uma empresa com este CNPJ." };
    }
    return { ok: false, erro: msg };
  }
}

// ----------------------------------------------------------------------------
// Certificado A1 — armazenado criptografado (AES-256-GCM) na empresa ativa.
// ----------------------------------------------------------------------------

export type CertStatus = {
  temCert: boolean;
  titular?: string;
  validoAte?: string;
  expirado?: boolean;
  diasRestantes?: number;
};

export async function salvarCertificado(
  pfxBase64: string,
  senha: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const empresaId = await exigirEmpresa();
  const info = await inspecionarCertificado(pfxBase64, senha);
  if (!info.ok) return { ok: false, erro: info.erro };

  // Trava de segurança: o CNPJ do certificado deve bater com o da empresa.
  const empresa = await prisma.emitente.findUniqueOrThrow({ where: { id: empresaId }, select: { cnpj: true } });
  const cnpjCert = (info.cnpj || "").replace(/\D/g, "");
  const cnpjEmpresa = empresa.cnpj.replace(/\D/g, "");
  if (cnpjCert && cnpjEmpresa && cnpjCert !== cnpjEmpresa) {
    return {
      ok: false,
      erro: `O certificado é do CNPJ ${info.cnpj}, mas esta empresa é ${cnpjEmpresa}. Use o certificado correto.`,
    };
  }

  const blob = encriptar(JSON.stringify({ pfxBase64, senha }));
  await prisma.emitente.update({
    where: { id: empresaId },
    data: { certData: blob, certTitular: info.titular, certValidoAte: new Date(info.validoAte) },
  });
  return { ok: true };
}

export async function removerCertificado(): Promise<void> {
  const empresaId = await exigirEmpresa();
  await prisma.emitente.update({
    where: { id: empresaId },
    data: { certData: null, certTitular: null, certValidoAte: null },
  });
}

export async function obterCertificado(): Promise<CertStatus> {
  const empresaId = await empresaAtivaId();
  if (!empresaId) return { temCert: false };
  const e = await prisma.emitente.findUnique({
    where: { id: empresaId },
    select: { certData: true, certTitular: true, certValidoAte: true },
  });
  if (!e?.certData) return { temCert: false };
  const validoAte = e.certValidoAte ?? null;
  const diasRestantes = validoAte ? Math.floor((validoAte.getTime() - Date.now()) / 86_400_000) : 0;
  return {
    temCert: true,
    titular: e.certTitular ?? "—",
    validoAte: validoAte?.toISOString(),
    expirado: validoAte ? validoAte.getTime() < Date.now() : false,
    diasRestantes,
  };
}

// ----------------------------------------------------------------------------
// Equipe (multiusuário) — membros da empresa ativa, limitado pelo plano.
// ----------------------------------------------------------------------------

export type MembroEquipe = { userId: string; email: string; nome: string; papel: string; voce: boolean };
export type EquipeInfo = {
  membros: MembroEquipe[];
  limite: number; // -1 = ilimitado
  usados: number;
  podeAdicionar: boolean;
  permitido: boolean; // plano permite equipe (>1 ou ilimitado)
};

async function exigirDono(uid: string, role: string, empresaId: string) {
  if (isAdminRole(role)) return; // admin/suporte gerenciam qualquer empresa
  const acesso = await prisma.acessoEmpresa.findUnique({
    where: { userId_empresaId: { userId: uid, empresaId } },
    select: { papel: true },
  });
  if (!acesso || acesso.papel !== "dono") throw new Error("Apenas o dono da empresa gerencia a equipe.");
}

export async function listarEquipe(): Promise<EquipeInfo> {
  const { uid, role } = await exigirSessao();
  const empresaId = await exigirEmpresa();
  const acessos = await prisma.acessoEmpresa.findMany({
    where: { empresaId },
    include: { user: { select: { id: true, email: true, nome: true } } },
    orderBy: { createdAt: "asc" },
  });
  const admin = isAdminRole(role);
  const lim = await limiteEquipe(uid, empresaId);
  // Admin/suporte: equipe sempre liberada, sem limite.
  const limite = admin ? -1 : lim.limite;
  return {
    membros: acessos.map((a) => ({
      userId: a.user.id,
      email: a.user.email,
      nome: a.user.nome ?? "",
      papel: a.papel,
      voce: a.user.id === uid,
    })),
    limite,
    usados: lim.usados,
    podeAdicionar: admin || lim.podeAdicionar,
    permitido: admin || limite < 0 || limite > 1,
  };
}

export async function adicionarMembro(input: {
  email: string;
  nome: string;
  senha: string;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const { uid, role } = await exigirSessao();
    const empresaId = await exigirEmpresa();
    await exigirDono(uid, role, empresaId);

    if (!isAdminRole(role)) {
      const lim = await limiteEquipe(uid, empresaId);
      const permitido = lim.limite < 0 || lim.limite > 1;
      if (!permitido) return { ok: false, erro: "Seu plano não inclui equipe. Faça upgrade para adicionar usuários." };
      if (!lim.podeAdicionar) return { ok: false, erro: `Seu plano permite ${lim.limite} membro(s) por empresa e você já tem ${lim.usados}.` };
    }

    const email = input.email.trim().toLowerCase();
    if (!emailValido(email)) return { ok: false, erro: "E-mail inválido." };

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (input.senha.length < 8) return { ok: false, erro: "Senha do novo usuário deve ter ao menos 8 caracteres." };
      user = await prisma.user.create({
        data: { email, nome: input.nome || null, senhaHash: await hashSenha(input.senha), role: "USER" },
      });
    }

    const jaTem = await prisma.acessoEmpresa.findUnique({
      where: { userId_empresaId: { userId: user.id, empresaId } },
    });
    if (jaTem) return { ok: false, erro: "Esse usuário já tem acesso a esta empresa." };

    await prisma.acessoEmpresa.create({ data: { userId: user.id, empresaId, papel: "membro" } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function removerMembro(userId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const { uid, role } = await exigirSessao();
    const empresaId = await exigirEmpresa();
    await exigirDono(uid, role, empresaId);
    // Não remove o dono.
    await prisma.acessoEmpresa.deleteMany({ where: { userId, empresaId, papel: { not: "dono" } } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function trocarEmpresa(id: string): Promise<void> {
  const { uid, role } = await exigirSessao();
  if (isAdminRole(role)) {
    const ok = await prisma.emitente.findUnique({ where: { id }, select: { id: true } });
    if (ok) await definirEmpresaAtiva(id);
    return;
  }
  const ok = await prisma.acessoEmpresa.findUnique({
    where: { userId_empresaId: { userId: uid, empresaId: id } },
    select: { id: true },
  });
  if (ok) await definirEmpresaAtiva(id);
}
