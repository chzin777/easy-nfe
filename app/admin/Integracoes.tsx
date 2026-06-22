"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Select } from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import { obterConfigAsaas, salvarConfigAsaas, testarConexaoAsaas } from "./actions";
import type { AsaasConfigStatus, AsaasAmbiente } from "@/lib/asaas-config";

const AMBIENTES = [
  { value: "sandbox", label: "Sandbox (testes)" },
  { value: "producao", label: "Produção" },
];

export default function Integracoes() {
  const [status, setStatus] = useState<AsaasConfigStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [ambiente, setAmbiente] = useState<AsaasAmbiente>("sandbox");
  const [webhookToken, setWebhookToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  async function recarregar() {
    const s = await obterConfigAsaas();
    setStatus(s);
    setAmbiente(s.ambiente);
  }
  useEffect(() => {
    void recarregar();
    if (typeof window !== "undefined") setWebhookUrl(`${window.location.origin}/api/asaas/webhook`);
  }, []);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const r = await salvarConfigAsaas({ apiKey: apiKey || undefined, ambiente, webhookToken: webhookToken || undefined });
    setSalvando(false);
    if (!r.ok) { setMsg({ tom: "erro", texto: r.erro }); return; }
    setApiKey(""); setWebhookToken("");
    setMsg({ tom: "ok", texto: "Configuração salva." });
    void recarregar();
  }

  async function removerToken() {
    setSalvando(true);
    setMsg(null);
    const r = await salvarConfigAsaas({ ambiente, limparWebhookToken: true });
    setSalvando(false);
    if (!r.ok) { setMsg({ tom: "erro", texto: r.erro }); return; }
    setWebhookToken("");
    setMsg({ tom: "ok", texto: "Token do webhook removido. As notificações não exigem mais autenticação." });
    void recarregar();
  }

  async function testar() {
    setTestando(true);
    setMsg(null);
    const r = await testarConexaoAsaas();
    setTestando(false);
    setMsg(r.ok ? { tom: "ok", texto: "Conexão com o Asaas OK." } : { tom: "erro", texto: `Falha: ${r.erro}` });
  }

  function copiar() {
    navigator.clipboard?.writeText(webhookUrl).then(() => setMsg({ tom: "ok", texto: "URL do webhook copiada." }));
  }

  if (!status) return <LightningLoader texto="Carregando integração…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="space-y-5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Asaas — cobrança de assinaturas</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">Chave de API e token guardados criptografados no banco.</p>
          </div>
          {status.configurado ? (
            <Badge tom={status.ambiente === "producao" ? "success" : "warning"}>
              {status.ambiente === "producao" ? "Produção" : "Sandbox"}
            </Badge>
          ) : (
            <Badge tom="neutral">Não configurado</Badge>
          )}
        </div>

        {status.configurado && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-[var(--muted)]">
            Chave atual: <span className="font-mono">{status.apiKeyMascarada}</span>
            {status.origem === "env" && " (vinda de variável de ambiente)"}
            {status.temWebhookToken && " · token de webhook definido"}
          </p>
        )}

        <Field label="Chave de API (API Key)" hint={status.configurado ? "Deixe em branco para manter a atual." : "Cole a chave do painel Asaas."}>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={status.configurado ? "•••••••• (mantém a atual)" : "$aact_..."} autoComplete="off" />
        </Field>

        <Field label="Ambiente" required>
          <Select opcoes={AMBIENTES} value={ambiente} onChange={(e) => setAmbiente(e.target.value as AsaasAmbiente)} />
        </Field>

        <Field label="Token do webhook" hint="Opcional. Valida o header asaas-access-token nas notificações. Deixe em branco para manter.">
          <Input type="password" value={webhookToken} onChange={(e) => setWebhookToken(e.target.value)} placeholder={status.temWebhookToken ? "•••••••• (mantém o atual)" : "defina um token forte"} autoComplete="off" />
        </Field>
        {status.temWebhookToken && (
          <button type="button" onClick={removerToken} disabled={salvando} className="-mt-2 text-xs font-medium text-[var(--danger)] hover:underline">
            Remover token (webhook sem autenticação)
          </button>
        )}

        <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
          <p className="text-xs font-medium text-[var(--muted)]">URL do webhook (cadastre no painel Asaas)</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-slate-100 px-2 py-1.5 font-mono text-xs">{webhookUrl || "—"}</code>
            <Button variante="secondary" onClick={copiar} className="!px-3 !py-1.5 !text-xs">Copiar</Button>
          </div>
        </div>

        {msg && (
          <p className={"text-sm font-medium " + (msg.tom === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]")}>{msg.texto}</p>
        )}

        <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
          <Button variante="secondary" onClick={testar} disabled={testando || !status.configurado}>
            {testando ? "Testando…" : "Testar conexão"}
          </Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar configuração"}</Button>
        </div>
      </Card>
    </div>
  );
}
