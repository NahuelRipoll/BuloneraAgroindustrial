export type PdfTextItem = { str: string; transform: number[]; width: number };
export type PdfPriceRow = { sku: string; price: number; page: number };
export type PdfPagePrices = { rows: PdfPriceRow[]; rejected: number; detected: boolean };

// The ERP prints prices right-aligned. Text items may combine adjacent columns;
// map a numeric group by its final column, never by numbers in descriptions.
export function parsePdfPricePage(items: PdfTextItem[], list: 1 | 2 | 3, page: number, includeZero = false): PdfPagePrices {
  const text = items.filter((item) => item.str.trim());
  const headings = [1, 2, 3].map((number) => text.find((item) => item.str.trim() === `Lista ${number}`));
  const codeHeading = text.find((item) => /^c[oó]digo$/i.test(item.str.trim()));
  if (headings.some((heading) => !heading) || !codeHeading) return { rows: [], rejected: 0, detected: false };
  const offer = text.find((item) => /^oferta$/i.test(item.str.trim()));
  const columns = [...headings, offer].filter((item): item is PdfTextItem => Boolean(item));
  const rightEdges = columns.map((item) => item.transform[4] + item.width);
  const headingY = codeHeading.transform[5];
  const codes = text.filter((item) => item.transform[5] < headingY - 3 && Math.abs(item.transform[4] - codeHeading.transform[4]) < 8 && /^[\w.-]{3,30}$/.test(item.str.trim()));
  const result: PdfPagePrices = { rows: [], rejected: 0, detected: true };
  for (const code of codes) {
    const candidates: number[] = [];
    for (const item of text) {
      if (Math.abs(item.transform[5] - code.transform[5]) > 1.5 || item.transform[4] < headings[0]!.transform[4] - 90) continue;
      const tokens = item.str.trim().split(/\s+/);
      if (!tokens.length || tokens.length > 4 || !tokens.every((token) => /^-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(token))) continue;
      const end = item.transform[4] + item.width;
      let last = -1, distance = 8;
      rightEdges.forEach((edge, index) => { if (Math.abs(end - edge) < distance) { distance = Math.abs(end - edge); last = index; } });
      const first = last - tokens.length + 1;
      if (first < 0 || list - 1 < first || list - 1 > last) continue;
      candidates.push(Number(tokens[list - 1 - first].replace(/\./g, "").replace(",", ".")));
    }
    if (candidates.length === 1 && (includeZero ? candidates[0] >= 0 : candidates[0] > 0) && Number.isFinite(candidates[0])) result.rows.push({ sku: code.str.trim(), price: candidates[0], page });
    else result.rejected++;
  }
  return result;
}

export type PdfInventoryRow = { sku: string; prices: (number | null)[]; stock: number | null; page: number; issues: string[] };
export function parsePdfInventoryPage(items: PdfTextItem[], page: number) {
  const text = items.filter((item) => item.str.trim());
  const codeHeading = text.find((item) => /^c[oó]digo$/i.test(item.str.trim()));
  const lists = ([1, 2, 3] as const).map((list) => parsePdfPricePage(items, list, page, true));
  if (!codeHeading || lists.some((list) => !list.detected)) return { detected: false, rows: [] as PdfInventoryRow[] };
  const codes = text.filter((item) => item.transform[5] < codeHeading.transform[5] - 3 && Math.abs(item.transform[4] - codeHeading.transform[4]) < 8 && /^[\w.-]{3,30}$/.test(item.str.trim()));
  const stockHeading = text.find((item) => /stock\s*actual/i.test(item.str));
  const stockRight = stockHeading ? stockHeading.transform[4] + stockHeading.width : null;
  const rows = codes.map((code): PdfInventoryRow => {
    const sku = code.str.trim();
    const prices = lists.map((list) => {
      const matches = list.rows.filter((row) => row.sku === sku);
      return matches.length === 1 ? matches[0].price : null;
    });
    const stockValues: number[] = [];
    if (stockRight !== null) for (const item of text) {
      if (Math.abs(item.transform[5] - code.transform[5]) > 1.5 || Math.abs(item.transform[4] + item.width - stockRight) > 8) continue;
      const value = item.str.trim().match(/(?:^|\s)(-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{3})$/)?.[1];
      if (value) stockValues.push(Number(value.replace(/\./g, "").replace(",", ".")));
    }
    const stock = stockValues.length === 1 && Number.isFinite(stockValues[0]) ? stockValues[0] : null;
    const issues = prices.flatMap((price, index) => price === null ? [`Lista ${index + 1}: lectura no confiable`] : []);
    if (stock === null) issues.push("Stock actual: lectura no confiable");
    return { sku, prices, stock, page, issues };
  });
  return { detected: true, rows };
}
