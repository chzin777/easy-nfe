import "server-only";
import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/crypto";
import { carregarCertificado } from "@/lib/nfe/cert";
import { resolverCodMunicipio } from "@/lib/nfe/ibge";
import { emitirNfse } from "./client";
import { montarDadosDps } from "./dps";
import { dataBrasilia, valoresAplicados } from "./xml";
import type { AmbienteNFSe, EmitirNfseInput, ResultadoEmissaoNFSe } from "./types";

// Núcleo da emissão de NFS-e, sem sessão. Serve tanto para a ação do usuário
// (que faz a checagem de permissão antes) quanto para o robô dos contratos
// recorrentes, que roda sem ninguém logado.

const so = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function certDaEmpresa(certData: string | null): { pfxBase64: string; senha: string } {
  if (!certData) {
    throw new Error("Certificado não configurado. Envie o A1 em Configurações › Certificado.");
  }
  return JSON.parse(decriptar(certData)) as { pfxBase64: string; senha: string };
}

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

export async function emitirParaEmpresa(
  empresaId: string,
  input: EmitirNfseInput,
  // Amarra a nota ao contrato recorrente que a gerou, quando houver.
  contratoId?: string | null,
): Promise<ResultadoEmissaoNFSe> {
  try {
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
        contratoId: contratoId ?? null,
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
