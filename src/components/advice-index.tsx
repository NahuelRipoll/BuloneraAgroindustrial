"use client";

import { useEffect, useRef } from "react";

const sections = [
  ["equivalencias", "Pulgadas a mm"],
  ["medicion", "Cómo medir"],
  ["roscas", "Roscas"],
  ["resistencia", "Resistencia"],
  ["checklist", "Antes de comprar"],
];

export function AdviceIndex() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const main = nav?.closest("main");
    const header = document.querySelector<HTMLElement>(".header");
    if (!nav || !main || !header) return;
    const update = () => {
      const stickyHeader = getComputedStyle(header).position === "sticky";
      main.style.setProperty("--advice-header-height", `${stickyHeader ? header.getBoundingClientRect().height : 0}px`);
      main.style.setProperty("--advice-index-height", `${nav.getBoundingClientRect().height}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(nav);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      main.style.removeProperty("--advice-header-height");
      main.style.removeProperty("--advice-index-height");
    };
  }, []);
  return <nav ref={ref} className="advice-index" aria-label="Temas de asesoramiento"><div className="container">
    {sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
  </div></nav>;
}
