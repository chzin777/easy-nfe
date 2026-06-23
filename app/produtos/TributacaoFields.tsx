"use client";

import { Field, Input, Select } from "@/app/ui/primitives";

// Campos de tributação do ICMS (Regime Normal). Hoje cobre:
//  - CST 40: Isenção (sem destaque de imposto) — padrão.
//  - CST 20: Redução de base de cálculo — a partir da alíquota interna e da
//    carga efetiva (o que o contador costuma informar: "carne tem carga de 7%").
// Compartilhado entre o cadastro (stepper) e a edição (página de produtos).
export type TributacaoValue = {
  cst: string;
  aliquotaIcms: number; // pICMS (alíquota cheia, ex.: 19 em GO)
  reducaoBaseIcms: number; // pRedBC % (derivado da carga efetiva)
};

// Alíquota interna padrão de GO (desde 01/04/2024).
const ALIQUOTA_GO = 19;

const OPCOES_CST = [
  { value: "40", label: "Isenção (CST 40)" },
  { value: "20", label: "Redução de base de cálculo (CST 20)" },
];

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
function fmt(v: number): string {
  return v ? String(v).replace(".", ",") : "";
}
function parse(s: string): number {
  return Number(s.replace(",", ".").replace(/[^\d.]/g, "")) || 0;
}

export default function TributacaoFields({
  value,
  onChange,
}: {
  value: TributacaoValue;
  onChange: (patch: Partial<TributacaoValue>) => void;
}) {
  const reducao = value.cst === "20";
  // Carga efetiva = alíquota × (1 − pRedBC/100). É o que o contador informa.
  const cargaEfetiva = value.aliquotaIcms > 0 ? r2(value.aliquotaIcms * (1 - value.reducaoBaseIcms / 100)) : 0;

  // Ao trocar p/ Redução, já preenche a alíquota de GO se estiver vazia.
  function mudarCst(novo: string) {
    if (novo === "20" && !value.aliquotaIcms) onChange({ cst: novo, aliquotaIcms: ALIQUOTA_GO });
    else onChange({ cst: novo });
  }

  // Usuário digita a carga efetiva → calcula a redução da base (pRedBC) que o XML usa.
  function mudarCarga(txt: string) {
    const carga = parse(txt);
    const aliq = value.aliquotaIcms || ALIQUOTA_GO;
    const pRed = aliq > 0 ? r2(Math.min(Math.max((1 - carga / aliq) * 100, 0), 100)) : 0;
    onChange({ reducaoBaseIcms: pRed });
  }

  return (
    <>
      <Field label="Tributação do ICMS" hint="Como o imposto é tratado nesta venda">
        <Select opcoes={OPCOES_CST} value={value.cst} onChange={(e) => mudarCst(e.target.value)} />
      </Field>
      {reducao && (
        <>
          <Field label="Alíquota de ICMS (%)" hint="Interna do estado · GO = 19%">
            <Input
              inputMode="decimal"
              value={fmt(value.aliquotaIcms)}
              onChange={(e) => onChange({ aliquotaIcms: parse(e.target.value) })}
              placeholder="19"
            />
          </Field>
          <Field label="Carga efetiva (%)" hint="O quanto fica de imposto · o contador informa (ex.: 7)">
            <Input
              inputMode="decimal"
              value={fmt(cargaEfetiva)}
              onChange={(e) => mudarCarga(e.target.value)}
              placeholder="7"
            />
          </Field>
          <p className="text-xs text-[var(--muted)] sm:col-span-2">
            Redução da base aplicada: <b>{fmt(value.reducaoBaseIcms) || "0"}%</b> (pRedBC, calculado). Confirme a carga efetiva com o contador.
          </p>
        </>
      )}
    </>
  );
}
