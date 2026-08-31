"use client";

import { formatBRL, formatCep, formatCpfCnpj, formatTelefone } from "@/lib/format";
import type { EmpresaDados } from "@/app/configuracoes/actions";
import type { VendaCompleta } from "./actions";

const PAG_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  fiado: "Fiado (caderneta)",
  outro: "Outro",
};

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

// Recibo imprimível da venda sem nota, renderizado fora da tela e capturado em
// PDF por baixarElementoPdf. Estilos inline (html2canvas não lê variáveis CSS).
// É comprovante de pagamento, não documento fiscal — o layout diz isso em três
// pontos (título, tarja e rodapé) pra ninguém confundir com um DANFE.
export default function ReciboPdf({
  id,
  venda,
  empresa,
}: {
  id: string;
  venda: VendaCompleta;
  empresa: EmpresaDados | null;
}) {
  const e = empresa;
  const end = e?.endereco;
  const endLinha = end
    ? `${end.logradouro}, ${end.numero}${end.complemento ? " " + end.complemento : ""} — ${end.bairro}, ${end.municipio}/${end.uf}${end.cep ? " · CEP " + formatCep(end.cep) : ""}`
    : "";

  const subtotal = venda.itens.reduce((s, i) => s + i.valorTotal, 0);
  const desconto = Math.max(0, Math.round((subtotal - venda.valorTotal) * 100) / 100);

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
      {/* Cabeçalho: empresa + nº do recibo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1e293b", paddingBottom: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{e?.nomeFantasia || e?.razaoSocial || "Recibo"}</div>
          {e?.nomeFantasia && e?.razaoSocial && <div style={{ color: "#475569" }}>{e.razaoSocial}</div>}
          {e?.cnpj && <div style={{ color: "#475569" }}>CNPJ {formatCpfCnpj(e.cnpj)}</div>}
          {endLinha && <div style={{ color: "#475569" }}>{endLinha}</div>}
          {(e?.telefone || e?.email) && (
            <div style={{ color: "#475569" }}>
              {[e?.telefone ? formatTelefone(e.telefone) : null, e?.email].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>Recibo de venda</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#5227ff" }}>#{venda.numero}</div>
          {venda.status === "cancelada" && (
            <div style={{ marginTop: 4, fontWeight: 700, color: "#dc2626" }}>CANCELADA</div>
          )}
        </div>
      </div>

      {/* Tarja: o ponto mais importante do documento */}
      <div style={{ marginBottom: 16, padding: "10px 12px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, textAlign: "center", fontWeight: 700, letterSpacing: 0.5, color: "#92400e" }}>
        SEM VALOR FISCAL · NÃO É NOTA FISCAL
      </div>

      {/* Cliente */}
      <div style={{ marginBottom: 16, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 6 }}>Recebemos de</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{venda.clienteNome}</div>
        {/* Consumidor final não tem documento — a linha some em vez de vir vazia. */}
        {venda.clienteDocumento && (
          <div style={{ color: "#475569" }}>
            {venda.clienteDocumento.replace(/\D/g, "").length > 11 ? "CNPJ " : "CPF "}
            {formatCpfCnpj(venda.clienteDocumento)}
          </div>
        )}
        {venda.clienteTelefone && <div style={{ color: "#475569" }}>{formatTelefone(venda.clienteTelefone)}</div>}
      </div>

      {/* Dados da venda */}
      <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
        <Campo rotulo="Data" valor={fmtData(venda.data)} />
        <Campo rotulo="Pagamento" valor={PAG_LABEL[venda.formaPagamento] ?? venda.formaPagamento} />
        <Campo rotulo={venda.fiado ? "Valor da venda" : "Valor recebido"} valor={formatBRL(venda.valorTotal)} />
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
          {venda.itens.map((i) => (
            <tr key={i.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={tdStyle}>
                {i.nome}
                {i.unidade ? <span style={{ color: "#94a3b8" }}> · {i.unidade}</span> : null}
              </td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{i.quantidade}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatBRL(i.precoUnitario)}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatBRL(i.valorTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {desconto > 0 && (
            <tr>
              <td style={tdStyle} colSpan={3}>Subtotal {formatBRL(subtotal)} · Desconto</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>- {formatBRL(desconto)}</td>
            </tr>
          )}
          <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
            <td style={tdStyle} colSpan={3}>Total</td>
            <td style={{ ...tdStyle, textAlign: "right", color: "#5227ff", fontSize: 14 }}>{formatBRL(venda.valorTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Fiado ainda não foi pago: o recibo não pode dizer "recebemos". */}
      {venda.fiado && (
        <div style={{ marginTop: 12, color: "#92400e" }}>
          Venda a prazo (fiado), lançada na caderneta. Este recibo não comprova o pagamento do valor.
        </div>
      )}

      {venda.observacoes && (
        <div style={{ marginTop: 16, padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 4 }}>Observações</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{venda.observacoes}</div>
        </div>
      )}

      {/* Assinatura */}
      <div style={{ marginTop: 48, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 320, textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 6, color: "#475569" }}>
            {e?.nomeFantasia || e?.razaoSocial || "Assinatura"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
        Recibo sem valor fiscal · não substitui nota fiscal · gerado por easy-nfe
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
