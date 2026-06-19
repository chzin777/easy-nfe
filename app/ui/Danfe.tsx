"use client";

import { formatBRL, formatData } from "@/lib/format";
import { TIPOS_TRANSPORTE, rotulo } from "@/lib/mock-data";
import type { NotaCompleta } from "@/app/notas/actions";

// DANFE — Documento Auxiliar da NF-e (protótipo, leiaute fiel ao padrão nacional).
export default function Danfe({ nota }: { nota: NotaCompleta }) {
  const EMITENTE = nota.emitente;
  const cliente = nota.cliente;
  const transp = nota.transportadora;

  const serie = String(nota.serie).padStart(3, "0");
  const numeroFmt = formatNumero(nota.numero);
  const entrada = nota.tipoNota.includes("entrada");
  const natureza = entrada
    ? "COMPRA / ENTRADA DE MERCADORIA"
    : "VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS";
  const totalProdutos = nota.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const dataEmissao = formatData(nota.emitidaEm);
  const horaEmissao = formatHora(nota.emitidaEm);

  const protocolo =
    nota.status === "autorizada"
      ? `152${nota.chaveAcesso.slice(-13)} · ${dataEmissao} ${horaEmissao}`
      : nota.status === "cancelada"
        ? "NF-e CANCELADA"
        : "NF-e sem Autorização de Uso da SEFAZ";

  // "SEM VALOR FISCAL" só em homologação. Em produção, nota autorizada não tem marca.
  const watermark =
    nota.status === "cancelada"
      ? "CANCELADA"
      : nota.ambiente === "homologacao"
        ? "SEM VALOR FISCAL"
        : nota.status === "autorizada"
          ? ""
          : "SEM AUTORIZACAO";

  return (
    <div className="relative mx-auto w-full bg-white font-sans text-[9px] leading-tight text-black">
      {/* Marca d'água */}
      {watermark && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          <span
            className={
              "rotate-[-18deg] whitespace-nowrap text-[44px] font-bold uppercase tracking-wide " +
              (nota.status === "cancelada" ? "text-red-500/15" : "text-slate-400/15")
            }
          >
            {watermark}
          </span>
        </div>
      )}

      <div className="relative z-10">
        {/* ---- Canhoto ---- */}
        <div className="border border-black">
          <div className="flex items-start justify-between border-b border-black px-1.5 py-1">
            <div className="pr-2">
              <p>
                Recebemos de <strong>{EMITENTE.razaoSocial}</strong> os produtos e/ou serviços
                constantes da Nota Fiscal Eletrônica indicada ao lado.
              </p>
              <p className="mt-0.5">
                Emissão: {dataEmissao} &nbsp; Dest./Reme.: {cliente?.nome ?? nota.clienteNome}{" "}
                &nbsp; Valor Total: {formatBRL(nota.valorTotal)}
              </p>
            </div>
            <div className="w-28 shrink-0 border-l border-black pl-2 text-right">
              <p className="text-[12px] font-bold">NF-e</p>
              <p className="text-[10px] font-bold">Nº {numeroFmt}</p>
              <p className="text-[10px] font-bold">Série {serie}</p>
            </div>
          </div>
          <div className="flex">
            <Cel label="Data do recebimento" className="w-40" />
            <Cel label="Identificação e assinatura do recebedor" className="flex-1 border-l border-black" />
          </div>
        </div>

        <div className="my-1 border-t border-dashed border-black" />

        {/* ---- Cabeçalho principal ---- */}
        <div className="border border-black">
          <div className="flex">
            {/* Emitente */}
            <div className="flex w-[38%] flex-col justify-center border-r border-black p-2 text-center">
              <p className="text-[12px] font-bold uppercase leading-tight">{EMITENTE.nomeFantasia}</p>
              <p className="mt-1 text-left text-[8px]">
                {EMITENTE.endereco.logradouro}, {EMITENTE.endereco.numero}
                <br />
                {EMITENTE.endereco.bairro} · CEP {EMITENTE.endereco.cep}
                <br />
                {EMITENTE.endereco.municipio} - {EMITENTE.endereco.uf}
                <br />
                Fone: {EMITENTE.telefone}
              </p>
            </div>

            {/* DANFE centro */}
            <div className="flex w-[20%] flex-col items-center justify-center border-r border-black p-1 text-center">
              <p className="text-[14px] font-bold">DANFE</p>
              <p className="text-[7px] leading-tight">Documento Auxiliar da Nota Fiscal Eletrônica</p>
              <div className="mt-1 flex w-full items-center justify-center gap-1">
                <span className="text-left text-[7px] leading-none">
                  0 - ENTRADA
                  <br />1 - SAÍDA
                </span>
                <span className="flex h-5 w-5 items-center justify-center border border-black text-[12px] font-bold">
                  {entrada ? "0" : "1"}
                </span>
              </div>
              <p className="mt-1 text-[9px] font-bold">Nº {numeroFmt}</p>
              <p className="text-[9px] font-bold">SÉRIE {serie}</p>
              <p className="text-[8px]">FOLHA 1/1</p>
            </div>

            {/* Barcode + chave */}
            <div className="flex w-[42%] flex-col justify-center p-2">
              <Barcode chave={nota.chaveAcesso} />
              <p className="mt-1 text-[7px] uppercase text-slate-600">Chave de acesso</p>
              <p className="font-mono text-[9px] font-semibold tracking-tight">{espacar(nota.chaveAcesso)}</p>
              <p className="mt-1 text-[7px]">
                Consulta de autenticidade no portal nacional da NF-e
                <br />
                www.nfe.fazenda.gov.br/portal ou no site da Sefaz autorizadora
              </p>
            </div>
          </div>

          {/* Natureza + protocolo */}
          <div className="flex border-t border-black">
            <Cel label="Natureza da operação" className="flex-1">{natureza}</Cel>
            <Cel label="Protocolo de autorização de uso" className="w-[42%] border-l border-black">
              {protocolo}
            </Cel>
          </div>
          {/* IE / IE ST / CNPJ */}
          <div className="flex border-t border-black">
            <Cel label="Inscrição estadual" className="flex-1">{EMITENTE.ie}</Cel>
            <Cel label="Inscr. estadual do subst. tributário" className="flex-1 border-l border-black" />
            <Cel label="CNPJ" className="flex-1 border-l border-black">{EMITENTE.cnpj}</Cel>
          </div>
        </div>

        {/* ---- Destinatário ---- */}
        <Titulo>Destinatário / Remetente</Titulo>
        <div className="border border-black">
          <div className="flex">
            <Cel label="Nome / Razão social" className="flex-1">{cliente?.nome ?? nota.clienteNome}</Cel>
            <Cel label="CNPJ / CPF" className="w-44 border-l border-black">{cliente?.documento ?? "—"}</Cel>
            <Cel label="Data da emissão" className="w-28 border-l border-black">{dataEmissao}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Endereço" className="flex-1">
              {cliente ? `${cliente.endereco.logradouro}, ${cliente.endereco.numero} ${cliente.endereco.complemento}` : "—"}
            </Cel>
            <Cel label="Bairro / Distrito" className="w-44 border-l border-black">{cliente?.endereco.bairro ?? "—"}</Cel>
            <Cel label="CEP" className="w-24 border-l border-black">{cliente?.endereco.cep ?? "—"}</Cel>
            <Cel label="Data da saída" className="w-28 border-l border-black">{dataEmissao}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Município" className="flex-1">{cliente?.endereco.municipio ?? "—"}</Cel>
            <Cel label="UF" className="w-12 border-l border-black">{cliente?.endereco.uf ?? "—"}</Cel>
            <Cel label="Telefone / Fax" className="w-40 border-l border-black">{cliente.telefone || "—"}</Cel>
            <Cel label="Inscrição estadual" className="w-40 border-l border-black">{cliente.ie || "ISENTO"}</Cel>
            <Cel label="Hora da saída" className="w-28 border-l border-black">{horaEmissao}</Cel>
          </div>
        </div>

        {/* ---- Cálculo do imposto ---- */}
        <Titulo>Cálculo do imposto</Titulo>
        <div className="border border-black">
          <div className="flex">
            <Cel label="Base de cálculo do ICMS" className="flex-1" alinhar="right">0,00</Cel>
            <Cel label="Valor do ICMS" className="flex-1 border-l border-black" alinhar="right">0,00</Cel>
            <Cel label="Base de cálc. ICMS subst." className="flex-1 border-l border-black" alinhar="right">0,00</Cel>
            <Cel label="Valor do ICMS subst." className="flex-1 border-l border-black" alinhar="right">0,00</Cel>
            <Cel label="Valor total dos produtos" className="flex-1 border-l border-black" alinhar="right">{moeda(totalProdutos)}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Valor do frete" className="flex-1" alinhar="right">0,00</Cel>
            <Cel label="Valor do seguro" className="flex-1 border-l border-black" alinhar="right">0,00</Cel>
            <Cel label="Desconto" className="flex-1 border-l border-black" alinhar="right">0,00</Cel>
            <Cel label="Outras desp. acessórias" className="flex-1 border-l border-black" alinhar="right">0,00</Cel>
            <Cel label="Valor do IPI" className="flex-1 border-l border-black" alinhar="right">0,00</Cel>
            <Cel label="Valor total da nota" className="flex-1 border-l border-black bg-slate-50" alinhar="right">
              <strong>{moeda(nota.valorTotal)}</strong>
            </Cel>
          </div>
        </div>

        {/* ---- Transportador ---- */}
        <Titulo>Transportador / Volumes transportados</Titulo>
        <div className="border border-black">
          <div className="flex">
            <Cel label="Nome / Razão social" className="flex-1">{transp?.nome ?? "—"}</Cel>
            <Cel label="Frete por conta" className="w-40 border-l border-black">
              {transp ? rotulo(TIPOS_TRANSPORTE, transp.tipoTransporte) : "9 - Sem frete"}
            </Cel>
            <Cel label="Código ANTT" className="w-24 border-l border-black" />
            <Cel label="Placa do veículo" className="w-24 border-l border-black" />
            <Cel label="UF" className="w-12 border-l border-black">{transp?.endereco.uf ?? "—"}</Cel>
            <Cel label="CNPJ / CPF" className="w-36 border-l border-black">{transp?.documento ?? "—"}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Endereço" className="flex-1">{transp?.endereco.logradouro ?? "—"}</Cel>
            <Cel label="Município" className="w-44 border-l border-black">{transp?.endereco.municipio ?? "—"}</Cel>
            <Cel label="UF" className="w-12 border-l border-black">{transp?.endereco.uf ?? "—"}</Cel>
            <Cel label="Inscrição estadual" className="w-44 border-l border-black">{transp?.ie ?? "—"}</Cel>
          </div>
          <div className="flex border-t border-black">
            <Cel label="Quantidade" className="flex-1" />
            <Cel label="Espécie" className="flex-1 border-l border-black" />
            <Cel label="Marca" className="flex-1 border-l border-black" />
            <Cel label="Numeração" className="flex-1 border-l border-black" />
            <Cel label="Peso bruto" className="flex-1 border-l border-black" alinhar="right" />
            <Cel label="Peso líquido" className="flex-1 border-l border-black" alinhar="right" />
          </div>
        </div>

        {/* ---- Produtos ---- */}
        <Titulo>Dados dos produtos / serviços</Titulo>
        <table className="w-full border-collapse border border-black text-[8px]">
          <thead>
            <tr className="bg-slate-100 text-center uppercase">
              <Th>Cód.</Th>
              <th className="border border-black px-1 py-0.5 text-left">Descrição do produto / serviço</th>
              <Th>NCM/SH</Th>
              <Th>CSOSN</Th>
              <Th>CFOP</Th>
              <Th>Un.</Th>
              <Th>Qtde</Th>
              <Th>Vlr. unit.</Th>
              <Th>Vlr. desc.</Th>
              <Th>Vlr. total</Th>
              <Th>BC ICMS</Th>
              <Th>Vlr. ICMS</Th>
              <Th>Vlr. IPI</Th>
              <Th>Alíq. ICMS</Th>
              <Th>Alíq. IPI</Th>
            </tr>
          </thead>
          <tbody>
            {nota.itens.map((it, idx) => (
              <tr key={idx} className="text-center">
                <Td>{it.codigo}</Td>
                <td className="border border-black px-1 py-0.5 text-left">{it.nome}</td>
                <Td>{it.ncm || "—"}</Td>
                <Td>0300</Td>
                <Td>{it.cfop || (entrada ? "1102" : "5102")}</Td>
                <Td>{it.unidade}</Td>
                <Td alinhar="right">{it.quantidade.toFixed(2).replace(".", ",")}</Td>
                <Td alinhar="right">{moeda(it.precoUnitario)}</Td>
                <Td alinhar="right">0,00</Td>
                <Td alinhar="right">{moeda(it.quantidade * it.precoUnitario)}</Td>
                <Td alinhar="right">0,00</Td>
                <Td alinhar="right">0,00</Td>
                <Td alinhar="right">0,00</Td>
                <Td alinhar="right">0,00</Td>
                <Td alinhar="right">0,00</Td>
              </tr>
            ))}
            {/* linhas em branco para preencher visualmente */}
            {Array.from({ length: Math.max(0, 6 - nota.itens.length) }).map((_, i) => (
              <tr key={`vazio-${i}`} className="text-center">
                {Array.from({ length: 15 }).map((__, j) => (
                  <td key={j} className="border border-black px-1 py-1.5">&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- Dados adicionais ---- */}
        <Titulo>Dados adicionais</Titulo>
        <div className="flex border border-black" style={{ minHeight: "70px" }}>
          <Cel label="Informações complementares" className="flex-1">
            {nota.informacoesAdicionais || "—"}
          </Cel>
          <Cel label="Reservado ao fisco" className="w-[38%] border-l border-black" />
        </div>

        <div className="mt-1 flex justify-between text-[7px] text-slate-500">
          <span>Data e hora da impressão: {dataEmissao} {horaEmissao}</span>
          <span>Easy-NFe · documento de demonstração · sem valor fiscal</span>
        </div>
      </div>
    </div>
  );
}

// ---- Subcomponentes ----

function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 mb-0.5 text-[8px] font-bold uppercase tracking-wide">{children}</p>;
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-black px-1 py-0.5">{children}</th>;
}

function Td({ children, alinhar = "left" }: { children: React.ReactNode; alinhar?: "left" | "right" }) {
  return (
    <td className={"border border-black px-1 py-0.5 " + (alinhar === "right" ? "text-right" : "text-center")}>
      {children}
    </td>
  );
}

// Código de barras fictício derivado da chave (apenas visual).
function Barcode({ chave }: { chave: string }) {
  const bars = chave.split("").flatMap((ch, i) => {
    const n = (parseInt(ch, 36) || 1) % 4;
    return [
      { w: n + 1, preto: true, k: `b${i}` },
      { w: ((n + i) % 3) + 1, preto: false, k: `w${i}` },
    ];
  });
  return (
    <div className="flex h-9 w-full items-stretch overflow-hidden">
      {bars.map((b) => (
        <span
          key={b.k}
          style={{ width: `${b.w}px`, background: b.preto ? "#000" : "#fff" }}
          className="shrink-0"
        />
      ))}
    </div>
  );
}

function espacar(chave: string): string {
  return chave.replace(/(.{4})/g, "$1 ").trim();
}

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumero(n: number): string {
  const s = String(n).padStart(9, "0");
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`;
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
