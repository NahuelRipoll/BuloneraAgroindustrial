"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import type { Product, ProductVariant } from "@/data/products";
import { formatCurrency } from "@/lib/format";

function measureValue(value: string, plainAsInches = false) {
  const clean = value.toUpperCase().replace(/^M/, "").replace(/MM|[`”"]/g, "").trim();
  const fraction = clean.match(/^(?:(\d+)[ .-])?(\d+)\/(\d+)/);
  if (fraction) return ((Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3])) * 25.4);
  const numeric = Number(clean.match(/\d+(?:[.,]\d+)?/)?.[0].replace(",", "."));
  return Number.isFinite(numeric) ? numeric * (plainAsInches && /^\d+(?:[.,]\d+)?$/.test(clean) ? 25.4 : 1) : Number.POSITIVE_INFINITY;
}

function compareMeasures(left: string, right: string, plainAsInches = false) {
  const difference = measureValue(left, plainAsInches) - measureValue(right, plainAsInches);
  return difference || left.localeCompare(right, "es", { numeric: true });
}

export function ProductPurchase({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const optionNames = useMemo(() => product.variants ? [...new Set(product.variants.flatMap((variant) => Object.keys(variant.options)))].sort((left, right) => ["Diámetro", "Paso", "Largo"].indexOf(left) - ["Diámetro", "Paso", "Largo"].indexOf(right)) : [], [product.variants]);
  const variant = product.variants?.find((item) => optionNames.every((name) => item.options[name] === selected[name]));
  const availableStock = variant?.stock ?? (product.variants ? 0 : product.stock);

  useEffect(() => setQuantity(1), [variant?.id]);

  function updateQuantity(value: number) {
    setQuantity(Math.max(1, Math.min(Math.floor(value) || 1, availableStock || 1)));
  }

  function valuesFor(name: string, optionIndex: number) {
    const previousNames = optionNames.slice(0, optionIndex);
    const values = [...new Set((product.variants ?? [])
      .filter((item) => previousNames.every((previousName) => item.options[previousName] === selected[previousName]))
      .map((item) => item.options[name]).filter(Boolean))];
    const includesFractions = values.some((value) => /\d+\/\d+/.test(value));
    return values.sort((left, right) => compareMeasures(left, right, includesFractions));
  }

  function select(name: string, value: string, optionIndex: number) {
    setSelected((current) => Object.fromEntries([...Object.entries(current).filter(([key]) => optionNames.indexOf(key) < optionIndex), [name, value]]));
  }

  function cartProduct(selectedVariant?: ProductVariant): Product {
    if (!selectedVariant) return product;
    const description = Object.values(selectedVariant.options).join(" × ");
    return { ...product, id: `${product.id}-${selectedVariant.id}`, name: `${product.name} — ${description}`, sku: selectedVariant.sku,
      price: selectedVariant.price, transferPrice: selectedVariant.transferPrice, stock: selectedVariant.stock, variants: undefined };
  }

  return <>
    {optionNames.map((name, optionIndex) => { const enabled = optionNames.slice(0, optionIndex).every((previousName) => selected[previousName]); return <div className="variant-group" key={name}>
      <strong>{name}: <span>{selected[name] ?? (enabled ? "Seleccioná una opción" : `Seleccioná primero ${optionNames[optionIndex - 1].toLowerCase()}`)}</span></strong>
      <div className="variant-options">{enabled ? valuesFor(name, optionIndex).map((value) =>
        <button type="button" className={selected[name] === value ? "selected" : ""} onClick={() => select(name, value, optionIndex)} key={value}>
          {selected[name] === value ? <Check size={14} /> : null}{value}
        </button>) : null}</div>
    </div>; })}
    {product.variants ? <p className="variant-help">Las opciones están ordenadas de menor a mayor. Cada selección habilita únicamente las medidas compatibles del paso siguiente.</p> : null}
    <div className="variant-price">
      <small>{variant ? `SKU ${variant.sku}` : product.variants ? `Elegí ${optionNames.map((name) => name.toLowerCase()).join(" y ")} para ver precio y stock` : `SKU ${product.sku}`}</small>
      {(variant?.listPrice ?? (!product.variants ? product.listPrice : undefined)) ? <div className="offer-base-price">Precio base: {formatCurrency(variant?.listPrice ?? product.listPrice!)}</div> : null}
      <div className={`price${product.offerPrice ? " offer-price" : ""}`}>{formatCurrency(variant?.price ?? product.price)}</div>
      <div className="transfer">{formatCurrency(variant?.transferPrice ?? product.transferPrice)} con transferencia</div>
      {variant ? variant.stock > 0 ? <p className="stock-ok">Disponible: {variant.stock} unidades</p> : <p className="stock-empty">Sin stock por el momento</p> : null}
    </div>
    {(!product.variants || variant) && availableStock > 0 ? <div className="purchase-quantity">
      <span>Cantidad</span>
      <div className="qty product-qty">
        <button type="button" onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Quitar una unidad"><Minus size={15} /></button>
        <input type="number" min="1" max={availableStock} value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} aria-label="Cantidad" />
        <button type="button" onClick={() => updateQuantity(quantity + 1)} disabled={quantity >= availableStock} aria-label="Agregar una unidad"><Plus size={15} /></button>
      </div>
      <small>Máximo disponible: {availableStock}</small>
    </div> : null}
    {!product.variants && product.stock > 0 ? <p className="stock-ok">Disponible: {product.stock} unidades</p> : null}
    <button className="button purchase-button" disabled={Boolean(product.variants && (!variant || variant.stock <= 0)) || (!product.variants && product.stock <= 0)} onClick={() => addItem(cartProduct(variant), quantity)}>
      <ShoppingCart size={18} /> {product.variants && !variant ? "Elegí una medida" : availableStock <= 0 ? "Sin stock" : `Agregar ${quantity} al carrito`}
    </button>
  </>;
}
