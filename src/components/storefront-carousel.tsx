"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { defaultStorefrontImages, loadStorefrontImages } from "@/lib/storefront-gallery";

export function StorefrontCarousel() {
  const [images, setImages] = useState(defaultStorefrontImages);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    loadStorefrontImages().then((items) => { if (active) setImages(items); }).catch(() => {});
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => { active = false; query.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    if (images.length < 2 || paused || hovered || focused || reduced) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % images.length), 5000);
    return () => window.clearInterval(timer);
  }, [images.length, paused, hovered, focused, reduced]);
  const move = (offset: number) => { setPaused(true); setIndex((value) => (value + offset + images.length) % images.length); };
  return <div className="media-card storefront-card" role="region" aria-roledescription="carrusel" aria-label="Fotos de nuestro local" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <img className="storefront-photo" src={images[index].src} alt={images[index].alt} />
    {images.length > 1 && <>
      <button className="gallery-arrow previous" aria-label="Foto anterior" onClick={() => move(-1)}><ChevronLeft /></button>
      <button className="gallery-arrow next" aria-label="Foto siguiente" onClick={() => move(1)}><ChevronRight /></button>
      <div className="gallery-controls">
        {images.map((image, position) => <button key={image.id} className="gallery-dot" aria-label={`Ver foto ${position + 1}`} aria-current={index === position ? "true" : undefined} onClick={() => { setPaused(true); setIndex(position); }} />)}
        {!reduced && <button className="gallery-pause" aria-label={paused ? "Reanudar carrusel" : "Pausar carrusel"} onClick={() => setPaused(!paused)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>}
        <span className="sr-only" aria-live={paused ? "polite" : "off"}>Foto {index + 1} de {images.length}</span>
      </div>
    </>}
    <div className="stats">
      <div className="stat"><strong>3+</strong><span>años</span></div>
      <div className="stat"><strong>Gran</strong><span>variedad de stock</span></div>
      <div className="stat schedule-stat"><strong>HORARIO</strong><span>8:00–13:00<br />15:00–19:30</span></div>
    </div>
  </div>;
}
