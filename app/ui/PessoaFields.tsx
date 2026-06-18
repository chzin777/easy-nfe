"use client";

import { useState } from "react";
import { Field, Input, Select, SectionTitle } from "./primitives";
import { UFS } from "@/lib/mock-data";
import type { Contato, Endereco } from "@/lib/types";

export function ContatoFields({
  value,
  onChange,
}: {
  value: Contato;
  onChange: (c: Contato) => void;
}) {
  return (
    <section>
      <SectionTitle>Dados de contato</SectionTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Telefone">
          <Input
            value={value.telefone}
            onChange={(e) => onChange({ ...value, telefone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            placeholder="contato@empresa.com"
          />
        </Field>
      </div>
    </section>
  );
}

export function EnderecoFields({
  value,
  onChange,
}: {
  value: Endereco;
  onChange: (e: Endereco) => void;
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);

  function set<K extends keyof Endereco>(k: K, v: Endereco[K]) {
    onChange({ ...value, [k]: v });
  }

  // Autopreenche logradouro/bairro/município/UF a partir do CEP (ViaCEP).
  async function aoMudarCep(raw: string) {
    const digitos = raw.replace(/\D/g, "");
    set("cep", raw);
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const j = await r.json();
      if (!j.erro) {
        onChange({
          ...value,
          cep: raw,
          logradouro: j.logradouro || value.logradouro,
          bairro: j.bairro || value.bairro,
          municipio: j.localidade || value.municipio,
          uf: j.uf || value.uf,
        });
      }
    } catch {
      /* offline / CEP não encontrado — mantém o que o usuário digitou */
    } finally {
      setBuscandoCep(false);
    }
  }

  const semNumero = value.numero.trim().toUpperCase() === "S/N";

  return (
    <section>
      <SectionTitle>Endereço</SectionTitle>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <Field label="CEP" className="col-span-2" hint={buscandoCep ? "Buscando endereço…" : undefined}>
          <Input value={value.cep} onChange={(e) => aoMudarCep(e.target.value)} placeholder="00000-000" />
        </Field>
        <Field label="Logradouro" className="col-span-4">
          <Input value={value.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
        </Field>
        <Field label="Número" className="col-span-2">
          <div className="flex items-center gap-2">
            <Input
              value={semNumero ? "S/N" : value.numero}
              disabled={semNumero}
              onChange={(e) => set("numero", e.target.value)}
              className="flex-1"
            />
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-[var(--muted)]">
              <input
                type="checkbox"
                checked={semNumero}
                onChange={(e) => set("numero", e.target.checked ? "S/N" : "")}
                className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
              />
              S/N
            </label>
          </div>
        </Field>
        <Field label="Complemento" className="col-span-4">
          <Input value={value.complemento} onChange={(e) => set("complemento", e.target.value)} />
        </Field>
        <Field label="Bairro" className="col-span-3">
          <Input value={value.bairro} onChange={(e) => set("bairro", e.target.value)} />
        </Field>
        <Field label="Município" className="col-span-2">
          <Input value={value.municipio} onChange={(e) => set("municipio", e.target.value)} />
        </Field>
        <Field label="UF" className="col-span-1">
          <Select opcoes={UFS} value={value.uf} onChange={(e) => set("uf", e.target.value)} />
        </Field>
      </div>
    </section>
  );
}
