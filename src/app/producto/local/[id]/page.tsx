import { CartDrawer } from "@/components/cart-drawer";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { LocalProductDetail } from "@/components/local-product-detail";

export default async function LocalProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><Header /><CartDrawer /><main className="product-page"><div className="container"><LocalProductDetail id={id} /></div></main><Footer /></>;
}
