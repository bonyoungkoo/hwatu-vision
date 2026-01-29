import React from "react";

export type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  rects: Rect[];
  className?: string;
  dimOpacity?: number; // 0~1
  strokeClassName?: string;
  strokeWidth?: number;
  radius?: number;

  draggable?: boolean;
  onRectsChange?: (next: Rect[]) => void;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export function GuideOverlay({
  rects,
  className,
  dimOpacity = 0.45,
  strokeClassName = "stroke-emerald-400/90",
  strokeWidth = 3,
  radius = 24,
  draggable = false,
  onRectsChange,
}: Props) {
  const maskId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);

  // ✅ 선택된 가이드
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  // ✅ 드래그 중인 가이드(Outline 강조용)
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);

  const dragRef = React.useRef<{
    index: number;
    offsetX: number;
    offsetY: number;
    pointerId: number;
    startRects: Rect[];
  } | null>(null);

  if (!rects || rects.length === 0) return null;

  const beginDrag = (e: React.PointerEvent, index: number) => {
    if (!draggable) return;
    const root = rootRef.current;
    if (!root) return;

    const r = rects[index];
    if (!r) return;

    // ✅ 선택 반영
    setActiveIndex(index);
    setDraggingIndex(index);

    const bounds = root.getBoundingClientRect();
    const localX = e.clientX - bounds.left;
    const localY = e.clientY - bounds.top;

    dragRef.current = {
      index,
      offsetX: localX - r.x,
      offsetY: localY - r.y,
      pointerId: e.pointerId,
      startRects: rects.map((x) => ({ ...x })),
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const clampRectToSafe = (r: Rect, W: number, H: number) => {
    const SAFE = Math.ceil(strokeWidth);
    const x = clamp(r.x, SAFE, W - r.w - SAFE);
    const y = clamp(r.y, SAFE, H - r.h - SAFE);
    return { ...r, x, y };
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!draggable) return;
    const root = rootRef.current;
    const st = dragRef.current;
    if (!root || !st) return;
    if (st.pointerId !== e.pointerId) return;

    const bounds = root.getBoundingClientRect();
    const W = bounds.width;
    const H = bounds.height;

    const target = st.startRects[st.index];
    if (!target) return;

    const localX = e.clientX - bounds.left;
    const localY = e.clientY - bounds.top;

    const SAFE = Math.ceil(strokeWidth);

    const nextX = clamp(localX - st.offsetX, SAFE, W - target.w - SAFE);
    const nextY = clamp(localY - st.offsetY, SAFE, H - target.h - SAFE);

    const next = st.startRects.map((r, i) => {
      if (i !== st.index) return r;
      return clampRectToSafe({ ...r, x: nextX, y: nextY }, W, H);
    });

    onRectsChange?.(next);
    e.preventDefault();
  };

  const endDrag = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st) return;
    if (st.pointerId !== e.pointerId) return;

    dragRef.current = null;
    setDraggingIndex(null);
    e.preventDefault();
  };

  // ✅ inner shadow처럼 보이게 하는 "안쪽 그라데이션" (안정적)
  // - 중앙은 거의 투명, 가장자리로 갈수록 살짝 어두워짐
  const innerFillFor = (i: number) => {
    const isActive = i === activeIndex;
    // 선택된 건 조금 더 밝게(=덜 어둡게)
    return isActive ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.18)";
  };

  const strokeClassFor = (i: number) => {
    const isActive = i === activeIndex;
    // 선택된 것만 살짝 더 밝게
    return isActive ? "stroke-emerald-300" : strokeClassName;
  };

  const strokeWidthFor = (i: number) => {
    const isActive = i === activeIndex;
    return isActive ? strokeWidth + 0.5 : strokeWidth;
  };

  return (
    <div
      ref={rootRef}
      className={[
        "absolute inset-0",
        draggable ? "pointer-events-auto" : "pointer-events-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
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

      {/* 2) ✅ 내부 미세 inner shadow(그라데이션 느낌) */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {rects.map((r, i) => (
          <g key={i}>
            {/* 얇은 inset 느낌: fill + 살짝 blur된 가장자리 */}
            <rect
              x={r.x + 1}
              y={r.y + 1}
              width={Math.max(0, r.w - 2)}
              height={Math.max(0, r.h - 2)}
              rx={Math.max(0, radius - 2)}
              ry={Math.max(0, radius - 2)}
              fill={innerFillFor(i)}
            />
            {/* 가장자리로 갈수록 어두운 느낌을 주기 위해 한 겹 더 */}
            <rect
              x={r.x + 2}
              y={r.y + 2}
              width={Math.max(0, r.w - 4)}
              height={Math.max(0, r.h - 4)}
              rx={Math.max(0, radius - 4)}
              ry={Math.max(0, radius - 4)}
              fill="transparent"
              stroke="rgba(0,0,0,0.20)"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>

      {/* 3) 테두리(선택된 것만 더 밝게) */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {rects.map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={radius}
            ry={radius}
            fill="transparent"
            className={strokeClassFor(i)}
            strokeWidth={strokeWidthFor(i)}
          />
        ))}

        {/* 4) ✅ 드래그 중 outline 강조(한 겹 더) */}
        {draggingIndex != null && rects[draggingIndex] ? (
          <rect
            x={rects[draggingIndex].x}
            y={rects[draggingIndex].y}
            width={rects[draggingIndex].w}
            height={rects[draggingIndex].h}
            rx={radius}
            ry={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={2}
          />
        ) : null}
      </svg>

      {/* 5) 드래그 hit-area */}
      {draggable
        ? rects.map((r, i) => (
            <div
              key={i}
              className="absolute touch-none cursor-grab active:cursor-grabbing"
              style={{
                left: r.x,
                top: r.y,
                width: r.w,
                height: r.h,
                borderRadius: radius,
              }}
              onPointerDown={(e) => beginDrag(e, i)}
              // ✅ 클릭만으로도 선택되게
              onClick={() => setActiveIndex(i)}
            />
          ))
        : null}
    </div>
  );
}
