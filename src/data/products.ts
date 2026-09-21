export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  price: number;
  listPrice?: number;
  transferPrice: number;
  stock: number;
  badge?: string;
  image: string;
  images?: string[];
  localDraftId?: string;
  specs: Record<string, string>;
  variants?: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  options: Record<string, string>;
  price: number;
  transferPrice: number;
  stock: number;
};

const boltLengths = [
  ["3/4\"", 19], ["7/8\"", 22], ["1\"", 25], ["1 1/4\"", 32], ["1 1/2\"", 38],
  ["1 3/4\"", 44], ["2\"", 50], ["2 1/4\"", 56], ["2 1/2\"", 63], ["2 3/4\"", 70],
  ["3\"", 76], ["3 1/4\"", 82], ["3 1/2\"", 90], ["4\"", 100], ["4 1/2\"", 110],
  ["5\"", 125], ["5 1/2\"", 140], ["6\"", 155], ["7\"", 175], ["8\"", 200],
  ["9\"", 225], ["10\"", 250], ["11\"", 275], ["12\"", 300],
] as const;

const boltDiameters = [
  { label: "1/4\"", code: 6, from: 0, to: 16 },
  { label: "5/16\"", code: 8, from: 0, to: 19 },
  { label: "3/8\"", code: 9, from: 0, to: 19 },
  { label: "7/16\"", code: 11, from: 0, to: 19 },
  { label: "1/2\" × 12", code: 12, from: 0, to: 21 },
  { label: "1/2\" × 13", code: 13, from: 0, to: 21 },
  { label: "9/16\"", code: 14, from: 2, to: 17 },
  { label: "5/8\"", code: 16, from: 2, to: 21 },
  { label: "3/4\"", code: 19, from: 2, to: 23 },
  { label: "7/8\"", code: 22, from: 3, to: 23 },
  { label: "1\"", code: 25, from: 3, to: 23, exclude: [20, 22] },
] as const;

function createBoltVariants(): ProductVariant[] {
  return boltDiameters.flatMap((diameter, diameterIndex) => boltLengths.flatMap(([length, millimeters], lengthIndex) => {
    if (lengthIndex < diameter.from || lengthIndex > diameter.to || ("exclude" in diameter && diameter.exclude.includes(lengthIndex as never))) return [];
    const price = Math.round((12500 + diameterIndex * 2100 + lengthIndex * 720) / 100) * 100;
    return [{ id: `g5-${diameter.code}-${millimeters}`, sku: `X.${diameter.code}.${millimeters}`, options: { Diámetro: diameter.label, Largo: length },
      price, transferPrice: Math.round(price * 0.9), stock: Math.max(4, 36 - diameterIndex * 2 - Math.floor(lengthIndex / 2)) }];
  }));
}

export const products: Product[] = [
  {
    id: "bocallaves-108",
    slug: "juego-bocallaves-108-pzs",
    name: "Juego de Bocallaves y Accesorios 1/2 y 1/4 - 108 Pzs Acero Cromo Vanadio",
    sku: "BLL-108-CV",
    brand: "KLD",
    category: "Herramientas",
    price: 96000,
    listPrice: 120000,
    transferPrice: 86400,
    stock: 8,
    badge: "20% OFF",
    image: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    specs: {
      Material: "Acero cromo vanadio",
      Piezas: "108 piezas",
      Encastres: "1/2 y 1/4",
      Presentación: "Maletín organizador",
      Aplicación: "Taller mecánico, mantenimiento agroindustrial y uso profesional",
    },
  },
  {
    id: "bulon-hex-88",
    slug: "caja-bulon-hexagonal-acero-88",
    name: "Caja Bulón Hexagonal Acero 8.8 Zincado (100u)",
    sku: "BUL-HEX-88",
    brand: "Dogo",
    category: "Bulonería",
    price: 25500,
    transferPrice: 22950,
    stock: 32,
    badge: "Bulonería",
    image: "https://images.unsplash.com/photo-1530635489115-b74c0556dc5b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    specs: {
      Material: "Acero 8.8",
      Terminación: "Zincado",
      Medidas: "Diámetro y largo seleccionables",
      Presentación: "Caja x 100 unidades",
      Aplicación: "Maquinaria, estructuras livianas y mantenimiento general",
    },
    variants: createBoltVariants(),
  },
  {
    id: "taladro-12v",
    slug: "taladro-atornillador-inalambrico-12v",
    name: "Taladro Atornillador Inalámbrico 12v con Maletín",
    sku: "TAL-12V",
    brand: "Bosch",
    category: "Herramientas",
    price: 89999,
    transferPrice: 80999,
    stock: 5,
    badge: "Envío gratis",
    image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    specs: {
      Voltaje: "12v",
      Presentación: "Maletín",
      Uso: "Perforación y atornillado",
      Aplicación: "Taller, hogar y mantenimiento",
    },
  },
  {
    id: "disco-corte-115",
    slug: "disco-corte-metal-115mm",
    name: "Disco de Corte para Metal 115mm x 1.0mm Caja x 50u",
    sku: "DIS-115-50",
    brand: "3M",
    category: "Abrasivos",
    price: 45000,
    transferPrice: 40500,
    stock: 24,
    image: "https://images.unsplash.com/photo-1540104539488-92a51bbc0410?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    specs: {
      Diámetro: "115 mm",
      Espesor: "1.0 mm",
      Presentación: "Caja x 50 unidades",
      Aplicación: "Corte de metal",
    },
  },
];

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}
