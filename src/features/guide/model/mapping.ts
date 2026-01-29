import type { Rect } from "./types";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function mapOverlayToVideoCrop(params: {
  containerW: number;
  containerH: number;
  videoW: number;
  videoH: number;
  overlay: Rect; // container 기준(px)
}): Rect {
  const { containerW, containerH, videoW, videoH, overlay } = params;

  const scale = Math.max(containerW / videoW, containerH / videoH);

  const drawnW = videoW * scale;
  const drawnH = videoH * scale;

  const offsetX = (drawnW - containerW) / 2;
  const offsetY = (drawnH - containerH) / 2;

  const dx = overlay.x + offsetX;
  const dy = overlay.y + offsetY;

  const x = dx / scale;
  const y = dy / scale;
  const w = overlay.w / scale;
  const h = overlay.h / scale;

  const cx = clamp(x, 0, videoW);
  const cy = clamp(y, 0, videoH);
  const cw = clamp(w, 0, videoW - cx);
  const ch = clamp(h, 0, videoH - cy);

  return { x: cx, y: cy, w: cw, h: ch };
}
