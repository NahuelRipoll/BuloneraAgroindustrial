"use client";

import { useId, useRef, useState } from "react";
import { dragFraming, framingStyle, imageFraming, type Frame } from "@/lib/storefront-framing";
import type { StorefrontImage } from "@/lib/storefront-gallery";

export function StorefrontPhotoFramer({ image, number, disabled, onChange }: { image: StorefrontImage; number: number; disabled: boolean; onChange: (frame: Frame) => void }) {
  const frame = imageFraming(image);
  const instructions = useId();
  const photo = useRef<HTMLImageElement>(null);
  const [view, setView] = useState("desktop");
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; frame: Frame; size: { width: number; height: number; naturalWidth: number; naturalHeight: number } } | null>(null);
  return <div className="storefront-framer">
    <div className="framing-views" role="group" aria-label={`Vista del encuadre de foto ${number}`}>
      <button type="button" className="button-muted" disabled={disabled} aria-pressed={view === "desktop"} onClick={() => setView("desktop")}>Escritorio</button>
      <button type="button" className="button-muted" disabled={disabled} aria-pressed={view === "mobile"} onClick={() => setView("mobile")}>Celular</button>
    </div>
    <p id={instructions}>Arrastrá la foto con el mouse o el dedo para encuadrarla. También podés usar las flechas del teclado o los controles de abajo. La vista es aproximada: el recorte se adapta al tamaño de pantalla.</p>
    <div className="storefront-frame" role="group" aria-label={`Encuadre de foto ${number}`} aria-describedby={instructions} aria-disabled={disabled} tabIndex={disabled ? -1 : 0} data-dragging={dragging} style={{ aspectRatio: view === "mobile" ? "3 / 5" : "1 / 1" }}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0 || !event.isPrimary || !photo.current?.naturalWidth) return;
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, frame, size: { width: rect.width, height: rect.height, naturalWidth: photo.current.naturalWidth, naturalHeight: photo.current.naturalHeight } };
        event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus(); setDragging(true); event.preventDefault();
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!disabled && current && current.pointerId === event.pointerId) onChange(dragFraming(current.frame, event.clientX - current.x, event.clientY - current.y, current.size));
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null; setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; setDragging(false); }}
      onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      onKeyDown={(event) => {
        if (disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 2;
        onChange(imageFraming({ ...frame, position: { x: frame.position.x + (event.key === "ArrowLeft" ? amount : event.key === "ArrowRight" ? -amount : 0), y: frame.position.y + (event.key === "ArrowUp" ? amount : event.key === "ArrowDown" ? -amount : 0) } }));
      }}>
      <img ref={photo} src={image.src} alt={image.alt} draggable={false} style={framingStyle(image)} />
    </div>
    <div className="framing-controls">
      <label>Horizontal · {Math.round(frame.position.x)}%<input aria-label={`Posición horizontal de foto ${number}`} type="range" min="0" max="100" step="1" value={frame.position.x} disabled={disabled} onChange={(event) => onChange({ ...frame, position: { ...frame.position, x: Number(event.target.value) } })} /></label>
      <label>Vertical · {Math.round(frame.position.y)}%<input aria-label={`Posición vertical de foto ${number}`} type="range" min="0" max="100" step="1" value={frame.position.y} disabled={disabled} onChange={(event) => onChange({ ...frame, position: { ...frame.position, y: Number(event.target.value) } })} /></label>
      <label>Zoom · {Math.round(frame.zoom * 100)}%<input aria-label={`Zoom de foto ${number}`} type="range" min="100" max="300" step="10" value={frame.zoom * 100} disabled={disabled} onChange={(event) => onChange({ ...frame, zoom: Number(event.target.value) / 100 })} /></label>
      <button type="button" className="button-muted" aria-label={`Restablecer encuadre de foto ${number}`} disabled={disabled} onClick={() => onChange(imageFraming({}))}>Restablecer encuadre</button>
    </div>
  </div>;
}
