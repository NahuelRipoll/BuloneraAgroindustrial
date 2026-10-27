import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { collectAssetPaths, validateArchive, validateSnapshot, type CatalogArchive, type CatalogSnapshot } from "@/lib/catalog-backup-format";

export const catalogBackupClient = (): SupabaseClient => createSupabaseBrowserClient();
export const backupSource = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer una foto del respaldo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

export async function readBackup(id: string): Promise<CatalogSnapshot> {
  const { data, error } = await catalogBackupClient().from("catalog_backups").select("snapshot").eq("id", id).single();
  if (error) throw new Error("No se pudo leer el respaldo. Verificá tu sesión y la conexión.");
  validateSnapshot(data.snapshot);
  return data.snapshot;
}

export async function downloadBackup(snapshot: CatalogSnapshot, progress: (message: string) => void) {
  validateSnapshot(snapshot);
  const sourceUrl = backupSource();
  const paths = collectAssetPaths(snapshot, sourceUrl);
  const archive: CatalogArchive = { format: "bulonera-catalog-backup", version: 1, exportedAt: new Date().toISOString(), sourceUrl, snapshot, assets: [] };
  const storage = catalogBackupClient().storage.from("product-images");
  for (const [index, path] of paths.entries()) {
    progress(`Incluyendo foto ${index + 1} de ${paths.length}…`);
    const { data, error } = await storage.download(path);
    if (error || !data) throw new Error(`No se pudo respaldar la foto ${path}. No se descargó un respaldo incompleto.`);
    archive.assets.push({ path, contentType: data.type.split(";")[0], base64: await blobBase64(data) });
  }
  validateArchive(archive, sourceUrl);
  const blob = new Blob([JSON.stringify(archive)], { type: "application/json" });
  if (blob.size > 200 * 1024 * 1024) throw new Error("El respaldo supera los 200 MB admitidos para importar desde el panel. La copia en Supabase está guardada; descargá respaldos individuales de los productos o solicitá una exportación completa de la base y Storage.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `bulonera-respaldo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function restoreArchive(archive: CatalogArchive, progress: (message: string) => void) {
  validateArchive(archive, backupSource());
  const storage = catalogBackupClient().storage.from("product-images");
  for (const [index, asset] of archive.assets.entries()) {
    progress(`Comprobando foto ${index + 1} de ${archive.assets.length}…`);
    const { data, error: readError } = await storage.download(asset.path);
    if (data) continue; // Immutable images already present are never overwritten.
    if (readError && !["404", "400"].includes(String(readError.statusCode))) throw new Error("No se pudo comprobar una foto. Reintentá cuando se restablezca la conexión.");
    const bytes = Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0));
    const { error } = await storage.upload(asset.path, new Blob([bytes], { type: asset.contentType }), { contentType: asset.contentType, upsert: false });
    if (error) throw new Error("No se pudo recuperar una foto. El catálogo todavía no fue modificado.");
  }
  progress("Restaurando catálogo…");
  return restoreSnapshot(archive.snapshot);
}

export async function restoreSnapshot(snapshot: CatalogSnapshot) {
  validateSnapshot(snapshot);
  const { data, error } = await catalogBackupClient().rpc("restore_catalog_backup", { p_snapshot: snapshot });
  if (error) throw new Error(`No se pudo restaurar el catálogo; la operación se revirtió. ${error.message}`);
  return data as string;
}
