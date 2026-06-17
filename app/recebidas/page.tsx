"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Tabela,
  Textarea,
  EmptyState,
  formatBRL,
  formatData,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import LightningLoader from "@/app/ui/LightningLoader";
import {
  listarRecebidas,
  sincronizarRecebidas,
  manifestar,
  baixarXmlRecebida,
  type RecebidaUI,
  type ResumoSinc,
} from "./actions";
import type { TipoManifesto } from "@/lib/nfe/dfe";

const TOM_MANIFESTO: Record<string, "success" | "danger" | "warning" | "neutral" | "primary"> = {
  PENDENTE: "warning",
  CIENCIA: "primary",
  CONFIRMACAO: "success",
  DESCONHECIMENTO: "danger",
  NAO_REALIZADA: "danger",
};

const ROTULO_MANIFESTO: Record<string, string> = {
  PENDENTE: "pendente",
  CIENCIA: "ciência",
  CONFIRMACAO: "confirmada",
  DESCONHECIMENTO: "desconhecida",
  NAO_REALIZADA: "não realizada",
};

const ROTULO_TIPO: Record<string, string> = {
  resumo: "Resumo NF-e",
  nfe: "NF-e completa",
  evento: "Evento",
};

const OPCOES_MANIFESTO: { tipo: TipoManifesto; rotulo: string; desc: string }[] = [
  { tipo: "210210", rotulo: "Ciência da operação", desc: "Reconhece que tomou ciência da nota (não compromete)." },
  { tipo: "210200", rotulo: "Confirmação da operação", desc: "Confirma a transação descrita na nota." },
  { tipo: "210220", rotulo: "Desconhecimento", desc: "Declara que desconhece a operação." },
  { tipo: "210240", rotulo: "Operação não realizada", desc: "A operação não ocorreu (exige justificativa)." },
];

export default function NotasRecebidasPage() {
  const [docs, setDocs] = useState<RecebidaUI[]>([]);
  const [resumo, setResumo] = useState<ResumoSinc | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const [alvo, setAlvo] = useState<RecebidaUI | null>(null);
  const [tipoSel, setTipoSel] = useState<TipoManifesto>("210210");
  const [justificativa, setJustificativa] = useState("");
  const [processando, setProcessando] = useState(false);
  const [erroManif, setErroManif] = useState<string | null>(null);

  async function recarregar() {
    const r = await listarRecebidas();
    setDocs(r.docs);
    setResumo(r.resumo);
    setCarregando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recarregar();
  }, []);

  async function sincronizar() {
    setSincronizando(true);
    setAviso(null);
    const r = await sincronizarRecebidas();
    setSincronizando(false);
    if (!r.ok) {
      setAviso(r.erro);
      return;
    }
    setAviso(
      r.aviso ??
        (r.novas > 0
          ? `${r.novas} documento(s) novo(s) capturado(s).`
          : "Nenhum documento novo. Você está em dia."),
    );
    await recarregar();
  }

  function abrirManifesto(d: RecebidaUI) {
    setAlvo(d);
    setTipoSel("210210");
    setJustificativa("");
    setErroManif(null);
  }

  async function confirmarManifesto() {
    if (!alvo) return;
    setProcessando(true);
    setErroManif(null);
    const r = await manifestar({ notaId: alvo.id, tipo: tipoSel, justificativa });
    setProcessando(false);
    if ("erro" in r) {
      setErroManif(r.erro);
      return;
    }
    if (!r.ok) {
      setErroManif(`SEFAZ recusou (cStat ${r.cStat}): ${r.xMotivo ?? "—"}`);
      return;
    }
    setAlvo(null);
    await recarregar();
  }

  async function baixar(d: RecebidaUI) {
    const r = await baixarXmlRecebida(d.id);
    if (!r.ok || !r.xml) return;
    const blob = new Blob([r.xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.nome ?? "documento.xml";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.emitenteNome.toLowerCase().includes(q) ||
        d.emitenteCnpj.includes(q) ||
        d.chaveAcesso.includes(q),
    );
  }, [docs, busca]);

  const colunas: Coluna<RecebidaUI>[] = [
    {
      chave: "emitente",
      cabecalho: "Emitente",
      render: (d) => (
        <div>
          <p className="font-medium">{d.emitenteNome}</p>
          <p className="font-mono text-[11px] text-[var(--muted)]">{d.chaveAcesso || `NSU ${d.nsu}`}</p>
        </div>
      ),
    },
    {
      chave: "tipo",
      cabecalho: "Tipo",
      render: (d) => (
        <span className="text-xs">
          {ROTULO_TIPO[d.tipoDoc] ?? d.tipoDoc}
          {d.descricao ? ` · ${d.descricao}` : ""}
        </span>
      ),
    },
    {
      chave: "emissao",
      cabecalho: "Emissão",
      render: (d) => (d.emitidaEm ? formatData(d.emitidaEm) : "—"),
    },
    {
      chave: "valor",
      cabecalho: "Valor",
      alinhar: "right",
      render: (d) => (d.valorTotal != null ? <span className="font-medium">{formatBRL(d.valorTotal)}</span> : "—"),
    },
    {
      chave: "manifestacao",
      cabecalho: "Manifestação",
      alinhar: "center",
      render: (d) =>
        d.tipoDoc === "evento" ? (
          <span className="text-xs text-[var(--muted)]">—</span>
        ) : (
          <Badge tom={TOM_MANIFESTO[d.manifestacao] ?? "neutral"}>
            {ROTULO_MANIFESTO[d.manifestacao] ?? d.manifestacao}
          </Badge>
        ),
    },
    {
      chave: "acoes",
      cabecalho: "",
      alinhar: "right",
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button variante="ghost" onClick={(e) => { e.stopPropagation(); baixar(d); }}>
            XML
          </Button>
          <Button
            variante="ghost"
            disabled={d.tipoDoc === "evento" || !d.chaveAcesso}
            onClick={(e) => { e.stopPropagation(); abrirManifesto(d); }}
          >
            Manifestar
          </Button>
        </div>
      ),
    },
  ];

  const exigeJust = tipoSel === "210240";

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Notas recebidas (DF-e)"
        subtitulo="Documentos emitidos contra o seu CNPJ, baixados da SEFAZ, com manifestação do destinatário."
        acao={
          <Button onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? "Sincronizando…" : "Sincronizar com SEFAZ"}
          </Button>
        }
      />

      {resumo && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Último NSU</p>
            <p className="mt-1 font-mono text-sm">{resumo.ultNSU ?? "—"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Máximo NSU</p>
            <p className="mt-1 font-mono text-sm">{resumo.maxNSU ?? "—"}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Pendentes</p>
            <p className="mt-1 text-sm font-semibold">{resumo.pendentes}</p>
          </Card>
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Última sincronização</p>
            <p className="mt-1 text-sm">{resumo.sincronizadaEm ? formatData(resumo.sincronizadaEm) : "nunca"}</p>
          </Card>
        </div>
      )}

      {aviso && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
          {aviso}
        </div>
      )}

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <Input
            placeholder="Buscar por emitente, CNPJ ou chave…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Tabela
          colunas={colunas}
          dados={filtradas}
          vazio={
            carregando ? (
              <LightningLoader texto="Carregando notas recebidas…" />
            ) : (
              <EmptyState
                titulo="Nenhuma nota recebida"
                descricao="Clique em “Sincronizar com SEFAZ” para baixar os documentos emitidos contra o seu CNPJ."
              />
            )
          }
        />
        <div className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
          {filtradas.length} documento(s)
        </div>
      </Card>

      <Modal
        aberto={alvo !== null}
        onFechar={() => setAlvo(null)}
        titulo="Manifestação do destinatário"
        largura="max-w-lg"
        rodape={
          <>
            <Button variante="secondary" onClick={() => setAlvo(null)} disabled={processando}>
              Voltar
            </Button>
            <Button
              disabled={processando || (exigeJust && justificativa.trim().length < 15)}
              onClick={confirmarManifesto}
            >
              {processando ? "Enviando à SEFAZ…" : "Confirmar manifestação"}
            </Button>
          </>
        }
      >
        {alvo && (
          <div className="space-y-4 text-sm">
            <p className="text-[var(--muted)]">
              {alvo.emitenteNome} ·{" "}
              <span className="font-mono text-[11px]">{alvo.chaveAcesso}</span>
            </p>

            <div className="space-y-2">
              {OPCOES_MANIFESTO.map((o) => (
                <label
                  key={o.tipo}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition " +
                    (tipoSel === o.tipo
                      ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                      : "border-[var(--border)] hover:border-[var(--primary)]/40")
                  }
                >
                  <input
                    type="radio"
                    name="tipo-manifesto"
                    className="mt-1"
                    checked={tipoSel === o.tipo}
                    onChange={() => setTipoSel(o.tipo)}
                  />
                  <span>
                    <span className="font-medium">{o.rotulo}</span>
                    <span className="block text-xs text-[var(--muted)]">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>

            {exigeJust && (
              <Field label="Justificativa" required hint="Mínimo 15 caracteres (exigência SEFAZ).">
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Motivo de a operação não ter sido realizada…"
                />
              </Field>
            )}

            {erroManif && (
              <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {erroManif}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
