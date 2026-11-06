"use client";

import { Field, Input } from "@/app/ui/primitives";
import type { VolumesNFe } from "@/lib/nfe/types";

// Texto enquanto digita; vira número só na emissão (lerVolumes).
export type VolumesForm = {
  quantidade: string;
  especie: string;
  marca: string;
  numeracao: string;
  pesoLiquido: string;
  pesoBruto: string;
};

export const VOLUMES_VAZIO: VolumesForm = {
  quantidade: "", especie: "", marca: "", numeracao: "", pesoLiquido: "", pesoBruto: "",
};

// Peso aceita ponto ou vírgula como decimal (até 3 casas, limite do XML).
// Ponto nunca é milhar aqui: "12.5" tem que continuar sendo 12,5 kg.
function digitarPeso(s: string): string {
  const [inteiro, ...resto] = s.replace(/\./g, ",").replace(/[^\d,]/g, "").split(",");
  const int = inteiro.slice(0, 12);
  return resto.length ? `${int},${resto.join("").slice(0, 3)}` : int;
}

const lerPeso = (s: string) => Number(s.replace(",", ".")) || undefined;

// Devolve undefined quando nada foi preenchido (a nota sai sem o grupo <vol>).
export function lerVolumes(f: VolumesForm): VolumesNFe | undefined {
  const v: VolumesNFe = {
    qVol: Number(f.quantidade) || undefined,
    esp: f.especie.trim() || undefined,
    marca: f.marca.trim() || undefined,
    nVol: f.numeracao.trim() || undefined,
    pesoL: lerPeso(f.pesoLiquido),
    pesoB: lerPeso(f.pesoBruto),
  };
  return Object.values(v).some((x) => x !== undefined) ? v : undefined;
}

export default function VolumesFields({
  value,
  onChange,
}: {
  value: VolumesForm;
  onChange: (v: VolumesForm) => void;
}) {
  const set = (campo: keyof VolumesForm, v: string) => onChange({ ...value, [campo]: v });

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Volumes transportados</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Quantidade">
          <Input
            inputMode="numeric"
            value={value.quantidade}
            onChange={(e) => set("quantidade", e.target.value.replace(/\D/g, "").slice(0, 15))}
            placeholder="0"
          />
        </Field>
        <Field label="Espécie">
          <Input value={value.especie} onChange={(e) => set("especie", e.target.value)} placeholder="Ex.: Caixa" maxLength={60} />
        </Field>
        <Field label="Marca">
          <Input value={value.marca} onChange={(e) => set("marca", e.target.value)} maxLength={60} />
        </Field>
        <Field label="Numeração">
          <Input value={value.numeracao} onChange={(e) => set("numeracao", e.target.value)} maxLength={60} />
        </Field>
        <Field label="Peso líquido (kg)">
          <Input
            inputMode="decimal"
            value={value.pesoLiquido}
            onChange={(e) => set("pesoLiquido", digitarPeso(e.target.value))}
            placeholder="0,000"
          />
        </Field>
        <Field label="Peso bruto (kg)">
          <Input
            inputMode="decimal"
            value={value.pesoBruto}
            onChange={(e) => set("pesoBruto", digitarPeso(e.target.value))}
            placeholder="0,000"
          />
        </Field>
      </div>
    </div>
  );
}
