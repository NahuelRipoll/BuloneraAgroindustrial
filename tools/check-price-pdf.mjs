import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const context = { exports: {} };
vm.runInNewContext(stripTypeScriptTypes(readFileSync("src/lib/pdf-price-table.ts", "utf8")).replace(/export /g, "") + "\nexports.parse = parsePdfPricePage;", context);
const task = getDocument({ data: new Uint8Array(readFileSync(process.argv[2] || "data/Listado de precios.pdf")) });
try {
  const pdf = await task.promise;
  const totals = [0, 0, 0], rejected = [0, 0, 0];
  const sample = [];
  let missingHeaders = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const { items } = await page.getTextContent();
    for (const list of [1, 2, 3]) {
      const result = context.exports.parse(items.filter((item) => "str" in item), list, number);
      totals[list - 1] += result.rows.length; rejected[list - 1] += result.rejected;
      if (!result.detected && list === 1) missingHeaders++;
      if (number === 1 && result.rows[0]) sample.push({ list, ...result.rows[0] });
    }
    page.cleanup();
  }
  console.log(JSON.stringify({ pages: pdf.numPages, rowsByList: totals, excludedByList: rejected, missingHeaders, sample }, null, 2));
  if (totals.some((count) => count === 0) || missingHeaders) process.exitCode = 1;
} finally { await task.destroy(); }
