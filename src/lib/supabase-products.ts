import type { Product, ProductVariant } from "@/data/products";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type ProductRow = {
  id: string; slug: string; name: string; sku: string; brand: string; category: string;
  price: number | string; list_price: number | string | null; transfer_price: number | string;
  stock: number; badge: string | null; featured: boolean; offer_price: number | string | null; specs: Record<string, string> | null;
  product_images: { storage_path: string | null; external_url: string | null; position: number }[];
  product_variants: { id: string; sku: string; options: Record<string, string>; price: number | string; transfer_price: number | string; stock: number }[];
};

function mapProductRows(rows: ProductRow[], supabase: ReturnType<typeof createSupabaseBrowserClient>): Product[] {
  return rows.map((row) => {
    const images = [...row.product_images].sort((a, b) => a.position - b.position).map((image) => image.external_url || (image.storage_path ? supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : "")).filter(Boolean);
    const basePrice = Number(row.price);
    const offerPrice = row.featured && row.offer_price != null && Number(row.offer_price) > 0 ? Number(row.offer_price) : undefined;
    const offerRatio = offerPrice && basePrice > 0 ? offerPrice / basePrice : 1;
    const variants: ProductVariant[] = row.product_variants.map((variant) => {
      const baseVariantPrice = Number(variant.price);
      const price = offerPrice ? Math.round(baseVariantPrice * offerRatio) : baseVariantPrice;
      return { id: variant.id, sku: variant.sku, options: variant.options ?? {}, price, listPrice: offerPrice ? baseVariantPrice : undefined, transferPrice: offerPrice ? Math.round(price * .9) : Number(variant.transfer_price), stock: variant.stock };
    });
    return { id: row.id, slug: row.slug, name: row.name, sku: row.sku, brand: row.brand, category: row.category, price: offerPrice ?? basePrice, listPrice: offerPrice ? basePrice : row.list_price == null ? undefined : Number(row.list_price), transferPrice: offerPrice ? Math.round(offerPrice * .9) : Number(row.transfer_price), stock: row.stock, badge: row.badge ?? undefined, featured: row.featured, offerPrice, image: images[0] || "/imagenes/producto-sin-foto.svg", images, specs: row.specs ?? {}, variants: variants.length ? variants : undefined };
  });
}

const productSelect = "id,slug,name,sku,brand,category,price,list_price,transfer_price,stock,badge,featured,offer_price,specs,product_images(storage_path,external_url,position),product_variants(id,sku,options,price,transfer_price,stock)";

export async function getSupabaseProducts(fallback: Product[]): Promise<Product[]> {
  if (!hasSupabaseConfig()) return fallback;
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("products").select(productSelect).eq("published", true).order("name");
  if (error || !data) {
    console.error("No se pudo cargar el catálogo de Supabase:", error?.message);
    return fallback;
  }
  return mapProductRows(data as unknown as ProductRow[], supabase);
}

export async function getFeaturedProducts(fallback: Product[]): Promise<Product[]> {
  if (!hasSupabaseConfig()) return fallback.slice(0, 4);
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("products").select(productSelect).eq("published", true).eq("featured", true).order("name").limit(4);
  if (error || !data) {
    console.error("No se pudieron cargar las ofertas de Supabase:", error?.message);
    return fallback.slice(0, 4);
  }
  return mapProductRows(data as unknown as ProductRow[], supabase);
}
