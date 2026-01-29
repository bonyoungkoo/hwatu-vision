import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

import type { GuideCount } from "@/features/guide/model/types";
import { computeGuides } from "@/features/guide/model/defaults";
import {
  loadGuideConfig,
  saveGuideConfig,
} from "@/features/guide/model/storage";

type Size = { w: number; h: number };

export default function SetupPage() {
  const nav = useNavigate();
  const previewRef = useRef<HTMLDivElement>(null);

  const [count, setCount] = useState<GuideCount>(2);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  // 저장된 count 복원
  useEffect(() => {
    const saved = loadGuideConfig();
    if (saved?.count) setCount(saved.count);
  }, []);

  // 미리보기 영역 크기 추적
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

  const guides = useMemo(
    () => computeGuides(count, size.w, size.h),
    [count, size.w, size.h],
  );

  const onStart = () => {
    saveGuideConfig({ count });
    nav("/camera");
  };

  return (
    <div className="h-dvh overflow-hidden bg-black text-white">
      <div className="mx-auto flex h-full w-full max-w-[920px] flex-col gap-4 px-4 py-4">
        <header className="shrink-0">
          <h1 className="text-2xl font-semibold">가이드 설정</h1>
          <p className="mt-2 text-sm text-white/70">
            촬영 전에 “몇 명의 패를 동시에 찍을지” 선택하면 자동으로 가이드가
            배치됩니다.
          </p>

          <div className="mt-4 flex gap-2">
            <Button
              variant={count === 2 ? "default" : "secondary"}
              className="rounded-2xl"
              onClick={() => setCount(2)}
            >
              2인
            </Button>
            <Button
              variant={count === 3 ? "default" : "secondary"}
              className="rounded-2xl"
              onClick={() => setCount(3)}
            >
              3인
            </Button>

            <div className="ml-auto">
              <Button className="rounded-2xl" onClick={onStart}>
                카메라로 이동
              </Button>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 text-sm text-white/70">미리보기</div>

          <div
            ref={previewRef}
            className="relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-white/5"
          >
            {/* 배경 그라데이션 */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />

            {/* 가이드 렌더 */}
            {guides.map((g, i) => (
              <div
                key={i}
                className="absolute rounded-3xl ring-2 ring-emerald-400/90"
                style={{
                  left: g.x,
                  top: g.y,
                  width: g.w,
                  height: g.h,
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
