import { notFound } from "next/navigation";
import { productModules } from "@/lib/admin-product-modules";

export function generateStaticParams() { return productModules.map((module) => ({ module: module.id })); }
export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return { title: `${productModules.find((item) => item.id === module)?.title || "Productos"} | Administración` };
}
export default async function ProductModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!productModules.some((item) => item.id === module)) notFound();
  return null;
}
