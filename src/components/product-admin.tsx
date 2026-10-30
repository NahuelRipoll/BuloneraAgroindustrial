"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardList, Download, FileUp, ImagePlus, Layers, Pencil, Percent, Save, Star, Trash2, X } from "lucide-react";
import readXlsxFile from "read-excel-file/browser";
import { productStorageKey, type LocalProductDraft, type LocalProductVariant } from "@/lib/local-products";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { productModules } from "@/lib/admin-product-modules";
import { ProductQuickEntry } from "@/components/product-quick-entry";
import { ProductPriceManager } from "@/components/product-price-manager";
import { ProductPhotoManager } from "@/components/product-photo-manager";
import { loadAdminCatalog, mergeAdminDrafts } from "@/lib/admin-catalog";
import { applyPriceChanges, buildPricePreview, percentageInputs, isPriceImportProtected } from "@/lib/admin-price-preview";

import { optimizeImage, rowToProduct, parseDelimited, decimal, transferFromPrice, slugify, parsePriceValue, readPriceRecordsFromFile, parsePricePasteText, buildPriceLookup, findPriceInLookup, downloadProductMeasureTemplate, groupErpVariants, groupTemplateVariants } from "@/lib/admin-product-tools";

type DraftProduct = LocalProductDraft & { image: string };

const storageKey = productStorageKey;

export function ProductAdmin() {
  const pathname = usePathname();
  const module = pathname.split("/")[3] || "";
  const activeModule = productModules.find((item) => item.id === module);
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const [preview, setPreview] = useState<ReturnType<typeof rowToProduct>[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("Todas");
  const [minimumStock, setMinimumStock] = useState(0);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const productOperations = useRef(new Set<string>());
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [childBusy, setChildBusy] = useState(false);
  const [catalogBrand, setCatalogBrand] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogPageSize, setCatalogPageSize] = useState(50);
  const [bulkBrand, setBulkBrand] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [savingOffers, setSavingOffers] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");
  const [offerCategory, setOfferCategory] = useState("Todas");
  const [offerBrand, setOfferBrand] = useState("Todas");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("Todos");
  const [bulkPercent, setBulkPercent] = useState(10);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [modalTool, setModalTool] = useState<"paste" | "diameter" | "percent" | null>(null);
  const [modalPricePaste, setModalPricePaste] = useState("");
  const [modalTargetDiameter, setModalTargetDiameter] = useState("");
  const [modalDiameterPrice, setModalDiameterPrice] = useState("");
  const [modalVariantPercent, setModalVariantPercent] = useState(10);
  const [pendingCloudSaveIds, setPendingCloudSaveIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const local = (() => { try { const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" && typeof item.sku === "string" && typeof item.name === "string") as DraftProduct[] : []; } catch { return []; } })();
    setDrafts(local); setHydrated(true);
    loadAdminCatalog().then((cloud) => { if (active) { setDrafts(mergeAdminDrafts(cloud, local)); setCloudReady(true); } })
      .catch((error) => { if (active) setNotice(error.message); })
      .finally(() => { if (active) setLoadingCloud(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storageKey, JSON.stringify(drafts)); }
    catch { setNotice("No queda espacio en el navegador para más fotos. Usá URLs o quitá alguna imagen cargada."); }
  }, [drafts, hydrated]);
  useEffect(() => { setEditingId(null); setImageUrl(""); }, [module]);
  useEffect(() => { setCatalogPage(0); }, [catalogSearch, catalogStatus, catalogBrand, catalogCategory, catalogPageSize]);
  useEffect(() => {
    if (!editingId) return;
    setModalTool(null);
    setModalPricePaste("");
    setModalDiameterPrice("");
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setEditingId(null); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [editingId]);
  const categories = useMemo(() => [...new Set(preview.map((item) => item.product.category))].sort((a, b) => a.localeCompare(b)), [preview]);
  const brands = useMemo(() => ["Todas", ...new Set(preview.map((item) => item.product.brand))].sort((a, b) => a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b)), [preview]);
  const matchesExtraFilters = (item: ReturnType<typeof rowToProduct>) => (brandFilter === "Todas" || item.product.brand === brandFilter) && item.product.stock >= minimumStock;
  const categoryCounts = useMemo(() => new Map(categories.map((category) => [category, preview.filter((item) => item.product.category === category && matchesExtraFilters(item)).length])), [brandFilter, categories, minimumStock, preview]);
  const filteredCategories = useMemo(() => categories.filter((category) => category.toLowerCase().includes(categorySearch.trim().toLowerCase()) && (categoryCounts.get(category) ?? 0) > 0 && (!showSelectedOnly || selectedCategories.includes(category))), [categories, categoryCounts, categorySearch, selectedCategories, showSelectedOnly]);
  const validRows = useMemo(() => preview.filter((item) => item.errors.length === 0 && selectedCategories.includes(item.product.category) && matchesExtraFilters(item)), [brandFilter, minimumStock, preview, selectedCategories]);
  const visiblePreview = useMemo(() => preview.filter((item) => selectedCategories.includes(item.product.category) && matchesExtraFilters(item)), [brandFilter, minimumStock, preview, selectedCategories]);
  const offerProducts = useMemo(() => drafts.filter((item) => item.published && item.remoteId), [drafts]);
  const offerCategories = useMemo(() => ["Todas", ...new Set(offerProducts.map((item) => item.category))].sort((a, b) => a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b)), [offerProducts]);
  const offerBrands = useMemo(() => ["Todas", ...new Set(offerProducts.map((item) => item.brand))].sort((a, b) => a === "Todas" ? -1 : b === "Todas" ? 1 : a.localeCompare(b)), [offerProducts]);
  const filteredOfferProducts = useMemo(() => {
    const term = offerSearch.trim().toLocaleLowerCase("es");
    return offerProducts.filter((item) => (!term || `${item.name} ${item.sku}`.toLocaleLowerCase("es").includes(term))
      && (offerCategory === "Todas" || item.category === offerCategory)
      && (offerBrand === "Todas" || item.brand === offerBrand)
      && (!showFeaturedOnly || item.featured));
  }, [offerBrand, offerCategory, offerProducts, offerSearch, showFeaturedOnly]);
  const filteredDrafts = useMemo(() => {
    const term = catalogSearch.trim().toLocaleLowerCase("es");
    return drafts.filter((item) => {
      const images = [...(item.images ?? []), item.image].filter(Boolean);
      const matchesStatus = catalogStatus === "Todos"
        || (catalogStatus === "Sin precio" && item.price <= 0)
        || (catalogStatus === "Sin imagen" && images.length === 0)
        || (catalogStatus === "Sin publicar" && !item.published)
        || (catalogStatus === "Sin stock" && item.stock <= 0)
        || (catalogStatus === "Pendientes" && (item.dirty || !item.remoteId))
        || (catalogStatus === "Listos" && item.price > 0 && images.length > 0 && item.stock > 0);
      return matchesStatus && (!catalogBrand || item.brand === catalogBrand) && (!catalogCategory || item.category === catalogCategory)
        && (catalogStatus !== "Pendientes" || item.dirty || !item.remoteId)
        && (!term || `${item.name} ${item.sku} ${item.brand} ${item.category} ${(item.variants || []).map((variant) => variant.sku).join(" ")}`.toLocaleLowerCase("es").includes(term));
    });
  }, [catalogSearch, catalogStatus, catalogBrand, catalogCategory, drafts]);
  const catalogPages = Math.max(1, Math.ceil(filteredDrafts.length / catalogPageSize));
  const currentCatalogPage = Math.min(catalogPage, catalogPages - 1);
  const visibleDrafts = filteredDrafts.slice(currentCatalogPage * catalogPageSize, (currentCatalogPage + 1) * catalogPageSize);
  const dirtyDrafts = drafts.filter((item) => item.dirty || !item.remoteId);
  const workspaceBusy = bulkSaving || childBusy || savingIds.length > 0 || deletingIds.length > 0 || savingOffers;
  useEffect(() => { setSelectedCategories(categories); }, [categories]);

  async function readCatalogFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const buffer = await file.arrayBuffer();
        let text: string;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
        catch { text = new TextDecoder("windows-1252").decode(buffer); }
        const rows = parseDelimited(text, ";");
        const erpColumns = ["Código", "Artículo", "Rubro", "Stock", "Marca"];
        const headerIndex = rows.findIndex((row) => erpColumns.every((column) => row.includes(column)));
        if (headerIndex < 0) throw new Error("No se encontró el encabezado esperado del listado de stock del ERP.");
        const columns = rows[headerIndex]; const get = (row: string[], name: string) => row[columns.indexOf(name)] ?? "";
        const productRows = rows.slice(headerIndex + 1).filter((row) => get(row, "Código").trim() && get(row, "Artículo").trim());
        const parsed = productRows.map((row, index) => {
          const sku = get(row, "Código").trim();
          const name = get(row, "Artículo").trim();
          const product: DraftProduct = { id: crypto.randomUUID(), slug: `${slugify(name).slice(0, 55)}-${slugify(sku)}`, name, sku,
            brand: get(row, "Marca") || "Sin marca", category: get(row, "Rubro") || "Sin categoría", price: 0, transferPrice: 0,
            stock: Math.max(0, Math.floor(decimal(get(row, "Stock")))), image: "", badge: "", diameter: "", length: "", published: false, featured: false };
          return { rowNumber: headerIndex + index + 2, product, errors: [] as string[], warnings: ["Precio e imagen pendientes"] };
        });
        const grouped = groupErpVariants(parsed).filter((item) => item.product.variants?.length || item.product.stock > 0);
        const variantCount = grouped.reduce((total, item) => total + (item.product.variants?.length ?? 0), 0);
        setPreview(grouped); setNotice(`${grouped.length} artículos detectados con stock positivo.${variantCount ? ` ${variantCount} medidas de bulonería quedaron agrupadas como variantes.` : ""} Los precios y las imágenes quedan pendientes.`); return;
      }
      const workbook = await readXlsxFile(file);
      const articleRows = workbook.find((sheet) => sheet.sheet === "Articulos")?.data;
      const variantRows = workbook.find((sheet) => sheet.sheet === "Variantes")?.data;
      if (!articleRows || !variantRows) throw new Error("El archivo debe incluir las hojas Articulos y Variantes.");
      const articleHeaders = articleRows[2]?.map((cell) => String(cell ?? "").toLowerCase()) ?? [];
      const variantHeaders = variantRows[2]?.map((cell) => String(cell ?? "").toLowerCase()) ?? [];
      const requiredArticles = ["slug", "nombre", "marca", "categoria", "descripcion", "imagen_url", "etiqueta", "publicado"];
      const requiredVariants = ["slug_producto", "sku", "diametro", "largo", "precio", "precio_transferencia", "stock"];
      const missing = [...requiredArticles.filter((name) => !articleHeaders.includes(name)), ...requiredVariants.filter((name) => !variantHeaders.includes(name))];
      if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}`);
      const articleValue = (row: unknown[], name: string) => String(row[articleHeaders.indexOf(name)] ?? "").trim();
      const articles = new Map(articleRows.slice(3).filter((row) => row.some((cell) => cell !== null)).map((row) => [articleValue(row, "slug"), row]));
      const columns = ["slug", "nombre", "sku", "marca", "categoria", "precio", "precio_transferencia", "stock", "diametro", "largo", "imagen_url", "etiqueta", "publicado"];
      const value = (row: unknown[], name: string) => String(row[variantHeaders.indexOf(name)] ?? "").trim();
      const parsed = variantRows.slice(3).filter((row) => row.some((cell) => cell !== null)).map((row, index) => {
        const slug = value(row, "slug_producto"), article = articles.get(slug);
        if (!article) {
          const result = rowToProduct([slug, "", value(row, "sku")], columns, index + 4);
          result.errors.unshift(`No existe el slug ${slug} en Articulos`); return result;
        }
        return rowToProduct([slug, articleValue(article, "nombre"), value(row, "sku"), articleValue(article, "marca"), articleValue(article, "categoria"), value(row, "precio"), value(row, "precio_transferencia"), value(row, "stock"), value(row, "diametro"), value(row, "largo"), articleValue(article, "imagen_url"), articleValue(article, "etiqueta"), articleValue(article, "publicado")], columns, index + 4);
      });
      setPreview(groupTemplateVariants(parsed)); setNotice("");
    } catch (error) {
      setPreview([]); setNotice(error instanceof Error ? error.message : "No se pudo leer el archivo Excel.");
    }
  }
  function importValid() {
    if (!cloudReady || workspaceBusy) return;
    const existingSkus = new Set(drafts.flatMap((draft) => [draft.sku, ...(draft.variants || []).map((variant) => variant.sku)]).map((sku) => sku.toLowerCase()));
    const newProducts = validRows.map((item) => item.product).filter((product) => {
      const codes = [product.sku, ...(product.variants || []).map((variant) => variant.sku)].map((sku) => sku.toLowerCase());
      if (codes.some((sku) => existingSkus.has(sku))) return false;
      codes.forEach((sku) => existingSkus.add(sku)); return true;
    }).map((product) => ({ ...product, dirty: true }));
    const skipped = validRows.length - newProducts.length;
    setDrafts((current) => [...current, ...newProducts]); setPreview([]); setNotice(`${newProducts.length} artículos importados como borradores.${skipped ? ` ${skipped} ya existían y no se duplicaron.` : ""}`);
    setPendingCloudSaveIds((current) => [...new Set([...current, ...newProducts.map((item) => item.id)])]);
  }
  function toggleCategory(category: string) {
    setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  }
  function selectVisible(select: boolean) {
    setSelectedCategories((current) => select ? [...new Set([...current, ...filteredCategories])] : current.filter((category) => !filteredCategories.includes(category)));
  }
  function clearImportFilters() { setCategorySearch(""); setBrandFilter("Todas"); setMinimumStock(0); setShowSelectedOnly(false); }
  function patchDraft(id: string, patch: Partial<DraftProduct>, dirty = true) {
    setNotice("");
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch, dirty } : draft));
  }
  function addImageUrl(draft: DraftProduct) {
    const url = imageUrl.trim(); if (!url) return;
    patchDraft(draft.id, { images: [...new Set([...(draft.images ?? []), draft.image, url].filter(Boolean))], image: draft.image || url });
    setImageUrl("");
  }
  async function addImageFiles(draft: DraftProduct, files: FileList | null) {
    if (!files?.length) return;
    try {
      const available = Math.max(0, 6 - (draft.images?.length ?? (draft.image ? 1 : 0)));
      const added = await Promise.all([...files].slice(0, available).map(optimizeImage));
      const images = [...new Set([...(draft.images ?? []), draft.image, ...added].filter(Boolean))];
      patchDraft(draft.id, { images, image: images[0] ?? "" });
      setNotice(`${added.length} foto${added.length === 1 ? "" : "s"} agregada${added.length === 1 ? "" : "s"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudieron cargar las fotos."); }
  }
  function removeImage(draft: DraftProduct, url: string) {
    if (url === imageUrl.trim()) setImageUrl("");
    const images = [...new Set([...(draft.images ?? []), draft.image].filter(Boolean))].filter((item) => item !== url);
    patchDraft(draft.id, { images, image: images[0] ?? "", published: images.length ? draft.published : false });
  }
  function updateVariant(draft: DraftProduct, index: number, patch: Partial<LocalProductVariant>) {
    const variants = (draft.variants ?? []).map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant);
    patchDraft(draft.id, { variants, stock: variants.reduce((total, variant) => total + variant.stock, 0) });
  }
  async function saveToSupabase(draft: DraftProduct) {
    if (!cloudReady) { setNotice("Esperá a que se cargue el catálogo antes de guardar."); return false; }
    if (productOperations.current.has(draft.id)) return false;
    const variantSkus = (draft.variants || []).map((variant) => variant.sku.trim().toLowerCase());
    const otherCodes = new Set(drafts.filter((item) => item.id !== draft.id).flatMap((item) => [item.sku, ...(item.variants || []).map((variant) => variant.sku)]).map((sku) => sku.trim().toLowerCase()));
    if (!draft.name.trim() || !draft.sku.trim() || variantSkus.some((sku) => !sku || otherCodes.has(sku)) || new Set(variantSkus).size !== variantSkus.length || otherCodes.has(draft.sku.trim().toLowerCase())) {
      setNotice("Completá nombre y códigos únicos. Hay un código vacío o repetido en el catálogo o entre las medidas."); return false;
    }
    const pendingUrl = editingId === draft.id ? imageUrl.trim() : "";
    const images = [...new Set([...(draft.images ?? []), draft.image, pendingUrl].filter(Boolean))];
    if (pendingUrl) { patchDraft(draft.id, { images, image: images[0] ?? "" }); setImageUrl(""); }
    const variantPricesComplete = Boolean(draft.variants?.length && draft.variants.every((variant) => variant.price > 0));
    const effectivePrice = draft.price || (variantPricesComplete ? Math.min(...draft.variants!.map((variant) => variant.price)) : 0);
    if (draft.published && (!effectivePrice || !images.length)) { setNotice(`Para publicar, ${draft.variants?.length ? "completá el precio de todas las medidas" : "completá el precio"} y agregá al menos una foto. También podés desmarcar la publicación y guardarlo como borrador.`); return false; }
    productOperations.current.add(draft.id);
    setSavingIds((current) => [...current, draft.id]); setNotice("Guardando producto y fotos en Supabase…");
    try {
      const supabase = createSupabaseBrowserClient();
      // The generated database types will replace this narrow bridge once the remote schema is linked to the CLI.
      const db: any = supabase;
      const effectiveTransferPrice = draft.transferPrice || transferFromPrice(effectivePrice);
      const uploadFolder = draft.remoteId || crypto.randomUUID();
      const rows = [];
      for (let index = 0; index < images.length; index += 1) {
        const source = images[index];
        if (source.startsWith("data:")) {
          const blob = await (await fetch(source)).blob();
          const path = `${uploadFolder}/${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg" });
          if (uploadError) throw uploadError;
          rows.push({ storage_path: path, external_url: null, alt_text: draft.name });
        } else rows.push({ storage_path: null, external_url: source, alt_text: draft.name });
      }
      const variants = (draft.variants ?? []).map((variant) => ({ ...variant, id: variant.id || crypto.randomUUID() }));
      const { data: productId, error } = await db.rpc("save_catalog_product", {
        p_product: { id: draft.remoteId || uploadFolder, slug: draft.slug, name: draft.name, sku: draft.sku, brand: draft.brand, category: draft.category, price: effectivePrice, transfer_price: effectiveTransferPrice, stock: draft.stock, badge: draft.badge || null, specs: { ...draft.catalogSpecs, price_import_protected: isPriceImportProtected(draft), ...(draft.diameter ? { "Diámetro": draft.diameter } : {}), ...(draft.length ? { Largo: draft.length } : {}) }, published: draft.published, featured: draft.featured, offer_price: draft.offerPrice || null },
        p_variants: variants.map((variant) => ({ id: variant.id, sku: variant.sku, options: { ...(variant.diameter ? { Diámetro: variant.diameter } : {}), ...(variant.pitch ? { Paso: variant.pitch } : {}), ...(variant.length ? { Largo: variant.length } : {}) }, price: variant.price || draft.price, transfer_price: variant.transferPrice || effectiveTransferPrice, stock: variant.stock })),
        p_images: rows,
      });
      if (error) throw new Error(error.code === "PGRST202" ? "Falta aplicar la migración de permisos y respaldos en Supabase para guardar productos." : error.message);
      const savedImages = rows.map((row) => row.storage_path ? supabase.storage.from("product-images").getPublicUrl(row.storage_path).data.publicUrl : row.external_url!);
      patchDraft(draft.id, { remoteId: productId, variants: variants.length ? variants : undefined, images: savedImages, image: savedImages[0] ?? "", savedPublished: draft.published, savedFeatured: draft.featured, price: effectivePrice, transferPrice: effectiveTransferPrice, imageStoragePaths: rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path)) }, false);
      setNotice(`${draft.name} quedó guardado en Supabase${draft.published ? " y publicado en la tienda" : " como borrador"}.`);
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar el producto en Supabase."); return false; }
    finally { productOperations.current.delete(draft.id); setSavingIds((current) => current.filter((id) => id !== draft.id)); }
  }
  async function removeProduct(draft: DraftProduct) {
    if (!draft.remoteId) return;
    const supabase = createSupabaseBrowserClient(); const db: any = supabase;
    // Keep image files: previous versions and backups may still reference them.
    const { error } = await db.from("products").delete().eq("id", draft.remoteId).select("id").single();
    if (error) throw error;
  }
  async function deleteProducts(items: DraftProduct[]) {
    if (!items.length) return;
    if (items.some((item) => productOperations.current.has(item.id))) { setNotice("Esperá a que terminen las operaciones pendientes de estos productos."); return; }
    const label = items.length === 1 ? `“${items[0].name}”` : `${items.length} artículos`;
    const hasRemoteProducts = items.some((item) => item.remoteId);
    if (!window.confirm(`¿Eliminar ${label}?${hasRemoteProducts ? " También se quitarán de la tienda y de Supabase." : ""}`)) return;
    const ids = items.map((item) => item.id);
    ids.forEach((id) => productOperations.current.add(id));
    setDeletingIds((current) => [...new Set([...current, ...ids])]);
    const removedIds: string[] = [], errors: string[] = [];
    try {
      for (const item of items) {
        try { await removeProduct(item); removedIds.push(item.id); }
        catch (error) { errors.push(`${item.name}: ${error instanceof Error ? error.message : "error desconocido"}`); }
      }
      setDrafts((current) => current.filter((item) => !removedIds.includes(item.id)));
      setSelectedProductIds((current) => current.filter((id) => !removedIds.includes(id)));
      if (editingId && removedIds.includes(editingId)) setEditingId(null);
      setNotice(errors.length ? `${removedIds.length} artículos eliminados. No se pudieron eliminar ${errors.length}: ${errors.join(" · ")}` : `${removedIds.length} artículo${removedIds.length === 1 ? "" : "s"} eliminado${removedIds.length === 1 ? "" : "s"}.`);
    } finally { ids.forEach((id) => productOperations.current.delete(id)); setDeletingIds((current) => current.filter((id) => !ids.includes(id))); }
  }
  function deleteProduct(draft: DraftProduct) { return deleteProducts([draft]); }
  function toggleProductSelection(id: string) {
    setSelectedProductIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function patchSelected(patch: Partial<DraftProduct>) {
    setDrafts((current) => current.map((item) => selectedProductIds.includes(item.id) ? { ...item, ...patch, dirty: true } : item));
  }

  function adjustSelectedPrices() {
    try {
      const products = drafts.filter((item) => selectedProductIds.includes(item.id));
      const result = buildPricePreview(products, percentageInputs(products, bulkPercent, "", ""));
      const next = applyPriceChanges(drafts, result.changes).map((item) => ({ ...item, image: item.image || "" }));
      setDrafts(next);
      setNotice(`Se preparó ${bulkPercent}% en ${result.changes.length} precios, incluidas las medidas. Revisá los valores antes de guardar.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo preparar el ajuste."); }
  }

  async function handleModalFilePrices(event: ChangeEvent<HTMLInputElement>, item: DraftProduct) {
    if (isPriceImportProtected(item)) {
      event.target.value = "";
      setNotice("Precio protegido: editá los valores manualmente o desactivá la protección antes de importar."); return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const records = await readPriceRecordsFromFile(file);
      if (!records.length) throw new Error("No se detectaron columnas con código y precio.");
      const lookup = buildPriceLookup(records);
      let matched = 0;
      const updatedVariants = (item.variants ?? []).map((v) => {
        const match = findPriceInLookup(lookup, v.sku);
        if (match) {
          matched += 1;
          return { ...v, price: match.price, transferPrice: match.transferPrice || transferFromPrice(match.price) };
        }
        return v;
      });
      const validPrices = updatedVariants.map((v) => v.price).filter((p) => p > 0);
      const minPrice = validPrices.length ? Math.min(...validPrices) : item.price;
      patchDraft(item.id, {
        variants: updatedVariants,
        price: minPrice,
        transferPrice: transferFromPrice(minPrice),
      });
      setNotice(`✅ Se asignaron precios a ${matched} medidas de ${item.name} desde el archivo.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error al leer el archivo de precios.");
    } finally {
      event.target.value = "";
    }
  }

  function handleModalPastePrices(item: DraftProduct) {
    if (isPriceImportProtected(item)) {
      setNotice("Precio protegido: editá los valores manualmente o desactivá la protección antes de pegar precios."); return;
    }
    const text = modalPricePaste.trim();
    if (!text) return;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const hasDelimiter = lines.some((l) => l.includes("\t") || l.includes(";") || l.includes(","));
    if (hasDelimiter) {
      const records = parsePricePasteText(text);
      const lookup = buildPriceLookup(records);
      let matched = 0;
      const updatedVariants = (item.variants ?? []).map((v) => {
        const match = findPriceInLookup(lookup, v.sku);
        if (match) {
          matched += 1;
          return { ...v, price: match.price, transferPrice: match.transferPrice || transferFromPrice(match.price) };
        }
        return v;
      });
      const validPrices = updatedVariants.map((v) => v.price).filter((p) => p > 0);
      const minPrice = validPrices.length ? Math.min(...validPrices) : item.price;
      patchDraft(item.id, {
        variants: updatedVariants,
        price: minPrice,
        transferPrice: transferFromPrice(minPrice),
      });
      setNotice(`✅ Se asignaron precios por SKU a ${matched} medidas.`);
    } else {
      const numbers = lines.map((l) => parsePriceValue(l)).filter((n) => n > 0);
      let matched = 0;
      const updatedVariants = (item.variants ?? []).map((v, idx) => {
        if (idx < numbers.length && numbers[idx] > 0) {
          matched += 1;
          const p = numbers[idx];
          return { ...v, price: p, transferPrice: transferFromPrice(p) };
        }
        return v;
      });
      const validPrices = updatedVariants.map((v) => v.price).filter((p) => p > 0);
      const minPrice = validPrices.length ? Math.min(...validPrices) : item.price;
      patchDraft(item.id, {
        variants: updatedVariants,
        price: minPrice,
        transferPrice: transferFromPrice(minPrice),
      });
      setNotice(`✅ Se asignaron ${matched} precios correlativos en el orden de la tabla.`);
    }
    setModalPricePaste("");
    setModalTool(null);
  }

  function handleModalDiameterPrice(item: DraftProduct) {
    const p = parsePriceValue(modalDiameterPrice);
    if (!modalTargetDiameter || p <= 0) return;
    let matched = 0;
    const updatedVariants = (item.variants ?? []).map((v) => {
      if (v.diameter === modalTargetDiameter) {
        matched += 1;
        return { ...v, price: p, transferPrice: transferFromPrice(p) };
      }
      return v;
    });
    const validPrices = updatedVariants.map((v) => v.price).filter((price) => price > 0);
    const minPrice = validPrices.length ? Math.min(...validPrices) : item.price;
    patchDraft(item.id, {
      variants: updatedVariants,
      price: minPrice,
      transferPrice: transferFromPrice(minPrice),
    });
    setNotice(`✅ Se asignó $${p.toLocaleString("es-AR")} a las ${matched} medidas de diámetro ${modalTargetDiameter}.`);
    setModalDiameterPrice("");
    setModalTool(null);
  }

  function handleModalCopyBasePrice(item: DraftProduct) {
    const base = item.price;
    if (!base || base <= 0) {
      setNotice("Ingresá un precio base arriba primero para poder copiarlo.");
      return;
    }
    let filled = 0;
    const updatedVariants = (item.variants ?? []).map((v) => {
      if (!v.price || v.price <= 0) {
        filled += 1;
        return { ...v, price: base, transferPrice: item.transferPrice || transferFromPrice(base) };
      }
      return v;
    });
    patchDraft(item.id, { variants: updatedVariants });
    setNotice(`✅ Se completó el precio base ($${base.toLocaleString("es-AR")}) en ${filled} medidas.`);
  }

  function handleModalAdjustPercent(item: DraftProduct) {
    if (isPriceImportProtected(item)) {
      setNotice("Precio protegido: editá los valores manualmente o desactivá la protección antes de ajustar porcentajes."); return;
    }
    const factor = 1 + modalVariantPercent / 100;
    let adjusted = 0;
    const updatedVariants = (item.variants ?? []).map((v) => {
      if (!v.price || v.price <= 0) return v;
      adjusted += 1;
      const p = Math.round(v.price * factor);
      return { ...v, price: p, transferPrice: transferFromPrice(p) };
    });
    const validPrices = updatedVariants.map((v) => v.price).filter((p) => p > 0);
    const minPrice = validPrices.length ? Math.min(...validPrices) : item.price;
    patchDraft(item.id, {
      variants: updatedVariants,
      price: minPrice,
      transferPrice: transferFromPrice(minPrice),
    });
    setNotice(`✅ Se ajustó un ${modalVariantPercent}% a ${adjusted} medidas.`);
    setModalTool(null);
  }

  async function saveSelectedProducts() {
    const selected = drafts.filter((item) => selectedProductIds.includes(item.id));
    if (!selected.length || bulkSaving) return;
    setBulkSaving(true);
    let saved = 0;
    for (const item of selected) if (await saveToSupabase(item)) saved++;
    setBulkSaving(false);
    setNotice(`${saved} productos guardados.${saved < selected.length ? ` ${selected.length - saved} no se guardaron; abrí uno y guardalo para revisar el error.` : ""}`);
  }

  async function saveImportedPrices(items: DraftProduct[], progress: (message: string) => void) {
    if (bulkSaving || !cloudReady) return [];
    setBulkSaving(true);
    const saved: string[] = [], failures: string[] = [];
    try {
      const db: any = createSupabaseBrowserClient();
      for (const item of items) {
        const current = drafts.find((draft) => draft.id === item.id);
        if (!current?.remoteId || isPriceImportProtected(current)) {
          failures.push(`${item.sku}: precio protegido o artículo no guardado.`); continue;
        }
        const changes = item.variants?.length ? item.variants.flatMap((variant, index) => {
          const previous = current.variants?.[index];
          return previous && previous.sku === variant.sku && previous.price !== variant.price ? [{ sku: variant.sku, before: previous.price, after: variant.price }] : [];
        }) : [{ sku: item.sku, before: current.price, after: item.price }];
        progress(`Guardando precios de ${item.name}…`);
        const { error } = await db.rpc("import_catalog_product_prices", { p_product_id: current.remoteId, p_changes: changes });
        if (error) {
          failures.push(`${item.sku}: ${error.code === "PGRST202" ? "Falta aplicar la migración de protección de precios en Supabase." : error.message}`);
          continue;
        }
        setDrafts((previous) => previous.map((draft) => draft.id === item.id ? { ...draft, price: item.price, transferPrice: item.transferPrice, variants: item.variants } : draft));
        saved.push(item.id);
      }
      setNotice(failures.length ? `${saved.length} artículos actualizados. ${failures.join(" · ")}` : `${saved.length} artículos actualizados. Se conservaron stock, fotos y datos del catálogo.`);
      return saved;
    } finally { setBulkSaving(false); }
  }

  async function saveProductBatch(items: DraftProduct[], progress: (message: string) => void = setNotice, stageDrafts = true) {
    if (bulkSaving || !cloudReady) return [];
    setBulkSaving(true);
    const updates = new Map(items.map((item) => [item.id, item]));
    if (stageDrafts) setDrafts((current) => current.map((item) => updates.has(item.id) ? { ...updates.get(item.id)!, dirty: true } : item));
    const saved: string[] = [];
    try {
      for (const [index, item] of items.entries()) {
        progress(`Guardando artículo ${index + 1} de ${items.length}: ${item.name}`);
        if (await saveToSupabase(item)) saved.push(item.id);
      }
      setPendingCloudSaveIds((current) => current.filter((id) => !saved.includes(id)));
      setNotice(`${saved.length} artículos guardados.${saved.length < items.length ? ` ${items.length - saved.length} siguen pendientes. Abrí uno desde Catálogo para revisar el error.` : ""}`);
      return saved;
    } finally { setBulkSaving(false); }
  }

  async function addQuickProducts(items: DraftProduct[]) {
    setDrafts((current) => [...current, ...items]);
    setPendingCloudSaveIds((current) => [...new Set([...current, ...items.map((item) => item.id)])]);
    const saved = await saveProductBatch(items);
    return { saved: saved.length, total: items.length };
  }

  async function discardPending() {
    if (!dirtyDrafts.length || workspaceBusy || !window.confirm(`¿Descartar ${dirtyDrafts.length} artículos con cambios pendientes? Los productos guardados volverán a su versión de Supabase y los borradores solo locales se quitarán.`)) return;
    setLoadingCloud(true);
    try { setDrafts(await loadAdminCatalog()); setPendingCloudSaveIds([]); setSelectedProductIds([]); setNotice("Cambios pendientes descartados. El catálogo guardado no fue modificado."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo recuperar el catálogo guardado."); }
    finally { setLoadingCloud(false); }
  }

  function addVariant(draft: DraftProduct) {
    const variants = draft.variants?.length ? draft.variants : [{ id: crypto.randomUUID(), sku: draft.sku, diameter: draft.diameter, length: draft.length, price: draft.price, transferPrice: draft.transferPrice, stock: draft.stock }];
    patchDraft(draft.id, { ...(!draft.variants?.length ? { sku: `GRP-${crypto.randomUUID().slice(0, 8).toUpperCase()}` } : {}), variants: [...variants, { id: crypto.randomUUID(), sku: "", diameter: "", length: "", price: 0, transferPrice: 0, stock: 0 }] });
  }

  function toggleFeatured(id: string) {
    const selectedCount = drafts.filter((item) => item.featured).length;
    const item = drafts.find((draft) => draft.id === id);
    if (!item?.featured && selectedCount >= 4) { setNotice("Podés mostrar hasta 4 productos en Ofertas."); return; }
    patchDraft(id, { featured: !item?.featured, ...(!item?.featured && !item?.offerPrice ? { offerPrice: transferFromPrice(item?.price ?? 0) } : {}) });
  }

  async function saveOffers() {
    const remoteProducts = drafts.filter((item) => item.remoteId);
    const selected = remoteProducts.filter((item) => item.published && item.featured);
    const invalid = selected.find((item) => !item.offerPrice || item.offerPrice >= item.price);
    if (invalid) { setNotice(`Ingresá para ${invalid.name} un precio de oferta menor que el precio base.`); return; }
    setSavingOffers(true); setNotice("Guardando la selección de ofertas…");
    try {
      if (remoteProducts.length) {
        const db: any = createSupabaseBrowserClient();
        const remoteIds = remoteProducts.map((item) => item.remoteId!);
        const { error: clearError } = await db.from("products").update({ featured: false }).in("id", remoteIds);
        if (clearError) throw clearError;
        for (const item of selected) {
          const { error } = await db.from("products").update({ featured: true, offer_price: item.offerPrice }).eq("id", item.remoteId!);
          if (error) throw error;
        }
      }
      setDrafts((current) => current.map((item) => ({ ...item, featured: item.published ? item.featured : false, savedFeatured: item.published ? item.featured : false })));
      setNotice(`${selected.length} producto${selected.length === 1 ? "" : "s"} seleccionado${selected.length === 1 ? "" : "s"} para Ofertas.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar la selección de ofertas."); }
    finally { setSavingOffers(false); }
  }

  return <div className="admin-stack">
    <div className="admin-title product-workspace-title"><div><span className="eyebrow">Administración de productos</span><h1>{activeModule?.title || "Productos"}</h1><p>{activeModule?.description || "Elegí la tarea que querés realizar."}</p></div><div className="product-workspace-summary"><strong>{drafts.length}</strong><span>artículos · {dirtyDrafts.length} pendientes</span></div></div>
    {activeModule && <nav className="product-module-nav" aria-label="Módulos de productos"><Link href="/admin/productos" onClick={(event) => { if (workspaceBusy) event.preventDefault(); }}>Todos los módulos</Link>{productModules.map((item) => <Link key={item.id} href={`/admin/productos/${item.id}`} aria-current={module === item.id ? "page" : undefined} aria-disabled={workspaceBusy} onClick={(event) => { if (workspaceBusy) event.preventDefault(); }}>{item.title}</Link>)}</nav>}
    {loadingCloud && <p role="status" className="admin-notice">Cargando el catálogo completo…</p>}
    {!loadingCloud && !cloudReady && <p role="alert" className="admin-notice">No se pudo cargar el catálogo. Recargá la página antes de guardar o importar artículos.</p>}
    {!activeModule && <div className="product-module-grid">{productModules.map((item, index) => <Link className="product-module-card" key={item.id} href={`/admin/productos/${item.id}`}><span className="module-number">0{index + 1}</span><h2>{item.title}</h2><p>{item.description}</p><strong>{item.action} →</strong></Link>)}</div>}
    <div hidden={module !== "carga"}><ProductQuickEntry products={drafts} disabled={!cloudReady || workspaceBusy} onCreate={addQuickProducts} /></div>
    <div hidden={module !== "precios"}><ProductPriceManager products={drafts} disabled={!cloudReady || bulkSaving || savingOffers} onSave={(items, progress, imported) => imported ? saveImportedPrices(items, progress) : saveProductBatch(items, progress)} onBusyChange={setChildBusy} /></div>
    <div hidden={module !== "fotos"}><ProductPhotoManager products={drafts} disabled={!cloudReady || bulkSaving || savingOffers} onSave={(items, progress) => saveProductBatch(items, progress, false)} onBusyChange={setChildBusy} /></div>
    {(module === "carga" || module === "importar") && pendingCloudSaveIds.length > 0 && <div className="workspace-savebar"><span><strong>{pendingCloudSaveIds.length}</strong> artículos del lote pendientes de guardar. También podés completarlos desde Catálogo.</span><button className="button" disabled={workspaceBusy || !cloudReady} onClick={() => void saveProductBatch(drafts.filter((item) => pendingCloudSaveIds.includes(item.id)))}>Guardar lote pendiente</button></div>}
    {module === "importar" && <>
    <section className="card admin-card">
      <div className="admin-heading"><div><span className="eyebrow">Carga masiva</span><h2><FileUp size={24} /> Importar catálogo</h2></div><a className="button-outline" href="/plantillas/plantilla-articulos.xlsx" download><Download size={17} /> Descargar plantilla Excel</a></div>
      <p>Podés subir la plantilla Excel completa o el listado de stock CSV exportado directamente desde el ERP.</p>
      <p className="import-warning"><strong>Importante:</strong> subí el CSV original del ERP sin abrirlo ni volverlo a guardar con Excel. El panel lee la columna Código como texto y conserva los dígitos y ceros iniciales.</p>
      <label className="file-drop"><FileUp size={28} /><span>Seleccionar Excel o CSV del ERP</span><input type="file" disabled={!cloudReady || workspaceBusy} accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={readCatalogFile} /></label>
      {preview.length ? <>
        <div className="category-selector">
          <div className="category-selector-head"><div><strong>Seleccionar rubros</strong><span>{selectedCategories.length} de {categories.length} rubros seleccionados · {filteredCategories.length} visibles</span></div><div><button className="link-button" onClick={() => selectVisible(true)}>Marcar visibles</button><button className="link-button" onClick={() => selectVisible(false)}>Desmarcar visibles</button></div></div>
          <div className="import-filters">
            <label className="wide-filter"><span>Buscar rubro</span><input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Ej: bulones, herramientas, discos" /></label>
            <label><span>Marca</span><select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
            <label><span>Stock mínimo</span><input type="number" min="0" value={minimumStock} onChange={(event) => setMinimumStock(Math.max(0, Number(event.target.value)))} /></label>
            <label className="selected-filter"><input type="checkbox" checked={showSelectedOnly} onChange={(event) => setShowSelectedOnly(event.target.checked)} /> Solo seleccionados</label>
            <button className="link-button clear-filter" onClick={clearImportFilters}>Limpiar filtros</button>
          </div>
          <div className="category-options">{filteredCategories.map((category) => <label key={category}><input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} /><span title={category}>{category}</span><small>{categoryCounts.get(category)}</small></label>)}</div>
          {!filteredCategories.length ? <p className="no-filter-results">No hay rubros que coincidan con los filtros.</p> : null}
        </div>
        <div className="import-summary"><strong>{validRows.length} listas para importar</strong><span>{visiblePreview.filter((item) => item.errors.length > 0).length} con errores en los rubros seleccionados</span></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Fila</th><th>SKU</th><th>Artículo</th><th>Medida</th><th>Estado</th></tr></thead><tbody>
          {visiblePreview.slice(0, 250).map((item) => <tr key={item.rowNumber} className={item.errors.length ? "row-error" : ""}><td>{item.rowNumber}</td><td>{item.product.sku}</td><td>{item.product.name}</td><td>{item.product.variants?.length ? `${item.product.variants.length} medidas` : [item.product.diameter, item.product.length].filter(Boolean).join(" × ") || "Simple"}</td><td>{item.errors.join(". ") || item.warnings.join(". ") || "Lista para importar"}</td></tr>)}
        </tbody></table></div><button className="button" disabled={!validRows.length || !cloudReady || workspaceBusy} onClick={importValid}>Preparar {validRows.length} artículos del lote</button></> : null}
    </section>
    </>}
    {notice ? <p className="admin-notice">{notice}</p> : null}
    {module === "ofertas" && <>
    <section className="card admin-card">
      <div className="admin-heading"><div><span className="eyebrow">Portada</span><h2><Star size={24} /> Ofertas destacadas</h2></div><button className="button" disabled={savingOffers || loadingCloud} onClick={saveOffers}><Save size={17} /> {savingOffers ? "Guardando…" : "Guardar ofertas"}</button></div>
      <p>Elegí hasta 4 productos publicados y definí su precio promocional. <strong>{offerProducts.filter((item) => item.featured).length} de 4 seleccionados.</strong></p>
      <div className="offer-filters">
        <label className="wide-filter"><span>Buscar producto</span><input value={offerSearch} onChange={(event) => setOfferSearch(event.target.value)} placeholder="Nombre o SKU" /></label>
        <label><span>Categoría</span><select value={offerCategory} onChange={(event) => setOfferCategory(event.target.value)}>{offerCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span>Marca</span><select value={offerBrand} onChange={(event) => setOfferBrand(event.target.value)}>{offerBrands.map((brand) => <option key={brand}>{brand}</option>)}</select></label>
        <label className="selected-filter"><input type="checkbox" checked={showFeaturedOnly} onChange={(event) => setShowFeaturedOnly(event.target.checked)} /> Solo seleccionados</label>
        <button className="link-button clear-filter" onClick={() => { setOfferSearch(""); setOfferCategory("Todas"); setOfferBrand("Todas"); setShowFeaturedOnly(false); }}>Limpiar</button>
      </div>
      <p className="offer-results-count">{filteredOfferProducts.length} producto{filteredOfferProducts.length === 1 ? "" : "s"} encontrados</p>
      <div className="offer-selector">
        {filteredOfferProducts.map((item) => <div className={`offer-option${item.featured ? " selected" : ""}`} key={item.id}><input type="checkbox" aria-label={`Mostrar ${item.name} en Ofertas`} checked={item.featured} onChange={() => toggleFeatured(item.id)} /><img src={item.image || "/imagenes/producto-sin-foto.svg"} alt="" /><span><strong title={item.name}>{item.name}</strong><small>{item.sku} · {item.category} · {item.brand}</small><small>Precio base: $ {item.price.toLocaleString("es-AR")}</small>{item.featured ? <label className="offer-price-field">Precio oferta<input type="number" min="1" max={Math.max(1, item.price - 1)} value={item.offerPrice || ""} onChange={(event) => patchDraft(item.id, { offerPrice: Number(event.target.value) })} /></label> : null}</span></div>)}
        {!loadingCloud && offerProducts.length > 0 && filteredOfferProducts.length === 0 ? <p className="no-filter-results">No hay productos que coincidan con los filtros.</p> : null}
        {!loadingCloud && !drafts.some((item) => item.published && item.remoteId) ? <p className="no-filter-results">Publicá al menos un producto para poder destacarlo.</p> : null}
      </div>
    </section>
    </>}
    {module === "catalogo" && <>
    <section className="card admin-card"><div className="admin-heading"><div><span className="eyebrow">Catálogo</span><h2>{drafts.length} artículos cargados</h2></div>{selectedProductIds.length ? <button className="button-outline bulk-delete" disabled={deletingIds.length > 0} onClick={() => deleteProducts(drafts.filter((item) => selectedProductIds.includes(item.id)))}><Trash2 size={17} /> Eliminar ({selectedProductIds.length})</button> : null}</div>
      <p>{loadingCloud ? "Cargando artículos de Supabase…" : "Acá aparecen tanto los productos guardados en Supabase como los recién importados."}</p>
      <fieldset disabled={workspaceBusy || !cloudReady}>
      <div className="workspace-toolbar"><label>Buscar<input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Nombre, SKU o medida" /></label><label>Marca<select value={catalogBrand} onChange={(event) => setCatalogBrand(event.target.value)}><option value="">Todas</option>{[...new Set(drafts.map((item) => item.brand))].sort().map((value) => <option key={value}>{value}</option>)}</select></label><label>Rubro<select value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)}><option value="">Todos</option>{[...new Set(drafts.map((item) => item.category))].sort().map((value) => <option key={value}>{value}</option>)}</select></label><label>Estado<select value={catalogStatus} onChange={(event) => setCatalogStatus(event.target.value)}>{["Todos", "Pendientes", "Sin precio", "Sin imagen", "Sin publicar", "Sin stock", "Listos"].map((value) => <option key={value}>{value}</option>)}</select></label><button className="link-button" onClick={() => { setCatalogSearch(""); setCatalogStatus("Todos"); setCatalogBrand(""); setCatalogCategory(""); }}>Limpiar filtros</button><button className="button" disabled={!dirtyDrafts.length || workspaceBusy || !cloudReady} onClick={() => void saveProductBatch(dirtyDrafts)}>Guardar pendientes ({dirtyDrafts.length})</button></div>
      {selectedProductIds.length > 0 && <div className="workspace-toolbar"><label>Marca para seleccionados<input value={bulkBrand} onChange={(event) => setBulkBrand(event.target.value)} /></label><label>Rubro para seleccionados<input value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} /></label><button className="button-outline" disabled={!bulkBrand.trim() && !bulkCategory.trim()} onClick={() => patchSelected({ ...(bulkBrand.trim() ? { brand: bulkBrand.trim() } : {}), ...(bulkCategory.trim() ? { category: bulkCategory.trim() } : {}) })}>Aplicar datos comunes</button><button className="link-button" onClick={() => setSelectedProductIds([])}>Desmarcar todos</button><span>La selección se conserva entre páginas y filtros.</span></div>}
      {selectedProductIds.length ? <div className="bulk-toolbar"><strong>{selectedProductIds.length} seleccionados</strong><button className="button-muted" onClick={() => patchSelected({ published: true })}>Publicar</button><button className="button-muted" onClick={() => patchSelected({ published: false, featured: false })}>Despublicar</button><label>Ajustar <input type="number" value={bulkPercent} onChange={(event) => setBulkPercent(Number(event.target.value))} /> %</label><button className="button-muted" onClick={adjustSelectedPrices}>Aplicar</button><button className="button" disabled={bulkSaving} onClick={saveSelectedProducts}><Save size={16} /> {bulkSaving ? "Guardando…" : "Guardar seleccionados"}</button></div> : null}
      {dirtyDrafts.length > 0 && <div className="workspace-toolbar"><span>{dirtyDrafts.length} artículos tienen cambios sin guardar.</span><button className="link-button" disabled={workspaceBusy || !cloudReady} onClick={() => void discardPending()}>Descartar todos los pendientes</button></div>}
      <p className="offer-results-count">{filteredDrafts.length} resultados</p>
      {drafts.length ? <div className="admin-table-wrap"><table className="admin-table editable-table"><thead><tr><th><input type="checkbox" aria-label="Seleccionar esta página" checked={visibleDrafts.length > 0 && visibleDrafts.every((item) => selectedProductIds.includes(item.id))} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...new Set([...current, ...visibleDrafts.map((item) => item.id)])] : current.filter((id) => !visibleDrafts.some((item) => item.id === id)))} /></th><th>Foto</th><th>SKU</th><th>Artículo</th><th>Marca</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Publicar</th><th></th></tr></thead><tbody>
        {visibleDrafts.map((item) => { const images = [...new Set([...(item.images ?? []), item.image].filter(Boolean))]; return <tr key={item.id}><td><input type="checkbox" aria-label={`Seleccionar ${item.name}`} checked={selectedProductIds.includes(item.id)} onChange={() => toggleProductSelection(item.id)} /></td><td><img className="admin-product-thumb" src={images[0] || "/imagenes/producto-sin-foto.svg"} alt="" /></td><td>{item.sku}{(item.dirty || !item.remoteId) && <small className="pending-product-label">Sin guardar</small>}</td><td className="editable-name"><input className="title-input" value={item.name} aria-label={`Título de ${item.sku}`} onChange={(event) => patchDraft(item.id, { name: event.target.value })} /></td><td><input value={item.brand} onChange={(event) => patchDraft(item.id, { brand: event.target.value })} /></td><td><input value={item.category} onChange={(event) => patchDraft(item.id, { category: event.target.value })} /></td><td><label><input type="checkbox" aria-label={`Excluir de importaciones de precios ${item.sku}`} checked={isPriceImportProtected(item)} onChange={(event) => patchDraft(item.id, { priceImportProtected: event.target.checked })} /> Precio manual</label><input className="price-input" type="number" min="0" value={item.price || ""} onChange={(event) => { const price = Number(event.target.value); patchDraft(item.id, { price, transferPrice: transferFromPrice(price) }); }} /></td><td><input className="stock-input" type="number" min="0" value={item.stock} disabled={Boolean(item.variants?.length)} onChange={(event) => patchDraft(item.id, { stock: Number(event.target.value) })} /></td><td><input type="checkbox" checked={item.published} onChange={(event) => patchDraft(item.id, { published: event.target.checked })} /></td><td><div className="table-actions"><button className="icon-button" disabled={workspaceBusy || !cloudReady || (!item.dirty && Boolean(item.remoteId))} onClick={() => void saveToSupabase(item)} aria-label={`Guardar ${item.sku}`}><Save size={17} /></button><button className="icon-button" onClick={() => setEditingId(editingId === item.id ? null : item.id)} aria-label="Editar"><Pencil size={17} /></button><button className="icon-button danger" disabled={deletingIds.includes(item.id)} onClick={() => deleteProduct(item)} aria-label="Eliminar producto"><Trash2 size={17} /></button></div></td></tr>})}
      </tbody></table></div> : <p>Todavía no hay borradores.</p>}
      <div className="workspace-pagination"><button className="button-outline" disabled={currentCatalogPage === 0} onClick={() => setCatalogPage(currentCatalogPage - 1)}>Anterior</button><span>{filteredDrafts.length} resultados · Página {currentCatalogPage + 1} de {catalogPages}</span><button className="button-outline" disabled={currentCatalogPage + 1 >= catalogPages} onClick={() => setCatalogPage(currentCatalogPage + 1)}>Siguiente</button><label>Por página<select value={catalogPageSize} onChange={(event) => setCatalogPageSize(Number(event.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label></div>
      {editingId && drafts.find((draft) => draft.id === editingId) ? (() => {
        const item = drafts.find((draft) => draft.id === editingId)!;
        const images = [...new Set([...(item.images ?? []), item.image, imageUrl.trim()].filter(Boolean))];
        const uniqueDiameters = item.variants?.length ? [...new Set(item.variants.map((v) => v.diameter).filter(Boolean))] : [];
        const pricedVariantsCount = item.variants?.filter((v) => v.price > 0).length ?? 0;
        const totalVariantsCount = item.variants?.length ?? 0;
        const allVariantsPriced = totalVariantsCount > 0 && pricedVariantsCount === totalVariantsCount;
        const hasBasePrice = item.price > 0;
        const publishPriceReady = totalVariantsCount > 0 ? (allVariantsPriced || hasBasePrice || pricedVariantsCount > 0) : hasBasePrice;
        const hasPitch = Boolean(item.variants?.some((variant) => variant.pitch));

        return <div className="product-editor-backdrop" onMouseDown={() => setEditingId(null)}><div className="product-editor" role="dialog" aria-modal="true" aria-label={`Editar ${item.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="editor-head"><div><span className="eyebrow">Editar producto</span><h3>{item.name}</h3></div><button className="icon-button" onClick={() => setEditingId(null)} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="product-form compact-form"><label className="wide">Título del artículo<input required value={item.name} onChange={(event) => patchDraft(item.id, { name: event.target.value })} /></label><label>Precio base {item.variants?.length ? "(opcional)" : ""}<input min="1" type="number" value={item.price || ""} onChange={(event) => { const price = Number(event.target.value); patchDraft(item.id, { price, transferPrice: transferFromPrice(price) }); }} /></label><label>Transferencia base<input min="1" type="number" value={item.transferPrice || ""} onChange={(event) => patchDraft(item.id, { transferPrice: Number(event.target.value) })} /></label><label>Stock total<input min="0" type="number" disabled={Boolean(item.variants?.length)} value={item.stock} onChange={(event) => patchDraft(item.id, { stock: Number(event.target.value) })} /></label><label>Etiqueta<input value={item.badge} onChange={(event) => patchDraft(item.id, { badge: event.target.value })} /></label></div>
        <label className="admin-notice"><input type="checkbox" checked={isPriceImportProtected(item)} onChange={(event) => patchDraft(item.id, { priceImportProtected: event.target.checked })} /> Excluir de importaciones de precios</label><p>Conserva los precios del artículo y todas sus medidas al importar o ajustar por porcentaje. Podés editarlos manualmente. Guardá el producto para conservar esta elección.</p><div className="workspace-toolbar"><button className="button-outline" disabled={savingIds.includes(item.id)} onClick={() => addVariant(item)}>+ Agregar medida</button></div>
        {item.variants?.length ? <div className="variant-editor">
          <div className="variant-editor-header">
            <div>
              <h4>Medidas y stock</h4>
              <p>Cada medida tiene su SKU propio para asociar precios.</p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span className={`variant-badge-count ${allVariantsPriced ? "complete" : "pending"}`}>
                {allVariantsPriced ? <Check size={14} /> : null}
                {pricedVariantsCount} de {totalVariantsCount} medidas con precio
              </span>
            </div>
          </div>

          <div className="variant-tools-bar">
            <label className="tool-btn-sm" title="Subir Excel o CSV con SKU y Precio para este producto">
              <FileUp size={15} /> Subir Excel/CSV
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleModalFilePrices(e, item)} />
            </label>

            <button
              type="button"
              className={`tool-btn-sm ${modalTool === "paste" ? "active" : ""}`}
              onClick={() => setModalTool(modalTool === "paste" ? null : "paste")}
              title="Pegar columnas copiadas desde Excel"
            >
              <ClipboardList size={15} /> Pegar desde Excel
            </button>

            {uniqueDiameters.length ? (
              <button
                type="button"
                className={`tool-btn-sm ${modalTool === "diameter" ? "active" : ""}`}
                onClick={() => {
                  if (!modalTargetDiameter && uniqueDiameters[0]) setModalTargetDiameter(uniqueDiameters[0]);
                  setModalTool(modalTool === "diameter" ? null : "diameter");
                }}
                title="Asignar precio por diámetro"
              >
                <Layers size={15} /> Por Diámetro
              </button>
            ) : null}

            <button
              type="button"
              className="tool-btn-sm"
              onClick={() => handleModalCopyBasePrice(item)}
              title="Completar precio base en las medidas vacías"
            >
              <Check size={15} /> Usar precio base en vacías
            </button>

            <button
              type="button"
              className={`tool-btn-sm ${modalTool === "percent" ? "active" : ""}`}
              onClick={() => setModalTool(modalTool === "percent" ? null : "percent")}
              title="Ajustar porcentaje a las medidas"
            >
              <Percent size={15} /> Ajustar %
            </button>

            <button
              type="button"
              className="tool-btn-sm"
              onClick={() => downloadProductMeasureTemplate(item)}
              title="Descargar listado CSV de medidas de este producto"
            >
              <Download size={15} /> Descargar medidas CSV
            </button>
          </div>

          {modalTool === "paste" ? (
            <div className="variant-panel-box">
              <h5>Pegar precios desde Excel</h5>
              <p>Podés pegar dos columnas (SKU y Precio) o solo la columna de precios en el orden de la tabla.</p>
              <textarea
                className="variant-panel-textarea"
                value={modalPricePaste}
                onChange={(e) => setModalPricePaste(e.target.value)}
                placeholder={'Opción A (SKU y Precio):\n1215021109627\t2500\n1215021109628\t2800\n\nOpción B (solo precios correlativos):\n2500\n2800\n3100'}
              />
              <div className="variant-panel-row">
                <button type="button" className="button" disabled={!modalPricePaste.trim()} onClick={() => handleModalPastePrices(item)}>
                  Aplicar precios
                </button>
                <button type="button" className="button-outline" onClick={() => setModalTool(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {modalTool === "diameter" ? (
            <div className="variant-panel-box">
              <h5>Asignar precio por diámetro</h5>
              <p>Aplica el mismo valor a todas las medidas que compartan este diámetro.</p>
              <div className="variant-panel-row">
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Diámetro:
                  <select value={modalTargetDiameter} onChange={(e) => setModalTargetDiameter(e.target.value)}>
                    {uniqueDiameters.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Precio: $
                  <input
                    type="number"
                    min="1"
                    placeholder="Ej: 3500"
                    value={modalDiameterPrice}
                    onChange={(e) => setModalDiameterPrice(e.target.value)}
                  />
                </label>
                <button type="button" className="button" disabled={!modalDiameterPrice} onClick={() => handleModalDiameterPrice(item)}>
                  Asignar a medidas de {modalTargetDiameter}
                </button>
                <button type="button" className="button-outline" onClick={() => setModalTool(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : null}

          {modalTool === "percent" ? (
            <div className="variant-panel-box">
              <h5>Ajustar porcentaje a todas las medidas</h5>
              <p>Modifica proporcionalmente los precios existentes de este producto.</p>
              <div className="variant-panel-row">
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Porcentaje:
                  <input
                    type="number"
                    value={modalVariantPercent}
                    onChange={(e) => setModalVariantPercent(Number(e.target.value))}
                    style={{ width: "80px" }}
                  /> %
                </label>
                <button type="button" className="button" onClick={() => handleModalAdjustPercent(item)}>
                  Aplicar {modalVariantPercent}%
                </button>
                <button type="button" className="button-outline" onClick={() => setModalTool(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : null}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Diámetro</th>
                  <th>{hasPitch ? "Paso" : "Largo"}</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Precio</th>
                  <th>Transferencia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {item.variants.map((variant, index) => {
                  const hasPrice = variant.price > 0;
                  return (
                    <tr key={variant.id || index} className={!hasPrice ? "row-pending-price" : ""}>
                      <td><input aria-label={`Diámetro medida ${index + 1}`} value={variant.diameter} onChange={(event) => updateVariant(item, index, { diameter: event.target.value })} /></td>
                      <td><input aria-label={`${hasPitch ? "Paso" : "Largo"} medida ${index + 1}`} value={(hasPitch ? variant.pitch : variant.length) || ""} onChange={(event) => updateVariant(item, index, hasPitch ? { pitch: event.target.value } : { length: event.target.value })} /></td>
                      <td><input aria-label={`SKU medida ${index + 1}`} value={variant.sku} onChange={(event) => updateVariant(item, index, { sku: event.target.value })} /></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Stock medida ${index + 1}`}
                          value={variant.stock}
                          onChange={(event) => updateVariant(item, index, { stock: Number(event.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Precio medida ${index + 1}`}
                          value={variant.price || ""}
                          placeholder={String(item.price || "Base")}
                          style={!hasPrice ? { borderColor: "#7a581e" } : undefined}
                          onChange={(event) => {
                            const price = Number(event.target.value);
                            updateVariant(item, index, { price, transferPrice: transferFromPrice(price) });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Transferencia medida ${index + 1}`}
                          value={variant.transferPrice || ""}
                          placeholder={String(item.transferPrice || "Base")}
                          onChange={(event) => updateVariant(item, index, { transferPrice: Number(event.target.value) })}
                        />
                      </td>
                      <td><button className="icon-button danger" aria-label={`Quitar medida ${index + 1}`} onClick={() => { const variants = item.variants!.filter((_, position) => position !== index); patchDraft(item.id, { variants: variants.length ? variants : undefined, stock: variants.length ? variants.reduce((total, variant) => total + variant.stock, 0) : item.stock }); }}><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div> : null}
        <div className="photo-manager"><div className="photo-manager-title"><div><h4>Fotos del producto</h4><p>La primera es la portada. Podés guardar hasta 6.</p></div><label className="button-outline photo-upload"><ImagePlus size={17} /> Subir fotos<input type="file" accept="image/*" multiple onChange={(event) => addImageFiles(item, event.target.files)} /></label></div><div className="image-url-row"><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addImageUrl(item); } }} placeholder="https://... URL de una imagen" /><button className="button-muted" onClick={() => addImageUrl(item)}>Agregar URL</button></div>
          {images.length ? <div className="photo-grid">{images.map((url, index) => <div className="photo-item" key={url}><img src={url} alt={`${item.name} ${index + 1}`} /><span>{index === 0 ? "Portada" : `Foto ${index + 1}`}</span><button onClick={() => removeImage(item, url)} aria-label="Quitar foto"><X size={15} /></button></div>)}</div> : <div className="empty-photos">Todavía no hay fotos. El producto no se podrá publicar hasta agregar una.</div>}
        </div>
        {notice ? <p className="editor-result">{notice}</p> : null}
        <div className="editor-save">
          <div>
            <label className="check-field">
              <input type="checkbox" checked={item.published} onChange={(event) => patchDraft(item.id, { published: event.target.checked })} /> Publicar en la tienda al guardar
            </label>
            {item.published && (!publishPriceReady || !images.length) ? (
              <small style={{ color: "#f2c96d" }}>Antes de guardar para publicación, agregá al menos un precio y una foto.</small>
            ) : null}
            {item.published && !allVariantsPriced && totalVariantsCount > 0 ? (
              <small style={{ color: "#a3a3a3" }}>Las medidas sin precio propio usarán el precio base al publicarse.</small>
            ) : null}
          </div>
          <button className="button" disabled={savingIds.includes(item.id)} onClick={() => saveToSupabase(item)}>
            <Save size={18} /> {savingIds.includes(item.id) ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </div></div>; })() : null}
      </fieldset>
    </section>
    </>}
  </div>;
}
