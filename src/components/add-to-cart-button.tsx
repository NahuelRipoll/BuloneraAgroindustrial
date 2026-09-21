"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import type { Product } from "@/data/products";

export function AddToCartButton({ product, label = "Comprar" }: { product: Product; label?: string }) {
  const { addItem } = useCart();

  return (
    <button className="button" onClick={() => addItem(product)}>
      <ShoppingCart size={18} /> {label}
    </button>
  );
}
