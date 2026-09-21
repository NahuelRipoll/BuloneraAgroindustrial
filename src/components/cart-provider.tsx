"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/products";

type CartLine = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  transferTotal: number;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const storageKey = "bulonera-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as CartLine[];
      setItems(parsed.filter((line) => line.product?.id && line.quantity > 0));
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, line) => {
        acc.subtotal += line.product.price * line.quantity;
        acc.transferTotal += line.product.transferPrice * line.quantity;
        acc.itemCount += line.quantity;
        return acc;
      },
      { subtotal: 0, transferTotal: 0, itemCount: 0 },
    );
  }, [items]);

  function addItem(product: Product, quantity = 1) {
    setItems((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: Math.min(line.quantity + quantity, product.stock) }
            : line,
        );
      }
      return [...current, { product, quantity: Math.min(quantity, product.stock) }];
    });
    setIsOpen(true);
  }

  function updateQuantity(productId: string, quantity: number) {
    setItems((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.max(1, Math.min(quantity, line.product.stock)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((line) => line.product.id !== productId));
  }

  const value: CartContextValue = {
    items,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    addItem,
    removeItem,
    updateQuantity,
    clearCart: () => setItems([]),
    subtotal: totals.subtotal,
    transferTotal: totals.transferTotal,
    itemCount: totals.itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
