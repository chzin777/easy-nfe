"use client";

import { formatBRL } from "@/lib/format";
import type { EmpresaDados } from "@/app/configuracoes/actions";
import type { OrcamentoCompleto } from "./actions";

const fmtData = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

// Layout imprimível do orçamento, renderizado fora da tela e capturado em PDF
// por baixarElementoPdf. Estilos inline (html2canvas não lê variáveis CSS).
export default function OrcamentoPdf({
  id,
  orc,
  empresa,
}: {
  id: string;
  orc: OrcamentoCompleto;
  empresa: EmpresaDados | null;
}) {
  const modelo = orc.tipoNota.startsWith("65") ? "NFC-e (65)" : "NF-e (55)";
  const e = empresa;
  const end = e?.endereco;
  const endLinha = end
    ? `${end.logradouro}, ${end.numero}${end.complemento ? " " + end.complemento : ""} — ${end.bairro}, ${end.municipio}/${end.uf}${end.cep ? " · CEP " + end.cep : ""}`
    : "";

  return (
    <div
      id={id}
      style={{
        position: "fixed",
        left: -10000,
        top: 0,
        width: 794, // ~A4 a 96dpi
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 12,
        padding: 40,
        boxSizing: "border-box",
      }}
      aria-hidden
    >
      {/* Cabeçalho: empresa + nº */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1e293b", paddingBottom: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{e?.nomeFantasia || e?.razaoSocial || "Orçamento"}</div>
          {e?.nomeFantasia && e?.razaoSocial && <div style={{ color: "#475569" }}>{e.razaoSocial}</div>}
          {e?.cnpj && <div style={{ color: "#475569" }}>CNPJ {e.cnpj}{e.inscricaoEstadual ? ` · IE ${e.inscricaoEstadual}` : ""}</div>}
          {endLinha && <div style={{ color: "#475569" }}>{endLinha}</div>}
          {(e?.telefone || e?.email) && <div style={{ color: "#475569" }}>{[e?.telefone, e?.email].filter(Boolean).join(" · ")}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>Orçamento</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#2563eb" }}>#{orc.numero}</div>
        </div>
      </div>

      {/* Dados do orçamento */}
      <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
        <Campo rotulo="Cliente" valor={orc.clienteNome} />
        <Campo rotulo="Validade" valor={fmtData(orc.validade)} />
        <Campo rotulo="Emitido em" valor={fmtData(orc.criadoEm.slice(0, 10))} />
        <Campo rotulo="Modelo" valor={modelo} />
      </div>

      {/* Itens */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
            <th style={thStyle}>Produto</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Qtd</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Preço un.</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {orc.itens.map((i) => (
            <tr key={i.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={tdStyle}>{i.nome}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{i.quantidade}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatBRL(i.precoUnitario)}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatBRL(i.valorTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
            <td style={tdStyle} colSpan={3}>Total</td>
            <td style={{ ...tdStyle, textAlign: "right", color: "#2563eb", fontSize: 14 }}>{formatBRL(orc.valorTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {orc.observacoes && (
        <div style={{ marginTop: 20, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 4 }}>Observações</div>
          <div>{orc.observacoes}</div>
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
        Documento sem valor fiscal · gerado por easy-nfe
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "8px 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b", borderBottom: "1px solid #cbd5e1" };
const tdStyle: React.CSSProperties = { padding: "8px 10px" };

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>{rotulo}</div>
      <div style={{ fontWeight: 600 }}>{valor}</div>
    </div>
  );
}
