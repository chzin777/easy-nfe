"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import { decriptar } from "@/lib/crypto";
import { carregarCertificado } from "@/lib/nfe/cert";
import { cancelarNfse, consultarPorDps, emitirNfse } from "@/lib/nfse/client";
import type { MotivoCancelamento } from "@/lib/nfse/evento";
import { resolverCodMunicipio } from "@/lib/nfe/ibge";
import { dataBrasilia, valoresAplicados } from "@/lib/nfse/xml";
import type { AmbienteNFSe } from "@/lib/nfse/types";
import { montarDadosDps } from "@/lib/nfse/dps";

// Emissão de NFS-e no Padrão Nacional.
//
// Uma DPS = uma NFS-e = um serviço. Não há "itens" como na NF-e: o documento
// descreve um serviço prestado, com um valor. Quem quiser cobrar três coisas
// emite três notas ou descreve tudo num serviço só.

function certDaEmpresa(certData: string | null): { pfxBase64: string; senha: string } {
  if (!certData) {
    throw new Error("Certificado não configurado. Envie o A1 em Configurações › Certificado.");
  }
  return JSON.parse(decriptar(certData)) as { pfxBase64: string; senha: string };
}

const so = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export type EmitirNfseInput = {
  clienteId: string;
  servicoId: string | null;
  descricao: string;
  cTribNac: string;
  cNBS: string;
  valorServico: number;
  aliqISS: number;
  // 1 = tributável | 2 = imune | 4 = não incidência
  tribISSQN: string;
  // Tipo de imunidade (0-5). Só usado quando tribISSQN = 2.
  tpImunidade: string;
  // ISS retido pelo tomador — quem recolhe é quem contratou.
  issRetido: boolean;
  // Local da prestação (IBGE 7). Vazio = município do emitente.
  codMunicipioPrestacao: string;
  competencia: string; // yyyy-mm-dd
  informacoesAdicionais: string;
};

export type ResultadoEmissao =
  | { ok: true; id: string; numero: number; chaveAcesso: string }
  | { ok: false; erro: string; id?: string };

// Campos que o XSD exige do tomador. Faltando um deles a rejeição vem sem
// explicação útil, então a checagem é feita aqui, antes de assinar.
function validarTomador(c: {
  nome: string; documento: string; cep: string | null; logradouro: string | null;
  numero: string | null; bairro: string | null; codMunicipio: string | null;
  municipio: string | null; uf: string | null;
}): string | null {
  if (!so(c.documento)) return `O cliente ${c.nome} está sem CPF/CNPJ.`;
  const faltando = [
    !c.cep && "CEP",
    !c.logradouro && "logradouro",
    !c.numero && "número",
    !c.bairro && "bairro",
    // O cadastro guarda o nome do município; o código IBGE é resolvido na
    // emissão. Só falta município se nem nome nem código estiverem lá.
    !c.codMunicipio && !(c.municipio && c.uf) && "município",
  ].filter(Boolean);
  if (faltando.length) {
    return `Endereço do cliente ${c.nome} incompleto — falta ${faltando.join(", ")}.`;
  }
  return null;
}

export async function emitirNotaServico(input: EmitirNfseInput): Promise<ResultadoEmissao> {
  try {
    await exigirFeature("emitir_nfse");
    const empresaId = await exigirEmpresa();

    const [empresa, cliente, servico] = await Promise.all([
      prisma.emitente.findUniqueOrThrow({ where: { id: empresaId } }),
      prisma.cliente.findFirst({ where: { id: input.clienteId, empresaId } }),
      input.servicoId
        ? prisma.servico.findFirst({ where: { id: input.servicoId, empresaId } })
        : Promise.resolve(null),
    ]);

    if (!cliente) return { ok: false, erro: "Cliente não encontrado." };
    if (!empresa.inscricaoMunicipal) {
      return { ok: false, erro: "Informe a inscrição municipal em Configurações — a NFS-e não sai sem ela." };
    }
    const problema = validarTomador(cliente);
    if (problema) return { ok: false, erro: problema };
    if (input.valorServico <= 0) return { ok: false, erro: "Valor do serviço deve ser maior que zero." };
    if (so(input.cTribNac).length !== 6) {
      return { ok: false, erro: "Código de tributação nacional inválido (6 dígitos)." };
    }

    // Código IBGE do tomador: usa o salvo quando existir, senão resolve pelo
    // nome do município + UF do cadastro (mesmo caminho da NF-e).
    let cMunTomador: string;
    try {
      cMunTomador = await resolverCodMunicipio(
        so(cliente.codMunicipio) || cliente.municipio || "",
        cliente.uf || empresa.uf,
      );
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : "Município do cliente inválido." };
    }

    const { pfxBase64, senha } = certDaEmpresa(empresa.certData);
    const cert = carregarCertificado(pfxBase64, senha);
    const ambiente: AmbienteNFSe = empresa.ambiente === "PRODUCAO" ? "1" : "2";

    const numero = empresa.proximoNumeroNFSe;
    const serie = empresa.serieNFSe;
    const agora = new Date();
    // Competência é o mês do serviço e não pode passar da data de emissão
    // (E0015). Data do browser em fuso adiantado cai nessa, então trava aqui.
    const informada = input.competencia ? new Date(`${input.competencia}T12:00:00-03:00`) : agora;
    const competencia = dataBrasilia(informada) > dataBrasilia(agora) ? agora : informada;
    const localPrestacao = so(input.codMunicipioPrestacao) || empresa.codMunicipio;

    // Grava antes de transmitir: se a resposta se perder, o rascunho segura o
    // número e a nota pode ser recuperada pelo Id da DPS em vez de reemitida.
    const registro = await prisma.notaServico.create({
      data: {
        numero, serie, emitenteId: empresaId, clienteId: cliente.id,
        servicoId: servico?.id ?? null,
        descricaoServico: input.descricao.trim(),
        cTribNac: so(input.cTribNac),
        itemListaServico: servico?.itemListaServico ?? null,
        cNBS: so(input.cNBS) || null,
        codMunicipioPrestacao: localPrestacao,
        valorServico: input.valorServico,
        aliqISS: input.tribISSQN === "1" && input.aliqISS > 0 ? input.aliqISS : null,
        valorISS:
          input.tribISSQN === "1" && input.aliqISS > 0
            ? Number(((input.valorServico * input.aliqISS) / 100).toFixed(2))
            : null,
        issRetido: input.issRetido,
        tribISSQN: input.tribISSQN,
        competencia,
        informacoesAdicionais: input.informacoesAdicionais.trim() || null,
        ambiente: empresa.ambiente,
      },
    });

    // Reserva o número na mesma hora — duas emissões simultâneas não podem
    // pegar o mesmo nDPS.
    await prisma.emitente.update({
      where: { id: empresaId },
      data: { proximoNumeroNFSe: numero + 1 },
    });

    const dados = montarDadosDps({
      empresa,
      cliente,
      input,
      ambiente,
      serie,
      numero,
      emitidaEm: agora,
      competencia,
      cMunTomador,
      cLocPrestacao: localPrestacao,
    });

    const r = await emitirNfse(dados, cert);

    if (!r.ok) {
      await prisma.notaServico.update({
        where: { id: registro.id },
        data: { status: "REJEITADA", xMotivo: r.erro, cStat: r.status ? String(r.status) : null, xmlDps: r.xmlDps },
      });
      return { ok: false, erro: r.erro, id: registro.id };
    }

    const aplicado = valoresAplicados(r.xmlNfse);
    await prisma.notaServico.update({
      where: { id: registro.id },
      data: {
        status: "AUTORIZADA",
        chaveAcesso: r.chaveAcesso,
        dpsId: r.idDps,
        autorizadaEm: new Date(),
        xmlDps: r.xmlDps,
        xmlNfse: r.xmlNfse,
        // Quem calcula o ISS é a prefeitura; grava o que ela aplicou.
        ...(aplicado.aliqISS != null ? { aliqISS: aplicado.aliqISS } : {}),
        ...(aplicado.valorISS != null ? { valorISS: aplicado.valorISS } : {}),
      },
    });

    return { ok: true, id: registro.id, numero, chaveAcesso: r.chaveAcesso };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}

// Recupera uma nota que ficou sem resposta (timeout na transmissão). A nota
// pode ter sido autorizada mesmo assim — reemitir criaria duplicidade.
export async function recuperarNotaServico(id: string): Promise<ResultadoEmissao> {
  try {
    await exigirFeature("emitir_nfse");
    const empresaId = await exigirEmpresa();
    const nota = await prisma.notaServico.findFirst({
      where: { id, emitenteId: empresaId },
      include: { emitente: true },
    });
    if (!nota) return { ok: false, erro: "Nota não encontrada." };
    if (nota.chaveAcesso) return { ok: true, id: nota.id, numero: nota.numero, chaveAcesso: nota.chaveAcesso };

    const { pfxBase64, senha } = certDaEmpresa(nota.emitente.certData);
    const cert = carregarCertificado(pfxBase64, senha);
    const ambiente: AmbienteNFSe = nota.emitente.ambiente === "PRODUCAO" ? "1" : "2";

    // O Id da DPS é determinístico: dá para reconstruí-lo sem tê-lo guardado.
    const doc = so(nota.emitente.cnpj);
    const idDps =
      nota.dpsId ??
      "DPS" +
        so(nota.emitente.codMunicipio).padStart(7, "0") +
        (doc.length === 11 ? "1" : "2") +
        doc.padStart(14, "0") +
        String(nota.serie).padStart(5, "0") +
        String(nota.numero).padStart(15, "0");

    const r = await consultarPorDps(idDps, ambiente, cert);
    if (!r.ok) return { ok: false, erro: r.erro, id: nota.id };

    await prisma.notaServico.update({
      where: { id: nota.id },
      data: { status: "AUTORIZADA", chaveAcesso: r.chaveAcesso, dpsId: idDps, autorizadaEm: new Date() },
    });
    return { ok: true, id: nota.id, numero: nota.numero, chaveAcesso: r.chaveAcesso };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export type NotaServicoUI = {
  id: string;
  numero: number;
  serie: number;
  status: string;
  ambienteUI: "producao" | "homologacao";
  clienteNome: string;
  clienteDocumento: string;
  descricaoServico: string;
  valorServico: number;
  valorISS: number | null;
  chaveAcesso: string;
  emitidaEm: string;
  competencia: string;
  motivo: string | null;
};

export async function listarNotasServico(): Promise<NotaServicoUI[]> {
  const empresaId = await exigirEmpresa();
  const linhas = await prisma.notaServico.findMany({
    where: { emitenteId: empresaId },
    orderBy: { emitidaEm: "desc" },
    include: { cliente: { select: { nome: true, documento: true } } },
  });
  return linhas.map((n) => ({
    id: n.id,
    numero: n.numero,
    serie: n.serie,
    status: n.status,
    ambienteUI: n.ambiente === "PRODUCAO" ? ("producao" as const) : ("homologacao" as const),
    clienteNome: n.cliente.nome,
    clienteDocumento: n.cliente.documento,
    descricaoServico: n.descricaoServico,
    valorServico: Number(n.valorServico),
    valorISS: n.valorISS == null ? null : Number(n.valorISS),
    chaveAcesso: n.chaveAcesso ?? "",
    emitidaEm: n.emitidaEm.toISOString(),
    competencia: n.competencia.toISOString(),
    motivo: n.xMotivo,
  }));
}

// Cancelamento da NFS-e (evento 101101). Prazo e regras são do município —
// fora da janela a própria SEFIN recusa e a mensagem dela vai para a tela.
export async function cancelarNotaServico(args: {
  id: string;
  motivo: MotivoCancelamento;
  descricaoMotivo: string;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    await exigirFeature("emitir_nfse");
    const empresaId = await exigirEmpresa();
    const nota = await prisma.notaServico.findFirst({
      where: { id: args.id, emitenteId: empresaId },
      include: { emitente: true },
    });
    if (!nota) return { ok: false, erro: "Nota não encontrada." };
    if (nota.status === "CANCELADA") return { ok: false, erro: "Esta nota já está cancelada." };
    if (nota.status !== "AUTORIZADA" || !nota.chaveAcesso) {
      return { ok: false, erro: "Só nota autorizada pode ser cancelada." };
    }
    if (args.descricaoMotivo.trim().length < 15) {
      return { ok: false, erro: "Descreva o motivo com pelo menos 15 caracteres." };
    }

    const { pfxBase64, senha } = certDaEmpresa(nota.emitente.certData);
    const cert = carregarCertificado(pfxBase64, senha);
    const r = await cancelarNfse({
      chaveAcesso: nota.chaveAcesso,
      ambiente: nota.emitente.ambiente === "PRODUCAO" ? "1" : "2",
      cert,
      cnpjAutor: so(nota.emitente.cnpj),
      motivo: args.motivo,
      descricaoMotivo: args.descricaoMotivo.trim(),
    });
    if (!r.ok) return { ok: false, erro: r.erro };

    await prisma.notaServico.update({
      where: { id: nota.id },
      data: {
        status: "CANCELADA",
        canceladaEm: new Date(),
        justificativaCancelamento: args.descricaoMotivo.trim(),
        xmlCancelamento: r.xmlEvento,
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|mac|integrity/i.test(msg)) return { ok: false, erro: "Senha do certificado incorreta." };
    return { ok: false, erro: msg };
  }
}

// Tudo que a pré-visualização da NFS-e precisa (o equivalente do DANFE).
export type NotaServicoCompleta = NotaServicoUI & {
  ambiente: "producao" | "homologacao";
  descricaoCompleta: string;
  itemListaServico: string;
  cTribNac: string;
  aliqISS: number | null;
  issRetido: boolean;
  tribISSQN: string;
  informacoesAdicionais: string;
  municipioPrestacao: string;
  emitente: {
    razaoSocial: string; nomeFantasia: string; cnpj: string; inscricaoMunicipal: string;
    telefone: string; email: string;
    endereco: { logradouro: string; numero: string; bairro: string; cep: string; municipio: string; uf: string };
  };
  tomador: {
    nome: string; documento: string; telefone: string; email: string;
    endereco: { logradouro: string; numero: string; complemento: string; bairro: string; cep: string; municipio: string; uf: string };
  };
};

export async function obterNotaServico(
  id: string,
): Promise<{ ok: true; nota: NotaServicoCompleta } | { ok: false; erro: string }> {
  const empresaId = await exigirEmpresa();
  const n = await prisma.notaServico.findFirst({
    where: { id, emitenteId: empresaId },
    include: { cliente: true, emitente: true },
  });
  if (!n) return { ok: false, erro: "Nota não encontrada." };
  const e = n.emitente;
  const c = n.cliente;
  return {
    ok: true,
    nota: {
      id: n.id,
      numero: n.numero,
      serie: n.serie,
      status: n.status,
      ambienteUI: n.ambiente === "PRODUCAO" ? "producao" : "homologacao",
      clienteNome: c.nome,
      clienteDocumento: c.documento,
      descricaoServico: n.descricaoServico,
      valorServico: Number(n.valorServico),
      valorISS: n.valorISS == null ? null : Number(n.valorISS),
      chaveAcesso: n.chaveAcesso ?? "",
      emitidaEm: n.emitidaEm.toISOString(),
      competencia: n.competencia.toISOString(),
      motivo: n.xMotivo,
      ambiente: n.ambiente === "PRODUCAO" ? "producao" : "homologacao",
      descricaoCompleta: n.descricaoServico,
      itemListaServico: n.itemListaServico ?? "",
      cTribNac: n.cTribNac,
      aliqISS: n.aliqISS == null ? null : Number(n.aliqISS),
      issRetido: n.issRetido,
      tribISSQN: n.tribISSQN,
      informacoesAdicionais: n.informacoesAdicionais ?? "",
      municipioPrestacao: n.codMunicipioPrestacao,
      emitente: {
        razaoSocial: e.razaoSocial,
        nomeFantasia: e.nomeFantasia ?? e.razaoSocial,
        cnpj: e.cnpj,
        inscricaoMunicipal: e.inscricaoMunicipal ?? "",
        telefone: e.telefone ?? "",
        email: e.email ?? "",
        endereco: {
          logradouro: e.logradouro, numero: e.numero, bairro: e.bairro,
          cep: e.cep, municipio: e.municipio, uf: e.uf,
        },
      },
      tomador: {
        nome: c.nome,
        documento: c.documento,
        telefone: c.telefone ?? "",
        email: c.email ?? "",
        endereco: {
          logradouro: c.logradouro ?? "", numero: c.numero ?? "", complemento: c.complemento ?? "",
          bairro: c.bairro ?? "", cep: c.cep ?? "", municipio: c.municipio ?? "", uf: c.uf ?? "",
        },
      },
    },
  };
}

// XML da NFS-e autorizada, para download.
export async function baixarXmlNotaServico(
  id: string,
): Promise<{ ok: true; xml: string; nome: string } | { ok: false; erro: string }> {
  const empresaId = await exigirEmpresa();
  const nota = await prisma.notaServico.findFirst({
    where: { id, emitenteId: empresaId },
    select: { xmlNfse: true, xmlDps: true, chaveAcesso: true, numero: true },
  });
  if (!nota) return { ok: false, erro: "Nota não encontrada." };
  const xml = nota.xmlNfse ?? nota.xmlDps;
  if (!xml) return { ok: false, erro: "Esta nota não tem XML guardado." };
  return { ok: true, xml, nome: `${nota.chaveAcesso || `nfse-${nota.numero}`}.xml` };
}
