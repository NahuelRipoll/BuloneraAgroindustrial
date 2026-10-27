import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, basename, extname, resolve, join } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { workbookBytes, priceCsv, consolidateInventory } from "./lib/price-workbook.mjs";

async function main() {
  const args = process.argv.slice(2), force = args.includes('--force');
  const paths = args.filter((arg) => arg !== '--force');
  if (paths.length < 1 || paths.length > 2 || paths.some((arg) => arg.startsWith('--'))) throw new Error('Uso: npm run convertir:precios -- "archivo.pdf" ["salida.xlsx"] [--force]');
  const input = resolve(paths[0]);
  if (extname(input).toLowerCase() !== '.pdf') throw new Error('El archivo de entrada debe ser PDF.');
  const output = resolve(paths[1] || join(dirname(input), 'convertidos', `${basename(input, extname(input))}.xlsx`));
  if (extname(output).toLowerCase() !== '.xlsx') throw new Error('La salida debe terminar en .xlsx.');
  const csv = output.slice(0, -5) + '.csv';
  const reviewCsv = output.slice(0, -5) + '-revision.csv';
  if (!force) for (const file of [output, csv, reviewCsv]) {
    try { await access(file); } catch { continue; }
    throw new Error(`Ya existe ${file}. Elegí otra salida o usá --force para reemplazarla.`);
  }
  const context = { exports: {} };
  const source = await readFile(new URL('../src/lib/pdf-price-table.ts', import.meta.url), 'utf8');
  vm.runInNewContext(stripTypeScriptTypes(source).replace(/export /g, '') + '\nexports.parse = parsePdfInventoryPage;', context);
  const task = getDocument({ data: new Uint8Array(await readFile(input)) });
  const rows = [], unreadPages = [];
  let pages;
  try {
    const pdf = await task.promise; pages = pdf.numPages;
    for (let number = 1; number <= pages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const parsed = context.exports.parse(content.items.filter((item) => 'str' in item), number);
      rows.push(...parsed.rows); if (!parsed.detected) unreadPages.push(number);
      page.cleanup();
      if (number % 100 === 0 || number === pages) console.log(`Leyendo ${number}/${pages} páginas…`);
    }
  } finally { await task.destroy(); }
  if (!rows.length) throw new Error('No se detectaron filas. Se requiere el PDF de texto del ERP con las columnas Código y Lista 1/2/3; no admite escaneos.');
  const consolidated = consolidateInventory(rows);
  for (const page of unreadPages) consolidated.review.push(['', String(page), 'Página sin encabezados reconocibles; no se extrajeron filas']);
  const headers = ['Código', 'Lista 1', 'Lista 2', 'Lista 3', 'Stock actual'];
  const reviewHeaders = ['Código', 'Página PDF', 'Revisar'];
  const workbook = workbookBytes([
    { name: 'Precios', headers, rows: consolidated.rows, stockColumn: 4, widths: [24, 20, 20, 20, 20] },
    { name: 'Revisión', headers: reviewHeaders, rows: consolidated.review, widths: [24, 20, 100] },
  ]);
  await mkdir(dirname(output), { recursive: true });
  for (const [path, data] of [[output, workbook], [csv, priceCsv(headers, consolidated.rows)], [reviewCsv, priceCsv(reviewHeaders, consolidated.review)]]) await writeFile(path, data, { flag: force ? 'w' : 'wx' });
  console.log(JSON.stringify({ paginas: pages, codigos: consolidated.rows.length, observaciones: consolidated.review.length, preciosPositivos: [1, 2, 3].map((column) => consolidated.rows.filter((row) => row[column] > 0).length), stocksLeidos: consolidated.rows.filter((row) => row[4] !== null).length, excel: output, csv, revision: reviewCsv }, null, 2));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
