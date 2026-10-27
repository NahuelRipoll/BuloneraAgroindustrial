import { parsePdfPricePage, type PdfTextItem, type PdfPriceRow } from "@/lib/pdf-price-table";

export async function readPricePdf(file: File, list: 1 | 2 | 3, progress: (message: string) => void, signal: AbortSignal) {
  if (file.size > 30 * 1024 * 1024) throw new Error("El PDF puede pesar hasta 30 MB.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const abort = () => { void task.destroy(); };
  signal.addEventListener("abort", abort, { once: true });
  const rows: PdfPriceRow[] = [];
  let rejected = 0, undetected = 0;
  try {
    const document = await task.promise;
    if (document.numPages > 1500) throw new Error("El PDF supera el máximo de 1500 páginas.");
    for (let number = 1; number <= document.numPages; number++) {
      if (signal.aborted) throw new Error("Lectura cancelada.");
      progress(`Leyendo PDF: página ${number} de ${document.numPages}…`);
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const parsed = parsePdfPricePage(content.items.filter((item): item is typeof item & PdfTextItem => "str" in item), list, number);
      rows.push(...parsed.rows); rejected += parsed.rejected; if (!parsed.detected) undetected++;
      page.cleanup();
    }
    if (!rows.length) throw new Error("No se pudieron identificar códigos y precios. Este lector admite el listado del ERP con columnas Lista 1, Lista 2 y Lista 3; un PDF escaneado necesita reconocimiento de texto.");
    return { rows, rejected, undetected, pages: document.numPages };
  } finally { signal.removeEventListener("abort", abort); await task.destroy(); }
}
