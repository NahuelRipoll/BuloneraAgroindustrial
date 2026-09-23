import type { Product } from "@/data/products";

export const productStorageKey = "bulonera-product-drafts";

export type LocalProductDraft = {
  id: string;
  remoteId?: string;
  savedPublished?: boolean;
  savedFeatured?: boolean;
  slug: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  price: number;
  transferPrice: number;
  stock: number;
  image?: string;
  images?: string[];
  imageStoragePaths?: string[];
  badge: string;
  diameter: string;
  length: string;
  published: boolean;
  featured: boolean;
  offerPrice?: number;
  variants?: LocalProductVariant[];
};

export type LocalProductVariant = {
  id?: string;
  sku: string;
  diameter: string;
  length: string;
  pitch?: string;
  price: number;
  transferPrice: number;
  stock: number;
};

export function readLocalDrafts(): LocalProductDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(productStorageKey) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function draftImages(draft: LocalProductDraft) {
  return [...new Set([...(draft.images ?? []), draft.image ?? ""].filter(Boolean))];
}

export function draftToProduct(draft: LocalProductDraft): Product {
  const images = draftImages(draft);
  return {
    id: `local-${draft.id}`,
    localDraftId: draft.id,
    slug: draft.slug,
    name: draft.name,
    sku: draft.sku,
    brand: draft.brand,
    category: draft.category,
    price: draft.price,
    transferPrice: draft.transferPrice,
    stock: draft.stock,
    badge: draft.badge || undefined,
    image: images[0] || "/imagenes/producto-sin-foto.svg",
    images,
    specs: {
      ...(draft.diameter ? { "Diámetro": draft.diameter } : {}),
      ...(draft.length ? { Largo: draft.length } : {}),
    },
    variants: draft.variants?.map((variant) => ({ id: variant.id ?? variant.sku, sku: variant.sku, options: {
      ...(variant.diameter ? { Diámetro: variant.diameter } : {}),
      ...(variant.pitch ? { Paso: variant.pitch } : {}),
      ...(variant.length ? { Largo: variant.length } : {}),
    }, price: variant.price || draft.price, transferPrice: variant.transferPrice || draft.transferPrice, stock: variant.stock })),
  };
}
