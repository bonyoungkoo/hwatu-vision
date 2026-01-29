// src/shared/ui/GuideOverlay.tsx
import React, { useState } from "react";

export type Rect = { x: number; y: number; w: number; h: number };

type Handle = "nw" | "ne" | "sw" | "se";

type Props = {
  rects: Rect[];
  className?: string;

  dimOpacity?: number; // 0~1
  strokeWidth?: number;
  radius?: number; // px

  // 스타일 튜닝
  strokeClassName?: string; // 기본 테두리
  selectedStrokeClassName?: string; // 선택된 테두리
  dragStrokeClassName?: string; // 드래그/리사이즈 중 테두리
  innerShadow?: boolean;

  // Step A: 이동(드래그)
  draggable?: boolean;

  // Step B: 리사이즈(모서리 핸들)
  resizable?: boolean;
  minSize?: number; // px (w/h 최소값)

  // ✅ 라벨
  showLabels?: boolean;
  labelPrefix?: string; // 기본: "사용자"

  onRectsChange?: (next: Rect[]) => void;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function GuideOverlay({
  rects,
  className,
  dimOpacity = 0.4,
  strokeWidth = 3,
  radius = 24,

  strokeClassName = "stroke-emerald-400/80",
  selectedStrokeClassName = "stroke-emerald-300",
  dragStrokeClassName = "stroke-emerald-200",

  innerShadow = true,

  draggable = false,
  resizable = false,
  minSize = 56,

  showLabels = true,
  labelPrefix = "사용자",

  onRectsChange,
}: Props) {
  const maskId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);

  const [isInteracting, setIsInteracting] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const interactRef = React.useRef<
    | {
        type: "move";
        index: number;
        pointerId: number;
        offsetX: number;
        offsetY: number;
        startRects: Rect[];
      }
    | {
        type: "resize";
        index: number;
        pointerId: number;
        handle: Handle;
        startRects: Rect[];
        startRect: Rect;
        startX: number;
        startY: number;
      }
    | null
  >(null);

  if (!rects || rects.length === 0) return null;

  // stroke가 가장자리에서 잘려보이는 문제 방지용 safe padding
  const safePad = Math.max(2, Math.ceil(strokeWidth / 2) + 1);

  const getLocal = (e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!root) return { x: 0, y: 0, W: 0, H: 0 };
    const b = root.getBoundingClientRect();
    return {
      x: e.clientX - b.left,
      y: e.clientY - b.top,
      W: b.width,
      H: b.height,
    };
  };

  const beginMove = (e: React.PointerEvent, index: number) => {
    if (!draggable) return;
    const r = rects[index];
    if (!r) return;

    const { x, y } = getLocal(e);
    interactRef.current = {
      type: "move",
      index,
      pointerId: e.pointerId,
      offsetX: x - r.x,
      offsetY: y - r.y,
      startRects: rects.map((v) => ({ ...v })),
    };

    setActiveIndex(index);
    setIsInteracting(true);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const beginResize = (
    e: React.PointerEvent,
    index: number,
    handle: Handle,
  ) => {
    if (!resizable) return;
    const r = rects[index];
    if (!r) return;

    const { x, y } = getLocal(e);
    interactRef.current = {
      type: "resize",
      index,
      pointerId: e.pointerId,
      handle,
      startRects: rects.map((v) => ({ ...v })),
      startRect: { ...r },
      startX: x,
      startY: y,
    };

    setActiveIndex(index);
    setIsInteracting(true);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const moveInteract = (e: React.PointerEvent) => {
    const root = rootRef.current;
    const st = interactRef.current;
    if (!root || !st) return;
    if (st.pointerId !== e.pointerId) return;

    const { x: lx, y: ly, W, H } = getLocal(e);
    if (!W || !H) return;

    if (st.type === "move") {
      const target = st.startRects[st.index];
      if (!target) return;

      const nextX = clamp(lx - st.offsetX, safePad, W - safePad - target.w);
      const nextY = clamp(ly - st.offsetY, safePad, H - safePad - target.h);

      const next = st.startRects.map((r, i) =>
        i === st.index ? { ...r, x: nextX, y: nextY } : r,
      );

      onRectsChange?.(next);
      e.preventDefault();
      return;
    }

    // resize
    const r0 = st.startRect;
    const dx = lx - st.startX;
    const dy = ly - st.startY;

    let x = r0.x;
    let y = r0.y;
    let w = r0.w;
    let h = r0.h;

    switch (st.handle) {
      case "nw":
        x = r0.x + dx;
        y = r0.y + dy;
        w = r0.w - dx;
        h = r0.h - dy;
        break;
      case "ne":
        y = r0.y + dy;
        w = r0.w + dx;
        h = r0.h - dy;
        break;
      case "sw":
        x = r0.x + dx;
        w = r0.w - dx;
        h = r0.h + dy;
        break;
      case "se":
        w = r0.w + dx;
        h = r0.h + dy;
        break;
    }

    w = Math.max(minSize, w);
    h = Math.max(minSize, h);

    x = clamp(x, safePad, W - safePad - w);
    y = clamp(y, safePad, H - safePad - h);

    w = Math.min(w, W - safePad - x);
    h = Math.min(h, H - safePad - y);

    if (st.handle === "nw" || st.handle === "sw") {
      const right = r0.x + r0.w;
      x = clamp(right - w, safePad, W - safePad - w);
    }
    if (st.handle === "nw" || st.handle === "ne") {
      const bottom = r0.y + r0.h;
      y = clamp(bottom - h, safePad, H - safePad - h);
    }

    const next = st.startRects.map((r, i) =>
      i === st.index ? { ...r, x, y, w, h } : r,
    );

    onRectsChange?.(next);
    e.preventDefault();
  };

  const endInteract = (e: React.PointerEvent) => {
    const st = interactRef.current;
    if (!st) return;
    if (st.pointerId !== e.pointerId) return;

    interactRef.current = null;
    setIsInteracting(false);
    e.preventDefault();
  };

  // ✅ “빈 영역 클릭 시에만” 선택 해제
  const onRootPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (interactRef.current) return;

    const el = e.target as HTMLElement | null;
    if (!el) return;

    const insideRect = el.closest('[data-guide-rect="true"]');
    if (!insideRect) setActiveIndex(null);
  };

  const handleSize = 18; // px
  const handleBase =
    "absolute z-20 touch-none rounded-full bg-white/10 backdrop-blur-sm " +
    "ring-1 ring-white/20 hover:bg-white/15 active:bg-white/20";

  const cursorByHandle: Record<Handle, string> = {
    nw: "cursor-nwse-resize",
    se: "cursor-nwse-resize",
    ne: "cursor-nesw-resize",
    sw: "cursor-nesw-resize",
  };

  const interactive = draggable || resizable;

  return (
    <div
      ref={rootRef}
      className={[
        "absolute inset-0",
        interactive ? "pointer-events-auto" : "pointer-events-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerMove={moveInteract}
      onPointerUp={endInteract}
      onPointerCancel={endInteract}
      onPointerDownCapture={onRootPointerDownCapture}
    >
      {/* 1) 딤(구멍 뚫린 mask) */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rects.map((r, i) => (
              <rect
                key={i}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={radius}
                ry={radius}
                fill="black"
              />
            ))}
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`rgba(0,0,0,${dimOpacity})`}
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* 2) inner shadow */}
      {innerShadow
        ? rects.map((r, i) => (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: r.x,
                top: r.y,
                width: r.w,
                height: r.h,
                borderRadius: radius,
                boxShadow: "inset 0 0 28px rgba(0,0,0,0.35)",
              }}
            />
          ))
        : null}

      {/* ✅ 라벨 */}
      {showLabels
        ? rects.map((r, i) => {
            const isActive = i === activeIndex;
            return (
              <div
                key={i}
                className={[
                  "pointer-events-none absolute z-30",
                  "select-none",
                ].join(" ")}
                style={{
                  left: r.x + 12,
                  top: r.y + 10,
                }}
              >
                <div
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                    "backdrop-blur-md",
                    isActive
                      ? "bg-black/55 text-white"
                      : "bg-black/45 text-white/85",
                    "ring-1 ring-white/15",
                  ].join(" ")}
                >
                  {labelPrefix}
                  {i + 1}
                </div>
              </div>
            );
          })
        : null}

      {/* 3) Hit-area + handles */}
      {interactive
        ? rects.map((r, i) => {
            const isActive = i === activeIndex;

            return (
              <div
                key={i}
                data-guide-rect="true"
                className="absolute"
                style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
              >
                {/* 선택 레이어 */}
                <div
                  className="absolute inset-0 touch-none"
                  style={{ borderRadius: radius }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex(i);
                  }}
                />

                {/* 이동 */}
                {draggable ? (
                  <div
                    className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
                    style={{ borderRadius: radius }}
                    onPointerDown={(e) => beginMove(e, i)}
                  />
                ) : null}

                {/* 리사이즈 핸들(선택된 것만) */}
                {resizable && isActive ? (
                  <>
                    <div
                      className={[handleBase, cursorByHandle.nw].join(" ")}
                      style={{
                        left: -handleSize / 2,
                        top: -handleSize / 2,
                        width: handleSize,
                        height: handleSize,
                      }}
                      onPointerDown={(e) => beginResize(e, i, "nw")}
                    />
                    <div
                      className={[handleBase, cursorByHandle.ne].join(" ")}
                      style={{
                        left: r.w - handleSize / 2,
                        top: -handleSize / 2,
                        width: handleSize,
                        height: handleSize,
                      }}
                      onPointerDown={(e) => beginResize(e, i, "ne")}
                    />
                    <div
                      className={[handleBase, cursorByHandle.sw].join(" ")}
                      style={{
                        left: -handleSize / 2,
                        top: r.h - handleSize / 2,
                        width: handleSize,
                        height: handleSize,
                      }}
                      onPointerDown={(e) => beginResize(e, i, "sw")}
                    />
                    <div
                      className={[handleBase, cursorByHandle.se].join(" ")}
                      style={{
                        left: r.w - handleSize / 2,
                        top: r.h - handleSize / 2,
                        width: handleSize,
                        height: handleSize,
                      }}
                      onPointerDown={(e) => beginResize(e, i, "se")}
                    />
                  </>
                ) : null}
              </div>
            );
          })
        : null}

      {/* 4) strokes */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {rects.map((r, i) => {
          const isActive = i === activeIndex;
          const strokeCls = isActive
            ? selectedStrokeClassName
            : strokeClassName;

          return (
            <rect
              key={i}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={radius}
              ry={radius}
              fill="transparent"
              className={strokeCls}
              strokeWidth={strokeWidth}
            />
          );
        })}

        {isInteracting && activeIndex !== null && rects[activeIndex] ? (
          <rect
            x={rects[activeIndex].x}
            y={rects[activeIndex].y}
            width={rects[activeIndex].w}
            height={rects[activeIndex].h}
            rx={radius}
            ry={radius}
            fill="transparent"
            className={dragStrokeClassName}
            strokeWidth={strokeWidth + 2}
          />
        ) : null}
      </svg>
    </div>
  );
}
