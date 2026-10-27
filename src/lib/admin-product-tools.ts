import readXlsxFile from "read-excel-file/browser";
import type { LocalProductDraft, LocalProductVariant } from "@/lib/local-products";
type DraftProduct = LocalProductDraft & { image: string };

export async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} no es una imagen.`);
  if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} supera el máximo de 12 MB.`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", .72);
}

export function rowToProduct(row: string[], columns: string[], rowNumber: number) {
  const value = (name: string) => row[columns.indexOf(name)] ?? "";
  const errors: string[] = [];
  ["slug", "nombre", "sku", "marca", "categoria"].forEach((name) => { if (!value(name)) errors.push(`Falta ${name}`); });
  const price = Number(value("precio")), transferPrice = Number(value("precio_transferencia")), stock = Number(value("stock"));
  if (!Number.isFinite(price) || price <= 0) errors.push("Precio inválido");
  if (!Number.isFinite(transferPrice) || transferPrice <= 0) errors.push("Precio de transferencia inválido");
  if (!Number.isInteger(stock) || stock < 0) errors.push("Stock inválido");
  const product: DraftProduct = { id: crypto.randomUUID(), slug: value("slug"), name: value("nombre"), sku: value("sku"), brand: value("marca"), category: value("categoria"),
    price, transferPrice, stock, diameter: value("diametro"), length: value("largo"), image: value("imagen_url"), badge: value("etiqueta"), published: ["si", "sí", "true", "1"].includes(value("publicado").toLowerCase()), featured: false };
  return { rowNumber, product, errors, warnings: [] as string[] };
}

export function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  const clean = (value: string) => value.trim().replace(/^=/, "").replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(clean(field)); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(clean(field)); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(clean(field)); if (row.some(Boolean)) rows.push(row); return rows;
}

export function decimal(value: string) { return Number(value.replace(/\./g, "").replace(",", ".")); }
export function transferFromPrice(price: number) { return Math.round(price * .9); }
export function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
export function stableCode(value: string) { let hash = 5381; for (const char of value) hash = ((hash << 5) + hash) ^ char.charCodeAt(0); return (hash >>> 0).toString(36).toUpperCase(); }

export function cleanSku(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/^=/, "").replace(/^["']|["']$/g, "").trim();
}

export function parsePriceValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  if (!value) return 0;
  let str = String(value).trim().replace(/^\$/, "").replace(/\s+/g, "").replace(/^=/, "").replace(/["']/g, "");
  if (str.includes(",") && str.includes(".")) str = str.replace(/\./g, "").replace(",", ".");
  else if (str.includes(",")) str = str.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(str)) str = str.replace(/\./g, "");
  const parsed = /^\d+(?:\.\d+)?$/.test(str) ? Number(str) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

export type PriceRecord = { sku: string; price: number; transferPrice?: number };

export function extractPriceRecordsFromRows(rawRows: (string | number | null)[][], list: 1 | 2 | 3 = 1): PriceRecord[] {
  if (!rawRows || !rawRows.length) return [];
  let headerIndex = -1, skuIndex = 0, priceIndex = 1, transferIndex = -1;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const row = (rawRows[i] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
    const sIdx = row.findIndex((c) => /^(c[oó]digo|sku|cod|codigoarticulo|art[ií]culo|articulo)$/i.test(c) || /c[oó]digo|sku/i.test(c));
    const listColumn = row.findIndex((c) => new RegExp(`^(?:precio\\s+)?lista\\s*${list}$`, "i").test(c));
    const hasLists = row.some((c) => /^(?:precio\s+)?lista\s*[123]$/i.test(c));
    if (sIdx >= 0 && hasLists && listColumn < 0) throw new Error(`No se encontró la columna Lista ${list} en el archivo.`);
    const pIdx = listColumn >= 0 ? listColumn : row.findIndex((c) => !/transferencia|efectivo|costo/i.test(c) && (/^(precio|importe|valor|pvp|precio_venta|precioventa|precio lista)$/i.test(c) || /precio/i.test(c)));
    if (sIdx >= 0 && pIdx >= 0 && sIdx !== pIdx) {
      headerIndex = i; skuIndex = sIdx; priceIndex = pIdx;
      transferIndex = row.findIndex((c) => /transferencia|efectivo/i.test(c));
      break;
    }
  }
  const dataRows = headerIndex >= 0 ? rawRows.slice(headerIndex + 1) : rawRows;
  const records: PriceRecord[] = [];
  for (const row of dataRows) {
    if (!row || !row.length) continue;
    const sku = cleanSku(row[skuIndex]);
    const price = parsePriceValue(row[priceIndex]);
    const transferPrice = transferIndex >= 0 ? parsePriceValue(row[transferIndex]) : undefined;
    if (sku && price > 0) records.push({ sku, price, transferPrice: transferPrice && transferPrice > 0 ? transferPrice : undefined });
  }
  return records;
}

export async function readPriceRecordsFromFile(file: File, list: 1 | 2 | 3 = 1): Promise<PriceRecord[]> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const sheetsOrRows = await readXlsxFile(file) as unknown;
    const rawRows: any[][] = Array.isArray(sheetsOrRows) && sheetsOrRows.length > 0 && Array.isArray(sheetsOrRows[0])
      ? (sheetsOrRows as any[][])
      : ((sheetsOrRows as { data: any[][] }[])?.[0]?.data ?? []);
    return extractPriceRecordsFromRows(rawRows, list);
  }
  let text = "";
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
  catch { text = new TextDecoder("windows-1252").decode(await file.arrayBuffer()); }
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const rawRows = parseDelimited(text, delimiter);
  return extractPriceRecordsFromRows(rawRows, list);
}

export function parsePricePasteText(text: string): PriceRecord[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rawRows = lines.map((line) => {
    if (line.includes("\t")) return line.split("\t");
    if (line.includes(";")) return line.split(";");
    if (line.includes(",")) return line.split(",");
    return line.split(/\s+/);
  });
  return extractPriceRecordsFromRows(rawRows);
}

export function buildPriceLookup(records: PriceRecord[]) {
  const map = new Map<string, PriceRecord>();
  for (const rec of records) {
    const key = cleanSku(rec.sku).toLowerCase();
    if (key) {
      map.set(key, rec);
      const numKey = key.replace(/^0+/, "");
      if (numKey && numKey !== key) map.set(numKey, rec);
    }
  }
  return map;
}

export function findPriceInLookup(lookup: Map<string, PriceRecord>, sku: string) {
  const key = cleanSku(sku).toLowerCase();
  if (!key) return undefined;
  return lookup.get(key) || lookup.get(key.replace(/^0+/, ""));
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCatalogPriceTemplate(drafts: DraftProduct[]) {
  const rows = [["Código / SKU", "Artículo", "Marca", "Categoría", "Medida / Variante", "Stock", "Precio Actual", "Transferencia Actual"]];
  for (const draft of drafts) {
    if (draft.variants && draft.variants.length > 0) {
      for (const variant of draft.variants) {
        const measure = [variant.diameter, variant.length, variant.pitch].filter(Boolean).join(" × ");
        rows.push([variant.sku, draft.name, draft.brand, draft.category, measure, String(variant.stock), String(variant.price || ""), String(variant.transferPrice || "")]);
      }
    } else {
      const measure = [draft.diameter, draft.length].filter(Boolean).join(" × ");
      rows.push([draft.sku, draft.name, draft.brand, draft.category, measure || "Simple", String(draft.stock), String(draft.price || ""), String(draft.transferPrice || "")]);
    }
  }
  const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  downloadCsv(`precios-catalogo-bulonera-${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
}

export function downloadProductMeasureTemplate(draft: DraftProduct) {
  if (!draft.variants || !draft.variants.length) return;
  const rows = [["Código / SKU", "Artículo", "Diámetro", "Largo / Paso", "Stock", "Precio", "Transferencia"]];
  for (const variant of draft.variants) {
    rows.push([variant.sku, draft.name, variant.diameter || "", variant.length || variant.pitch || "", String(variant.stock), String(variant.price || ""), String(variant.transferPrice || "")]);
  }
  const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  downloadCsv(`medidas-${slugify(draft.name)}-${draft.sku}.csv`, csvContent);
}
export function normalizeBoltBaseName(value: string) {
  return value
    .replace(/\bCALSE\b/gi, "CLASE")
    .replace(/\s+/g, " ")
    .replace(/\s+(?:-\s*)+$/, "")
    .trim();
}
export function boltMeasure(name: string, category: string) {
  const normalizedCategory = category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const isNut = /TUERCA/.test(normalizedCategory);
  const result = (baseName: string, diameter: string, length = "", pitch = "") => ({
    baseName: normalizeBoltBaseName(isNut ? baseName.replace(/\bM[AB]\b/gi, "") : baseName),
    diameter,
    length,
    pitch,
  });
  const isFastenerCategory = /BULON|TORNILLO|TUERCA|ARANDELA|TIRAFONDO|VARILLA\s+ROSCADA/.test(normalizedCategory)
    || (/ALLEN/.test(normalizedCategory) && !/LLAVE|JUEGO|SET/.test(normalizedCategory));
  if (!isFastenerCategory) return null;
  const cleanName = name
    .trim()
    .replace(/^(?=\S*\d)\S+\s+/, "")
    .replace(/\[?\d{1,3}\]\s*/g, "")
    .replace(/\s*\(\d+(?:-\d+)?\)\s*$/, "")
    .replace(/[`”"]+/g, "")
    .trim();
  const value = "M?(?:\\d+(?:[.,]\\d+)?(?:[ .-]\\d+\\/\\d+)?|\\d+\\/\\d+)";
  const suffix = "(?:\\s+(.+?))?";
  const classLeading = cleanName.match(new RegExp(`^(.*?CLASE\\s+${value})\\s+[X×]\\s*(${value})\\s*[X×]\\s*(${value})\\s*$`, "i"));
  if (classLeading) return result(classLeading[1], classLeading[2], classLeading[3]);
  const threePart = cleanName.match(new RegExp(`^(.*?)\\s+-?\\s*(${value})\\s*[X×]\\s*(${value})\\s*[X×]\\s*(${value})${suffix}$`, "i"));
  if (threePart) return result([threePart[1], threePart[5]].filter(Boolean).join(" "), isNut ? threePart[2] : `${threePart[2]} × ${threePart[3]}`, isNut ? "" : threePart[4], isNut ? threePart[3] : "");
  const match = cleanName.match(new RegExp(`^(.*?)\\s+-?\\s*(?:[X×]\\s*)?(${value})\\s*[X×]\\s*(${value})${suffix}$`, "i"));
  if (match) return result([match[1], match[4]].filter(Boolean).join(" "), match[2], isNut ? "" : match[3], isNut ? match[3] : "");
  const threadedRod = cleanName.match(new RegExp(`^(.*?VARILLA\\s+ROSCADA.*?)\\s+-?\\s*(${value})(?:\\s+P\\s+(${value}))?\\s*$`, "i"));
  if (threadedRod) return result(threadedRod[1], threadedRod[2], "", threadedRod[3] ?? "");
  const single = cleanName.match(new RegExp(`^(.*?)\\s+-?\\s*(${value})(?:\\s*(MM))?${suffix}$`, "i"));
  if (single) return result([single[1], single[4]].filter(Boolean).join(" "), `${single[2]}${single[3] ? " MM" : ""}`);
  return null;
}
export function groupErpVariants(rows: ReturnType<typeof rowToProduct>[]) {
  const output: ReturnType<typeof rowToProduct>[] = [], groups = new Map<string, ReturnType<typeof rowToProduct>>();
  for (const item of rows) {
    const measure = boltMeasure(item.product.name, item.product.category);
    if (!measure) { output.push(item); continue; }
    const groupedCategory = /TUERCA/i.test(item.product.category) ? item.product.category.replace(/\bM[AB]\b/gi, "").replace(/\s+/g, " ").trim() : item.product.category;
    const key = `${measure.baseName}|${item.product.brand}|${groupedCategory}`.toLowerCase();
    const variant: LocalProductVariant = { sku: item.product.sku, diameter: measure.diameter, length: measure.length, pitch: measure.pitch, price: 0, transferPrice: 0, stock: item.product.stock };
    const existing = groups.get(key);
    if (existing) {
      existing.product.variants = [...(existing.product.variants ?? []), variant];
      existing.product.stock += item.product.stock;
      existing.warnings = [`${existing.product.variants.length} medidas agrupadas · precios e imagen pendientes`];
    } else {
      const code = stableCode(key);
      const grouped = { ...item, product: { ...item.product, id: crypto.randomUUID(), name: measure.baseName, slug: `${slugify(measure.baseName).slice(0, 55)}-${code.toLowerCase()}`, sku: `GRP-${code}`, diameter: "", length: "", variants: [variant] }, warnings: ["1 medida agrupada · precios e imagen pendientes"] };
      groups.set(key, grouped); output.push(grouped);
    }
  }
  return output;
}

export function groupTemplateVariants(rows: ReturnType<typeof rowToProduct>[]) {
  const groups = new Map<string, ReturnType<typeof rowToProduct>[]>();
  for (const row of rows) groups.set(row.product.slug, [...(groups.get(row.product.slug) || []), row]);
  return [...groups.values()].map((items) => {
    const first = items[0];
    if (items.length === 1 && !first.product.diameter && !first.product.length) return first;
    const variants = items.map(({ product }) => ({ sku: product.sku, diameter: product.diameter, length: product.length, price: product.price, transferPrice: product.transferPrice, stock: product.stock }));
    const problems = items.flatMap((item) => item.errors.map((error) => `Fila ${item.rowNumber}: ${error}`));
    if (new Set(variants.map((variant) => variant.sku.toLowerCase())).size !== variants.length) problems.push("Hay códigos de medida repetidos en el artículo");
    const positive = variants.map((variant) => variant.price).filter((price) => price > 0);
    const price = positive.length ? Math.min(...positive) : 0;
    return { ...first, errors: problems, warnings: [...first.warnings, `${variants.length} medidas agrupadas`], product: { ...first.product, sku: `GRP-${stableCode(first.product.slug)}`, diameter: "", length: "", variants, stock: variants.reduce((sum, variant) => sum + variant.stock, 0), price, transferPrice: transferFromPrice(price), published: first.product.published && variants.every((variant) => variant.price > 0) && Boolean(first.product.image) } };
  });
}
