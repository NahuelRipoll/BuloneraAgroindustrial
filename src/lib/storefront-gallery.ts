import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImageFraming } from "@/lib/storefront-framing";

export type StorefrontImage = { id: string; src: string; alt: string } & ImageFraming;
export const defaultStorefrontImages: StorefrontImage[] = [{ id: "original", src: "/imagenes/portada-local.jpeg", alt: "Frente del local de Bulonera Agroindustrial" }];

export function storefrontClient(): SupabaseClient { return createSupabaseBrowserClient(); }

export async function loadStorefrontImages(): Promise<StorefrontImage[]> {
  if (!hasSupabaseConfig()) return defaultStorefrontImages;
  const { data, error } = await storefrontClient().from("storefront_gallery").select("images").eq("id", true).maybeSingle();
  if (error) throw new Error("No se pudo cargar la galería. Verificá la conexión y que la migración de Nosotros esté aplicada en Supabase.");
  return data?.images?.length ? data.images as StorefrontImage[] : defaultStorefrontImages;
}
