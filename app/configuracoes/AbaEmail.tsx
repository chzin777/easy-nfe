"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, Input, SectionTitle, Textarea } from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import {
  obterConfigEmailNota,
  salvarConfigEmailNota,
  type ConfigEmailNotaView,
} from "./actions";

const VARIAVEIS = ["{cliente}", "{numero}", "{serie}", "{chave}", "{empresa}", "{valor}"];

export default function AbaEmail() {
  const [cfg, setCfg] = useState<ConfigEmailNotaView | null>(null);
  const [ativaEmissao, setAtivaEmissao] = useState(false);
  const [enviarXml, setEnviarXml] = useState(true);
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterConfigEmailNota().then((c) => {
      setCfg(c);
      setAtivaEmissao(c.ativaEmissao);
      setEnviarXml(c.enviarXml);
      setAssunto(c.assunto);
      setCorpo(c.corpo);
    });
  }, []);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarConfigEmailNota({ ativaEmissao, enviarXml, assunto, corpo });
    setSalvando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  if (!cfg) return <LightningLoader texto="Carregando…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
        <p>
          A NF-e é enviada ao cliente pelo <strong>e-mail do Easy-NFe</strong>. O cliente responde direto para o
          e-mail da sua empresa (Reply-To). O DANFE em PDF e o XML seguem em anexo.
        </p>
      </div>

      {!cfg.emailConfigurado && (
        <Card className="p-5">
          <SectionTitle>Serviço indisponível</SectionTitle>
          <p className="text-sm text-[var(--muted)]">
            O envio de e-mail ainda não foi configurado no servidor
            (<code className="rounded bg-slate-100 px-1">RESEND_API_KEY</code>). Avise o administrador.
          </p>
        </Card>
      )}

      <section>
        <SectionTitle>Envio automático</SectionTitle>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={ativaEmissao} onChange={(e) => setAtivaEmissao(e.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" />
            <span className="text-sm font-medium">Enviar a NF-e por e-mail assim que a nota for autorizada</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={enviarXml} onChange={(e) => setEnviarXml(e.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" />
            <span className="text-sm font-medium">Anexar o XML autorizado</span>
          </label>
          <p className="text-xs text-[var(--muted)]">
            Usa o e-mail cadastrado no cliente. No envio automático, o DANFE em PDF não é anexado (só no envio
            manual pela tela da nota); o e-mail já leva número, valor e chave de acesso.
          </p>
        </div>
      </section>

      <section>
        <SectionTitle>Assunto</SectionTitle>
        <Field label="Assunto do e-mail" hint="Em branco usa o padrão do sistema.">
          <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder={cfg.assuntoPadrao} />
        </Field>
      </section>

      <section>
        <SectionTitle>Mensagem</SectionTitle>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Variáveis disponíveis:{" "}
          {VARIAVEIS.map((v) => (
            <code key={v} className="mx-0.5 rounded bg-slate-100 px-1 font-mono text-xs">{v}</code>
          ))}
        </p>
        <Field label="Texto da mensagem" hint="Em branco usa a mensagem padrão. O texto entra no e-mail bonito da marca.">
          <Textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder={cfg.corpoPadrao}
            className="min-h-40"
          />
        </Field>
      </section>

      {erro && <p className="text-sm font-medium text-[var(--danger)]">{erro}</p>}

      <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
        {salvo && <span className="text-sm font-medium text-[var(--success)]">✓ Salvo</span>}
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar preferências"}</Button>
      </div>
    </div>
  );
}
