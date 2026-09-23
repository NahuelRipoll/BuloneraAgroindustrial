import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Bulonera Agroindustrial",
  description: "Catálogo técnico, herramientas, bulonería y cotización para campo, taller e industria.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={montserrat.variable}>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
