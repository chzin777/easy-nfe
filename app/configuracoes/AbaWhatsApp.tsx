"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge, Button, Card, Field, SectionTitle, Textarea } from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import {
  obterConfigWhatsApp,
  salvarConfigWhatsApp,
  statusWhatsApp,
  conectarWhatsApp,
  desconectarWhatsApp,
  type ConfigWhatsAppView,
} from "./actions";

// A integração depende de um worker que ainda não está no ar. Até subir, a aba
// mostra só o aviso abaixo — reativar é trocar este corpo por <AbaWhatsAppCompleta />.
export default function AbaWhatsApp() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-6 text-sm">
      <p className="font-medium">Envio por WhatsApp em desenvolvimento</p>
      <p className="mt-1 text-[var(--muted)]">
        Estamos finalizando a integração para enviar a NF-e ao cliente automaticamente pelo seu próprio
        número. Avisaremos assim que estiver disponível.
      </p>
    </div>
  );
}

// Implementação completa, preservada para quando o worker estiver disponível.
export function AbaWhatsAppCompleta() {
  const [cfg, setCfg] = useState<ConfigWhatsAppView | null>(null);

  // preferências (form)
  const [ativaEmissao, setAtivaEmissao] = useState(false);
  const [enviarDanfe, setEnviarDanfe] = useState(true);
  const [template, setTemplate] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // sessão (worker)
  const [conectado, setConectado] = useState(false);
  const [telefone, setTelefone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [erroSessao, setErroSessao] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    obterConfigWhatsApp().then((c) => {
      setCfg(c);
      setAtivaEmissao(c.ativaEmissao);
      setEnviarDanfe(c.enviarDanfe);
      setTemplate(c.template);
    });
  }, []);

  function pararPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function atualizarStatus() {
    const st = await statusWhatsApp();
    if (!st.ok) {
      setErroSessao(st.erro);
      return;
    }
    setErroSessao(null);
    setConectado(st.conectado);
    setTelefone(st.telefone ?? null);
    setQr(st.conectado ? null : st.qr ?? null);
    if (st.conectado) {
      setConectando(false);
      pararPoll();
    }
  }

  // Busca o status inicial e enquanto o worker estiver configurado + feature ok.
  useEffect(() => {
    if (!cfg?.workerConfigurado || !cfg.temFeature) return;
    void atualizarStatus();
    return pararPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.workerConfigurado, cfg?.temFeature]);

  async function conectar() {
    setConectando(true);
    setErroSessao(null);
    setQr(null);
    const r = await conectarWhatsApp();
    if (!r.ok) {
      setErroSessao(r.erro);
      setConectando(false);
      return;
    }
    setConectado(r.conectado);
    setTelefone(r.telefone ?? null);
    setQr(r.conectado ? null : r.qr ?? null);
    if (r.conectado) {
      setConectando(false);
      return;
    }
    // Aguarda o pareamento: re-busca o QR/status a cada 3s.
    pararPoll();
    pollRef.current = setInterval(() => void atualizarStatus(), 3000);
  }

  async function desconectar() {
    setConectando(false);
    pararPoll();
    const r = await desconectarWhatsApp();
    if (!r.ok) {
      setErroSessao(r.erro);
      return;
    }
    setConectado(false);
    setTelefone(null);
    setQr(null);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await salvarConfigWhatsApp({ ativaEmissao, enviarDanfe, template });
    setSalvando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  if (!cfg) return <LightningLoader texto="Carregando…" />;

  if (!cfg.temFeature) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-slate-50 p-6 text-sm">
        <p className="font-medium">Envio por WhatsApp não disponível no seu plano</p>
        <p className="mt-1 text-[var(--muted)]">
          Faça upgrade para um plano com a integração de WhatsApp e envie a NF-e ao cliente automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
        <p>
          Conecte seu <strong>próprio número de WhatsApp</strong> escaneando o QR Code (igual ao WhatsApp Web).
          A nota é enviada ao cliente quando autorizada. Use um número dedicado — uso intenso pode levar a
          bloqueio pelo WhatsApp.
        </p>
      </div>

      {!cfg.workerConfigurado ? (
        <Card className="p-5">
          <SectionTitle>Serviço indisponível</SectionTitle>
          <p className="text-sm text-[var(--muted)]">
            O serviço de WhatsApp ainda não foi configurado no servidor. Avise o administrador para definir o
            worker (<code className="rounded bg-slate-100 px-1">WHATSAPP_WORKER_URL</code>).
          </p>
        </Card>
      ) : (
        <section>
          <SectionTitle>Conexão</SectionTitle>
          <Card className="p-5">
            {conectado ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge tom="success">Conectado</Badge>
                  {telefone && <span className="font-mono text-sm">{telefone}</span>}
                </div>
                <Button variante="danger" onClick={desconectar}>Desconectar</Button>
              </div>
            ) : qr ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-[var(--muted)]">
                  No WhatsApp do celular: <strong>Configurações › Aparelhos conectados › Conectar aparelho</strong> e
                  aponte para o código.
                </p>
                <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                  <QRCodeSVG value={qr} size={220} />
                </div>
                <p className="text-xs text-[var(--muted)]">Aguardando leitura… o código atualiza sozinho.</p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">Nenhum número conectado.</p>
                <Button onClick={conectar} disabled={conectando}>
                  {conectando ? "Gerando QR Code…" : "Conectar WhatsApp"}
                </Button>
              </div>
            )}
            {erroSessao && <p className="mt-3 text-sm font-medium text-[var(--danger)]">{erroSessao}</p>}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Envio automático</SectionTitle>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={ativaEmissao} onChange={(e) => setAtivaEmissao(e.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" />
            <span className="text-sm font-medium">Enviar a NF-e ao cliente assim que a nota for autorizada</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={enviarDanfe} onChange={(e) => setEnviarDanfe(e.target.checked)} className="h-4 w-4 rounded border-[var(--border)]" />
            <span className="text-sm font-medium">Anexar o DANFE em PDF</span>
          </label>
          <p className="text-xs text-[var(--muted)]">
            O envio usa o telefone cadastrado no cliente. Sem telefone, a nota não é enviada.
          </p>
        </div>
      </section>

      <section>
        <SectionTitle>Mensagem</SectionTitle>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Variáveis disponíveis:{" "}
          {["{cliente}", "{numero}", "{chave}", "{empresa}", "{valor}"].map((v) => (
            <code key={v} className="mx-0.5 rounded bg-slate-100 px-1 font-mono text-xs">{v}</code>
          ))}
        </p>
        <Field label="Modelo da mensagem" hint="Em branco usa a mensagem padrão do sistema.">
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder={cfg.templatePadrao}
            className="min-h-32"
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
