// Gera o PDF do DANFE a partir de um elemento já renderizado no DOM e baixa o
// arquivo. Compartilhado entre a lista de notas e o fluxo de emissão.
export async function baixarDanfePdf(elId: string, numero: number | string): Promise<void> {
  const el = document.getElementById(elId);
  if (!el) throw new Error("DANFE não encontrado para gerar o PDF.");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const M = 28; // margem ~10mm em todos os lados
  const contentW = pw - M * 2;
  const usableH = ph - M * 2;
  const fullH = (canvas.height * contentW) / canvas.width;

  if (fullH <= usableH) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", M, M, contentW, fullH);
  } else {
    const pxPorPagina = Math.floor((usableH / contentW) * canvas.width);
    let sy = 0;
    while (sy < canvas.height) {
      const sliceH = Math.min(pxPorPagina, canvas.height - sy);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, sy, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      }
      const drawH = (sliceH * contentW) / canvas.width;
      pdf.addImage(slice.toDataURL("image/png"), "PNG", M, M, contentW, drawH);
      sy += sliceH;
      if (sy < canvas.height) pdf.addPage();
    }
  }
  pdf.save(`DANFE-${numero}.pdf`);
}
