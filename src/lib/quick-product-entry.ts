import type { LocalProductDraft } from "@/lib/local-products";

export type EntryRow = { id: string; sku: string; name: string; brand: string; category: string; price: string; stock: string; diameter: string; length: string; image: string };
export const entryFields = ["sku", "name", "brand", "category", "price", "stock", "diameter", "length"] as const;
export const blankEntry = (brand = "", category = ""): EntryRow => ({ id: crypto.randomUUID(), sku: "", name: "", brand, category, price: "", stock: "", diameter: "", length: "", image: "" });
const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function entryNumber(value: string): number {
  const raw = value.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
export function entryUsed(row: EntryRow) { return Boolean(row.sku.trim() || row.name.trim() || row.price.trim() || row.stock.trim() || row.diameter.trim() || row.length.trim() || row.image); }
export function parseEntryPaste(text: string, brand = "", category = ""): EntryRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines[0] && /^(sku|c[oó]digo)(\t|;)/i.test(lines[0])) lines.shift();
  if (lines.length > 200) throw new Error("Pegá hasta 200 artículos por lote.");
  return lines.map((line) => {
    const cells = line.split(line.includes("\t") ? "\t" : ";").map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"));
    if (cells.length < 2 || cells.length > 8) throw new Error("Pegá entre 2 y 8 columnas en el orden indicado.");
    const row = blankEntry(brand, category);
    entryFields.forEach((field, index) => { if (cells[index]) row[field] = cells[index]; });
    return row;
  });
}

export function prepareEntryRows(rows: EntryRow[], existing: LocalProductDraft[], groupMeasures: boolean) {
  const errors: Record<string, string[]> = {};
  const used = rows.filter(entryUsed);
  const known = new Set(existing.flatMap((product) => [product.sku, ...(product.variants || []).map((variant) => variant.sku)]).map((sku) => sku.trim().toLowerCase()));
  const counts = new Map<string, number>();
  used.forEach((row) => counts.set(row.sku.trim().toLowerCase(), (counts.get(row.sku.trim().toLowerCase()) || 0) + 1));
  for (const row of used) {
    const problems: string[] = [];
    if (!row.sku.trim() || !row.name.trim()) problems.push("Completá código y nombre");
    if (known.has(row.sku.trim().toLowerCase())) problems.push("El código ya existe en el catálogo");
    if ((counts.get(row.sku.trim().toLowerCase()) || 0) > 1) problems.push("Código repetido en este lote");
    const price = entryNumber(row.price), stock = entryNumber(row.stock);
    if (!Number.isFinite(price) || price < 0) problems.push("Precio inválido");
    if (!Number.isSafeInteger(stock) || stock < 0) problems.push("Stock: usá un entero positivo o cero");
    if (problems.length) errors[row.id] = problems;
  }
  const products: (LocalProductDraft & { image: string })[] = [];
  const groups = new Map<string, LocalProductDraft & { image: string }>();
  for (const row of used) {
    if (errors[row.id]) continue;
    const name = row.name.trim(), sku = row.sku.trim(), brand = row.brand.trim() || "Sin marca", category = row.category.trim() || "Sin categoría";
    const price = entryNumber(row.price), stock = entryNumber(row.stock);
    const group = groupMeasures && Boolean(row.diameter.trim() || row.length.trim());
    const groupKey = `${name.toLowerCase()}|${brand.toLowerCase()}|${category.toLowerCase()}`;
    const current = group ? groups.get(groupKey) : undefined;
    const variant = { sku, diameter: row.diameter.trim(), length: row.length.trim(), price, transferPrice: Math.round(price * 90) / 100, stock };
    if (current) {
      current.variants!.push(variant); current.stock += stock;
      const prices = current.variants!.map((item) => item.price).filter((value) => value > 0);
      current.price = prices.length ? Math.min(...prices) : 0; current.transferPrice = Math.round(current.price * 90) / 100;
      if (row.image && !current.images!.includes(row.image)) current.images!.push(row.image);
      if (!current.image) current.image = row.image;
    } else {
      const id = crypto.randomUUID();
      const product = { id, name, sku: group ? `GRP-${id.slice(0, 8).toUpperCase()}` : sku, slug: `${slug(name).slice(0, 65)}-${slug(sku)}`, brand, category, price, transferPrice: variant.transferPrice,
        stock, diameter: group ? "" : row.diameter.trim(), length: group ? "" : row.length.trim(), badge: "", published: false, featured: false, dirty: true, image: row.image, images: row.image ? [row.image] : [], variants: group ? [variant] : undefined };
      products.push(product); if (group) groups.set(groupKey, product);
    }
  }
  return { products, errors, used: used.length };
}
