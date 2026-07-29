"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/app/ui/Modal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Paginacao,
  Tabela,
  Textarea,
  formatBRL,
  paginar,
  type Coluna,
} from "@/app/ui/primitives";
import SeletorLC116 from "./SeletorLC116";
import {
  atualizarServico,
  criarServico,
  excluirServico,
  listarServicos,
  type Servico,
  type ServicoInput,
} from "./actions";

const VAZIO: ServicoInput = {
  nome: "",
  descricao: "",
  cTribNac: "",
  itemListaServico: "",
  cNBS: "",
  aliqISS: 0,
  valorUnit: 0,
};

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [form, setForm] = useState<ServicoInput>(VAZIO);
  const [editId, setEditId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState<Servico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarServicos()
      .then(setServicos)
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return servicos;
    const digitos = q.replace(/\D/g, "");
    return servicos.filter(
      (s) =>
        s.nome.toLowerCase().includes(q) ||
        (digitos !== "" && s.cTribNac.includes(digitos)) ||
        String(s.codigoInterno).includes(q),
    );
  }, [servicos, busca]);
  const pag = paginar(filtrados, pagina, porPagina);

  function abrirNovo() {
    setForm(VAZIO);
    setEditId(null);
    setErro(null);
    setAberto(true);
  }

  function abrirEdicao(s: Servico) {
    setForm({
      nome: s.nome,
      descricao: s.descricao,
      cTribNac: s.cTribNac,
      itemListaServico: s.itemListaServico,
      cNBS: s.cNBS,
      aliqISS: s.aliqISS,
      valorUnit: s.valorUnit,
    });
    setEditId(s.id);
    setErro(null);
    setAberto(true);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const salvo = editId ? await atualizarServico(editId, form) : await criarServico(form);
      setServicos((l) =>
        [...l.filter((s) => s.id !== salvo.id), salvo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
      setAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(s: Servico) {
    setConfirmar(null);
    try {
      await excluirServico(s.id);
      setServicos((l) => l.filter((x) => x.id !== s.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const colunas: Coluna<Servico>[] = [
    {
      chave: "codigo",
      cabecalho: "Cód.",
      valor: (s) => s.codigoInterno,
      render: (s) => <span className="font-mono text-xs">{s.codigoInterno}</span>,
    },
    {
      chave: "nome",
      cabecalho: "Serviço",
      valor: (s) => s.nome,
      render: (s) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{s.nome}</div>
          {s.descricao && <div className="truncate text-xs text-[var(--muted)]">{s.descricao}</div>}
        </div>
      ),
    },
    {
      chave: "cTribNac",
      cabecalho: "Código nacional",
      valor: (s) => s.cTribNac,
      render: (s) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{s.cTribNac}</span>
          {s.itemListaServico && <Badge>{s.itemListaServico}</Badge>}
        </div>
      ),
    },
    {
      chave: "aliqISS",
      cabecalho: "ISS",
      alinhar: "right",
      valor: (s) => s.aliqISS,
      render: (s) => (s.aliqISS > 0 ? `${s.aliqISS.toFixed(2)}%` : "—"),
    },
    {
      chave: "valor",
      cabecalho: "Valor",
      alinhar: "right",
      valor: (s) => s.valorUnit,
      render: (s) => <span className="font-medium">{formatBRL(s.valorUnit)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Serviços"
        subtitulo="O que a empresa presta. Cada serviço leva o código nacional que o fisco usa para identificá-lo."
        acao={<Button onClick={abrirNovo}>+ Novo serviço</Button>}
      />

      {erro && !aberto && (
        <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2.5 text-sm font-medium text-[var(--danger)]">
          {erro}
        </p>
      )}

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <Input
            placeholder="Buscar por nome, código nacional ou número"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
          />
        </div>

        {carregando ? (
          <div className="px-6 py-16 text-center text-sm text-[var(--muted)]">Carregando…</div>
        ) : (
          <>
            <Tabela
              colunas={colunas}
              dados={pag.fatia}
              onRowClick={abrirEdicao}
              vazio={
                <EmptyState
                  titulo="Nenhum serviço"
                  descricao="Cadastre os serviços que a empresa presta para poder emitir nota de serviço."
                />
              }
            />
            <Paginacao
              total={filtrados.length}
              pagina={pag.pagina}
              paginas={pag.paginas}
              porPagina={porPagina}
              onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
              rotulo="serviço"
            />
          </>
        )}
      </Card>

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={editId ? "Editar serviço" : "Novo serviço"}
        rodape={
          <div className="flex w-full items-center justify-between gap-2">
            {editId ? (
              <Button
                variante="danger"
                onClick={() => {
                  const s = servicos.find((x) => x.id === editId);
                  if (s) { setAberto(false); setConfirmar(s); }
                }}
                disabled={salvando}
              >
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variante="secondary" onClick={() => setAberto(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando || !form.nome.trim()}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {erro && aberto && (
            <p className="rounded-lg bg-[var(--danger-soft,#fee2e2)] px-3 py-2 text-sm text-[var(--danger)]">{erro}</p>
          )}

          <Field label="Nome" required>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Troca de óleo"
            />
          </Field>

          <Field label="Descrição" hint="Vai na nota como descrição do serviço prestado.">
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </Field>

          <Field label="Classificação do serviço" required hint="Busque pelo que a empresa faz — o código sai daqui.">
            <SeletorLC116
              cTribNac={form.cTribNac}
              itemLista={form.itemListaServico}
              onEscolher={(v) =>
                setForm((f) => ({
                  ...f,
                  cTribNac: v.cTribNac,
                  itemListaServico: v.itemListaServico,
                  // Só sugere a descrição legal quando o campo ainda está vazio.
                  descricao: f.descricao.trim() ? f.descricao : v.descricao,
                }))
              }
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Código de tributação nacional"
              required
              hint="Preenchido pela busca. Os 2 últimos dígitos são o desdobramento — ajuste se a sua prefeitura usar outro."
            >
              <Input
                value={form.cTribNac}
                onChange={(e) => setForm({ ...form, cTribNac: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                placeholder="140101"
                inputMode="numeric"
              />
            </Field>
            <Field label="Item da lista de serviços" hint="Ex.: 14.01">
              <Input
                value={form.itemListaServico}
                onChange={(e) => setForm({ ...form, itemListaServico: e.target.value })}
                placeholder="14.01"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Código NBS" hint="Opcional, 9 dígitos.">
              <Input
                value={form.cNBS}
                onChange={(e) => setForm({ ...form, cNBS: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Alíquota do ISS (%)" hint="A do seu município.">
              <Input
                type="number"
                step="0.01"
                value={form.aliqISS || ""}
                onChange={(e) => setForm({ ...form, aliqISS: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Valor padrão">
              <Input
                type="number"
                step="0.01"
                value={form.valorUnit || ""}
                onChange={(e) => setForm({ ...form, valorUnit: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        aberto={!!confirmar}
        onFechar={() => setConfirmar(null)}
        titulo="Excluir serviço"
        largura="max-w-md"
        camada="z-[60]"
        rodape={
          <div className="flex gap-2">
            <Button variante="secondary" onClick={() => setConfirmar(null)}>Voltar</Button>
            <Button variante="danger" onClick={() => confirmar && remover(confirmar)}>Excluir</Button>
          </div>
        }
      >
        <p className="text-sm">
          Remove <strong>{confirmar?.nome}</strong> do catálogo. As notas já emitidas continuam intactas.
        </p>
      </Modal>
    </div>
  );
}
