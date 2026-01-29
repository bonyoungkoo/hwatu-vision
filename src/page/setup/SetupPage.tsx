import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { GuideCount } from "@/features/guide/model";
import {
  DEFAULT_GUIDE_CONFIG,
  computeGuidesAuto,
  normalizedToPx,
  saveGuideConfig,
  loadGuideConfig,
} from "@/features/guide/model";
import { GuideOverlay } from "@/shared/ui/GuideOverlay";

const SELECTED = "ring-2 ring-amber-400/90 text-amber-400";
const UNSELECTED = "opacity-80 text-white/80 hover:text-white";

export default function SetupPage() {
  const navigate = useNavigate();

  const previewRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [count, setCount] = useState<GuideCount>(() => {
    const saved = loadGuideConfig();
    return saved?.count ?? DEFAULT_GUIDE_CONFIG.count;
  });

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

  const rectsPx = useMemo(() => {
    if (!size.w || !size.h) return [];
    const rectsN = computeGuidesAuto(count, size.w, size.h);
    return rectsN.map((r) => normalizedToPx(r, size.w, size.h));
  }, [count, size.w, size.h]);

  const onGoCamera = () => {
    saveGuideConfig({
      version: 1,
      count,
      mode: "auto",
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
                "h-12 w-24 rounded-2xl text-lg",
                count === 2 ? SELECTED : UNSELECTED,
              ].join(" ")}
              onClick={() => {
                setCount(2);
                blurActive();
              }}
            >
              2인
            </Button>

            <Button
              variant="secondary"
              className={[
                "h-12 w-24 rounded-2xl text-lg",
                count === 3 ? SELECTED : UNSELECTED,
              ].join(" ")}
              onClick={() => {
                setCount(3);
                blurActive();
              }}
            >
              3인
            </Button>
          </div>

          <Button
            className="h-12 rounded-2xl px-6 text-base"
            onClick={onGoCamera}
          >
            카메라로 이동
          </Button>
        </div>

        <div className="mt-6 text-sm text-white/70">미리보기</div>
      </div>

      {/* 미리보기 영역: 남은 높이를 꽉 사용 */}
      <div className="flex-1 min-h-0 mx-auto w-full max-w-[960px] px-6 pb-10 pt-4">
        <div
          ref={previewRef}
          className="relative h-full w-full overflow-hidden rounded-[28px] bg-white/5"
        >
          {/* 가이드 */}
          <GuideOverlay rects={rectsPx} />
        </div>
      </div>
    </div>
  );
}
