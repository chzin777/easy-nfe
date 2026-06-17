"use client";

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
  function set<K extends keyof Endereco>(k: K, v: Endereco[K]) {
    onChange({ ...value, [k]: v });
  }
  return (
    <section>
      <SectionTitle>Endereço</SectionTitle>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <Field label="CEP" className="col-span-2">
          <Input value={value.cep} onChange={(e) => set("cep", e.target.value)} placeholder="00000-000" />
        </Field>
        <Field label="Logradouro" className="col-span-4">
          <Input value={value.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
        </Field>
        <Field label="Número" className="col-span-2">
          <Input value={value.numero} onChange={(e) => set("numero", e.target.value)} />
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
