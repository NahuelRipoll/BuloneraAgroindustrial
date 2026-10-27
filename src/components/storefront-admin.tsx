"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { loadStorefrontImages, storefrontClient, type StorefrontImage } from "@/lib/storefront-gallery";

async function uploadPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Elegí una imagen JPG, PNG o WebP.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Cada foto puede pesar hasta 12 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("No se pudo procesar la foto."); }
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo procesar la foto.")), "image/jpeg", .85));
  const db = createSupabaseBrowserClient();
  const path = `storefront/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("No se pudo subir la foto. Verificá tu sesión y la conexión.");
  return db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export function StorefrontAdmin() {
  const [images, setImages] = useState<StorefrontImage[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { loadStorefrontImages().then((items) => { setImages(items); setReady(true); }).catch((error) => setMessage(error.message)); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(items: StorefrontImage[]) { setImages(items); setDirty(true); setMessage(""); }
  async function add(files: File[], replaceId?: string) {
    if (!files.length) return;
    if (!replaceId && images.length + files.length > 12) { setMessage("Podés publicar hasta 12 fotos."); return; }
    setBusy(true); setMessage("");
    try {
      const uploaded: StorefrontImage[] = [];
      for (const file of files) uploaded.push({ id: crypto.randomUUID(), src: await uploadPhoto(file), alt: "Local de Bulonera Agroindustrial" });
      change(replaceId ? images.map((image) => image.id === replaceId ? { ...image, src: uploaded[0].src } : image) : [...images, ...uploaded]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron subir las fotos."); }
    finally { setBusy(false); }
  }
  function move(index: number, offset: number) {
    const items = [...images]; [items[index], items[index + offset]] = [items[index + offset], items[index]]; change(items);
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      if (images.some((image) => !image.alt.trim())) throw new Error("Completá la descripción de todas las fotos.");
      const { error } = await storefrontClient().from("storefront_gallery").upsert({ id: true, images });
      if (error) throw new Error("No se pudieron publicar las fotos. Verificá la conexión y tus permisos.");
      setDirty(false); setMessage("Fotos publicadas. Ya se pueden ver al recargar el inicio.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron guardar los cambios."); }
    finally { setBusy(false); }
  }
  return <section className="card storefront-editor">
    <p>La primera foto abre el carrusel de «Quiénes somos». Podés publicar hasta 12 fotos. Los cambios aparecen en el sitio al guardar.</p>
    <p role="status">{message || (!ready ? "Cargando fotos…" : dirty ? "Tenés cambios sin publicar." : "")}</p>
    <fieldset disabled={!ready || busy}>
      <label className="button-outline gallery-upload">Subir fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void add(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
      <div className="gallery-editor-grid">{images.map((image, index) => <article className="gallery-editor-photo" key={image.id}>
        <img src={image.src} alt={image.alt} />
        <label>Descripción de la foto {index + 1}<input maxLength={200} value={image.alt} onChange={(event) => change(images.map((item) => item.id === image.id ? { ...item, alt: event.target.value } : item))} /></label>
        <div className="gallery-editor-actions">
          <button className="button-muted" disabled={index === 0} aria-label={`Mover foto ${index + 1} antes`} onClick={() => move(index, -1)}>←</button>
          <button className="button-muted" disabled={index === images.length - 1} aria-label={`Mover foto ${index + 1} después`} onClick={() => move(index, 1)}>→</button>
          <label className="button-outline gallery-upload">Reemplazar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void add(Array.from(event.target.files ?? []), image.id); event.target.value = ""; }} /></label>
          <button className="button-muted" disabled={images.length === 1} onClick={() => change(images.filter((item) => item.id !== image.id))}>Quitar</button>
        </div>
      </article>)}</div>
      <button className="button" disabled={!dirty || !images.length} onClick={save}>{busy ? "Procesando…" : "Guardar y publicar"}</button>
    </fieldset>
  </section>;
}
