export type BackupRow = Record<string, unknown>;
export type CatalogSnapshot = { version: 1; scope: "catalog" | "product"; products: BackupRow[]; variants: BackupRow[]; images: BackupRow[]; gallery: BackupRow[] };
export type BackupAsset = { path: string; contentType: string; base64: string };
export type CatalogArchive = { format: "bulonera-catalog-backup"; version: 1; exportedAt: string; sourceUrl: string; snapshot: CatalogSnapshot; assets: BackupAsset[] };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validAssetPath(path: unknown): path is string {
  return typeof path === "string" && path.length > 0 && path.length < 1024 && !/[\\?#\x00-\x1f]/.test(path)
    && path.split("/").every((part) => part !== "" && part !== "." && part !== ".." && !part.includes("%"));
}

export function validateSnapshot(value: unknown): asserts value is CatalogSnapshot {
  const snapshot = value as CatalogSnapshot;
  if (!snapshot || snapshot.version !== 1 || !["catalog", "product"].includes(snapshot.scope)) throw new Error("El archivo no es un respaldo compatible.");
  for (const key of ["products", "variants", "images", "gallery"] as const) {
    if (!Array.isArray(snapshot[key]) || snapshot[key].some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("El respaldo tiene datos inválidos.");
  }
  if (snapshot.scope === "product" && (snapshot.products.length !== 1 || snapshot.gallery.length !== 0)) throw new Error("El respaldo de producto tiene un alcance inválido.");
  const ids = new Set<string>();
  for (const product of snapshot.products) {
    if (typeof product.id !== "string" || !uuid.test(product.id) || ids.has(product.id) || typeof product.sku !== "string" || typeof product.name !== "string") throw new Error("El respaldo contiene productos inválidos o repetidos.");
    ids.add(product.id);
  }
  for (const row of [...snapshot.variants, ...snapshot.images]) {
    if (typeof row.product_id !== "string" || !ids.has(row.product_id)) throw new Error("El respaldo contiene fotos o variantes sin producto.");
  }
  for (const row of snapshot.images) if (row.storage_path != null && !validAssetPath(row.storage_path)) throw new Error("El respaldo contiene una ruta de foto inválida.");
}

export function collectAssetPaths(snapshot: CatalogSnapshot, sourceUrl: string): string[] {
  const paths = new Set<string>();
  const source = new URL(sourceUrl);
  const fromUrl = (value: unknown) => {
    if (typeof value !== "string") return;
    try {
      const url = new URL(value);
      const prefix = "/storage/v1/object/public/product-images/";
      if (url.origin === source.origin && url.pathname.startsWith(prefix)) {
        const path = decodeURIComponent(url.pathname.slice(prefix.length));
        if (!validAssetPath(path)) throw new Error("Ruta de imagen inválida.");
        paths.add(path);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Ruta de imagen inválida.") throw error;
    }
  };
  for (const image of snapshot.images) {
    if (validAssetPath(image.storage_path)) paths.add(image.storage_path);
    fromUrl(image.external_url);
  }
  for (const gallery of snapshot.gallery) {
    if (!Array.isArray(gallery.images)) throw new Error("La galería del respaldo es inválida.");
    for (const image of gallery.images) fromUrl(image?.src);
  }
  return [...paths].sort();
}

export function validateArchive(value: unknown, expectedSource: string): asserts value is CatalogArchive {
  const archive = value as CatalogArchive;
  if (!archive || archive.format !== "bulonera-catalog-backup" || archive.version !== 1 || !Array.isArray(archive.assets)) throw new Error("Elegí un archivo de respaldo generado por este panel.");
  if (archive.sourceUrl !== expectedSource.replace(/\/$/, "")) throw new Error("Este respaldo pertenece a otro proyecto de Supabase.");
  validateSnapshot(archive.snapshot);
  const expected = new Set(collectAssetPaths(archive.snapshot, archive.sourceUrl));
  const found = new Set<string>();
  for (const asset of archive.assets) {
    if (!asset || !validAssetPath(asset.path) || !expected.has(asset.path) || found.has(asset.path)
      || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(asset.contentType)
      || typeof asset.base64 !== "string" || !asset.base64 || asset.base64.length > 9 * 1024 * 1024
      || asset.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(asset.base64)) throw new Error("El respaldo contiene una foto inválida o repetida.");
    found.add(asset.path);
  }
  if (expected.size !== found.size) throw new Error("El respaldo está incompleto: faltan fotos del catálogo.");
}
