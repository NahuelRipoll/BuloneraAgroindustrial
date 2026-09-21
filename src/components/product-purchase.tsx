"use client";

import { useMemo, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import type { Product, ProductVariant } from "@/data/products";
import { formatCurrency } from "@/lib/format";

export function ProductPurchase({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const optionNames = useMemo(() => product.variants ? [...new Set(product.variants.flatMap((variant) => Object.keys(variant.options)))] : [], [product.variants]);
  const variant = product.variants?.find((item) => optionNames.every((name) => item.options[name] === selected[name]));

  function valuesFor(name: string) {
    return [...new Set((product.variants ?? []).map((item) => item.options[name]))];
  }

  function select(name: string, value: string) {
    setSelected((current) => {
      const next = { ...current, [name]: value };
      return product.variants?.some((item) => Object.entries(next).every(([key, selectedValue]) => item.options[key] === selectedValue)) ? next : { [name]: value };
    });
  }

  function cartProduct(selectedVariant?: ProductVariant): Product {
    if (!selectedVariant) return product;
    const description = Object.values(selectedVariant.options).join(" × ");
    return { ...product, id: `${product.id}-${selectedVariant.id}`, name: `${product.name} — ${description}`, sku: selectedVariant.sku,
      price: selectedVariant.price, transferPrice: selectedVariant.transferPrice, stock: selectedVariant.stock, variants: undefined };
  }

  return <>
    {optionNames.map((name) => <div className="variant-group" key={name}>
      <strong>{name}: <span>{selected[name] ?? "Seleccioná una opción"}</span></strong>
      <div className="variant-options">{valuesFor(name).map((value) =>
        <button type="button" className={selected[name] === value ? "selected" : ""} onClick={() => select(name, value)} key={value}>
          {selected[name] === value ? <Check size={14} /> : null}{value}
        </button>)}</div>
    </div>)}
    {product.variants ? <p className="variant-help">Todas las medidas permanecen visibles. Si cambiás a una combinación que no existe en tabla, se limpia la otra selección para que puedas elegir una disponible.</p> : null}
    <div className="variant-price">
      <small>{variant ? `SKU ${variant.sku}` : product.variants ? "Elegí diámetro y largo para ver precio y stock" : `SKU ${product.sku}`}</small>
      <div className="price">{formatCurrency(variant?.price ?? product.price)}</div>
      <div className="transfer">{formatCurrency(variant?.transferPrice ?? product.transferPrice)} con transferencia</div>
      {variant ? <p className="stock-ok">Disponible: {variant.stock} cajas</p> : null}
    </div>
    <button className="button purchase-button" disabled={Boolean(product.variants && !variant)} onClick={() => addItem(cartProduct(variant))}>
      <ShoppingCart size={18} /> {product.variants && !variant ? "Elegí una medida" : "Agregar al carrito"}
    </button>
  </>;
}
