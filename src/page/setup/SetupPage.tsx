// src/page/setup/SetupPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { GuideCount, NormalizedRect } from "@/features/guide/model";
import {
  DEFAULT_GUIDE_CONFIG,
  computeGuidesAuto,
  normalizedToPx,
  saveGuideConfig,
  loadGuideConfig,
} from "@/features/guide/model";
import { GuideOverlay, type Rect as PxRect } from "@/shared/ui/GuideOverlay";

const SELECTED = "ring-2 ring-amber-400/90 text-amber-400";
const UNSELECTED = "opacity-80 text-white/80 hover:text-white";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clampRect01 = (r: NormalizedRect): NormalizedRect => {
  const x = clamp01(r.x);
  const y = clamp01(r.y);
  const w = clamp01(r.w);
  const h = clamp01(r.h);
  const ww = Math.min(w, 1 - x);
  const hh = Math.min(h, 1 - y);
  return { x, y, w: ww, h: hh };
};

function pxToNormalized(r: PxRect, W: number, H: number): NormalizedRect {
  if (!W || !H) return { x: 0, y: 0, w: 0, h: 0 };
  return clampRect01({
    x: r.x / W,
    y: r.y / H,
    w: r.w / W,
    h: r.h / H,
  });
}

export default function SetupPage() {
  const navigate = useNavigate();

  const previewRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const saved = useMemo(() => loadGuideConfig(), []);
  const [count, setCount] = useState<GuideCount>(
    saved?.count ?? DEFAULT_GUIDE_CONFIG.count,
  );

  // ✅ Step A 상태: 정규화 rects를 “소스 오브 트루스”로 둠
  const [customRectsN, setCustomRectsN] = useState<NormalizedRect[]>([]);

  const [isCustom, setIsCustom] = useState(false);

  // ResizeObserver로 미리보기 컨테이너 크기 추적
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const autoRectsN = useMemo(() => {
    if (!size.w || !size.h) return [];
    return computeGuidesAuto(count, size.w, size.h);
  }, [count, size.w, size.h]);

  // (3) 화면에 보여줄 rectsN 결정
  const rectsN = isCustom ? customRectsN : autoRectsN;

  // (4) px 변환도 파생값(useMemo)
  const rectsPx = useMemo(() => {
    if (!size.w || !size.h) return [];
    return rectsN.map((r) => normalizedToPx(r, size.w, size.h));
  }, [rectsN, size.w, size.h]);

  // (5) count 변경 시 커스텀 해제는 "클릭 핸들러"에서 처리
  const onSelectCount = (next: GuideCount) => {
    setCount(next);
    setIsCustom(false);
    setCustomRectsN([]); // 선택: 커스텀 값 버림
  };

  const onRectsChange = (nextPx: PxRect[]) => {
    if (!size.w || !size.h) return;
    const nextN = nextPx.map((r) => pxToNormalized(r, size.w, size.h));
    setCustomRectsN(nextN);
    setIsCustom(true);
  };

  const onGoCamera = () => {
    saveGuideConfig({
      version: 1,
      count,
      mode: isCustom ? "custom" : "auto",
      customRects: isCustom ? rectsN : undefined,
    });
    navigate("/camera");
  };

  const blurActive = () =>
    (document.activeElement as HTMLElement | null)?.blur();

  return (
    <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
      {/* 상단 */}
      <div className="shrink-0 mx-auto w-full max-w-[960px] px-6 pt-10">
        <div className="text-5xl font-extrabold tracking-tight">
          가이드 설정
        </div>
        <div className="mt-3 text-base text-white/70">
          촬영 전에 “몇 명의 패를 동시에 찍을지” 선택하면 자동으로 가이드가
          배치됩니다.
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className={[
                "h-12 w-24 rounded-2xl text-lg focus-visible:ring-0 focus-visible:ring-offset-0",
                count === 2 ? SELECTED : UNSELECTED,
              ].join(" ")}
              onClick={() => {
                onSelectCount(2);
                blurActive();
              }}
            >
              2인
            </Button>

            <Button
              variant="secondary"
              className={[
                "h-12 w-24 rounded-2xl text-lg focus-visible:ring-0 focus-visible:ring-offset-0",
                count === 3 ? SELECTED : UNSELECTED,
              ].join(" ")}
              onClick={() => {
                onSelectCount(3);
                blurActive();
              }}
            >
              3인
            </Button>
          </div>

          <Button
            className="h-12 rounded-2xl px-6 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            onClick={onGoCamera}
          >
            카메라로 이동
          </Button>
        </div>

        <div className="mt-6 text-sm text-white/70">
          미리보기 {isCustom ? "(커스텀)" : "(자동)"}
        </div>
      </div>

      {/* 미리보기 영역 */}
      <div className="flex-1 min-h-0 mx-auto w-full max-w-[960px] px-6 pb-10 pt-4">
        <div
          ref={previewRef}
          className="relative h-full w-full bg-white overflow-hidden rounded-[28px] bg-zinc-900/60 ring-1 ring-white/10"
        >
          <GuideOverlay
            rects={rectsPx}
            dimOpacity={0.08}
            draggable
            onRectsChange={onRectsChange}
          />
        </div>
      </div>
    </div>
  );
}
