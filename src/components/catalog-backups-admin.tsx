"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backupSource, catalogBackupClient, downloadBackup, readBackup, restoreArchive, restoreSnapshot } from "@/lib/catalog-backups";
import { validateArchive, type CatalogArchive, type CatalogSnapshot } from "@/lib/catalog-backup-format";

type Backup = { id: string; created_at: string; label: string; scope: "catalog" | "product" };
type PendingRestore = { label: string; snapshot: CatalogSnapshot; archive?: CatalogArchive };
const pageSize = 30;

export function CatalogBackupsAdmin() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [label, setLabel] = useState("");

  const load = useCallback(async (offset = 0) => {
    const { data, error } = await catalogBackupClient().from("catalog_backups").select("id,created_at,label,scope").order("created_at", { ascending: false }).order("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error("No se pudieron cargar los respaldos. Verificá la conexión y que esté habilitada la nueva configuración de Supabase.");
    setBackups((current) => offset ? [...current, ...data as Backup[]] : data as Backup[]);
    setHasMore(data.length === pageSize);
  }, []);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo completar la operación."); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => { void run(async () => { await load(); }); }, [load]);

  async function create() {
    const { data, error } = await catalogBackupClient().rpc("create_catalog_backup", { p_label: label.trim() || "Respaldo manual" });
    if (error) throw new Error("No se pudo crear el respaldo. Verificá tus permisos y la conexión.");
    setMessage("Respaldo creado. Preparando la descarga con las fotos…");
    await load();
    await downloadBackup(await readBackup(data), setMessage);
    setLabel(""); setMessage("Respaldo creado y descarga iniciada. Guardá el archivo fuera de esta computadora.");
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) throw new Error("El archivo supera el límite de 200 MB.");
    let archive: unknown;
    try { archive = JSON.parse(await file.text()); } catch { throw new Error("El archivo no contiene un respaldo JSON válido."); }
    validateArchive(archive, backupSource());
    setConfirmation(""); setPending({ label: file.name, snapshot: archive.snapshot, archive });
  }

  async function restore() {
    if (!pending || confirmation !== "RESTAURAR") return;
    const safetyId = pending.archive ? await restoreArchive(pending.archive, setMessage) : await restoreSnapshot(pending.snapshot);
    setPending(null); setConfirmation("");
    await load();
    setMessage(`Restauración completada. Se creó un respaldo previo de seguridad (${safetyId}). Recargá el panel de productos para ver los datos recuperados.`);
  }

  return <section className="card backups-panel">
    <p>Los cambios guardados y las eliminaciones de productos generan copias automáticas. También podés crear un respaldo de todo el catálogo y descargarlo con las fotos guardadas en el sitio.</p>
    <p>Los archivos descargados incluyen productos publicados y borradores. Las fotos de sitios externos se conservan como enlaces. Los cambios que todavía no guardaste en Supabase no se incluyen.</p>
    <div role="status" aria-live="polite">{message || (busy ? "Cargando…" : "")}</div>
    {error && <p role="alert" className="admin-notice">{error}</p>}
    <fieldset disabled={busy || Boolean(pending)}>
      <div className="backups-toolbar">
        <label>Nombre del respaldo<input maxLength={200} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ej.: Antes de actualizar precios" /></label>
        <button className="button" onClick={() => void run(create)}>Crear y descargar respaldo</button>
        <label className="button-outline gallery-upload">Abrir archivo de respaldo<input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void run(() => chooseFile(file)); }} /></label>
        <button className="button-muted" onClick={() => void run(() => load())}>Actualizar lista</button>
      </div>
      <div className="backups-list">{backups.map((backup) => <article key={backup.id}>
        <div><strong>{backup.label}</strong><small>{new Date(backup.created_at).toLocaleString("es-AR")} · {backup.scope === "catalog" ? "Catálogo completo" : "Un producto"}</small></div>
        <div className="backups-actions">
          <button className="button-outline" onClick={() => void run(async () => { await downloadBackup(await readBackup(backup.id), setMessage); setMessage("Descarga iniciada."); })}>Descargar</button>
          <button className="button-muted" onClick={() => void run(async () => { setConfirmation(""); setPending({ label: backup.label, snapshot: await readBackup(backup.id) }); })}>Restaurar</button>
        </div>
      </article>)}</div>
      {!backups.length && !busy && !error && <p>Todavía no hay respaldos. Creá el primero antes de modificar el catálogo.</p>}
      {hasMore && <button className="button-outline" onClick={() => void run(() => load(backups.length))}>Ver más respaldos</button>}
    </fieldset>
    {pending && <section className="backup-confirm" aria-labelledby="restore-heading">
      <h2 id="restore-heading">Confirmar restauración</h2>
      <p><strong>{pending.label}</strong></p>
      <p>Se recuperarán {pending.snapshot.products.length} productos, {pending.snapshot.variants.length} variantes y {pending.snapshot.images.length} fotos de producto{pending.snapshot.scope === "catalog" ? ", junto con la galería de Nosotros" : ""}. Se reemplazarán sus datos y su estado de publicación por los del respaldo. Los demás productos se conservarán.</p>
      <p>Antes de restaurar se guardará una copia de seguridad del catálogo actual.</p>
      <label>Escribí RESTAURAR para confirmar<input autoComplete="off" disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <div className="backups-actions"><button className="button" disabled={busy || confirmation !== "RESTAURAR"} onClick={() => void run(restore)}>Restaurar datos</button><button className="button-outline" disabled={busy} onClick={() => setPending(null)}>Cancelar</button></div>
    </section>}
  </section>;
}
