"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/app/ui/Modal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Paginacao,
  Tabela,
  formatBRL,
  paginar,
  type Coluna,
} from "@/app/ui/primitives";
import NovoServicoModal from "./NovoServicoModal";
import {
  excluirServico,
  listarServicos,
  type Servico,
} from "./actions";

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [servicoEdit, setServicoEdit] = useState<Servico | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
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
    setServicoEdit(null);
    setErro(null);
    setModalAberto(true);
  }

  function abrirEdicao(s: Servico) {
    setServicoEdit(s);
    setErro(null);
    setModalAberto(true);
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
    {
      chave: "acoes",
      cabecalho: "",
      alinhar: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => abrirEdicao(s)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title="Editar serviço"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(s)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-[var(--danger)]"
            title="Excluir serviço"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Serviços"
        subtitulo="O que a empresa presta. Cada serviço leva o código nacional que o fisco usa para identificá-lo."
        acao={<Button onClick={abrirNovo}>+ Novo serviço</Button>}
      />

      {erro && !modalAberto && (
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

      {modalAberto && (
        <NovoServicoModal
          onFechar={() => setModalAberto(false)}
          servicoInicial={servicoEdit ?? undefined}
          onCriado={(salvo) => {
            setServicos((l) =>
              [...l.filter((s) => s.id !== salvo.id), salvo].sort((a, b) =>
                a.nome.localeCompare(b.nome, "pt-BR")
              )
            );
            setModalAberto(false);
          }}
        />
      )}

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
