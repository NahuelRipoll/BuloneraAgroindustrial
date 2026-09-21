import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";
import type { Product } from "@/data/products";
import { formatCurrency } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const lowestVariant = product.variants?.reduce((lowest, variant) => variant.price < lowest.price ? variant : lowest);
  const displayPrice = lowestVariant?.price ?? product.price;
  const displayTransferPrice = lowestVariant?.transferPrice ?? product.transferPrice;

  return (
    <article className="product-card">
      <Link href={`/producto/${product.slug}`} className="product-image">
        {product.badge ? <span className="badge">{product.badge}</span> : null}
        <img src={product.image} alt={product.name} />
      </Link>
      <div className="product-body">
        <Link href={`/producto/${product.slug}`} className="product-title">
          {product.name}
        </Link>
        <div>
          {product.listPrice ? (
            <div style={{ color: "#737373", textDecoration: "line-through", fontSize: 13 }}>
              {formatCurrency(product.listPrice)}
            </div>
          ) : null}
          <div className="price">{product.variants ? "Desde " : ""}{formatCurrency(displayPrice)}</div>
          <div className="transfer">{formatCurrency(displayTransferPrice)} con transferencia</div>
        </div>
        {product.variants ? <Link className="button" href={`/producto/${product.slug}`}>Ver medidas</Link> : <AddToCartButton product={product} />}
      </div>
    </article>
  );
}
