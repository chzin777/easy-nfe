"use client";

import { formatBRL, formatData, formatCpfCnpj, formatCep, formatTelefone } from "@/lib/format";
import type { NotaServicoCompleta } from "@/app/notas-servico/actions";

// DANFSe — o espelho da NFS-e do Padrão Nacional. Uma nota descreve um serviço:
// não há itens, transporte nem ICMS, então o leiaute é bem mais curto que o
// DANFE. Mesmo id de impressão (#danfe-print) para reaproveitar o gerador de PDF.

const TRIBUTACAO: Record<string, string> = {
  "1": "Tributável — ISS devido",
  "2": "Imune",
  "3": "Exportação de serviço",
  "4": "Não incidência",
};

export default function Danfse({ nota }: { nota: NotaServicoCompleta }) {
  const e = nota.emitente;
  const t = nota.tomador;
  const cancelada = nota.status === "CANCELADA";
  const autorizada = nota.status === "AUTORIZADA";

  const watermark = cancelada
    ? "CANCELADA"
    : nota.ambiente === "homologacao"
      ? "SEM VALOR FISCAL"
      : autorizada
        ? ""
        : "SEM AUTORIZACAO";

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
            <div className="flex w-[45%] flex-col justify-center border-r border-black p-2">
              <p className="text-[11px] font-bold uppercase leading-tight">{e.nomeFantasia}</p>
              <p className="mt-1 text-[8px]">
                {e.razaoSocial}
                <br />
                CNPJ {formatCpfCnpj(e.cnpj)}
                {e.inscricaoMunicipal ? ` · IM ${e.inscricaoMunicipal}` : ""}
                <br />
                {e.endereco.logradouro}, {e.endereco.numero} · {e.endereco.bairro}
                <br />
                {e.endereco.municipio} - {e.endereco.uf} · CEP {formatCep(e.endereco.cep)}
                {e.telefone ? <><br />Fone: {formatTelefone(e.telefone)}</> : null}
              </p>
            </div>

            <div className="flex w-[25%] flex-col items-center justify-center border-r border-black p-2 text-center">
              <p className="text-[13px] font-bold">DANFSe</p>
              <p className="text-[7px] leading-tight">
                Documento Auxiliar da Nota Fiscal de Serviço Eletrônica
              </p>
              <p className="mt-2 text-[10px] font-bold">Nº {nota.numero}</p>
              <p className="text-[9px]">Série {nota.serie}</p>
            </div>

            <div className="flex w-[30%] flex-col justify-center p-2">
              <Cel label="Emissão">{formatData(nota.emitidaEm)}</Cel>
              <Cel label="Competência">{formatData(nota.competencia)}</Cel>
              <Cel label="Situação">{nota.status.toLowerCase()}</Cel>
            </div>
          </div>

          <div className="border-t border-black px-1.5 py-1">
            <p className="text-[7px] uppercase leading-none text-slate-500">
              Chave de acesso da NFS-e
            </p>
            <p className="break-all font-mono text-[9px] font-medium">
              {nota.chaveAcesso ? espacar(nota.chaveAcesso) : "—"}
            </p>
          </div>
        </div>

        {/* ---- Tomador ---- */}
        <Bloco titulo="Tomador do serviço">
          <div className="flex">
            <Cel label="Nome / razão social" className="w-[55%] border-r border-black">{t.nome}</Cel>
            <Cel label="CPF / CNPJ" className="w-[25%] border-r border-black">
              {t.documento ? formatCpfCnpj(t.documento) : "—"}
            </Cel>
            <Cel label="Fone" className="flex-1">{t.telefone ? formatTelefone(t.telefone) : "—"}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Endereço" className="w-[55%] border-r border-black">
              {[t.endereco.logradouro, t.endereco.numero, t.endereco.complemento].filter(Boolean).join(", ") || "—"}
            </Cel>
            <Cel label="Bairro" className="w-[25%] border-r border-black">{t.endereco.bairro || "—"}</Cel>
            <Cel label="Município / UF" className="flex-1">
              {t.endereco.municipio ? `${t.endereco.municipio} - ${t.endereco.uf}` : "—"}
            </Cel>
          </div>
        </Bloco>

        {/* ---- Serviço ---- */}
        <Bloco titulo="Serviço prestado">
          <div className="px-1.5 py-1">
            <p className="text-[7px] uppercase leading-none text-slate-500">Discriminação</p>
            <p className="whitespace-pre-wrap text-[9px] font-medium">{nota.descricaoServico}</p>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Código de tributação nacional" className="w-[30%] border-r border-black">
              {nota.cTribNac || "—"}
            </Cel>
            <Cel label="Item da LC 116" className="w-[20%] border-r border-black">
              {nota.itemListaServico || "—"}
            </Cel>
            <Cel label="Município da prestação" className="flex-1">{nota.municipioPrestacao}</Cel>
          </div>
        </Bloco>

        {/* ---- Valores ---- */}
        <Bloco titulo="Valores e ISSQN">
          <div className="flex">
            <Cel label="Valor do serviço" className="w-1/4 border-r border-black" alinhar="right">
              {formatBRL(nota.valorServico)}
            </Cel>
            <Cel label="Tributação do ISSQN" className="w-1/4 border-r border-black">
              {TRIBUTACAO[nota.tribISSQN] ?? nota.tribISSQN}
            </Cel>
            <Cel label="Alíquota aplicada" className="w-1/4 border-r border-black" alinhar="right">
              {nota.aliqISS != null ? `${nota.aliqISS.toFixed(2)} %` : "—"}
            </Cel>
            <Cel label="ISSQN" className="w-1/4" alinhar="right">
              {nota.valorISS != null ? formatBRL(nota.valorISS) : "—"}
            </Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="ISSQN retido pelo tomador" className="w-1/2 border-r border-black">
              {nota.issRetido ? "Sim" : "Não"}
            </Cel>
            <Cel label="Valor líquido" className="w-1/2" alinhar="right">
              {formatBRL(nota.valorServico - (nota.issRetido ? nota.valorISS ?? 0 : 0))}
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

        <p className="mt-1 text-[7px] text-slate-500">
          O ISSQN é apurado pela prefeitura do município de incidência. Consulte a autenticidade
          desta nota pela chave de acesso no portal nacional da NFS-e.
        </p>
      </div>
    </div>
  );
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
