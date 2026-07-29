"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { exigirFeature } from "@/lib/permissoes";
import { decriptar } from "@/lib/crypto";
import { carregarCertificado } from "@/lib/nfe/cert";
import { consultarPorDps, emitirNfse } from "@/lib/nfse/client";
import { resolverCodMunicipio } from "@/lib/nfe/ibge";
import type { AmbienteNFSe, DadosDPS } from "@/lib/nfse/types";

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
  // 1 = tributável | 2 = imune | 3 = exportação | 4 = não incidência
  tribISSQN: string;
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
    const competencia = input.competencia ? new Date(`${input.competencia}T12:00:00`) : agora;
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

    const dados: DadosDPS = {
      ambiente,
      serie,
      numero,
      emitidaEm: agora,
      competencia,
      cLocEmi: empresa.codMunicipio,
      tpEmit: "1", // prestador
      prestador: {
        cnpj: so(empresa.cnpj),
        im: so(empresa.inscricaoMunicipal),
        fone: so(empresa.telefone),
        email: empresa.email ?? undefined,
        regTrib: {
          opSimpNac: empresa.opSimpNac,
          // Só faz sentido para optante do Simples.
          regApTribSN: empresa.opSimpNac !== "1" ? empresa.regApTribSN ?? undefined : undefined,
          regEspTrib: empresa.regEspTrib ?? "0",
        },
      },
      tomador: {
        cnpj: so(cliente.documento).length === 14 ? so(cliente.documento) : undefined,
        cpf: so(cliente.documento).length === 11 ? so(cliente.documento) : undefined,
        im: so(cliente.inscricaoEstadual) || undefined,
        nome: cliente.nome,
        endereco: {
          cMun: cMunTomador,
          cep: so(cliente.cep),
          logradouro: cliente.logradouro ?? "",
          numero: cliente.numero ?? "",
          complemento: cliente.complemento ?? undefined,
          bairro: cliente.bairro ?? "",
        },
        fone: so(cliente.telefone) || undefined,
        email: cliente.email ?? undefined,
      },
      servico: {
        cLocPrestacao: localPrestacao,
        cTribNac: so(input.cTribNac),
        descricao: input.descricao.trim(),
        cNBS: so(input.cNBS) || undefined,
      },
      valores: {
        valorServico: input.valorServico,
        tribISSQN: input.tribISSQN,
        tpRetISSQN: input.issRetido ? "2" : "1",
        aliquotaISS: input.tribISSQN === "1" && input.aliqISS > 0 ? input.aliqISS : undefined,
      },
      infoAdicional: input.informacoesAdicionais.trim() || undefined,
    };

    const r = await emitirNfse(dados, cert);

    if (!r.ok) {
      await prisma.notaServico.update({
        where: { id: registro.id },
        data: { status: "REJEITADA", xMotivo: r.erro, cStat: r.status ? String(r.status) : null, xmlDps: r.xmlDps },
      });
      return { ok: false, erro: r.erro, id: registro.id };
    }

    await prisma.notaServico.update({
      where: { id: registro.id },
      data: {
        status: "AUTORIZADA",
        chaveAcesso: r.chaveAcesso,
        dpsId: r.idDps,
        autorizadaEm: new Date(),
        xmlDps: r.xmlDps,
        xmlNfse: r.xmlNfse,
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
