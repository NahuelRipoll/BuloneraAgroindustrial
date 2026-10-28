export type ImageFraming = { position?: { x: number; y: number }; zoom?: number };
export type Frame = { position: { x: number; y: number }; zoom: number };
const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function imageFraming(image: ImageFraming): Frame {
  return { position: { x: bounded(image.position?.x, 50, 0, 100), y: bounded(image.position?.y, 0, 0, 100) }, zoom: bounded(image.zoom, 1, 1, 3) };
}

export function framingStyle(image: ImageFraming) {
  const { position, zoom } = imageFraming(image);
  return { objectPosition: `${position.x}% ${position.y}%`, transform: `scale(${zoom})`, transformOrigin: `${position.x}% ${position.y}%` };
}

export function dragFraming(start: Frame, dx: number, dy: number, size: { width: number; height: number; naturalWidth: number; naturalHeight: number }): Frame {
  const { width, height, naturalWidth, naturalHeight } = size;
  if (![width, height, naturalWidth, naturalHeight].every((value) => Number.isFinite(value) && value > 0)) return imageFraming(start);
  const scale = Math.max(width / naturalWidth, height / naturalHeight) * start.zoom;
  const move = (position: number, delta: number, overflow: number) => overflow > .5 ? Math.round(bounded(position - delta * 100 / overflow, position, 0, 100) * 100) / 100 : position;
  return imageFraming({ position: { x: move(start.position.x, dx, naturalWidth * scale - width), y: move(start.position.y, dy, naturalHeight * scale - height) }, zoom: start.zoom });
}
