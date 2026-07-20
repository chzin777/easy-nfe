"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  DateBR,
  Field,
  Input,
  PageHeader,
  Tabela,
  EmptyState,
  Paginacao,
  paginar,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import MoneyInput from "@/app/ui/MoneyInput";
import LightningLoader from "@/app/ui/LightningLoader";
import { formatBRL, formatData } from "@/lib/format";
import { listarClientes } from "@/app/clientes/actions";
import { listarProdutos } from "@/app/produtos/actions";
import ClientePicker from "@/app/notas/nova/ClientePicker";
import ProdutoPicker from "@/app/notas/nova/ProdutoPicker";
import type { Cliente, Produto } from "@/lib/types";
import {
  listarCaderneta,
  listarLancamentos,
  registrarLancamento,
  excluirLancamento,
  type ContaFiado,
  type LancamentoFiado,
  type TipoLancamento,
} from "./actions";

// Data de hoje em YYYY-MM-DD (fuso local) p/ default do formulário.
function hojeISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

type FormLanc = {
  clienteId: string;
  tipo: TipoLancamento;
  produtoId: string;
  valor: number;
  descricao: string;
  data: string;
};

const formVazio: FormLanc = {
  clienteId: "",
  tipo: "DEBITO",
  produtoId: "",
  valor: 0,
  descricao: "",
  data: hojeISO(),
};

export default function CadernetaPage() {
  const [contas, setContas] = useState<ContaFiado[]>([]);
  const [totalDevedor, setTotalDevedor] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  // modal de lançamento (novo / rápido)
  const [modalLanc, setModalLanc] = useState(false);
  const [form, setForm] = useState<FormLanc>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // modal de detalhe (extrato do cliente)
  const [detalhe, setDetalhe] = useState<ContaFiado | null>(null);
  const [extrato, setExtrato] = useState<LancamentoFiado[]>([]);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [paginaExtrato, setPaginaExtrato] = useState(1);

  async function recarregar() {
    try {
      const [cad, cs, ps] = await Promise.all([listarCaderneta(), listarClientes(), listarProdutos()]);
      setContas(cad.contas);
      setTotalDevedor(cad.totalDevedor);
      // Consumidor final (padrão) não faz sentido no fiado.
      setClientes(cs.filter((c) => !c.padrao));
      setProdutos(ps);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => {
    void recarregar();
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contas;
    return contas.filter(
      (c) => c.clienteNome.toLowerCase().includes(q) || c.documento.includes(q),
    );
  }, [contas, busca]);

  // A tabela precisa de `id`; monta a lista já no formato antes de fatiar.
  const linhas = useMemo(() => filtradas.map((c) => ({ ...c, id: c.clienteId })), [filtradas]);
  const pag = paginar(linhas, pagina, porPagina);
  const pagExtrato = paginar(extrato, paginaExtrato, 10);

  const devedores = contas.filter((c) => c.saldo > 0.005).length;

  function abrirNovo(clienteId = "", tipo: TipoLancamento = "DEBITO") {
    setForm({ ...formVazio, data: hojeISO(), clienteId, tipo });
    setErro("");
    setModalLanc(true);
  }

  async function salvarLancamento() {
    setErro("");
    if (!form.clienteId) return setErro("Selecione um cliente.");
    if (form.tipo === "DEBITO" && !form.produtoId) return setErro("Selecione o produto comprado.");
    if (!(form.valor > 0)) return setErro("Informe um valor maior que zero.");
    setSalvando(true);
    try {
      await registrarLancamento({
        clienteId: form.clienteId,
        tipo: form.tipo,
        valor: form.valor,
        descricao: form.descricao,
        data: form.data,
      });
      setModalLanc(false);
      await recarregar();
      // Se o detalhe estava aberto p/ esse cliente, atualiza o extrato.
      if (detalhe && detalhe.clienteId === form.clienteId) {
        await abrirDetalhe(form.clienteId);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  async function abrirDetalhe(clienteId: string) {
    const conta = contas.find((c) => c.clienteId === clienteId) ?? null;
    // Só volta ao topo do extrato ao trocar de cliente — recarregar após excluir
    // um lançamento mantém a página em que o usuário estava.
    if (detalhe?.clienteId !== clienteId) setPaginaExtrato(1);
    setDetalhe(conta);
    setCarregandoExtrato(true);
    try {
      setExtrato(await listarLancamentos(clienteId));
    } finally {
      setCarregandoExtrato(false);
    }
  }

  async function removerLancamento(id: string) {
    if (!detalhe) return;
    await excluirLancamento(id);
    await recarregar();
    await abrirDetalhe(detalhe.clienteId);
  }

  const colunas: Coluna<ContaFiado & { id: string }>[] = [
    {
      chave: "cliente",
      cabecalho: "Cliente",
      render: (c) => (
        <div>
          <p className="font-medium">{c.clienteNome}</p>
          <p className="text-xs text-[var(--muted)]">{c.documento || c.telefone || "—"}</p>
        </div>
      ),
    },
    {
      chave: "compras",
      cabecalho: "Comprou",
      alinhar: "right",
      render: (c) => <span className="tabular-nums text-[var(--muted)]">{formatBRL(c.totalCompras)}</span>,
    },
    {
      chave: "pago",
      cabecalho: "Pagou",
      alinhar: "right",
      render: (c) => <span className="tabular-nums text-[var(--muted)]">{formatBRL(c.totalPago)}</span>,
    },
    {
      chave: "saldo",
      cabecalho: "Saldo devedor",
      alinhar: "right",
      render: (c) =>
        c.saldo > 0.005 ? (
          <Badge tom="danger">{formatBRL(c.saldo)}</Badge>
        ) : c.saldo < -0.005 ? (
          <Badge tom="primary">{formatBRL(-c.saldo)} a favor</Badge>
        ) : (
          <Badge tom="success">Quitado</Badge>
        ),
    },
    {
      chave: "ultimo",
      cabecalho: "Último",
      alinhar: "right",
      render: (c) => <span className="text-xs text-[var(--muted)]">{formatData(c.ultimoLancamento)}</span>,
    },
  ];

  const saldoDetalhe = detalhe?.saldo ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Caderneta"
        subtitulo="Controle de contas fiado. Registre compras e pagamentos por cliente."
        acao={<Button onClick={() => abrirNovo()}>+ Novo lançamento</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Total a receber</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--danger)]">{formatBRL(totalDevedor)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Clientes devendo</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{devedores}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Contas na caderneta</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{contas.length}</p>
        </Card>
      </div>

      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <Input
            placeholder="Buscar por nome ou CPF/CNPJ…"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
          />
        </div>
        {carregando ? (
          <LightningLoader texto="Carregando caderneta…" />
        ) : (
          <>
            <Tabela
              colunas={colunas}
              dados={pag.fatia}
              onRowClick={(c) => abrirDetalhe(c.clienteId)}
              vazio={
                <EmptyState
                  titulo="Caderneta vazia"
                  descricao="Registre a primeira compra fiado em “Novo lançamento”."
                />
              }
            />
            <Paginacao
              total={filtradas.length}
              pagina={pag.pagina}
              paginas={pag.paginas}
              porPagina={porPagina}
              onPagina={setPagina}
              onPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
              rotulo="cliente"
            />
          </>
        )}
      </Card>

      {/* Modal: novo lançamento */}
      <Modal
        aberto={modalLanc}
        onFechar={() => setModalLanc(false)}
        titulo="Novo lançamento"
        largura="max-w-lg"
        rodape={
          <>
            <Button variante="secondary" onClick={() => setModalLanc(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvarLancamento} disabled={salvando}>
              {salvando ? "Salvando…" : "Registrar"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Tipo: compra fiado x pagamento */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, tipo: "DEBITO" }))}
              className={
                "min-h-[48px] rounded-lg border px-3 py-2.5 text-sm font-medium transition " +
                (form.tipo === "DEBITO"
                  ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-slate-300")
              }
            >
              Compra fiado
            </button>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, tipo: "CREDITO", produtoId: "", descricao: "" }))
              }
              className={
                "min-h-[48px] rounded-lg border px-3 py-2.5 text-sm font-medium transition " +
                (form.tipo === "CREDITO"
                  ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-slate-300")
              }
            >
              Pagamento
            </button>
          </div>

          <Field label="Cliente" required>
            <ClientePicker
              clientes={clientes}
              value={form.clienteId}
              onChange={(id) => setForm((f) => ({ ...f, clienteId: id }))}
              onCriado={(c) => {
                setClientes((cs) => [...cs, c]);
                setForm((f) => ({ ...f, clienteId: c.id }));
              }}
            />
          </Field>

          {/* Produto: só na compra fiado. Ao selecionar, sugere o preço de venda. */}
          {form.tipo === "DEBITO" && (
            <Field label="Produto" required>
              <ProdutoPicker
                produtos={produtos}
                value={form.produtoId}
                onChange={(id) => {
                  const p = produtos.find((x) => x.id === id);
                  setForm((f) => ({
                    ...f,
                    produtoId: id,
                    descricao: p?.nome ?? "",
                    valor: p ? p.preco : f.valor,
                  }));
                }}
                onCriado={(p) => {
                  setProdutos((ps) => [...ps, p]);
                  setForm((f) => ({ ...f, produtoId: p.id, descricao: p.nome, valor: p.preco }));
                }}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor" required>
              <MoneyInput value={form.valor} onChange={(valor) => setForm((f) => ({ ...f, valor }))} />
            </Field>
            <Field label="Data">
              <DateBR
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              />
            </Field>
          </div>

          {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
        </div>
      </Modal>

      {/* Modal: extrato do cliente */}
      <Modal
        aberto={detalhe !== null}
        onFechar={() => setDetalhe(null)}
        titulo={detalhe?.clienteNome ?? "Cliente"}
        rodape={
          detalhe ? (
            <>
              <Button variante="secondary" onClick={() => abrirNovo(detalhe.clienteId, "CREDITO")}>
                Registrar pagamento
              </Button>
              <Button onClick={() => abrirNovo(detalhe.clienteId, "DEBITO")}>Nova compra fiado</Button>
            </>
          ) : undefined
        }
      >
        {detalhe && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2,transparent)] p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Saldo devedor</p>
                <p
                  className={
                    "text-2xl font-bold tabular-nums " +
                    (saldoDetalhe > 0.005 ? "text-[var(--danger)]" : "text-[var(--success)]")
                  }
                >
                  {saldoDetalhe > 0.005
                    ? formatBRL(saldoDetalhe)
                    : saldoDetalhe < -0.005
                      ? `${formatBRL(-saldoDetalhe)} a favor`
                      : "Quitado"}
                </p>
              </div>
              <div className="text-right text-xs text-[var(--muted)]">
                <p>Comprou {formatBRL(detalhe.totalCompras)}</p>
                <p>Pagou {formatBRL(detalhe.totalPago)}</p>
              </div>
            </div>

            {carregandoExtrato ? (
              <LightningLoader texto="Carregando extrato…" />
            ) : extrato.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">Sem lançamentos.</p>
            ) : (
              <>
              <ul className="divide-y divide-[var(--border)]">
                {pagExtrato.fatia.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-3">
                    <span
                      className={
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                        (l.tipo === "DEBITO"
                          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                          : "bg-[var(--success-soft)] text-[var(--success)]")
                      }
                    >
                      {l.tipo === "DEBITO" ? "+" : "−"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {l.descricao || (l.tipo === "DEBITO" ? "Compra fiado" : "Pagamento")}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{formatData(l.data)}</p>
                    </div>
                    <span
                      className={
                        "shrink-0 text-sm font-semibold tabular-nums " +
                        (l.tipo === "DEBITO" ? "text-[var(--danger)]" : "text-[var(--success)]")
                      }
                    >
                      {l.tipo === "DEBITO" ? "+" : "−"}
                      {formatBRL(l.valor)}
                    </span>
                    <button
                      onClick={() => removerLancamento(l.id)}
                      aria-label="Excluir lançamento"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
              {/* Sem seletor de itens por página: o modal é estreito demais. */}
              <Paginacao
                total={extrato.length}
                pagina={pagExtrato.pagina}
                paginas={pagExtrato.paginas}
                porPagina={10}
                onPagina={setPaginaExtrato}
                rotulo="lançamento"
              />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
