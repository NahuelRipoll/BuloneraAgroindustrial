"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CreditCard, MapPin, Package, ShoppingBag, TrendingUp } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";

type Order = { id: string; total: number; payment_method: string; province: string; status: string; created_at: string };
type OrderItem = { order_id: string; product_name: string; sku: string; quantity: number; unit_price: number };
type StockProduct = { id: string; name: string; sku: string; stock: number; published: boolean };

function groupSum<T>(items: T[], key: (item: T) => string, value: (item: T) => number) {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(key(item), (result.get(key(item)) ?? 0) + value(item)));
  return [...result.entries()].sort((a, b) => b[1] - a[1]);
}

export function AnalyticsAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const db: any = createSupabaseBrowserClient();
    Promise.all([
      db.from("products").select("id,name,sku,stock,published").order("stock"),
      db.from("orders").select("id,total,payment_method,province,status,created_at").neq("status", "cancelled").order("created_at", { ascending: false }),
    ]).then(async ([productResult, orderResult]) => {
      if (productResult.error) throw productResult.error;
      if (orderResult.error) throw orderResult.error;
      const loadedOrders = (orderResult.data ?? []) as Order[];
      setProducts(productResult.data ?? []); setOrders(loadedOrders);
      if (loadedOrders.length) {
        const itemResult = await db.from("order_items").select("order_id,product_name,sku,quantity,unit_price").in("order_id", loadedOrders.map((order) => order.id));
        if (itemResult.error) throw itemResult.error;
        setItems(itemResult.data ?? []);
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las analíticas.")).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const totalFor = (match: (date: string) => boolean) => orders.filter((order) => match(order.created_at.slice(0, 10))).reduce((sum, order) => sum + Number(order.total), 0);
  const lowStock = useMemo(() => products.filter((product) => product.stock <= threshold), [products, threshold]);
  const topProducts = useMemo(() => groupSum(items, (item) => `${item.product_name}|${item.sku}`, (item) => item.quantity).slice(0, 10), [items]);
  const paymentMethods = useMemo(() => groupSum(orders, (order) => order.payment_method || "Sin informar", (order) => Number(order.total)), [orders]);
  const provinces = useMemo(() => groupSum(orders, (order) => order.province || "Sin informar", () => 1), [orders]);
  const dailySales = useMemo(() => groupSum(orders, (order) => order.created_at.slice(0, 10), (order) => Number(order.total)).sort((a, b) => a[0].localeCompare(b[0])).slice(-14), [orders]);
  const maxDaily = Math.max(1, ...dailySales.map(([, total]) => total));

  if (loading) return <section className="card admin-card"><p>Cargando analíticas…</p></section>;
  return <div className="admin-stack">
    {error ? <p className="admin-note"><AlertTriangle /><span>{error}. Ejecutá la migración de analíticas para habilitar los datos de ventas.</span></p> : null}
    <section className="analytics-kpis">
      <article><CalendarDays /><span>Ventas de hoy</span><strong>{formatCurrency(totalFor((date) => date === today))}</strong></article>
      <article><TrendingUp /><span>Ventas del mes</span><strong>{formatCurrency(totalFor((date) => date.startsWith(month)))}</strong></article>
      <article><ShoppingBag /><span>Ventas del año</span><strong>{formatCurrency(totalFor((date) => date.startsWith(year)))}</strong></article>
      <article><Package /><span>Órdenes</span><strong>{orders.length}</strong></article>
    </section>

    <section className="card admin-card analytics-wide"><div className="admin-heading"><div><span className="eyebrow">Facturación</span><h2>Ventas de los últimos 14 días</h2></div></div>
      {dailySales.length ? <div className="sales-chart">{dailySales.map(([date, total]) => <div className="sales-bar-column" key={date}><strong>{formatCurrency(total)}</strong><div className="sales-bar-track"><span style={{ height: `${Math.max(5, total / maxDaily * 100)}%` }} /></div><small>{new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</small></div>)}</div> : <p className="analytics-empty">Todavía no hay ventas registradas.</p>}
    </section>

    <div className="analytics-grid">
      <section className="card admin-card"><div className="admin-heading"><div><span className="eyebrow">Inventario</span><h2>Stock bajo</h2></div><label className="threshold-field">Límite <input type="number" min="0" value={threshold} onChange={(event) => setThreshold(Math.max(0, Number(event.target.value)))} /></label></div>
        {lowStock.length ? <div className="analytics-list">{lowStock.slice(0, 20).map((product) => <div key={product.id}><span><strong>{product.name}</strong><small>{product.sku}</small></span><b className={product.stock === 0 ? "stock-empty" : "status-pending"}>{product.stock}</b></div>)}</div> : <p className="analytics-empty">No hay productos debajo del límite.</p>}
      </section>
      <section className="card admin-card"><div className="admin-heading"><div><span className="eyebrow">Productos</span><h2>Más vendidos</h2></div></div>
        {topProducts.length ? <div className="analytics-list ranked">{topProducts.map(([label, quantity], index) => { const [name, sku] = label.split("|"); return <div key={label}><b>{index + 1}</b><span><strong>{name}</strong><small>{sku}</small></span><em>{quantity} u.</em></div>; })}</div> : <p className="analytics-empty">Todavía no hay productos vendidos.</p>}
      </section>
      <section className="card admin-card"><div className="admin-heading"><div><span className="eyebrow">Cobros</span><h2><CreditCard size={22} /> Medios de pago</h2></div></div>
        {paymentMethods.length ? <div className="analytics-list">{paymentMethods.map(([method, total]) => <div key={method}><strong>{method}</strong><em>{formatCurrency(total)}</em></div>)}</div> : <p className="analytics-empty">Todavía no hay pagos registrados.</p>}
      </section>
      <section className="card admin-card"><div className="admin-heading"><div><span className="eyebrow">Ubicación</span><h2><MapPin size={22} /> Desde dónde compran</h2></div></div>
        {provinces.length ? <div className="analytics-list">{provinces.map(([province, count]) => <div key={province}><strong>{province}</strong><em>{count} compra{count === 1 ? "" : "s"}</em></div>)}</div> : <p className="analytics-empty">Todavía no hay ubicaciones registradas.</p>}
      </section>
    </div>
  </div>;
}
