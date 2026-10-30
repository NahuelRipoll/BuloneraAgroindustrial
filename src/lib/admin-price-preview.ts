import type { LocalProductDraft } from "@/lib/local-products";

export type PriceInput = { sku: string; price: number; page?: number };
export type PriceChange = { key: string; productId: string; variantIndex: number | null; sku: string; name: string; brand: string; category: string; before: number; after: number; page?: number };
export type PricePreview = { changes: PriceChange[]; unmatched: string[]; conflicts: string[]; unchanged: number; invalid: number; protectedCodes?: string[] };
export function isPriceImportProtected(product: Pick<LocalProductDraft, "sku" | "name" | "priceImportProtected">): boolean {
  return product.priceImportProtected ?? (product.sku.trim() === "2121032" || /\bfoliar(?:es)?\b/i.test(product.name));
}
export const priceCode = (value: string) => value.trim().replace(/^="(.*)"$/, "$1").toLocaleLowerCase("es");
export const roundPrice = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function buildPricePreview(products: LocalProductDraft[], inputs: PriceInput[]): PricePreview {
  const result: PricePreview = { changes: [], unmatched: [], conflicts: [], unchanged: 0, invalid: 0 };
  const targets = new Map<string, Omit<PriceChange, "after" | "page">[]>();
  const protectedCodes = new Set<string>();
  for (const product of products) {
    const rows = product.variants?.length ? product.variants.map((variant, index) => ({ sku: variant.sku, before: variant.price, variantIndex: index })) : [{ sku: product.sku, before: product.price, variantIndex: null }];
    for (const row of rows) {
      const key = priceCode(row.sku);
      if (isPriceImportProtected(product)) protectedCodes.add(key);
      targets.set(key, [...(targets.get(key) || []), { ...row, key: `${product.id}:${row.variantIndex ?? "base"}`, productId: product.id, name: product.name, brand: product.brand, category: product.category }]);
    }
  }
  const grouped = new Map<string, PriceInput[]>();
  const unmatched = new Map<string, string>();
  const excluded = new Map<string, string>();
  for (const input of inputs) {
    const key = priceCode(input.sku);
    if (!key) { result.invalid++; continue; }
    if (protectedCodes.has(key)) { excluded.set(key, input.sku); continue; }
    if (!targets.has(key)) { unmatched.set(key, input.sku); continue; }
    if (!Number.isFinite(input.price) || input.price <= 0) { result.invalid++; continue; }
    grouped.set(key, [...(grouped.get(key) || []), input]);
  }
  result.unmatched = [...unmatched.values()];
  result.protectedCodes = [...excluded.values()];
  for (const [key, values] of grouped) {
    const target = targets.get(key);
    if (new Set(values.map((value) => roundPrice(value.price))).size !== 1 || (target && target.length !== 1)) { result.conflicts.push(values[0].sku); continue; }
    if (!target) { result.unmatched.push(values[0].sku); continue; }
    const after = roundPrice(values[0].price);
    if (after === roundPrice(target[0].before)) { result.unchanged++; continue; }
    result.changes.push({ ...target[0], after, page: values[0].page });
  }
  return result;
}

export function percentageInputs(products: LocalProductDraft[], percentage: number, brand: string, category: string): PriceInput[] {
  if (!Number.isFinite(percentage) || percentage <= -100 || percentage > 1000) throw new Error("Ingresá un porcentaje mayor a -100 y de hasta 1000.");
  return products.filter((product) => (!brand || product.brand === brand) && (!category || product.category === category)).flatMap((product) => (
    product.variants?.length ? product.variants.map((variant) => ({ sku: variant.sku, price: roundPrice(variant.price * (1 + percentage / 100)) })) : [{ sku: product.sku, price: roundPrice(product.price * (1 + percentage / 100)) }]
  )).filter((item) => item.price > 0);
}

export function applyPriceChanges(products: LocalProductDraft[], changes: PriceChange[], manual = false): LocalProductDraft[] {
  const byProduct = new Map<string, PriceChange[]>();
  for (const change of changes) {
    if (!Number.isFinite(change.after) || change.after <= 0) throw new Error("Todos los precios nuevos deben ser mayores a cero.");
    byProduct.set(change.productId, [...(byProduct.get(change.productId) || []), change]);
  }
  return products.map((product) => {
    const updates = byProduct.get(product.id);
    if (!updates) return product;
    if (!manual && isPriceImportProtected(product)) throw new Error(`El precio de ${product.sku} está protegido. Volvé a preparar la revisión.`);
    for (const change of updates) {
      const current = change.variantIndex === null ? product : product.variants?.[change.variantIndex];
      if (!current || priceCode(current.sku) !== priceCode(change.sku) || (roundPrice(current.price) !== roundPrice(change.before) && roundPrice(current.price) !== roundPrice(change.after))) throw new Error("El catálogo cambió desde la revisión. Volvé a preparar la vista previa.");
    }
    if (!product.variants?.length) return { ...product, dirty: true, price: updates[0].after, transferPrice: roundPrice(updates[0].after * .9) };
    const variants = product.variants.map((variant, index) => {
      const update = updates.find((change) => change.variantIndex === index);
      return update ? { ...variant, price: update.after, transferPrice: roundPrice(update.after * .9) } : variant;
    });
    const positive = variants.map((variant) => variant.price).filter((price) => price > 0);
    const price = positive.length ? Math.min(...positive) : product.price;
    return { ...product, dirty: true, variants, price, transferPrice: roundPrice(price * .9) };
  });
}
