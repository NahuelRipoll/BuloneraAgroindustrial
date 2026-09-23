import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@/data/products";
import { formatCurrency } from "@/lib/format";

export function ProductCard({ product }: { product: Product }) {
  const lowestVariant = product.variants?.reduce((lowest, variant) => variant.price < lowest.price ? variant : lowest);
  const displayPrice = lowestVariant?.price ?? product.price;
  const displayTransferPrice = lowestVariant?.transferPrice ?? product.transferPrice;

  const href = product.localDraftId ? `/producto/local/${product.localDraftId}` : `/producto/${product.slug}`;
  return (
    <article className={`product-card${product.offerPrice ? " is-offer" : ""}`}>
      <Link href={href} className="product-image">
        {product.offerPrice ? <span className="badge orange">OFERTA</span> : product.badge ? <span className="badge">{product.badge}</span> : null}
        <img src={product.image} alt={product.name} />
      </Link>
      <div className="product-body">
        <Link href={href} className="product-title">
          {product.name}
        </Link>
        <div>
          <div className={`product-list-price${product.listPrice ? "" : " empty"}`}>
            {product.listPrice ? formatCurrency(product.listPrice) : "Sin precio anterior"}
          </div>
          <div className={`price${product.offerPrice ? " offer-price" : ""}`}>{product.variants ? "Desde " : ""}{formatCurrency(displayPrice)}</div>
          <div className="transfer">{formatCurrency(displayTransferPrice)} con transferencia</div>
        </div>
        <Link className="button" href={href}><ShoppingCart size={18} /> Comprar</Link>
      </div>
    </article>
  );
}
