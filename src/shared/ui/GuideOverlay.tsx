import React from "react";

export type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  rects: Rect[];
  className?: string;
  dimOpacity?: number; // 0~1
  strokeClassName?: string; // tailwind class (stroke-*)
  strokeWidth?: number;
  radius?: number; // px
};

export function GuideOverlay({
  rects,
  className,
  dimOpacity = 0.45,
  strokeClassName = "stroke-emerald-400/90",
  strokeWidth = 3,
  radius = 24,
}: Props) {
  // ✅ Hook은 항상 최상단에서, 조건부 return 이전에 호출
  const maskId = React.useId();

  if (!rects || rects.length === 0) return null;

  return (
    <div
      className={["absolute inset-0 pointer-events-none", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* 1) 전체 딤(구멍 뚫린 mask) */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          {/* 흰색 = 보임, 검정 = 가림 */}
          <mask id={maskId}>
            {/* 전체는 보이게 */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* 가이드 영역은 구멍(검정) */}
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

        {/* dim layer: mask 적용해서 "가이드 영역만 투명" */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`rgba(0,0,0,${dimOpacity})`}
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* 2) 테두리(항상 위에) */}
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
            className={strokeClassName}
            strokeWidth={strokeWidth}
          />
        ))}
      </svg>
    </div>
  );
}
