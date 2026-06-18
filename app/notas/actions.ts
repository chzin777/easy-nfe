"use server";

import {
  carregarCertificado,
  emitirNFe,
  cancelarNFe,
  consultarStatus,
} from "@/lib/nfe";
import type { DadosNFe, EnderecoNFe } from "@/lib/nfe/types";
import { resolverCodMunicipio } from "@/lib/nfe/ibge";
import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { decriptar } from "@/lib/crypto";
import { estadoLicencaUsuario } from "@/lib/licenca";
import { exigirFeature } from "@/lib/permissoes";

// Carrega o certificado A1 (PFX+senha) armazenado criptografado na empresa.
function certDaEmpresa(certData: string | null): { pfxBase64: string; senha: string } {
  if (!certData) {
    throw new Error("Certificado não configurado. Envie o A1 em Configurações › Certificado.");
  }
  return JSON.parse(decriptar(certData)) as { pfxBase64: string; senha: string };
}

// Código IBGE da UF (cUF). Necessário na chave de acesso e no cMunFG.
const UF_IBGE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

// Razão social obrigatória do destinatário em homologação.
const HOMOLOG_XNOME = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";

function endEmpresa(e: {
  logradouro: string; numero: string; complemento: string | null; bairro: string;
  municipio: string; uf: string; cep: string; telefone?: string | null;
}): EnderecoNFe {
  return {
    xLgr: e.logradouro, nro: e.numero, xCpl: e.complemento || undefined,
    xBairro: e.bairro, municipio: e.municipio, uf: e.uf, cep: e.cep,
    fone: e.telefone || undefined,
  };
}

export type EmitirInput = {
  clienteId: string;
  transportadoraId: string | null;
  tipoNota: string;
  modFrete: string; // 0-4, 9 (NT 2016.002)
  infCpl?: string;
  itens: { produtoId: string; quantidade: number }[];
};

export type EmitirResultado =
  | {
      ok: true;
      autorizada: boolean;
      cStat: string | null;
      xMotivo: string | null;
      chave: string;
      nProt: string | null;
      numero: number;
      avisoPersistencia?: string;
    }
  | { ok: false; erro: string; codigo?: string; clienteId?: string };

// Emite a NF-e da empresa ativa. Resolve emitente, cliente e produtos do banco —
// o cliente só envia ids + o certificado (que vive apenas na sessão do navegador).
export async function emitirNota(input: EmitirInput): Promise<EmitirResultado> {
  try {
    await exigirFeature("emitir_nfe");
    const lic = await estadoLicencaUsuario();
    if (lic.bloqueado) return { ok: false, erro: lic.mensagem ?? "Licença expirada — emissão bloqueada." };

    const empresaId = await exigirEmpresa();
    const empresa = await prisma.emitente.findUniqueOrThrow({ where: { id: empresaId } });
    const cUF = UF_IBGE[empresa.uf];
    if (!cUF) return { ok: false, erro: `UF do emitente inválida: ${empresa.uf}` };

    const cliente = await prisma.cliente.findFirst({ where: { id: input.clienteId, empresaId } });
    if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

    // NF-e modelo 55 exige endereço completo do destinatário (SEFAZ rejeita 225 sem ele).
    const camposEnd: [string, string | null][] = [
      ["logradouro", cliente.logradouro], ["número", cliente.numero], ["bairro", cliente.bairro],
      ["município", cliente.municipio], ["UF", cliente.uf], ["CEP", cliente.cep],
    ];
    const faltando = camposEnd.filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
    if (faltando.length) {
      return {
        ok: false,
        codigo: "endereco_dest",
        clienteId: cliente.id,
        erro: `Complete o endereço do cliente "${cliente.nome}" antes de emitir (faltando: ${faltando.join(", ")}). A NF-e modelo 55 exige o endereço do destinatário.`,
      };
    }

    if (input.itens.length === 0) return { ok: false, erro: "A nota não tem itens." };
    const produtos = await prisma.produto.findMany({
      where: { empresaId, id: { in: input.itens.map((i) => i.produtoId) } },
    });
    const porId = new Map(produtos.map((p) => [p.id, p]));

    const transp = input.transportadoraId
      ? await prisma.transportadora.findFirst({ where: { id: input.transportadoraId, empresaId } })
      : null;

    const tpAmb = empresa.ambiente === "PRODUCAO" ? "1" : "2";
    let numero = empresa.proximoNumero;

    const itensNFe = input.itens.map((i) => {
      const p = porId.get(i.produtoId);
      if (!p) throw new Error("Produto não encontrado na empresa.");
      return {
        cProd: String(p.codigoInterno),
        cEAN: p.codigoBarras || "SEM GTIN",
        xProd: p.nome,
        ncm: p.ncm,
        cfop: p.cfopPadrao || "5102",
        uCom: p.unidade,
        qCom: i.quantidade,
        vUnCom: Number(p.preco),
        orig: p.origem,
        cest: p.cest || undefined,
      };
    });

    const { pfxBase64, senha } = certDaEmpresa(empresa.certData);
    const cert = carregarCertificado(pfxBase64, senha);

    // Código IBGE do município (cMun) resolvido via API do IBGE — sem tabela local.
    // Usa o código já salvo na empresa quando válido; senão resolve pelo nome+UF.
    const cMunEmit = await resolverCodMunicipio(empresa.codMunicipio?.trim() || empresa.municipio, empresa.uf);
    const destUf = cliente.uf ?? empresa.uf;
    const cMunDest = await resolverCodMunicipio(cliente.municipio ?? empresa.municipio, destUf);

    const dados: DadosNFe = {
      tpAmb,
      cUF,
      serie: String(empresa.serie),
      nNF: String(numero),
      natOp: "VENDA DE MERCADORIA",
      modFrete: input.modFrete || "9",
      infCpl: input.infCpl,
      emit: {
        cnpj: empresa.cnpj,
        xNome: empresa.razaoSocial,
        xFant: empresa.nomeFantasia || undefined,
        ie: empresa.ie,
        crt: empresa.crt,
        ender: { ...endEmpresa(empresa), cMun: cMunEmit },
      },
      dest: {
        doc: cliente.documento,
        xNome: tpAmb === "2" ? HOMOLOG_XNOME : cliente.nome,
        ie: cliente.inscricaoEstadual ?? undefined,
        indIEDest: cliente.tipoContribuinte || "9",
        ender: {
          xLgr: cliente.logradouro ?? "", nro: cliente.numero ?? "",
          xCpl: cliente.complemento || undefined, xBairro: cliente.bairro ?? "",
          municipio: cliente.municipio ?? empresa.municipio, uf: destUf,
          cMun: cMunDest, cep: cliente.cep ?? "",
        },
      },
      itens: itensNFe,
    };

    // Auto-correção de numeração: a SEFAZ não expõe "último número emitido", então
    // ao receber 539 (duplicidade — número já usado, ex.: notas de outro sistema)
    // avança o nNF e tenta de novo. Salto exponencial cobre gaps grandes em poucas
    // tentativas; gaps na numeração são fiscalmente permitidos.
    let r = await emitirNFe(cert, dados);
    let salto = 1;
    let tentativas = 0;
    while (!r.ok && r.cStat === "539" && tentativas < 25) {
      numero += salto;
      salto *= 2;
      tentativas++;
      dados.nNF = String(numero);
      r = await emitirNFe(cert, dados);
    }

    const valorTotal = itensNFe.reduce((s, it) => s + it.qCom * it.vUnCom, 0);

    let avisoPersistencia: string | undefined;
    try {
      await prisma.$transaction([
        prisma.nota.create({
          data: {
            numero,
            serie: empresa.serie,
            modelo: "55",
            naturezaOperacao: "VENDA DE MERCADORIA",
            tipoNota: input.tipoNota,
            emitenteId: empresa.id,
            clienteId: cliente.id,
            transportadoraId: transp?.id ?? null,
            informacoesAdicionais: input.infCpl || null,
            status: r.ok ? "AUTORIZADA" : "REJEITADA",
            ambiente: empresa.ambiente,
            valorTotal,
            chaveAcesso: r.chave,
            protocolo: r.nProt,
            autorizadaEm: r.ok ? new Date() : null,
            xmlAutorizado: r.xmlAutorizado,
            cStat: r.cStat,
            xMotivo: r.xMotivo,
            itens: {
              create: itensNFe.map((it, idx) => ({
                produtoId: input.itens[idx].produtoId,
                nome: it.xProd, ncm: it.ncm, cfop: it.cfop, unidade: it.uCom,
                quantidade: it.qCom, precoUnitario: it.vUnCom, valorTotal: it.qCom * it.vUnCom,
              })),
            },
          },
        }),
        // Avança a numeração quando autorizada (próximo número) ou quando a busca
        // por duplicidade esgotou (continua acima da faixa ocupada). Em outras
        // rejeições mantém o número para reemitir após corrigir a causa.
        ...(r.ok || r.cStat === "539"
          ? [prisma.emitente.update({ where: { id: empresa.id }, data: { proximoNumero: numero + 1 } })]
          : []),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      avisoPersistencia = r.ok ? `Autorizada na SEFAZ, mas falhou ao gravar: ${msg}` : undefined;
    }

    return {
      ok: true,
      autorizada: r.ok,
      cStat: r.cStat,
      xMotivo: r.xMotivo,
      chave: r.chave,
      nProt: r.nProt,
      numero,
      avisoPersistencia,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}

export type StatusResultado =
  | { ok: boolean; cStat: string | null; xMotivo: string | null }
  | { ok: false; erro: string };

export async function checarStatusSefaz(): Promise<StatusResultado> {
  try {
    const empresaId = await exigirEmpresa();
    const empresa = await prisma.emitente.findUniqueOrThrow({ where: { id: empresaId } });
    const cUF = UF_IBGE[empresa.uf];
    if (!cUF) return { ok: false, erro: `UF inválida: ${empresa.uf}` };
    const { pfxBase64, senha } = certDaEmpresa(empresa.certData);
    const cert = carregarCertificado(pfxBase64, senha);
    const r = await consultarStatus(cert, empresa.ambiente === "PRODUCAO" ? "1" : "2", cUF);
    return { ok: r.ok, cStat: r.cStat, xMotivo: r.xMotivo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}

// ----------------------------------------------------------------------------
// Listagem (com dados completos p/ DANFE) — escopada à empresa ativa.
// ----------------------------------------------------------------------------

type EnderecoUI = {
  cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; municipio: string; uf: string;
};

export type NotaCompleta = {
  id: string;
  numero: number;
  serie: number;
  tipoNota: string;
  naturezaOperacao: string;
  status: "autorizada" | "rascunho" | "cancelada" | "rejeitada" | "denegada";
  emitidaEm: string;
  valorTotal: number;
  chaveAcesso: string;
  protocolo: string | null;
  informacoesAdicionais: string;
  clienteNome: string;
  emitenteCnpj: string;
  emitenteUf: string;
  emitente: {
    razaoSocial: string; nomeFantasia: string; cnpj: string; ie: string;
    telefone: string; endereco: EnderecoUI;
  };
  cliente: {
    nome: string; documento: string; ie: string; telefone: string; endereco: EnderecoUI;
  };
  transportadora: {
    nome: string; documento: string; tipoTransporte: string; ie: string; endereco: EnderecoUI;
  } | null;
  itens: {
    codigo: string; nome: string; ncm: string; cfop: string;
    unidade: string; quantidade: number; precoUnitario: number;
  }[];
};

const STATUS_UI: Record<string, NotaCompleta["status"]> = {
  RASCUNHO: "rascunho", AUTORIZADA: "autorizada", CANCELADA: "cancelada",
  REJEITADA: "rejeitada", DENEGADA: "denegada",
};

const fmtMasc = (cep: string | null) => cep ?? "";

export async function listarNotas(): Promise<NotaCompleta[]> {
  const empresaId = await exigirEmpresa();
  const notas = await prisma.nota.findMany({
    where: { emitenteId: empresaId },
    orderBy: { emitidaEm: "desc" },
    include: { cliente: true, emitente: true, transportadora: true, itens: { include: { produto: true } } },
  });
  return notas.map((n) => ({
    id: n.id,
    numero: n.numero,
    serie: n.serie,
    tipoNota: n.tipoNota,
    naturezaOperacao: n.naturezaOperacao,
    status: STATUS_UI[n.status] ?? "rascunho",
    emitidaEm: n.emitidaEm.toISOString(),
    valorTotal: Number(n.valorTotal),
    chaveAcesso: n.chaveAcesso ?? "",
    protocolo: n.protocolo,
    informacoesAdicionais: n.informacoesAdicionais ?? "",
    clienteNome: n.cliente.nome,
    emitenteCnpj: n.emitente.cnpj,
    emitenteUf: n.emitente.uf,
    emitente: {
      razaoSocial: n.emitente.razaoSocial,
      nomeFantasia: n.emitente.nomeFantasia ?? n.emitente.razaoSocial,
      cnpj: n.emitente.cnpj,
      ie: n.emitente.ie,
      telefone: n.emitente.telefone ?? "",
      endereco: {
        cep: n.emitente.cep, logradouro: n.emitente.logradouro, numero: n.emitente.numero,
        complemento: n.emitente.complemento ?? "", bairro: n.emitente.bairro,
        municipio: n.emitente.municipio, uf: n.emitente.uf,
      },
    },
    cliente: {
      nome: n.cliente.nome, documento: n.cliente.documento, ie: n.cliente.inscricaoEstadual ?? "",
      telefone: n.cliente.telefone ?? "",
      endereco: {
        cep: fmtMasc(n.cliente.cep), logradouro: n.cliente.logradouro ?? "", numero: n.cliente.numero ?? "",
        complemento: n.cliente.complemento ?? "", bairro: n.cliente.bairro ?? "",
        municipio: n.cliente.municipio ?? "", uf: n.cliente.uf ?? "",
      },
    },
    transportadora: n.transportadora
      ? {
          nome: n.transportadora.nome, documento: n.transportadora.documento,
          tipoTransporte: n.transportadora.tipoTransporte, ie: n.transportadora.inscricaoEstadual ?? "",
          endereco: {
            cep: fmtMasc(n.transportadora.cep), logradouro: n.transportadora.logradouro ?? "",
            numero: n.transportadora.numero ?? "", complemento: n.transportadora.complemento ?? "",
            bairro: n.transportadora.bairro ?? "", municipio: n.transportadora.municipio ?? "",
            uf: n.transportadora.uf ?? "",
          },
        }
      : null,
    itens: n.itens.map((i) => ({
      codigo: i.produto ? String(i.produto.codigoInterno) : "—",
      nome: i.nome, ncm: i.ncm ?? "", cfop: i.cfop ?? "",
      unidade: i.unidade ?? "UN", quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario),
    })),
  }));
}

// ----------------------------------------------------------------------------
// Cancelamento (evento 110111) + atualização no banco.
// ----------------------------------------------------------------------------

export type CancelarInput = {
  justificativa: string;
  notaId: string;
};

export type CancelarResultado =
  | { ok: boolean; cStat: string | null; xMotivo: string | null; nProt: string | null }
  | { ok: false; erro: string };

export async function cancelarNota(input: CancelarInput): Promise<CancelarResultado> {
  try {
    await exigirFeature("nota_cancelar");
    const empresaId = await exigirEmpresa();
    if (input.justificativa.trim().length < 15) {
      return { ok: false, erro: "Justificativa deve ter ao menos 15 caracteres." };
    }
    const nota = await prisma.nota.findFirst({
      where: { id: input.notaId, emitenteId: empresaId },
      include: { emitente: true },
    });
    if (!nota || !nota.chaveAcesso || !nota.protocolo) {
      return { ok: false, erro: "Nota não encontrada ou sem protocolo de autorização." };
    }
    const cUF = UF_IBGE[nota.emitente.uf];
    if (!cUF) return { ok: false, erro: `UF inválida: ${nota.emitente.uf}` };

    const { pfxBase64, senha } = certDaEmpresa(nota.emitente.certData);
    const cert = carregarCertificado(pfxBase64, senha);
    const r = await cancelarNFe(cert, {
      tpAmb: nota.ambiente === "PRODUCAO" ? "1" : "2",
      cUF,
      cnpj: nota.emitente.cnpj,
      chave: nota.chaveAcesso,
      nProt: nota.protocolo,
      justificativa: input.justificativa,
    });

    if (r.ok) {
      await prisma.nota.update({
        where: { id: nota.id },
        data: {
          status: "CANCELADA",
          protocoloCancelamento: r.nProt,
          justificativaCancelamento: input.justificativa,
          canceladaEm: new Date(),
        },
      });
    }
    return { ok: r.ok, cStat: r.cStat, xMotivo: r.xMotivo, nProt: r.nProt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}
