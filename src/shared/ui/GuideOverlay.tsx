import type { CSSProperties } from "react";

type PxRect = { x: number; y: number; w: number; h: number };

type Props = {
  rects: PxRect[];
  className?: string;
  strokeClassName?: string; // 테두리 색상 커스텀
};

export function GuideOverlay({
  rects,
  className,
  strokeClassName = "ring-2 ring-emerald-400/90",
}: Props) {
  if (!rects.length) return null;

  return (
    <div className={["absolute inset-0", className].filter(Boolean).join(" ")}>
      {/* 전체 어둡게 */}
      <div className="absolute inset-0 bg-white/35" />

      {/* 각 가이드 박스 */}
      {rects.map((r, idx) => (
        <div
          key={idx}
          className={["absolute rounded-2xl", strokeClassName].join(" ")}
          style={
            {
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              // 바깥 마스크처럼 보이게
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
