"use client";

import { QRCodeSVG } from "qrcode.react";
import { formatBRL, formatData } from "@/lib/format";
import type { NotaCompleta } from "@/app/notas/actions";

// DANFE NFC-e — cupom (modelo 65), leiaute em bobina ~80mm.
// O QR Code é gerado a partir do conteúdo salvo na emissão (nota.qrCode).
export default function DanfeNFCe({ nota }: { nota: NotaCompleta }) {
  const emit = nota.emitente;
  const total = nota.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const qtdTotal = nota.itens.reduce((s, i) => s + i.quantidade, 0);
  const dataHora = `${formatData(nota.emitidaEm)} ${formatHora(nota.emitidaEm)}`;
  // urlChave = parte da URL antes do "?p=" do conteúdo do QR Code.
  const urlChave = nota.qrCode ? nota.qrCode.split("?p=")[0] : "";

  const autorizada = nota.status === "autorizada";

  // Marca d'água: CANCELADA (vermelho) ou SEM VALOR FISCAL em homologação.
  const watermark =
    nota.status === "cancelada"
      ? "CANCELADA"
      : nota.ambiente === "homologacao"
        ? "SEM VALOR FISCAL"
        : "";

  return (
    <div className="relative mx-auto w-[302px] overflow-hidden bg-white px-2 py-3 font-mono text-[10px] leading-tight text-black">
      {/* Marca d'água */}
      {watermark && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <span
            className={
              "rotate-[-30deg] whitespace-nowrap text-[34px] font-bold uppercase tracking-wide " +
              (nota.status === "cancelada" ? "text-red-500/20" : "text-slate-400/20")
            }
          >
            {watermark}
          </span>
        </div>
      )}

      <div className="relative z-10">
      {/* Cabeçalho emitente */}
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase">{emit.nomeFantasia || emit.razaoSocial}</p>
        <p>CNPJ {emit.cnpj} · IE {emit.ie}</p>
        <p>
          {emit.endereco.logradouro}, {emit.endereco.numero} - {emit.endereco.bairro}
        </p>
        <p>
          {emit.endereco.municipio}/{emit.endereco.uf}
        </p>
      </div>

      <Hr />
      <p className="text-center text-[9px] font-bold uppercase">
        DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
      </p>
      <Hr />

      {/* Itens */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-dashed border-black text-left">
            <th className="w-5">#</th>
            <th>Descrição</th>
            <th className="text-right">Qtd</th>
            <th className="text-right">Un</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {nota.itens.map((it, i) => (
            <tr key={i} className="align-top">
              <td>{i + 1}</td>
              <td className="pr-1">
                {it.codigo} {it.nome}
              </td>
              <td className="text-right">{it.quantidade}</td>
              <td className="text-right">{moeda(it.precoUnitario)}</td>
              <td className="text-right">{moeda(it.quantidade * it.precoUnitario)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Hr />
      <Linha rotulo={`Qtd. total de itens`} valor={String(nota.itens.length)} />
      <Linha rotulo="Qtd. total de produtos" valor={qtdTotal.toLocaleString("pt-BR")} />
      <Linha rotulo="VALOR TOTAL R$" valor={formatBRL(total)} forte />
      <Linha rotulo="FORMA DE PAGAMENTO" valor="" />
      <Linha rotulo="Dinheiro" valor={formatBRL(total)} />

      <Hr />
      {/* Consumidor */}
      <p className="text-[9px]">
        CONSUMIDOR: {nota.cliente.documento ? `CPF/CNPJ ${nota.cliente.documento}` : "NÃO IDENTIFICADO"}
      </p>

      <Hr />
      {/* Chave + autorização */}
      <p className="text-center text-[9px] font-bold uppercase">
        Consulte pela chave de acesso em
      </p>
      <p className="break-all text-center text-[8px]">{urlChave}</p>
      <p className="mt-1 text-center text-[9px] font-semibold uppercase">Chave de acesso</p>
      <p className="break-all text-center font-mono text-[9px]">{espacar(nota.chaveAcesso)}</p>

      <Hr />
      {/* QR Code */}
      <div className="flex flex-col items-center gap-1 py-1">
        {nota.qrCode ? (
          <QRCodeSVG value={nota.qrCode} size={128} level="M" />
        ) : (
          <p className="text-center text-[9px] text-slate-500">QR Code indisponível</p>
        )}
      </div>

      <Hr />
      <p className="text-center text-[8px]">
        {autorizada ? (
          <>
            Protocolo de autorização: {nota.protocolo}
            <br />
            {dataHora}
          </>
        ) : nota.status === "cancelada" ? (
          "NFC-e CANCELADA"
        ) : (
          "NFC-e sem autorização de uso"
        )}
      </p>
      {nota.ambiente === "homologacao" && (
        <p className="mt-1 text-center text-[9px] font-bold uppercase text-red-600">
          Emitida em homologação - sem valor fiscal
        </p>
      )}
      </div>
    </div>
  );
}

function Hr() {
  return <div className="my-1 border-t border-dashed border-black" />;
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={"flex justify-between " + (forte ? "text-[11px] font-bold" : "")}>
      <span>{rotulo}</span>
      <span>{valor}</span>
    </div>
  );
}

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function espacar(chave: string): string {
  return chave.replace(/(.{4})/g, "$1 ").trim();
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
