import type { AmbienteNFSe, DadosDPS } from "./types";

// Montagem da DPS a partir do cadastro. Fica fora da server action para que a
// mesma função sirva de fonte única do que vai para a SEFIN — e possa ser
// exercitada em teste sem passar pela sessão do usuário.

const so = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export type EmpresaDPS = {
  cnpj: string;
  inscricaoMunicipal: string | null;
  telefone: string | null;
  email: string | null;
  codMunicipio: string;
  opSimpNac: string;
  regApTribSN: string | null;
  regEspTrib: string | null;
};

export type ClienteDPS = {
  nome: string;
  documento: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  telefone: string | null;
  email: string | null;
};

export type ServicoDPSInput = {
  descricao: string;
  cTribNac: string;
  cNBS: string;
  valorServico: number;
  aliqISS: number;
  tribISSQN: string;
  tpImunidade: string;
  issRetido: boolean;
  informacoesAdicionais: string;
};

export function montarDadosDps(args: {
  empresa: EmpresaDPS;
  cliente: ClienteDPS;
  input: ServicoDPSInput;
  ambiente: AmbienteNFSe;
  serie: number;
  numero: number;
  emitidaEm: Date;
  competencia: Date;
  cMunTomador: string;
  cLocPrestacao: string;
}): DadosDPS {
  const { empresa, cliente, input } = args;
  const doc = so(cliente.documento);
  return {
    ambiente: args.ambiente,
    serie: args.serie,
    numero: args.numero,
    emitidaEm: args.emitidaEm,
    competencia: args.competencia,
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
      cnpj: doc.length === 14 ? doc : undefined,
      cpf: doc.length === 11 ? doc : undefined,
      // Sem IM: o cadastro de cliente guarda inscrição estadual, que é outra
      // coisa — mandar uma no lugar da outra é rejeição.
      nome: cliente.nome,
      endereco: {
        cMun: args.cMunTomador,
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
      cLocPrestacao: args.cLocPrestacao,
      cTribNac: so(input.cTribNac),
      descricao: input.descricao.trim(),
      cNBS: so(input.cNBS) || undefined,
    },
    valores: {
      valorServico: input.valorServico,
      tribISSQN: input.tribISSQN,
      tpRetISSQN: input.issRetido ? "2" : "1",
      aliquotaISS: input.tribISSQN === "1" && input.aliqISS > 0 ? input.aliqISS : undefined,
      opSimpNac: empresa.opSimpNac,
      tpImunidade: input.tpImunidade || "0",
    },
    infoAdicional: input.informacoesAdicionais.trim() || undefined,
  };
}
