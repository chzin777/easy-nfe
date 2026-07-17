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
  Textarea,
  Tabela,
  EmptyState,
  formatBRL,
  formatData,
  type Coluna,
} from "@/app/ui/primitives";
import Modal from "@/app/ui/Modal";
import LightningLoader from "@/app/ui/LightningLoader";
import ClientePicker from "@/app/notas/nova/ClientePicker";
import ProdutoPicker from "@/app/notas/nova/ProdutoPicker";
import type { Cliente, Produto } from "@/lib/types";
import { listarClientes } from "@/app/clientes/actions";
import { listarProdutos } from "@/app/produtos/actions";
import {
  listarVendas,
  criarVenda,
  cancelarVenda,
  type VendaCompleta,
  type FormaPagamento,
  type ItemVendaInput,
} from "./actions";

const PAGAMENTOS: { value: FormaPagamento; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "fiado", label: "Fiado (caderneta)" },
  { value: "outro", label: "Outro" },
];
const PAG_LABEL = Object.fromEntries(PAGAMENTOS.map((p) => [p.value, p.label]));

export default function VendasPage() {
  const [vendas, setVendas] = useState<VendaCompleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nova, setNova] = useState(false);
  const [cancelarId, setCancelarId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  async function recarregar() {
    try {
      setVendas(await listarVendas());
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { void recarregar(); }, []);

  const totalMes = useMemo(() => {
    const agora = new Date();
    return vendas
      .filter((v) => v.status === "concluida")
      .filter((v) => {
        const d = new Date(v.data);
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
      })
      .reduce((s, v) => s + v.valorTotal, 0);
  }, [vendas]);

  async function confirmarCancelar() {
    if (!cancelarId) return;
    setCancelando(true);
    const r = await cancelarVenda(cancelarId);
    setCancelando(false);
    if (r.ok) { setCancelarId(null); await recarregar(); }
    else alert(r.erro);
  }

  const colunas: Coluna<VendaCompleta>[] = [
    {
      chave: "numero", cabecalho: "Venda",
      render: (v) => (
        <div>
          <p className="font-medium">#{v.numero}</p>
          <p className="text-xs text-[var(--muted)]">{formatData(v.data)}</p>
        </div>
      ),
    },
    {
      chave: "cliente", cabecalho: "Cliente",
      render: (v) => v.clienteNome,
    },
    {
      chave: "pagamento", cabecalho: "Pagamento",
      render: (v) => (
        <span className="inline-flex items-center gap-1.5">
          {PAG_LABEL[v.formaPagamento] ?? v.formaPagamento}
          {v.fiado && <Badge tom="warning">fiado</Badge>}
        </span>
      ),
    },
    {
      chave: "itens", cabecalho: "Itens", alinhar: "center",
      render: (v) => v.itens.length,
    },
    {
      chave: "total", cabecalho: "Total", alinhar: "right",
      render: (v) => <span className="font-semibold">{formatBRL(v.valorTotal)}</span>,
    },
    {
      chave: "status", cabecalho: "Status", alinhar: "center",
      render: (v) => (v.status === "cancelada" ? <Badge tom="danger">cancelada</Badge> : <Badge tom="success">concluída</Badge>),
    },
    {
      chave: "acoes", cabecalho: "", alinhar: "right",
      render: (v) => v.status === "concluida" ? (
        <Button variante="ghost" className="text-[var(--danger)]" onClick={() => setCancelarId(v.id)}>Cancelar</Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Vendas"
        subtitulo="Registro de vendas sem emissão de nota fiscal. Documento sem valor fiscal."
        acao={<Button onClick={() => setNova(true)}>+ Nova venda</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-[var(--muted)]">Vendas no mês</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{formatBRL(totalMes)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--muted)]">Total de registros</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{vendas.filter((v) => v.status === "concluida").length}</p>
        </Card>
      </div>

      <Card>
        {carregando ? (
          <LightningLoader texto="Carregando vendas…" />
        ) : (
          <Tabela
            colunas={colunas}
            dados={vendas}
            vazio={<EmptyState titulo="Nenhuma venda registrada" descricao="Registre a primeira venda sem nota para começar." />}
          />
        )}
      </Card>

      {nova && (
        <NovaVendaModal
          onFechar={() => setNova(false)}
          onCriada={() => { setNova(false); void recarregar(); }}
        />
      )}

      <Modal
        aberto={cancelarId !== null}
        onFechar={() => setCancelarId(null)}
        titulo="Cancelar venda"
        largura="max-w-md"
        rodape={
          <div className="flex w-full justify-end gap-2">
            <Button variante="secondary" onClick={() => setCancelarId(null)} disabled={cancelando}>Voltar</Button>
            <Button variante="danger" onClick={confirmarCancelar} disabled={cancelando}>{cancelando ? "Cancelando…" : "Cancelar venda"}</Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          A venda será marcada como cancelada. Se houve baixa de estoque, os itens voltam ao saldo; se foi fiado, o débito é estornado na caderneta.
        </p>
      </Modal>
    </div>
  );
}

type ItemRow = { produtoId: string; nome: string; unidade: string; preco: number; quantidade: number };

function NovaVendaModal({ onFechar, onCriada }: { onFechar: () => void; onCriada: () => void }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [pagamento, setPagamento] = useState<FormaPagamento>("dinheiro");
  const [baixaEstoque, setBaixaEstoque] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [descontoValor, setDescontoValor] = useState("");
  const [itens, setItens] = useState<ItemRow[]>([]);
  const [addId, setAddId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listarClientes(), listarProdutos()]).then(([cs, ps]) => {
      setClientes(cs);
      setProdutos(ps);
    });
  }, []);

  function adicionar(produtoId: string) {
    const p = produtos.find((x) => x.id === produtoId);
    if (!p) return;
    setItens((prev) => {
      const existe = prev.find((i) => i.produtoId === produtoId);
      if (existe) return prev.map((i) => i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { produtoId: p.id, nome: p.nome, unidade: p.unidade, preco: p.preco, quantidade: 1 }];
    });
    setAddId("");
  }
  function setQtd(id: string, q: number) {
    setItens((prev) => prev.map((i) => i.produtoId === id ? { ...i, quantidade: q } : i));
  }
  function remover(id: string) {
    setItens((prev) => prev.filter((i) => i.produtoId !== id));
  }

  const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const desc = Number(descontoValor.replace(",", ".").replace(/[^\d.]/g, "")) || 0;
  const total = Math.max(0, Math.round((subtotal - desc) * 100) / 100);

  async function salvar() {
    setErro(null);
    if (!itens.length) { setErro("Adicione ao menos um produto."); return; }
    if (pagamento === "fiado" && !clienteId) { setErro("Venda fiado exige um cliente."); return; }
    setSalvando(true);
    const payload = {
      clienteId: clienteId || null,
      formaPagamento: pagamento,
      observacoes,
      desconto: { tipo: "valor" as const, valor: desc },
      baixaEstoque,
      itens: itens.map<ItemVendaInput>((i) => ({
        produtoId: i.produtoId, quantidade: i.quantidade, descTipo: "valor", descValor: 0,
      })),
    };
    const r = await criarVenda(payload);
    setSalvando(false);
    if (r.ok) onCriada();
    else setErro(r.erro);
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Nova venda (sem nota)"
      largura="max-w-2xl"
      rodape={
        <div className="flex w-full items-center justify-between">
          <span className="text-sm text-[var(--muted)]">Total: <b className="text-[var(--foreground)]">{formatBRL(total)}</b></span>
          <div className="flex gap-2">
            <Button variante="secondary" onClick={onFechar} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Registrar venda"}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente" hint="Opcional (obrigatório se fiado)">
            <ClientePicker
              clientes={clientes}
              value={clienteId}
              onChange={setClienteId}
              onCriado={(c) => { setClientes((prev) => [...prev, c]); setClienteId(c.id); }}
            />
          </Field>
          <Field label="Forma de pagamento">
            <Select
              opcoes={PAGAMENTOS}
              value={pagamento}
              onChange={(e) => setPagamento(e.target.value as FormaPagamento)}
            />
          </Field>
        </div>

        <Field label="Adicionar produto">
          <ProdutoPicker
            produtos={produtos}
            value={addId}
            onChange={adicionar}
            onCriado={(p) => { setProdutos((prev) => [...prev, p]); adicionar(p.id); }}
          />
        </Field>

        {/* Itens */}
        {itens.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
            {itens.map((i) => (
              <div key={i.produtoId} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.nome}</p>
                  <p className="text-xs text-[var(--muted)]">{formatBRL(i.preco)} / {i.unidade}</p>
                </div>
                <Input
                  inputMode="decimal"
                  className="w-20 text-right"
                  value={String(i.quantidade).replace(".", ",")}
                  onChange={(e) => setQtd(i.produtoId, Number(e.target.value.replace(",", ".").replace(/[^\d.]/g, "")) || 0)}
                />
                <span className="w-24 text-right text-sm font-semibold">{formatBRL(i.preco * i.quantidade)}</span>
                <button onClick={() => remover(i.produtoId)} aria-label="Remover" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-[var(--danger)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Desconto (R$)" hint="Opcional">
            <Input inputMode="decimal" value={descontoValor} onChange={(e) => setDescontoValor(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Baixar estoque?">
            <label className="flex h-[46px] items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-sm">
              <input
                type="checkbox"
                checked={baixaEstoque}
                onChange={(e) => setBaixaEstoque(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Dar baixa no estoque dos produtos controlados
            </label>
          </Field>
        </div>

        <Field label="Observações" hint="Opcional">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: entrega, comprador, condição…" />
        </Field>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm">
          <span className="text-[var(--muted)]">Subtotal {formatBRL(subtotal)} · Desconto {formatBRL(desc)}</span>
          <span className="text-base font-bold">Total {formatBRL(total)}</span>
        </div>

        {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
      </div>
    </Modal>
  );
}
