"use server";

import { prisma } from "@/lib/prisma";
import { exigirEmpresa } from "@/lib/empresa";
import { decriptar } from "@/lib/crypto";
import { carregarCertificado } from "@/lib/nfe";
import { consultarDFe } from "@/lib/nfe/dfe";

const UF_IBGE: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

function extrai(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}

export type DFeResultado =
  | {
      ok: true;
      cStat: string | null;
      xMotivo: string | null;
      ultNSU: string;
      maxNSU: string;
      docs: { nsu: string; schema: string; tipo: string; chave: string; emitente: string; valor: string }[];
    }
  | { ok: false; erro: string };

// Consulta DFe da empresa ativa (teste/produção). ultNSU=0 traz desde o início.
export async function buscarDFe(ultNSU = "0"): Promise<DFeResultado> {
  try {
    const empresaId = await exigirEmpresa();
    const empresa = await prisma.emitente.findUniqueOrThrow({ where: { id: empresaId } });
    const cUF = UF_IBGE[empresa.uf];
    if (!cUF) return { ok: false, erro: `UF inválida: ${empresa.uf}` };
    if (!empresa.certData) return { ok: false, erro: "Certificado não configurado em Configurações." };

    const { pfxBase64, senha } = JSON.parse(decriptar(empresa.certData));
    const cert = carregarCertificado(pfxBase64, senha);

    // DFe é sobre documentos reais → ambiente de produção.
    const r = await consultarDFe(cert, { tpAmb: "1", cUF, cnpj: empresa.cnpj, ultNSU });

    const docs = r.docs.map((d) => {
      const chave = (d.xml.match(/\d{44}/) ?? [""])[0];
      return {
        nsu: d.nsu,
        schema: d.schema,
        tipo: d.schema.includes("resNFe") ? "Resumo NF-e"
          : d.schema.includes("procNFe") ? "NF-e completa"
          : d.schema.includes("resEvento") ? "Evento"
          : d.schema.includes("procEvento") ? "Evento completo"
          : d.schema,
        chave,
        emitente: extrai(d.xml, "xNome") ?? "—",
        valor: extrai(d.xml, "vNF") ?? "—",
      };
    });

    return { ok: true, cStat: r.cStat, xMotivo: r.xMotivo, ultNSU: r.ultNSU, maxNSU: r.maxNSU, docs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: msg };
  }
}
