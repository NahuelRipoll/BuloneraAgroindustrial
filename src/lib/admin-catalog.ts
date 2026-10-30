import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { LocalProductDraft, LocalProductVariant } from "@/lib/local-products";
import { isPriceImportProtected } from "@/lib/admin-price-preview";

export async function loadAdminCatalog() {
  const db = createSupabaseBrowserClient() as SupabaseClient;
  const output: (LocalProductDraft & { image: string })[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("products").select("id,slug,name,sku,brand,category,price,transfer_price,stock,badge,published,featured,offer_price,specs,product_images(storage_path,external_url,position),product_variants(id,sku,options,price,transfer_price,stock)").order("id").range(offset, offset + 499);
    if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
    for (const row of data) {
      const images = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position).map((image) => image.external_url || (image.storage_path ? db.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : "")).filter(Boolean);
      const variants: LocalProductVariant[] = (row.product_variants ?? []).map((variant) => ({ id: variant.id, sku: variant.sku, diameter: variant.options?.["Diámetro"] ?? "", length: variant.options?.Largo ?? "", pitch: variant.options?.Paso ?? "", price: Number(variant.price), transferPrice: Number(variant.transfer_price), stock: variant.stock }));
      output.push({ id: row.id, remoteId: row.id, dirty: false, catalogSpecs: row.specs ?? {}, priceImportProtected: typeof row.specs?.price_import_protected === "boolean" ? row.specs.price_import_protected : isPriceImportProtected(row), savedPublished: row.published, savedFeatured: row.featured, slug: row.slug, name: row.name, sku: row.sku, brand: row.brand, category: row.category, price: Number(row.price), transferPrice: Number(row.transfer_price), stock: row.stock, image: images[0] ?? "", images, imageStoragePaths: (row.product_images ?? []).map((image) => image.storage_path).filter(Boolean), badge: row.badge ?? "", diameter: row.specs?.["Diámetro"] ?? "", length: row.specs?.Largo ?? "", variants: variants.length ? variants : undefined, published: row.published, featured: row.featured, offerPrice: row.offer_price == null ? 0 : Number(row.offer_price) });
    }
    if (data.length < 500) break;
  }
  return output.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function mergeAdminDrafts(cloud: (LocalProductDraft & { image: string })[], local: (LocalProductDraft & { image: string })[]) {
  const byId = new Map(local.map((item) => [item.remoteId || item.id, item]));
  const bySku = new Map(local.map((item) => [item.sku, item]));
  const used = new Set<string>();
  return [...cloud.map((item) => {
    const draft = byId.get(item.id) || bySku.get(item.sku);
    if (draft) used.add(draft.id);
    return draft?.dirty ? { ...draft, remoteId: item.id } : item;
  }), ...local.filter((item) => !used.has(item.id) && !item.remoteId)];
}
