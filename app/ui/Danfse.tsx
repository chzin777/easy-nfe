"use client";

import { QRCodeSVG } from "qrcode.react";
import { formatBRL, formatData, formatCpfCnpj, formatCep, formatTelefone } from "@/lib/format";
import type { NotaServicoCompleta } from "@/app/notas-servico/actions";

// DANFSe — o espelho da NFS-e do Padrão Nacional. Uma nota descreve um serviço:
// não há itens, transporte nem ICMS, então o leiaute é bem mais curto que o
// DANFE. Mesmo id de impressão (#danfe-print) para reaproveitar o gerador de PDF.
//
// O leiaute segue o modelo nacional (NT 008/2026): cabeçalho com o município,
// QR Code de validação no portal nacional, blocos de prestador e tomador, e a
// grade de tributos — ISSQN apurado pela prefeitura, retenções federais e, se
// vierem no XML, IBS/CBS.

const TRIBUTACAO: Record<string, string> = {
  "1": "Operação tributável",
  "2": "Imune",
  "3": "Exportação de serviço",
  "4": "Não incidência",
};

const RETENCAO_ISS: Record<string, string> = {
  "1": "Não retido",
  "2": "Retido pelo tomador",
  "3": "Retido pelo intermediário",
};

const SIMPLES: Record<string, string> = {
  "1": "Não optante",
  "2": "Optante — MEI",
  "3": "Optante — ME/EPP",
};

const REGIME_APURACAO: Record<string, string> = {
  "1": "Federal e municipal pelo Simples",
  "2": "Federal pelo Simples, ISSQN por fora",
  "3": "Federal e municipal por fora",
};

const REGIME_ESPECIAL: Record<string, string> = {
  "0": "Nenhum",
  "1": "Ato cooperado",
  "2": "Estimativa",
  "3": "Microempresa municipal",
  "4": "Notários e registradores",
  "5": "Profissional autônomo",
  "6": "Sociedade de profissionais",
};

const RET_PIS_COFINS: Record<string, string> = {
  "1": "PIS/COFINS retidos",
  "2": "PIS/COFINS não retidos",
};

export default function Danfse({ nota }: { nota: NotaServicoCompleta }) {
  const e = nota.emitente;
  const t = nota.tomador;
  const tr = nota.tributos;
  const cancelada = nota.status === "CANCELADA";
  const autorizada = nota.status === "AUTORIZADA";

  const watermark = cancelada
    ? "CANCELADA"
    : nota.ambiente === "homologacao"
      ? "SEM VALOR FISCAL"
      : autorizada
        ? ""
        : "SEM AUTORIZACAO";

  // O que a prefeitura apurou tem precedência sobre o que foi declarado.
  const vServ = tr.vServ ?? nota.valorServico;
  const vBC = tr.vBC ?? (nota.tribISSQN === "1" ? vServ : undefined);
  const aliq = tr.pAliqAplic ?? nota.aliqISS ?? undefined;
  const vISS = tr.vISSQN ?? nota.valorISS ?? undefined;
  const retencaoISS = tr.tpRetISSQN ?? (nota.issRetido ? "2" : "1");
  const vTotalRet =
    tr.vTotalRet ??
    soma(retencaoISS !== "1" ? vISS : undefined, tr.vPis, tr.vCofins, tr.vRetCSLL, tr.vRetIRRF, tr.vRetCP);
  const vLiq = tr.vLiq ?? vServ - (tr.vDescIncond ?? 0) - (vTotalRet ?? 0);
  const temIbsCbs = [tr.vBCIBSCBS, tr.vCBS, tr.vIBSEst, tr.vIBSMun].some((v) => v != null);

  return (
    <div className="relative mx-auto w-full bg-white font-sans text-[9px] leading-tight text-black">
      {watermark && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          <span
            className={
              "rotate-[-18deg] whitespace-nowrap text-[44px] font-bold uppercase tracking-wide " +
              (cancelada ? "text-red-500/15" : "text-slate-400/15")
            }
          >
            {watermark}
          </span>
        </div>
      )}

      <div className="relative z-10">
        {/* ---- Cabeçalho ---- */}
        <div className="border border-black">
          <div className="flex">
            <div className="flex w-[42%] flex-col justify-center border-r border-black p-2">
              <p className="text-[11px] font-bold uppercase leading-tight">
                Prefeitura Municipal de {e.endereco.municipio} - {e.endereco.uf}
              </p>
              <p className="mt-1 text-[8px] leading-tight">
                Nota Fiscal de Serviço Eletrônica — NFS-e
                <br />
                Padrão Nacional · {tr.verAplic ? `Versão ${tr.verAplic}` : "SEFIN Nacional"}
              </p>
              <p className="mt-2 text-[7px] uppercase leading-none text-slate-500">Emitente da NFS-e</p>
              <p className="text-[9px] font-medium">Prestador</p>
            </div>

            <div className="flex w-[33%] flex-col justify-center border-r border-black p-2">
              <p className="text-[13px] font-bold leading-none">
                NFS-e nº {tr.nNFSe ?? nota.numero}
              </p>
              <div className="mt-1 flex gap-3">
                <Cel label="Série" className="px-0">{nota.serie}</Cel>
                <Cel label="Geração" className="px-0">{formatData(nota.emitidaEm)}</Cel>
                <Cel label="Competência" className="px-0">{formatData(nota.competencia)}</Cel>
              </div>
              <Cel label="Situação" className="px-0">{nota.status.toLowerCase()}</Cel>
            </div>

            <div className="flex w-[25%] flex-col items-center justify-center p-1.5 text-center">
              {nota.qrCode ? (
                <>
                  <QRCodeSVG value={nota.qrCode} size={78} level="M" />
                  <p className="mt-1 text-[6.5px] leading-tight text-slate-600">
                    Consulte a autenticidade pelo QR Code
                  </p>
                </>
              ) : (
                <p className="text-[7px] text-slate-500">Nota sem chave de acesso</p>
              )}
            </div>
          </div>

          <div className="border-t border-black px-1.5 py-1">
            <p className="text-[7px] uppercase leading-none text-slate-500">
              Código de autenticidade / chave de acesso da NFS-e
            </p>
            <p className="break-all font-mono text-[9px] font-medium">
              {nota.chaveAcesso ? espacar(nota.chaveAcesso) : "—"}
            </p>
          </div>
        </div>

        {/* ---- Prestador ---- */}
        <Bloco titulo="Identificação do prestador">
          <div className="flex">
            <Cel label="CNPJ / CPF" className="w-[25%] border-r border-black">{formatCpfCnpj(e.cnpj)}</Cel>
            <Cel label="Inscrição municipal" className="w-[20%] border-r border-black">
              {e.inscricaoMunicipal || "—"}
            </Cel>
            <Cel label="Telefone" className="w-[20%] border-r border-black">
              {e.telefone ? formatTelefone(e.telefone) : "—"}
            </Cel>
            <Cel label="E-mail" className="flex-1">{e.email || "—"}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Nome / razão social" className="w-[55%] border-r border-black">{e.razaoSocial}</Cel>
            <Cel label="Nome fantasia" className="flex-1">{e.nomeFantasia || "—"}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Endereço" className="w-[55%] border-r border-black">
              {[e.endereco.logradouro, e.endereco.numero, e.endereco.bairro].filter(Boolean).join(", ")}
            </Cel>
            <Cel label="CEP" className="w-[15%] border-r border-black">{formatCep(e.endereco.cep)}</Cel>
            <Cel label="Município / UF" className="flex-1">
              {e.endereco.municipio} - {e.endereco.uf}
            </Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Situação no Simples Nacional" className="w-[40%] border-r border-black">
              {tr.opSimpNac ? SIMPLES[tr.opSimpNac] ?? tr.opSimpNac : "—"}
            </Cel>
            <Cel label="Regime de apuração" className="w-[35%] border-r border-black">
              {tr.regApTribSN ? REGIME_APURACAO[tr.regApTribSN] ?? tr.regApTribSN : "—"}
            </Cel>
            <Cel label="Regime especial" className="flex-1">
              {tr.regEspTrib ? REGIME_ESPECIAL[tr.regEspTrib] ?? tr.regEspTrib : "—"}
            </Cel>
          </div>
        </Bloco>

        {/* ---- Tomador ---- */}
        <Bloco titulo="Identificação do tomador">
          <div className="flex">
            <Cel label="CNPJ / CPF" className="w-[25%] border-r border-black">
              {t.documento ? formatCpfCnpj(t.documento) : "—"}
            </Cel>
            <Cel label="Telefone" className="w-[20%] border-r border-black">
              {t.telefone ? formatTelefone(t.telefone) : "—"}
            </Cel>
            <Cel label="E-mail" className="flex-1">{t.email || "—"}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Nome / razão social" className="w-[55%] border-r border-black">{t.nome}</Cel>
            <Cel label="Endereço" className="flex-1">
              {[t.endereco.logradouro, t.endereco.numero, t.endereco.complemento].filter(Boolean).join(", ") || "—"}
            </Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Bairro" className="w-[30%] border-r border-black">{t.endereco.bairro || "—"}</Cel>
            <Cel label="CEP" className="w-[15%] border-r border-black">
              {t.endereco.cep ? formatCep(t.endereco.cep) : "—"}
            </Cel>
            <Cel label="Município / UF" className="flex-1">
              {t.endereco.municipio ? `${t.endereco.municipio} - ${t.endereco.uf}` : "—"}
            </Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Nº da DPS" className="w-[25%] border-r border-black">{tr.nDPS ?? nota.numero}</Cel>
            <Cel label="Série da DPS" className="w-[20%] border-r border-black">{tr.serieDPS ?? nota.serie}</Cel>
            <Cel label="Emissão da DPS" className="flex-1">
              {tr.dhEmiDPS ? formatData(tr.dhEmiDPS) : formatData(nota.emitidaEm)}
            </Cel>
          </div>
        </Bloco>

        {/* ---- Serviço ---- */}
        <Bloco titulo="Dados do serviço prestado">
          <div className="flex">
            <Cel label="Código de tributação nacional" className="w-[30%] border-r border-black">
              {nota.cTribNac || "—"}
              {tr.xTribNac ? <span className="font-normal"> · {tr.xTribNac}</span> : null}
            </Cel>
            <Cel label="NBS" className="w-[20%] border-r border-black">{nota.cNBS || tr.xNBS || "—"}</Cel>
            <Cel label="Item da LC 116" className="w-[15%] border-r border-black">
              {nota.itemListaServico || "—"}
            </Cel>
            <Cel label="Local da prestação" className="flex-1">{nota.municipioPrestacao}</Cel>
          </div>
          {tr.xTribMun && (
            <div className="border-t border-black">
              <Cel label="Atividade municipal">{tr.xTribMun}</Cel>
            </div>
          )}
          <div className="border-t border-black px-1.5 py-1">
            <p className="text-[7px] uppercase leading-none text-slate-500">Descrição do serviço</p>
            <p className="whitespace-pre-wrap text-[9px] font-medium">{nota.descricaoServico}</p>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Valor do serviço" className="w-1/4 border-r border-black" alinhar="right">
              {formatBRL(vServ)}
            </Cel>
            <Cel label="Desconto incondicionado" className="w-1/4 border-r border-black" alinhar="right">
              {brl(tr.vDescIncond)}
            </Cel>
            <Cel label="Desconto condicionado" className="w-1/4 border-r border-black" alinhar="right">
              {brl(tr.vDescCond)}
            </Cel>
            <Cel label="Dedução / redução" className="w-1/4" alinhar="right">{brl(tr.vDedRed)}</Cel>
          </div>
        </Bloco>

        {/* ---- ISSQN ---- */}
        <Bloco titulo="ISSQN">
          <div className="flex">
            <Cel label="Base de cálculo" className="w-1/4 border-r border-black" alinhar="right">
              {brl(vBC)}
            </Cel>
            <Cel label="Alíquota aplicada" className="w-1/4 border-r border-black" alinhar="right">
              {aliq != null ? `${aliq.toFixed(2)} %` : "—"}
            </Cel>
            <Cel label="Valor do ISSQN" className="w-1/4 border-r border-black" alinhar="right">
              {brl(vISS)}
            </Cel>
            <Cel label="Tipo de retenção" className="w-1/4">
              {RETENCAO_ISS[retencaoISS] ?? retencaoISS}
            </Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Tipo de tributação" className="w-[35%] border-r border-black">
              {TRIBUTACAO[tr.tribISSQN ?? nota.tribISSQN] ?? nota.tribISSQN}
            </Cel>
            <Cel label="Município de incidência" className="w-[35%] border-r border-black">
              {tr.xLocIncid ?? nota.municipioPrestacao}
            </Cel>
            <Cel label="Nº do processo de suspensão" className="flex-1">{tr.nProcesso ?? "—"}</Cel>
          </div>
        </Bloco>

        {/* ---- Tributação federal ---- */}
        <Bloco titulo="Tributação nacional">
          <div className="flex">
            <Cel label="CST PIS/COFINS" className="w-[18%] border-r border-black">
              {tr.cstPisCofins ?? "—"}
            </Cel>
            <Cel label="Tipo de retenção" className="w-[28%] border-r border-black">
              {tr.tpRetPisCofins ? RET_PIS_COFINS[tr.tpRetPisCofins] ?? tr.tpRetPisCofins : "—"}
            </Cel>
            <Cel label="PIS" className="flex-1 border-r border-black" alinhar="right">{brl(tr.vPis)}</Cel>
            <Cel label="COFINS" className="flex-1 border-r border-black" alinhar="right">{brl(tr.vCofins)}</Cel>
            <Cel label="CSLL" className="flex-1 border-r border-black" alinhar="right">{brl(tr.vRetCSLL)}</Cel>
            <Cel label="IRRF" className="flex-1 border-r border-black" alinhar="right">{brl(tr.vRetIRRF)}</Cel>
            <Cel label="CP retido" className="flex-1" alinhar="right">{brl(tr.vRetCP)}</Cel>
          </div>
        </Bloco>

        {/* ---- IBS/CBS (reforma tributária) ---- */}
        {temIbsCbs && (
          <Bloco titulo="IBS / CBS">
            <div className="flex">
              <Cel label="Base de cálculo" className="w-1/4 border-r border-black" alinhar="right">
                {brl(tr.vBCIBSCBS)}
              </Cel>
              <Cel label="Valor CBS" className="w-1/4 border-r border-black" alinhar="right">{brl(tr.vCBS)}</Cel>
              <Cel label="IBS estadual" className="w-1/4 border-r border-black" alinhar="right">
                {brl(tr.vIBSEst)}
              </Cel>
              <Cel label="IBS municipal" className="w-1/4" alinhar="right">{brl(tr.vIBSMun)}</Cel>
            </div>
          </Bloco>
        )}

        {/* ---- Totais ---- */}
        <Bloco titulo="Totais">
          <div className="flex">
            <Cel label="Total de retenções" className="w-1/4 border-r border-black" alinhar="right">
              {brl(vTotalRet)}
            </Cel>
            <Cel label="Tributos aproximados" className="w-1/4 border-r border-black" alinhar="right">
              {tributosAprox(tr, vServ)}
            </Cel>
            <Cel label="Valor líquido" className="w-1/4 border-r border-black" alinhar="right">
              {formatBRL(vLiq)}
            </Cel>
            <Cel label="Valor total da nota" className="w-1/4" alinhar="right">
              <span className="text-[11px] font-bold">{formatBRL(vServ)}</span>
            </Cel>
          </div>
        </Bloco>

        {/* ---- Complemento ---- */}
        {(nota.informacoesAdicionais || nota.motivo) && (
          <Bloco titulo="Informações complementares">
            <div className="px-1.5 py-1">
              {nota.informacoesAdicionais && (
                <p className="whitespace-pre-wrap text-[9px]">{nota.informacoesAdicionais}</p>
              )}
              {nota.motivo && <p className="mt-1 text-[9px] font-medium">Motivo: {nota.motivo}</p>}
            </div>
          </Bloco>
        )}

        <p className="mt-1 text-[7px] leading-tight text-slate-500">
          O ISSQN é apurado pela prefeitura do município de incidência. Valores aproximados dos tributos
          conforme a Lei 12.741/2012. Consulte a autenticidade desta nota pelo QR Code ou pelo portal:{" "}
          {nota.qrCode || "https://www.nfse.gov.br/ConsultaPublica"}
        </p>
      </div>
    </div>
  );
}

function soma(...v: (number | undefined)[]): number | undefined {
  const nums = v.filter((x): x is number => typeof x === "number");
  return nums.length ? nums.reduce((a, b) => a + b, 0) : undefined;
}

const brl = (v: number | undefined) => (v == null ? "—" : formatBRL(v));

// Lei da transparência: o XML traz ou o valor, ou o percentual (Simples), ou o
// percentual por esfera. Qualquer um deles vira valor em reais aqui.
function tributosAprox(tr: NotaServicoCompleta["tributos"], vServ: number): string {
  if (tr.vTotTrib != null) return formatBRL(tr.vTotTrib);
  if (tr.pTotTribSN != null) return formatBRL((vServ * tr.pTotTribSN) / 100);
  const p = soma(tr.pTotTribFed, tr.pTotTribEst, tr.pTotTribMun);
  return p != null ? formatBRL((vServ * p) / 100) : "—";
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-1 border border-black">
      <p className="border-b border-black bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Cel({
  label,
  children,
  className = "",
  alinhar = "left",
}: {
  label: string;
  children?: React.ReactNode;
  className?: string;
  alinhar?: "left" | "right";
}) {
  return (
    <div className={"px-1.5 py-0.5 " + className}>
      <p className="text-[7px] uppercase leading-none text-slate-500">{label}</p>
      <p className={"min-h-[11px] text-[9px] font-medium " + (alinhar === "right" ? "text-right" : "")}>
        {children}
      </p>
    </div>
  );
}

function espacar(chave: string): string {
  return chave.replace(/(.{4})/g, "$1 ").trim();
}
