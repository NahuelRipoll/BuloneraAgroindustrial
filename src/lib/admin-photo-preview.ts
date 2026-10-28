import type { LocalProductDraft } from "@/lib/local-products";

export type PhotoRow = { id: string; name: string; code: string; order: number; selected: boolean; error?: string };
export type PhotoMatch = PhotoRow & { productId?: string; productName?: string; variant?: boolean };
export type PhotoGroup = { productId: string; rowIds: string[]; existingCount: number; total: number };
const codeKey = (value: string) => value.trim().toLocaleLowerCase("es");

function photoTargets(products: LocalProductDraft[]) {
  const targets = new Map<string, { productId: string; productName: string; variant: boolean }[]>();
  for (const product of products) {
    if (!product.remoteId) continue;
    const codes = [{ sku: product.sku, variant: false }, ...(product.variants || []).map((variant) => ({ sku: variant.sku, variant: true }))];
    for (const code of codes) {
      const key = codeKey(code.sku);
      if (!key) continue;
      targets.set(key, [...(targets.get(key) || []), { productId: product.id, productName: product.name, variant: code.variant }]);
    }
  }
  return targets;
}

export function photoFilename(products: LocalProductDraft[], name: string) {
  const stem = name.replace(/\.[^.]+$/, "").trim();
  // Full codes win: a real SKU may itself end in "-1".
  if (photoTargets(products).has(codeKey(stem))) return { code: stem, order: 1 };
  const numbered = /^(.*)-(\d+)$/.exec(stem);
  return numbered ? { code: numbered[1], order: Number(numbered[2]) } : { code: stem, order: 1 };
}

export function buildPhotoPreview(products: LocalProductDraft[], inputs: PhotoRow[]): { rows: PhotoMatch[]; groups: PhotoGroup[] } {
  const targets = photoTargets(products);
  const rows: PhotoMatch[] = inputs.map((input) => {
    const matches = targets.get(codeKey(input.code));
    const target = matches?.length === 1 ? matches[0] : undefined;
    const error = input.error || (!matches ? "Sin coincidencia: corregí el código o desmarcá la foto." : matches.length !== 1 ? "Código ambiguo en el catálogo: corregilo antes de asignar fotos." : !Number.isInteger(input.order) || input.order < 1 || input.order > 999 ? "El orden debe ser un entero entre 1 y 999." : undefined);
    return { ...input, ...target, error };
  });
  const grouped = new Map<string, PhotoMatch[]>();
  for (const row of rows) {
    if (!row.selected || row.error || !row.productId) continue;
    grouped.set(row.productId, [...(grouped.get(row.productId) || []), row]);
  }
  const groups: PhotoGroup[] = [];
  for (const [productId, photos] of grouped) {
    const product = products.find((item) => item.id === productId)!;
    const existingCount = new Set([...(product.images || []), product.image || ""].filter(Boolean)).size;
    const duplicateOrders = new Set(photos.filter((photo, index) => photos.some((other, otherIndex) => index !== otherIndex && photo.order === other.order)).map((photo) => photo.order));
    for (const photo of photos) {
      if (duplicateOrders.has(photo.order)) photo.error = "Hay fotos con el mismo orden para este artículo. Cambiá el orden o desmarcá una.";
      else if (photos.length + existingCount > 6) photo.error = "El artículo supera el máximo de 6 fotos contando las existentes. Desmarcá fotos o editá su galería desde Catálogo.";
    }
    if (photos.some((photo) => photo.error)) continue;
    groups.push({ productId, rowIds: [...photos].sort((a, b) => a.order - b.order).map((photo) => photo.id), existingCount, total: existingCount + photos.length });
  }
  return { rows, groups };
}
