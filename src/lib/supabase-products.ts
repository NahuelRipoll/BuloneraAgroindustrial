import type { Product, ProductVariant } from "@/data/products";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type ProductRow = {
  id: string; slug: string; name: string; sku: string; brand: string; category: string;
  price: number | string; list_price: number | string | null; transfer_price: number | string;
  stock: number; badge: string | null; specs: Record<string, string> | null;
  product_images: { storage_path: string | null; external_url: string | null; position: number }[];
  product_variants: { id: string; sku: string; options: Record<string, string>; price: number | string; transfer_price: number | string; stock: number }[];
};

export async function getSupabaseProducts(fallback: Product[]): Promise<Product[]> {
  if (!hasSupabaseConfig()) return fallback;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("products").select("id,slug,name,sku,brand,category,price,list_price,transfer_price,stock,badge,specs,product_images(storage_path,external_url,position),product_variants(id,sku,options,price,transfer_price,stock)").eq("published", true).order("name");
  if (error || !data) {
    console.error("No se pudo cargar el catálogo de Supabase:", error?.message);
    return fallback;
  }
  return (data as ProductRow[]).map((row) => {
    const images = [...row.product_images].sort((a, b) => a.position - b.position).map((image) => image.external_url || (image.storage_path ? supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : "")).filter(Boolean);
    const variants: ProductVariant[] = row.product_variants.map((variant) => ({ id: variant.id, sku: variant.sku, options: variant.options ?? {}, price: Number(variant.price), transferPrice: Number(variant.transfer_price), stock: variant.stock }));
    return { id: row.id, slug: row.slug, name: row.name, sku: row.sku, brand: row.brand, category: row.category, price: Number(row.price), listPrice: row.list_price == null ? undefined : Number(row.list_price), transferPrice: Number(row.transfer_price), stock: row.stock, badge: row.badge ?? undefined, image: images[0] || "/imagenes/producto-sin-foto.svg", images, specs: row.specs ?? {}, variants: variants.length ? variants : undefined };
  });
}
