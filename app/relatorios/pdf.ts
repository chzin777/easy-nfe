import type { LinhaRelatorio } from "./actions";

// Renderiza o relatório direto no jsPDF (texto + linhas), sem passar por
// html2canvas.
//
// Por que não rasterizar: o caminho antigo capturava a tabela inteira do DOM
// num único <canvas>. Com 1.782 produtos o elemento passa de 35.000px de
// altura e, no scale 2, o canvas ultrapassa o limite de 65.535px do navegador —
// a captura devolve um bitmap vazio e o PDF sai TODO EM BRANCO, sem erro
// nenhum. Desenhando nativo não há limite de altura, o texto fica selecionável,
// o arquivo fica pequeno e o cabeçalho se repete a cada página.

export type Fmt = "money" | "percent" | "number" | "text";
export type ColDef = { chave: string; label: string; fmt?: Fmt };

export type EmpresaCabecalho = {
  nome: string;
  cnpj?: string | null;
  ie?: string | null;
};

const M = 32; // margem
const FONTE = 8;
const LINHA = 9.6; // altura de uma linha de texto
const PAD_X = 4;
const PAD_Y = 4;
const RODAPE = 22;
const MAX_LINHAS_CELULA = 3; // trava o crescimento de uma célula muito longa
const LARGURA_MAX_NATURAL = 200;
const LARGURA_MIN = 32;

const CINZA_TEXTO: [number, number, number] = [100, 116, 139];
const CINZA_LINHA: [number, number, number] = [203, 213, 225];
const CINZA_ZEBRA: [number, number, number] = [246, 248, 251];
const TINTA: [number, number, number] = [15, 23, 42];
const ROXO: [number, number, number] = [82, 39, 255];

const ehNumerica = (c: ColDef) => c.fmt === "money" || c.fmt === "percent" || c.fmt === "number";

// Distribui `total` entre as colunas respeitando uma largura mínima. Colunas
// que já estão no mínimo não encolhem mais; o corte recai sobre as largas.
function ajustarLarguras(natural: number[], total: number): number[] {
  const soma = natural.reduce((a, b) => a + b, 0);
  if (soma <= 0) return natural.map(() => total / natural.length);

  // Sobra: devolve proporcionalmente para a tabela ocupar a página inteira.
  if (soma <= total) return natural.map((w) => w + (total - soma) * (w / soma));

  const larguras = natural.map((w) => Math.max(LARGURA_MIN, (w * total) / soma));
  let excesso = larguras.reduce((a, b) => a + b, 0) - total;
  // Tira o excesso só de quem está acima do mínimo, proporcional à folga.
  while (excesso > 0.5) {
    const folga = larguras.map((w) => Math.max(0, w - LARGURA_MIN));
    const somaFolga = folga.reduce((a, b) => a + b, 0);
    if (somaFolga <= 0.5) break;
    const corte = Math.min(excesso, somaFolga);
    for (let i = 0; i < larguras.length; i++) larguras[i] -= (folga[i] / somaFolga) * corte;
    excesso = larguras.reduce((a, b) => a + b, 0) - total;
  }
  return larguras;
}

export async function baixarRelatorioPdf(p: {
  nomeArquivo: string;
  titulo: string;
  subtitulo: string;
  colunas: ColDef[];
  rows: LinhaRelatorio[];
  empresa: EmpresaCabecalho | null;
  formatar: (valor: string | number, fmt?: Fmt) => string;
}): Promise<void> {
  const { jsPDF } = await import("jspdf");

  // Muitas colunas em A4 retrato viram uma coluna de 30pt cada. Deita a página.
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: p.colunas.length > 6 ? "landscape" : "portrait",
    compress: true,
  });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const W = PW - M * 2;
  const limiteY = PH - M - RODAPE;

  // Formata tudo uma vez só — o texto é reutilizado na medida e no desenho.
  const celulas = p.rows.map((r) => p.colunas.map((c) => p.formatar(r[c.chave], c.fmt)));

  // ---- larguras -----------------------------------------------------------
  doc.setFontSize(FONTE);
  doc.setFont("helvetica", "bold");
  const natural = p.colunas.map((c) => doc.getTextWidth(c.label));
  doc.setFont("helvetica", "normal");
  // Amostra as primeiras linhas: com milhares de registros, medir tudo custa
  // caro e não muda o resultado — o que passar da largura quebra em 2 linhas.
  const amostra = Math.min(celulas.length, 400);
  for (let i = 0; i < amostra; i++) {
    for (let j = 0; j < p.colunas.length; j++) {
      natural[j] = Math.max(natural[j], doc.getTextWidth(celulas[i][j]));
    }
  }
  const larguras = ajustarLarguras(
    natural.map((w) => Math.min(w, LARGURA_MAX_NATURAL) + PAD_X * 2),
    W,
  );
  const x0: number[] = [];
  let acc = M;
  for (const w of larguras) { x0.push(acc); acc += w; }

  // ---- cabeçalhos ---------------------------------------------------------
  const hoje = new Date().toLocaleDateString("pt-BR");

  function cabecalhoDocumento(): number {
    let y = M + 10;
    doc.setTextColor(...TINTA);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(p.empresa?.nome || "Relatório", M, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CINZA_TEXTO);
    doc.text(`Gerado em ${hoje}`, PW - M, y, { align: "right" });

    if (p.empresa?.cnpj) {
      y += 11;
      const ie = p.empresa.ie ? ` · IE ${p.empresa.ie}` : "";
      doc.text(`CNPJ ${p.empresa.cnpj}${ie}`, M, y);
    }

    y += 8;
    doc.setDrawColor(...TINTA);
    doc.setLineWidth(1);
    doc.line(M, y, PW - M, y);

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...ROXO);
    doc.text(p.titulo, M, y);

    if (p.subtitulo) {
      y += 11;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...CINZA_TEXTO);
      doc.text(p.subtitulo, M, y);
    }
    return y + 14;
  }

  // Repetido no topo de toda página — sem isso a página 7 vira uma tabela sem
  // nome de coluna.
  function cabecalhoTabela(y: number): number {
    const h = LINHA + PAD_Y * 2;
    doc.setFillColor(241, 245, 249);
    doc.rect(M, y, W, h, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_TEXTO);
    p.colunas.forEach((c, j) => {
      const dir = ehNumerica(c);
      doc.text(
        c.label.toUpperCase(),
        dir ? x0[j] + larguras[j] - PAD_X : x0[j] + PAD_X,
        y + PAD_Y + LINHA - 2.5,
        { align: dir ? "right" : "left", maxWidth: larguras[j] - PAD_X * 2 },
      );
    });
    doc.setDrawColor(...CINZA_LINHA);
    doc.setLineWidth(0.5);
    doc.line(M, y + h, PW - M, y + h);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONTE);
    doc.setTextColor(...TINTA);
    return y + h;
  }

  // ---- corpo --------------------------------------------------------------
  let y = cabecalhoTabela(cabecalhoDocumento());

  if (celulas.length === 0) {
    doc.setTextColor(...CINZA_TEXTO);
    doc.text("Sem dados para os filtros selecionados.", PW / 2, y + 24, { align: "center" });
  }

  for (let i = 0; i < celulas.length; i++) {
    // Quebra cada célula de texto na largura da coluna; a altura da linha é a
    // da célula mais alta.
    const linhas = p.colunas.map((c, j) => {
      const texto = celulas[i][j];
      if (ehNumerica(c) || !texto) return [texto];
      const partes = doc.splitTextToSize(texto, larguras[j] - PAD_X * 2) as string[];
      return partes.length > MAX_LINHAS_CELULA
        ? [...partes.slice(0, MAX_LINHAS_CELULA - 1), partes[MAX_LINHAS_CELULA - 1].slice(0, -1) + "…"]
        : partes;
    });
    const alturaLinha = Math.max(...linhas.map((l) => l.length)) * LINHA + PAD_Y * 2;

    if (y + alturaLinha > limiteY) {
      doc.addPage();
      y = cabecalhoTabela(M);
    }

    if (i % 2 === 1) {
      doc.setFillColor(...CINZA_ZEBRA);
      doc.rect(M, y, W, alturaLinha, "F");
    }

    doc.setTextColor(...TINTA);
    p.colunas.forEach((c, j) => {
      const dir = ehNumerica(c);
      doc.text(
        linhas[j],
        dir ? x0[j] + larguras[j] - PAD_X : x0[j] + PAD_X,
        y + PAD_Y + LINHA - 2.5,
        { align: dir ? "right" : "left", lineHeightFactor: LINHA / FONTE },
      );
    });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(M, y + alturaLinha, PW - M, y + alturaLinha);
    y += alturaLinha;
  }

  // ---- rodapé (precisa do total de páginas, então é o último passo) --------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA_TEXTO);
    doc.text(`easy-nfe · ${p.rows.length} registro(s)`, M, PH - M + 6);
    doc.text(`Página ${i} de ${total}`, PW - M, PH - M + 6, { align: "right" });
  }

  doc.save(`${p.nomeArquivo}.pdf`);
}
