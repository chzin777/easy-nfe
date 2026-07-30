import type { AmbienteNFSe } from "./types";
import { dhBrasilia } from "./xml";

// Pedido de registro de evento da NFS-e Padrão Nacional. O cancelamento é o
// evento 101101 — a nota não é apagada: fica um evento amarrado à chave.
//
// O Id tem 59 caracteres: "PRE" + chave de acesso (50) + tipo do evento (6).
// O número do pedido fica só no campo nPedRegEvento, fora do Id — o texto do
// XSD diz o contrário, mas o validador da SEFIN exige 56 dígitos.
// Ordem dos campos é <xs:sequence>: trocar rejeita.

const NS = "http://www.sped.fazenda.gov.br/nfse";

const dig = (s: string) => (s ?? "").replace(/\D/g, "");

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 1 = erro na emissão | 2 = serviço não prestado | 9 = outros.
export type MotivoCancelamento = "1" | "2" | "9";

export const MOTIVOS_CANCELAMENTO: { value: MotivoCancelamento; label: string }[] = [
  { value: "1", label: "Erro na emissão" },
  { value: "2", label: "Serviço não prestado" },
  { value: "9", label: "Outros" },
];

export function montarPedidoCancelamento(args: {
  chaveAcesso: string;
  ambiente: AmbienteNFSe;
  verAplic: string;
  cnpjAutor: string;
  motivo: MotivoCancelamento;
  descricaoMotivo: string;
  emitidoEm: Date;
}): { xml: string; id: string } {
  const chave = dig(args.chaveAcesso);
  const id = "PRE" + chave + "101101";
  const doc = dig(args.cnpjAutor);

  const xml =
    `<pedRegEvento xmlns="${NS}" versao="1.00">` +
    `<infPedReg Id="${id}">` +
    `<tpAmb>${args.ambiente}</tpAmb>` +
    `<verAplic>${esc(args.verAplic)}</verAplic>` +
    `<dhEvento>${dhBrasilia(args.emitidoEm)}</dhEvento>` +
    (doc.length === 11 ? `<CPFAutor>${doc}</CPFAutor>` : `<CNPJAutor>${doc}</CNPJAutor>`) +
    `<chNFSe>${chave}</chNFSe>` +
    `<e101101>` +
    `<xDesc>Cancelamento de NFS-e</xDesc>` +
    `<cMotivo>${args.motivo}</cMotivo>` +
    `<xMotivo>${esc(args.descricaoMotivo.slice(0, 255))}</xMotivo>` +
    `</e101101>` +
    `</infPedReg>` +
    `</pedRegEvento>`;

  return { xml, id };
}
