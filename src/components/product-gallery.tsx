"use client";

import { useState } from "react";

export function ProductGallery({ name, images }: { name: string; images: string[] }) {
  const [selected, setSelected] = useState(0);
  return <div><div className="product-main-image"><img src={images[selected]} alt={name} /></div>{images.length > 1 ? <div className="product-thumbnails">{images.map((image, index) => <button className={selected === index ? "active" : ""} onClick={() => setSelected(index)} key={image}><img src={image} alt={`${name} ${index + 1}`} /></button>)}</div> : null}</div>;
}
