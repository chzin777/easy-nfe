"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  DateBR,
  formatBRL,
} from "@/app/ui/primitives";
import LightningLoader from "@/app/ui/LightningLoader";
import { baixarElementoPdf } from "@/app/ui/danfePdf";
import { obterEmpresaAtiva, type EmpresaDados } from "@/app/configuracoes/actions";
import { dadosRelatorio, type Dataset, type LinhaRelatorio } from "./actions";

type Fmt = "money" | "percent" | "number" | "text";
type ColDef = { chave: string; label: string; fmt?: Fmt };
type DatasetDef = { chave: Dataset; nome: string; descricao: string; temData: boolean; colunas: ColDef[] };

// Catálogo de datasets e colunas disponíveis. As chaves batem com o que
// dadosRelatorio() devolve por dataset.
const DATASETS: DatasetDef[] = [
  {
    chave: "produtos", nome: "Produtos", descricao: "Catálogo completo de produtos", temData: false,
    colunas: [
      { chave: "codigo", label: "Código" },
      { chave: "nome", label: "Produto" },
      { chave: "marca", label: "Marca" },
      { chave: "categoria", label: "Categoria" },
      { chave: "unidade", label: "Unidade" },
      { chave: "ncm", label: "NCM" },
      { chave: "gtin", label: "GTIN" },
      { chave: "preco", label: "Preço", fmt: "money" },
      { chave: "custo", label: "Custo", fmt: "money" },
      { chave: "margem", label: "Margem", fmt: "percent" },
    ],
  },
  {
    chave: "estoque", nome: "Estoque", descricao: "Saldo e valor do estoque", temData: false,
    colunas: [
      { chave: "codigo", label: "Código" },
      { chave: "nome", label: "Produto" },
      { chave: "categoria", label: "Categoria" },
      { chave: "unidade", label: "Unidade" },
      { chave: "saldo", label: "Saldo", fmt: "number" },
      { chave: "minimo", label: "Mínimo", fmt: "number" },
      { chave: "custo", label: "Custo un.", fmt: "money" },
      { chave: "valorEstoque", label: "Valor em estoque", fmt: "money" },
      { chave: "situacao", label: "Situação" },
    ],
  },
  {
    chave: "notas", nome: "Notas emitidas", descricao: "NF-e / NFC-e emitidas", temData: true,
    colunas: [
      { chave: "numero", label: "Número" },
      { chave: "serie", label: "Série" },
      { chave: "modelo", label: "Modelo" },
      { chave: "status", label: "Status" },
      { chave: "cliente", label: "Cliente" },
      { chave: "emitidaEm", label: "Emitida em" },
      { chave: "valorTotal", label: "Valor", fmt: "money" },
      { chave: "chave", label: "Chave de acesso" },
    ],
  },
  {
    chave: "clientes", nome: "Clientes", descricao: "Base de clientes", temData: false,
    colunas: [
      { chave: "codigo", label: "Código" },
      { chave: "nome", label: "Nome" },
      { chave: "documento", label: "CPF/CNPJ" },
      { chave: "tipo", label: "Tipo" },
      { chave: "categoria", label: "Categoria" },
      { chave: "telefone", label: "Telefone" },
      { chave: "email", label: "E-mail" },
      { chave: "cidade", label: "Cidade" },
      { chave: "uf", label: "UF" },
    ],
  },
  {
    chave: "vendas", nome: "Vendas sem nota", descricao: "Vendas não fiscais registradas", temData: true,
    colunas: [
      { chave: "numero", label: "Número" },
      { chave: "data", label: "Data" },
      { chave: "cliente", label: "Cliente" },
      { chave: "pagamento", label: "Pagamento" },
      { chave: "itens", label: "Itens", fmt: "number" },
      { chave: "total", label: "Total", fmt: "money" },
      { chave: "status", label: "Status" },
    ],
  },
  {
    chave: "financeiro", nome: "Financeiro", descricao: "Faturamento por mês (notas + vendas)", temData: true,
    colunas: [
      { chave: "mes", label: "Mês" },
      { chave: "notasQtd", label: "Qtd notas", fmt: "number" },
      { chave: "faturamentoNotas", label: "Faturam. notas", fmt: "money" },
      { chave: "vendasQtd", label: "Qtd vendas", fmt: "number" },
      { chave: "faturamentoVendas", label: "Faturam. vendas", fmt: "money" },
      { chave: "faturamentoTotal", label: "Faturam. total", fmt: "money" },
    ],
  },
];

function formatarCelula(valor: string | number, fmt?: Fmt): string {
  if (fmt === "money") return formatBRL(Number(valor) || 0);
  if (fmt === "percent") return `${(Number(valor) || 0).toFixed(1)}%`;
  if (fmt === "number") return (Number(valor) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return String(valor ?? "");
}

type PdfPayload = {
  titulo: string;
  subtitulo: string;
  colunas: ColDef[];
  rows: LinhaRelatorio[];
  empresa: EmpresaDados | null;
};

export default function RelatoriosPage() {
  const [empresa, setEmpresa] = useState<EmpresaDados | null>(null);
  const [datasetChave, setDatasetChave] = useState<Dataset>("produtos");
  const [colsSel, setColsSel] = useState<string[]>(DATASETS[0].colunas.map((c) => c.chave));
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [titulo, setTitulo] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PdfPayload | null>(null);

  const dataset = useMemo(() => DATASETS.find((d) => d.chave === datasetChave)!, [datasetChave]);

  useEffect(() => {
    void obterEmpresaAtiva().then(setEmpresa).catch(() => {});
  }, []);

  function trocarDataset(chave: Dataset) {
    setDatasetChave(chave);
    const d = DATASETS.find((x) => x.chave === chave)!;
    setColsSel(d.colunas.map((c) => c.chave));
    setErro(null);
  }

  function toggleCol(chave: string) {
    setColsSel((prev) => prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]);
  }

  // Gera o PDF: busca as linhas, monta o payload e dispara a captura no efeito.
  async function gerar() {
    setErro(null);
    if (!colsSel.length) { setErro("Selecione ao menos uma coluna."); return; }
    setGerando(true);
    try {
      const rows = await dadosRelatorio(datasetChave, dataset.temData ? { de: de || null, ate: ate || null } : {});
      // Mantém a ordem do catálogo, filtrando pelas selecionadas.
      const colunas = dataset.colunas.filter((c) => colsSel.includes(c.chave));
      const periodo = dataset.temData && (de || ate)
        ? `Período: ${de ? de.split("-").reverse().join("/") : "início"} a ${ate ? ate.split("-").reverse().join("/") : "hoje"}`
        : "";
      setPdf({
        titulo: titulo.trim() || `Relatório de ${dataset.nome}`,
        subtitulo: [periodo, `${rows.length} registro(s)`].filter(Boolean).join(" · "),
        colunas,
        rows,
        empresa,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setGerando(false);
    }
  }

  // Após o layout imprimível montar no DOM, captura em PDF e limpa.
  useEffect(() => {
    if (!pdf) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        await baixarElementoPdf("relatorio-pdf", `relatorio-${datasetChave}`);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) { setGerando(false); setPdf(null); }
      }
    }, 60);
    return () => { cancelado = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Relatórios"
        subtitulo="Monte relatórios em PDF escolhendo os dados, as colunas e o período."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Escolha do dataset */}
        <Card className="h-fit p-2">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Tipo de relatório</p>
          <ul className="space-y-0.5">
            {DATASETS.map((d) => {
              const ativo = d.chave === datasetChave;
              return (
                <li key={d.chave}>
                  <button
                    onClick={() => trocarDataset(d.chave)}
                    className={"w-full rounded-lg px-3 py-2.5 text-left transition " + (ativo ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "hover:bg-slate-50")}
                  >
                    <span className="block text-sm font-medium">{d.nome}</span>
                    <span className="block text-xs text-[var(--muted)]">{d.descricao}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Configuração */}
        <div className="space-y-4">
          <Card className="p-5">
            <Field label="Título do relatório" hint="Opcional">
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={`Relatório de ${dataset.nome}`} />
            </Field>

            {dataset.temData && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Field label="De" hint="Opcional">
                  <DateBR value={de} onChange={(e) => setDe(e.target.value)} />
                </Field>
                <Field label="Até" hint="Opcional">
                  <DateBR value={ate} onChange={(e) => setAte(e.target.value)} />
                </Field>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Colunas ({colsSel.length}/{dataset.colunas.length})</p>
              <div className="flex gap-3 text-sm">
                <button onClick={() => setColsSel(dataset.colunas.map((c) => c.chave))} className="font-medium text-[var(--primary)] hover:underline">Todas</button>
                <button onClick={() => setColsSel([])} className="font-medium text-[var(--muted)] hover:underline">Nenhuma</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {dataset.colunas.map((c) => (
                <label key={c.chave} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={colsSel.includes(c.chave)}
                    onChange={() => toggleCol(c.chave)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </Card>

          {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}

          <div className="flex justify-end">
            <Button onClick={gerar} disabled={gerando}>
              {gerando ? "Gerando PDF…" : "Gerar PDF"}
            </Button>
          </div>
          {gerando && <LightningLoader texto="Montando relatório…" />}
        </div>
      </div>

      {/* Layout imprimível (off-screen) — capturado por baixarElementoPdf */}
      {pdf && <RelatorioPdf {...pdf} />}
    </div>
  );
}

function RelatorioPdf({ titulo, subtitulo, colunas, rows, empresa }: PdfPayload) {
  const e = empresa;
  const hoje = new Date().toLocaleDateString("pt-BR");
  return (
    <div
      id="relatorio-pdf"
      style={{
        position: "fixed", left: -10000, top: 0, width: 794,
        background: "#ffffff", color: "#0f172a", fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 11, padding: 40, boxSizing: "border-box",
      }}
      aria-hidden
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1e293b", paddingBottom: 14, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{e?.nomeFantasia || e?.razaoSocial || "Relatório"}</div>
          {e?.cnpj && <div style={{ color: "#475569", fontSize: 10 }}>CNPJ {e.cnpj}{e.inscricaoEstadual ? ` · IE ${e.inscricaoEstadual}` : ""}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>Gerado em</div>
          <div style={{ fontWeight: 600 }}>{hoje}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#5227ff" }}>{titulo}</div>
        {subtitulo && <div style={{ color: "#64748b", fontSize: 10 }}>{subtitulo}</div>}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {colunas.map((c) => (
              <th key={c.chave} style={{ padding: "6px 8px", textAlign: c.fmt === "money" || c.fmt === "percent" || c.fmt === "number" ? "right" : "left", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4, color: "#64748b", borderBottom: "1px solid #cbd5e1" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={colunas.length} style={{ padding: "16px 8px", textAlign: "center", color: "#94a3b8" }}>Sem dados para os filtros selecionados.</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 ? "#fafafa" : "#ffffff" }}>
                {colunas.map((c) => (
                  <td key={c.chave} style={{ padding: "5px 8px", textAlign: c.fmt === "money" || c.fmt === "percent" || c.fmt === "number" ? "right" : "left" }}>
                    {formatarCelula(r[c.chave], c.fmt)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 20, fontSize: 9, color: "#94a3b8", textAlign: "center" }}>
        Gerado por easy-nfe · {rows.length} registro(s)
      </div>
    </div>
  );
}
