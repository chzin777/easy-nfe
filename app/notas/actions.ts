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
import type { Prisma } from "@/lib/generated/prisma/client";
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
      notaId?: string; // id da nota gravada (p/ abrir DANFE/baixar XML após emitir)
      avisoPersistencia?: string;
      debugXml?: string; // XML enviado (exposto só em rejeição, p/ diagnóstico)
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

    // Modelo do documento decidido pelo tipo de nota ("65-saida" → NFC-e).
    const modelo = input.tipoNota.startsWith("65") ? "65" : "55";
    const nfce = modelo === "65";

    // NFC-e exige CSC + idCSC (cIdToken) da SEFAZ para o QR Code.
    if (nfce && (!empresa.cscNFCe || !empresa.idCscNFCe)) {
      return {
        ok: false,
        erro: "NFC-e exige CSC e ID do CSC. Cadastre-os em Configurações › Emissão antes de emitir.",
      };
    }

    const cliente = await prisma.cliente.findFirst({ where: { id: input.clienteId, empresaId } });
    if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

    // NF-e modelo 55 exige endereço completo do destinatário (SEFAZ rejeita 225 sem ele).
    // NFC-e não exige: o consumidor é opcional e dispensa endereço.
    if (!nfce) {
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
    // NFC-e tem numeração e série próprias, separadas da NF-e 55.
    let numero = nfce ? empresa.proximoNumeroNFCe : empresa.proximoNumero;
    const serieDoc = nfce ? empresa.serieNFCe : empresa.serie;

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

    // NCM precisa ter 8 dígitos — senão a SEFAZ rejeita por schema (225).
    const ncmInvalido = itensNFe.find((it) => !/^\d{8}$/.test((it.ncm ?? "").replace(/\D/g, "")));
    if (ncmInvalido) {
      return {
        ok: false,
        erro: `Produto "${ncmInvalido.xProd}" está com NCM inválido (${ncmInvalido.ncm || "vazio"}). O NCM precisa ter 8 dígitos — corrija no cadastro do produto.`,
      };
    }

    const { pfxBase64, senha } = certDaEmpresa(empresa.certData);
    const cert = carregarCertificado(pfxBase64, senha);

    // Código IBGE do município (cMun) resolvido via API do IBGE — sem tabela local.
    // Usa o código já salvo na empresa quando válido; senão resolve pelo nome+UF.
    const cMunEmit = await resolverCodMunicipio(empresa.codMunicipio?.trim() || empresa.municipio, empresa.uf);
    const destUf = cliente.uf ?? empresa.uf;
    const cMunDest = await resolverCodMunicipio(cliente.municipio ?? empresa.municipio, destUf);

    // Destinatário: NF-e 55 sempre identificado e com endereço. NFC-e identifica o
    // consumidor só pelo documento/nome (sem endereço, indIEDest=9 não-contribuinte).
    // indIEDest: contribuinte (1) EXIGE IE no schema. Sem IE cadastrada, trata como
    // não contribuinte (9) para não estourar rejeição 225 (falha de schema).
    const ieDest = (cliente.inscricaoEstadual ?? "").replace(/\D/g, "");
    let indIEDest = cliente.tipoContribuinte || "9";
    if (indIEDest === "1" && !ieDest) indIEDest = "9";

    const dest: DadosNFe["dest"] = nfce
      ? {
          doc: cliente.documento,
          xNome: tpAmb === "2" ? HOMOLOG_XNOME : cliente.nome,
          indIEDest: "9",
          ender: { xLgr: "", nro: "", xBairro: "", municipio: "", uf: destUf, cep: "" },
        }
      : {
          doc: cliente.documento,
          xNome: tpAmb === "2" ? HOMOLOG_XNOME : cliente.nome,
          ie: indIEDest === "1" ? ieDest : undefined,
          indIEDest,
          ender: {
            xLgr: cliente.logradouro ?? "", nro: cliente.numero ?? "",
            xCpl: cliente.complemento || undefined, xBairro: cliente.bairro ?? "",
            municipio: cliente.municipio ?? empresa.municipio, uf: destUf,
            cMun: cMunDest, cep: cliente.cep ?? "",
          },
        };

    const dados: DadosNFe = {
      tpAmb,
      mod: modelo,
      cUF,
      serie: String(serieDoc),
      nNF: String(numero),
      natOp: "VENDA DE MERCADORIA",
      modFrete: input.modFrete || "9",
      infCpl: input.infCpl,
      csc: empresa.cscNFCe ?? undefined,
      idCsc: empresa.idCscNFCe ?? undefined,
      emit: {
        cnpj: empresa.cnpj,
        xNome: empresa.razaoSocial,
        xFant: empresa.nomeFantasia || undefined,
        ie: empresa.ie,
        crt: empresa.crt,
        ender: { ...endEmpresa(empresa), cMun: cMunEmit },
      },
      dest,
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
    let notaId: string | undefined;
    try {
      const [notaCriada] = await prisma.$transaction([
        prisma.nota.create({
          data: {
            numero,
            serie: serieDoc,
            modelo,
            qrCode: r.qrCode ?? null,
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
          ? [prisma.emitente.update({
              where: { id: empresa.id },
              data: nfce ? { proximoNumeroNFCe: numero + 1 } : { proximoNumero: numero + 1 },
            })]
          : []),
      ]);
      notaId = notaCriada.id;
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
      notaId,
      avisoPersistencia,
      debugXml: r.ok ? undefined : r.xmlEnviado,
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
  modelo: string; // "55" | "65"
  qrCode: string | null; // NFC-e
  tipoNota: string;
  naturezaOperacao: string;
  status: "autorizada" | "rascunho" | "cancelada" | "rejeitada" | "denegada";
  ambiente: "producao" | "homologacao";
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

// Inclui tudo que o DANFE precisa.
const INCLUDE_NOTA = {
  cliente: true, emitente: true, transportadora: true,
  itens: { include: { produto: true } },
} as const;

type NotaRow = Prisma.NotaGetPayload<{ include: typeof INCLUDE_NOTA }>;

function mapNota(n: NotaRow): NotaCompleta {
  return {
    id: n.id,
    numero: n.numero,
    serie: n.serie,
    modelo: n.modelo,
    qrCode: n.qrCode,
    tipoNota: n.tipoNota,
    naturezaOperacao: n.naturezaOperacao,
    status: STATUS_UI[n.status] ?? "rascunho",
    ambiente: n.ambiente === "PRODUCAO" ? "producao" : "homologacao",
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
  };
}

export async function listarNotas(): Promise<NotaCompleta[]> {
  const empresaId = await exigirEmpresa();
  const notas = await prisma.nota.findMany({
    where: { emitenteId: empresaId },
    orderBy: { emitidaEm: "desc" },
    include: INCLUDE_NOTA,
  });
  return notas.map(mapNota);
}

// Uma nota completa (p/ DANFE), escopada à empresa ativa. Usada após emitir.
export async function obterNota(notaId: string): Promise<NotaCompleta | null> {
  const empresaId = await exigirEmpresa();
  const n = await prisma.nota.findFirst({
    where: { id: notaId, emitenteId: empresaId },
    include: INCLUDE_NOTA,
  });
  return n ? mapNota(n) : null;
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

// XML autorizado (nfeProc) de uma nota, para download. Escopado à empresa ativa.
export async function obterXmlNota(notaId: string): Promise<{ ok: true; xml: string; nome: string } | { ok: false; erro: string }> {
  try {
    const empresaId = await exigirEmpresa();
    const nota = await prisma.nota.findFirst({ where: { id: notaId, emitenteId: empresaId }, select: { xmlAutorizado: true, chaveAcesso: true, numero: true } });
    if (!nota) return { ok: false, erro: "Nota não encontrada." };
    if (!nota.xmlAutorizado) return { ok: false, erro: "Esta nota não tem XML autorizado (não foi autorizada pela SEFAZ)." };
    return { ok: true, xml: nota.xmlAutorizado, nome: `${nota.chaveAcesso || nota.numero}.xml` };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
