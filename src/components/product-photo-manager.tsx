"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalProductDraft } from "@/lib/local-products";
import { buildPhotoPreview, photoFilename, type PhotoRow } from "@/lib/admin-photo-preview";
import { optimizeImage } from "@/lib/admin-product-tools";

type Product = LocalProductDraft & { image: string };
type PhotoFile = PhotoRow & { file: File; url: string };

export function ProductPhotoManager({ products, disabled, onSave, onBusyChange }: {
  products: Product[];
  disabled: boolean;
  onSave: (products: Product[], progress: (message: string) => void) => Promise<string[]>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState<PhotoFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const urls = useRef(new Set<string>());
  const preview = useMemo(() => buildPhotoPreview(products, files), [products, files]);
  const selected = preview.rows.filter((row) => row.selected);
  const blocked = selected.some((row) => row.error);
  const fileById = new Map(files.map((file) => [file.id, file]));
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => {
    const currentUrls = urls.current;
    return () => { for (const url of currentUrls) URL.revokeObjectURL(url); currentUrls.clear(); };
  }, []);

  function remove(ids: string[]) {
    for (const id of ids) {
      const url = fileById.get(id)?.url;
      if (url) { URL.revokeObjectURL(url); urls.current.delete(url); }
    }
    setFiles((current) => current.filter((file) => !ids.includes(file.id)));
  }
  function patch(id: string, update: Partial<PhotoRow>) {
    setFiles((current) => current.map((file) => file.id === id ? { ...file, ...update } : file));
    setError(""); setMessage("");
  }
  function addFiles(incoming: FileList | null) {
    if (!incoming?.length || busy || disabled) return;
    setError(""); setMessage("");
    const added = Array.from(incoming);
    if (files.length + added.length > 60) { setError("Podés revisar hasta 60 fotos por lote. Quitá archivos o dividí la selección."); return; }
    if ([...files.map((item) => item.file), ...added].reduce((total, file) => total + file.size, 0) > 120 * 1024 * 1024) { setError("El lote puede pesar hasta 120 MB. Dividí la selección en varios lotes."); return; }
    const rows = added.map((file): PhotoFile => {
      const error = !["image/jpeg", "image/png", "image/webp"].includes(file.type) ? "Formato no admitido. Usá JPG, PNG o WebP." : file.size > 12 * 1024 * 1024 ? "La foto supera los 12 MB." : file.size === 0 ? "El archivo está vacío." : undefined;
      const row = { id: crypto.randomUUID(), name: file.name, ...photoFilename(products, file.name), selected: true, error };
      const match = buildPhotoPreview(products, [row]).rows[0];
      const url = error ? "" : URL.createObjectURL(file);
      if (url) urls.current.add(url);
      return { ...row, selected: !match.error, file, url };
    });
    setFiles((current) => [...current, ...rows]);
  }
  async function save() {
    if (lock.current || disabled || !preview.groups.length || blocked) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const updates: Product[] = [];
      let processed = 0;
      for (const group of preview.groups) {
        const product = products.find((item) => item.id === group.productId)!;
        const images: string[] = [];
        for (const id of group.rowIds) {
          const photo = fileById.get(id)!;
          setMessage(`Preparando foto ${++processed} de ${selected.length}: ${photo.name}`);
          try { images.push(await optimizeImage(photo.file)); }
          catch { patch(id, { error: "No se pudo leer la imagen. Quitala y seleccioná un archivo válido." }); throw new Error(`No se pudo leer ${photo.name}. No se guardó este lote.`); }
        }
        images.push(...[...new Set([...(product.images || []), product.image].filter(Boolean))]);
        updates.push({ ...product, images, image: images[0], dirty: true });
      }
      const saved = await onSave(updates, setMessage);
      remove(preview.groups.filter((group) => saved.includes(group.productId)).flatMap((group) => group.rowIds));
      const failed = updates.length - saved.length;
      setMessage(`${saved.length} artículos con fotos guardadas.${failed ? ` ${failed} no se guardaron; sus fotos siguen en revisión para reintentar. Revisá el aviso del panel.` : ""}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudieron guardar las fotos."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <section className="card admin-card photo-manager">
    <div className="admin-heading"><div><span className="eyebrow">Carga masiva por código</span><h2>Fotos del catálogo</h2></div></div>
    <p>Seleccioná fotos con nombres como <strong>001342-1.jpg</strong>, <strong>001342-2.jpg</strong> o <strong>GRP-ABC123-1.jpg</strong>. El número final indica el orden; sin número se usa 1. Si el nombre completo coincide con un SKU, se respeta ese código. Se conservan los ceros iniciales.</p>
    <p className="admin-notice">Las fotos nuevas van primero: la de menor orden será la portada. Las fotos existentes se conservan después, hasta un máximo de 6 por artículo. Un código de medida usa la galería compartida de su producto; la foto se verá para todas sus medidas.</p>
    <fieldset disabled={disabled || busy}>
      <label className="file-drop"><span>Seleccionar fotos para revisar</span><input aria-label="Seleccionar fotos para revisar" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /></label>
      <p>JPG, PNG o WebP. Hasta 60 archivos por lote, 12 MB por foto y 120 MB en total. Solo se asignan a artículos ya guardados. Podés navegar entre módulos sin perder esta selección; al recargar la página deberás seleccionar los archivos otra vez.</p>
      {files.length > 0 && <>
        <div className="workspace-toolbar"><strong>{files.length} archivos · {selected.length} seleccionados · {preview.groups.length} artículos listos</strong><button className="button-muted" onClick={() => { remove(files.map((file) => file.id)); setMessage(""); setError(""); }}>Quitar todas las fotos</button></div>
        <div className="admin-table-wrap"><table className="admin-table photo-review-table"><thead><tr><th>Aplicar</th><th>Foto / archivo</th><th>Código destino</th><th>Orden</th><th>Artículo y revisión</th><th>Quitar</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.id}>
          <td><input type="checkbox" aria-label={`Aplicar foto ${row.name}`} checked={row.selected} onChange={(event) => patch(row.id, { selected: event.target.checked })} /></td>
          <td>{fileById.get(row.id)?.url && <img className="admin-product-thumb" src={fileById.get(row.id)!.url} alt={`Vista previa de ${row.name}`} />}<span className="photo-filename">{row.name}</span></td>
          <td><input aria-label={`Código destino de ${row.name}`} value={row.code} onChange={(event) => patch(row.id, { code: event.target.value })} /></td>
          <td><input aria-label={`Orden de ${row.name}`} type="number" min="1" max="999" step="1" value={Number.isFinite(row.order) ? row.order : ""} onChange={(event) => patch(row.id, { order: Number(event.target.value) })} /></td>
          <td>{row.productName && <strong>{row.productName}{row.variant ? " · galería compartida de todas las medidas" : ""}</strong>}{row.error ? <p className="photo-row-error">{row.error}</p> : <p>{row.selected ? "Lista para guardar" : "Sin seleccionar"}</p>}</td>
          <td><button className="button-muted" aria-label={`Quitar foto ${row.name}`} onClick={() => remove([row.id])}>Quitar</button></td>
        </tr>)}</tbody></table></div>
        {preview.groups.length > 0 && <div className="photo-gallery-previews"><h3>Así quedarán las galerías seleccionadas</h3>{preview.groups.map((group) => {
          const product = products.find((item) => item.id === group.productId)!;
          const images = [...group.rowIds.map((id) => ({ url: fileById.get(id)!.url, label: fileById.get(id)!.name })), ...[...new Set([...(product.images || []), product.image].filter(Boolean))].map((url) => ({ url, label: "Foto existente" }))];
          return <div key={group.productId} className="photo-gallery-preview"><strong>{product.name} · {product.sku}</strong><p>{group.rowIds.length} nuevas + {group.existingCount} existentes = {group.total} fotos</p><div>{images.map((image, index) => <figure key={`${index}:${image.url}`}><img src={image.url} alt={image.label} /><figcaption>{index === 0 ? "Portada" : `Foto ${index + 1}`}</figcaption></figure>)}</div></div>;
        })}</div>}
        {blocked && <p className="admin-notice">Corregí o desmarcá las fotos seleccionadas con errores antes de guardar.</p>}
        <div className="workspace-savebar"><span>No se suben fotos hasta guardar. Los artículos conservan su estado de publicación.</span><button className="button" disabled={!preview.groups.length || blocked} onClick={() => void save()}>Guardar fotos seleccionadas</button></div>
      </>}
    </fieldset>
    <p role="status">{message || (disabled ? "Cargando catálogo…" : "Revisá las coincidencias y el orden antes de guardar.")}</p>
    {error && <p role="alert" className="admin-notice">{error}</p>}
    {busy && <p className="admin-notice">Esperá a que termine la carga antes de cambiar de módulo o cerrar la página.</p>}
  </section>;
}
