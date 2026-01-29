// src/page/camera/CameraPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/features/camera/useCamera";
import type { NormalizedRect } from "@/features/guide/model";
import {
  computeGuidesAuto,
  loadGuideConfig,
  normalizedToPx,
} from "@/features/guide/model";
import { GuideOverlay } from "@/shared/ui/GuideOverlay";

type PxRect = { x: number; y: number; w: number; h: number };
type CapturedImage = { id: string; url: string; crop: PxRect };

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * “container 위에 object-fit: cover 로 그려진 video”에서
 * overlay(px) → video 원본 픽셀 crop(px) 변환
 */
function mapOverlayToVideoCrop(params: {
  containerW: number;
  containerH: number;
  videoW: number;
  videoH: number;
  overlay: PxRect;
}): PxRect {
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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob 실패"))),
      type,
      quality,
    );
  });
}

export default function CameraPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    videoRef,
    isReady,
    isStreaming,
    error,
    start,
    stop,
    captureToCanvas,
  } = useCamera({
    facingMode: "environment",
  });

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // ✅ 촬영→확인 상태
  const [captured, setCaptured] = useState<CapturedImage[] | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 컨테이너 크기 추적
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setContainerSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  // 저장된 가이드 설정 로드
  const config = useMemo(() => loadGuideConfig(), []);

  // 정규화 rects (auto/custom)
  const rectsN: NormalizedRect[] = useMemo(() => {
    if (!containerSize.w || !containerSize.h) return [];
    if (config.mode === "custom" && config.customRects?.length)
      return config.customRects;
    return computeGuidesAuto(config.count, containerSize.w, containerSize.h);
  }, [
    config.count,
    config.customRects,
    config.mode,
    containerSize.h,
    containerSize.w,
  ]);

  // px 변환
  const rectsPx: PxRect[] = useMemo(() => {
    if (!containerSize.w || !containerSize.h) return [];
    return rectsN.map((r) =>
      normalizedToPx(r, containerSize.w, containerSize.h),
    );
  }, [rectsN, containerSize.h, containerSize.w]);

  // ✅ URL revoke (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (!captured) return;
      captured.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, [captured]);

  const clearCaptured = useCallback(() => {
    setCaptured((prev) => {
      if (prev) prev.forEach((c) => URL.revokeObjectURL(c.url));
      return null;
    });
  }, []);

  const onCapture = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;

    if (!container || !video) return;
    if (!isStreaming) return;
    if (!rectsPx.length) return;

    const containerW = containerSize.w;
    const containerH = containerSize.h;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    if (!videoW || !videoH) return;

    setIsCapturing(true);

    try {
      // ✅ 각 가이드 영역을 crop으로 변환
      const crops = rectsPx.map((overlay) =>
        mapOverlayToVideoCrop({
          containerW,
          containerH,
          videoW,
          videoH,
          overlay,
        }),
      );

      // ✅ crop 이미지들 생성 (가이드 개수만큼)
      const results: CapturedImage[] = [];

      for (let i = 0; i < crops.length; i++) {
        const crop = crops[i]!;
        const off = document.createElement("canvas");
        // 너무 큰 이미지를 그대로 뽑으면 무거우니, 적당히 리사이즈(권장)
        // 여기선 가로 960 기준으로 비율 유지
        const targetW = 960;
        const scale = targetW / Math.max(1, crop.w);
        const outW = Math.round(crop.w * scale);
        const outH = Math.round(crop.h * scale);

        captureToCanvas(off, { crop, out: { w: outW, h: outH } });

        const blob = await canvasToBlob(off, "image/jpeg", 0.92);
        const url = URL.createObjectURL(blob);

        results.push({
          id: `${Date.now()}-${i}`,
          url,
          crop,
        });
      }

      // ✅ 촬영 결과 표시
      clearCaptured(); // 혹시 이전 결과 있으면 정리
      setCaptured(results);
      stop();

      // (선택) 촬영 확인 단계에서는 카메라 계속 켜둬도 되지만,
      // 배터리/발열 줄이려면 여기서 stop() 하고, 다시찍기 때 start() 하면 됨.
      // stop();
    } finally {
      setIsCapturing(false);
    }
  }, [
    captureToCanvas,
    clearCaptured,
    containerSize,
    isStreaming,
    rectsPx,
    videoRef,
    stop,
  ]);

  const onRetake = useCallback(async () => {
    clearCaptured();
    start();
    // stop()을 해뒀다면 다시 start 필요 (현재는 stop 안하므로 생략 가능)
    // await start();
  }, [clearCaptured, start]);

  const onConfirm = useCallback(() => {
    if (!captured?.length) return;

    // TODO: 여기서 서버 업로드 / 로컬 inference 호출
    // 지금은 “추론 단계로 넘어갈 준비 완료” 확인용
    console.log("CONFIRM payload:", captured);

    // 다음 화면으로 라우팅한다면 여기서 navigate("/infer") 같은 흐름
    // 일단은 UX상 확인 완료 표시만 하고 싶으면:
    alert("확인 완료! (다음 단계: 추론 연결)");
  }, [captured]);

  const isReviewMode = !!captured?.length;

  return (
    <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
      {/* Header */}
      <div className="shrink-0 mx-auto w-full px-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex justify-center">
            <div className="text-lg font-semibold">Hwatu Vision</div>
            <div className="pointer-events-none rounded-full bg-white/15 ml-2 px-3 py-1 text-sm">
              패를 박스 안에 맞춰주세요
            </div>
          </div>
          <div
            className={[
              "text-xs font-semibold",
              isStreaming ? "text-emerald-300" : "text-white/70",
            ].join(" ")}
          >
            {isStreaming ? "LIVE" : "OFF"}
          </div>
        </div>

        {error ? (
          <div className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      {/* Camera 영역 */}
      <div className="flex-1 min-h-0 mx-auto w-full px-3 pt-3">
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden rounded-2xl bg-black"
        >
          {/* live video */}
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />

          {/* 가이드 */}
          {!isReviewMode && <GuideOverlay rects={rectsPx} />}

          {/* ✅ 확인(Review) 오버레이 */}
          {isReviewMode ? (
            <div className="absolute inset-0 z-20 bg-black/80">
              {/* ✅ fixed top/bottom 대신 flex column */}
              <div className="absolute inset-0 flex flex-col">
                {/* Header */}
                <div className="shrink-0 px-4 pt-4">
                  <div className="text-base font-semibold">촬영 확인</div>
                  <div className="mt-1 text-sm text-white/70">
                    가이드별로 잘 잘렸는지 확인하고 “확인”을 누르세요.
                  </div>
                </div>

                {/* List (scroll) */}
                <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
                  <div
                    className={[
                      "grid gap-3",
                      captured!.length === 1 ? "grid-cols-1" : "grid-cols-2",
                      // ✅ 데스크탑에서 가로가 넓어도 너무 커지지 않게
                      "auto-rows-max",
                    ].join(" ")}
                  >
                    {captured!.map((c, idx) => (
                      <div
                        key={c.id}
                        className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10"
                      >
                        <div className="px-3 py-2 text-xs text-white/70">
                          사용자 {idx + 1}
                        </div>
                        <img
                          src={c.url}
                          alt={`capture-${idx + 1}`}
                          className="block w-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-4 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      variant="secondary"
                      className="h-12 flex-1 rounded-2xl text-base text-white"
                      onClick={onRetake}
                    >
                      다시찍기
                    </Button>

                    <Button
                      className="h-12 flex-1 rounded-2xl text-base"
                      onClick={onConfirm}
                    >
                      확인
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 mx-auto w-full px-3 pb-6 pt-4 flex justify-center">
        <Button
          className="h-12 w-32 rounded-2xl text-base"
          onClick={onCapture}
          disabled={!isReady || !isStreaming || isCapturing || isReviewMode}
        >
          {isCapturing ? "촬영중" : "촬영"}
        </Button>
      </div>
    </div>
  );
}
