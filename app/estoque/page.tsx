"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Tabela,
  Textarea,
  EmptyState,
  Paginacao,
  paginar,
  formatBRL,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import LightningLoader from "@/app/ui/LightningLoader";
import type { Produto } from "@/lib/types";
import {
  listarProdutos,
  ajustarEstoque,
  ativarControleEstoque,
} from "@/app/produtos/actions";
import ExtratoEstoqueModal from "@/app/produtos/ExtratoEstoqueModal";
import { listarCategorias, type Categoria } from "@/app/categorias/actions";

type StatusFiltro = "todos" | "ok" | "baixo" | "zerado";

const fmtQtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

// Situação do saldo de um produto controlado.
function situacao(p: Produto): "ok" | "baixo" | "zerado" {
  if (p.estoque <= 0) return "zerado";
  if (p.estoqueMinimo > 0 && p.estoque <= p.estoqueMinimo) return "baixo";
  return "ok";
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  // A lista de produtos sem controle pagina por conta própria — não depende dos filtros acima.
  const [paginaSem, setPaginaSem] = useState(1);
  const [porPaginaSem, setPorPaginaSem] = useState(10);
  const [carregando, setCarregando] = useState(true);
  const [extratoId, setExtratoId] = useState<string | null>(null);
  const [ajusteId, setAjusteId] = useState<string | null>(null);
  const [ativarId, setAtivarId] = useState<string | null>(null);

  async function recarregar() {
    try {
      const [ps, cs] = await Promise.all([listarProdutos(), listarCategorias("produto")]);
      setProdutos(ps);
      setCategorias(cs);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void recarregar();
  }, []);

  const controlados = useMemo(() => produtos.filter((p) => p.controlaEstoque), [produtos]);
  const semControle = useMemo(() => produtos.filter((p) => !p.controlaEstoque), [produtos]);

  // Indicadores do topo.
  const kpis = useMemo(() => {
    let baixo = 0, zerado = 0, valor = 0;
    for (const p of controlados) {
      const s = situacao(p);
      if (s === "zerado") zerado++;
      else if (s === "baixo") baixo++;
      valor += p.estoque * (p.precoCusto || 0);
    }
    return { total: controlados.length, baixo, zerado, valor };
  }, [controlados]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return controlados.filter((p) => {
      if (filtroCategoria && p.categoriaId !== filtroCategoria) return false;
      if (filtroStatus !== "todos" && situacao(p) !== filtroStatus) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        p.codigoBarras.includes(q) ||
        String(p.codigoInterno).includes(q)
      );
    });
  }, [controlados, busca, filtroCategoria, filtroStatus]);

  const pag = paginar(filtrados, pagina, porPagina);
  const pagSem = paginar(semControle, paginaSem, porPaginaSem);

  const produtoAjuste = produtos.find((p) => p.id === ajusteId) ?? null;
  const produtoAtivar = produtos.find((p) => p.id === ativarId) ?? null;
  const produtoExtrato = produtos.find((p) => p.id === extratoId) ?? null;

  const colunas: Coluna<Produto>[] = [
    {
      chave: "nome", cabecalho: "Produto",
      render: (p) => (
        <div>
          <p className="font-medium">{p.nome}</p>
          <p className="text-xs text-[var(--muted)]">
            #{p.codigoInterno} · GTIN {p.codigoBarras || "—"}
          </p>
        </div>
      ),
    },
    {
      chave: "categoria", cabecalho: "Categoria",
      render: (p) => (p.categoriaNome ? <Badge tom="primary">{p.categoriaNome}</Badge> : <span className="text-slate-300">—</span>),
    },
    {
      chave: "saldo", cabecalho: "Saldo", alinhar: "right",
      render: (p) => {
        const s = situacao(p);
        return (
          <span className="inline-flex items-center justify-end gap-1.5">
            <span className={"font-semibold " + (s === "zerado" ? "text-[var(--danger)]" : s === "baixo" ? "text-[var(--warning)]" : "")}>
              {fmtQtd(p.estoque)} {p.unidade}
            </span>
            {s === "zerado" ? <Badge tom="danger">zerado</Badge> : s === "baixo" ? <Badge tom="warning">baixo</Badge> : null}
          </span>
        );
      },
    },
    {
      chave: "minimo", cabecalho: "Mínimo", alinhar: "right",
      render: (p) => (p.estoqueMinimo > 0 ? fmtQtd(p.estoqueMinimo) : <span className="text-slate-300">—</span>),
    },
    {
      chave: "custo", cabecalho: "Custo un.", alinhar: "right",
      render: (p) => (p.precoCusto > 0 ? <span className="text-[var(--muted)]">{formatBRL(p.precoCusto)}</span> : <span className="text-slate-300">—</span>),
    },
    {
      chave: "valor", cabecalho: "Valor em estoque", alinhar: "right",
      render: (p) => (p.precoCusto > 0 ? <span className="font-medium">{formatBRL(p.estoque * p.precoCusto)}</span> : <span className="text-slate-300">—</span>),
    },
    {
      chave: "acoes", cabecalho: "", alinhar: "right",
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button variante="secondary" onClick={(e) => { e.stopPropagation(); setAjusteId(p.id); }}>Ajustar</Button>
          <Button variante="ghost" onClick={(e) => { e.stopPropagation(); setExtratoId(p.id); }}>Extrato</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Estoque"
        subtitulo="Controle de saldo, entradas, saídas e valor do estoque."
      />

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard titulo="Produtos controlados" valor={String(kpis.total)} />
        <KpiCard titulo="Estoque baixo" valor={String(kpis.baixo)} tom={kpis.baixo > 0 ? "warning" : undefined} />
        <KpiCard titulo="Zerados" valor={String(kpis.zerado)} tom={kpis.zerado > 0 ? "danger" : undefined} />
        <KpiCard titulo="Valor em estoque" valor={formatBRL(kpis.valor)} />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_200px_180px]">
          <Input
            placeholder="Buscar por nome, marca, código ou GTIN…"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
          />
          <Select
            placeholder="Todas as categorias"
            opcoes={categorias.map((c) => ({ value: c.id, label: c.nome }))}
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value); setPagina(1); }}
          />
          <Select
            opcoes={[
              { value: "todos", label: "Todos os status" },
              { value: "ok", label: "Em dia" },
              { value: "baixo", label: "Estoque baixo" },
              { value: "zerado", label: "Zerados" },
            ]}
            value={filtroStatus}
            onChange={(e) => { setFiltroStatus(e.target.value as StatusFiltro); setPagina(1); }}
          />
        </div>
        {carregando ? (
          <LightningLoader texto="Carregando estoque…" />
        ) : (
          <>
            <Tabela
              colunas={colunas}
              dados={pag.fatia}
              vazio={
                <EmptyState
                  titulo="Nenhum produto no estoque"
                  descricao="Ative o controle de estoque nos produtos para acompanhar o saldo aqui."
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
              rotulo="produto"
            />
          </>
        )}
      </Card>

      {/* Produtos sem controle — habilitar por aqui */}
      {!carregando && semControle.length > 0 && (
        <Card>
          <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
            <div>
              <p className="font-semibold">Sem controle de estoque</p>
              <p className="text-sm text-[var(--muted)]">{semControle.length} produto(s) não acompanhados. Ative para começar a controlar o saldo.</p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {pagSem.fatia.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-xs text-[var(--muted)]">#{p.codigoInterno} · {p.unidade}</p>
                </div>
                <Button variante="secondary" onClick={() => setAtivarId(p.id)}>Ativar controle</Button>
              </li>
            ))}
          </ul>
          <Paginacao
            total={semControle.length}
            pagina={pagSem.pagina}
            paginas={pagSem.paginas}
            porPagina={porPaginaSem}
            onPagina={setPaginaSem}
            onPorPagina={(n) => { setPorPaginaSem(n); setPaginaSem(1); }}
            rotulo="produto"
          />
        </Card>
      )}

      {/* Modal de ajuste de saldo */}
      {produtoAjuste && (
        <AjusteModal
          produto={produtoAjuste}
          onFechar={() => setAjusteId(null)}
          onSalvo={() => { setAjusteId(null); void recarregar(); }}
        />
      )}

      {/* Modal de ativação de controle */}
      {produtoAtivar && (
        <AtivarModal
          produto={produtoAtivar}
          onFechar={() => setAtivarId(null)}
          onSalvo={() => { setAtivarId(null); void recarregar(); }}
        />
      )}

      {/* Extrato de movimentações */}
      {produtoExtrato && (
        <ExtratoEstoqueModal
          produtoId={produtoExtrato.id}
          nome={produtoExtrato.nome}
          onFechar={() => setExtratoId(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ titulo, valor, tom }: { titulo: string; valor: string; tom?: "warning" | "danger" }) {
  const cor = tom === "danger" ? "text-[var(--danger)]" : tom === "warning" ? "text-[var(--warning)]" : "";
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{titulo}</p>
      <p className={"mt-1 text-2xl font-bold tracking-tight " + cor}>{valor}</p>
    </Card>
  );
}

// Ajuste de saldo: define o saldo final e registra o movimento (ENTRADA/SAIDA/AJUSTE).
function AjusteModal({ produto, onFechar, onSalvo }: { produto: Produto; onFechar: () => void; onSalvo: () => void }) {
  const [saldo, setSaldo] = useState(String(produto.estoque).replace(".", ","));
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const novoSaldo = Number(saldo.replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
  const delta = novoSaldo - produto.estoque;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await ajustarEstoque(produto.id, novoSaldo, motivo || "Ajuste manual");
    setSalvando(false);
    if (r.ok) onSalvo();
    else setErro(r.erro);
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Ajustar estoque · ${produto.nome}`}
      largura="max-w-md"
      rodape={
        <div className="flex w-full justify-end gap-2">
          <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || delta === 0}>{salvando ? "Salvando…" : "Salvar ajuste"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-[var(--muted)]">Saldo atual</span>
          <span className="font-semibold">{fmtQtd(produto.estoque)} {produto.unidade}</span>
        </div>
        <Field label="Novo saldo" hint="Registra automaticamente entrada, saída ou ajuste conforme a diferença">
          <Input inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
        </Field>
        {delta !== 0 && (
          <p className="text-sm text-[var(--muted)]">
            Movimento: <span className={"font-medium " + (delta > 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
              {delta > 0 ? "+" : "−"}{fmtQtd(Math.abs(delta))} {produto.unidade}
            </span>
          </p>
        )}
        <Field label="Motivo" hint="Opcional">
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: contagem de inventário, perda, quebra…" />
        </Field>
        {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}

// Ativa o controle de estoque e opcionalmente lança o saldo inicial.
function AtivarModal({ produto, onFechar, onSalvo }: { produto: Produto; onFechar: () => void; onSalvo: () => void }) {
  const [inicial, setInicial] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const qtd = Number(inicial.replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    const r = await ativarControleEstoque(produto.id, true, qtd);
    setSalvando(false);
    if (r.ok) onSalvo();
    else setErro(r.erro);
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Ativar controle · ${produto.nome}`}
      largura="max-w-md"
      rodape={
        <div className="flex w-full justify-end gap-2">
          <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Ativando…" : "Ativar controle"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          A partir de agora o saldo passa a ser controlado e sofre baixa automática a cada NF-e emitida.
        </p>
        <Field label="Saldo inicial" hint="Opcional · quantidade em estoque hoje">
          <Input inputMode="decimal" value={inicial} onChange={(e) => setInicial(e.target.value)} placeholder="0" />
        </Field>
        {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}
