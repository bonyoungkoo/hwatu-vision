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

// clamp
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
  const dw = overlay.w;
  const dh = overlay.h;

  const x = dx / scale;
  const y = dy / scale;
  const w = dw / scale;
  const h = dh / scale;

  const cx = clamp(x, 0, videoW);
  const cy = clamp(y, 0, videoH);
  const cw = clamp(w, 0, videoW - cx);
  const ch = clamp(h, 0, videoH - cy);

  return { x: cx, y: cy, w: cw, h: ch };
}

export default function CameraPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const { videoRef, isReady, isStreaming, error, start, captureToCanvas } =
    useCamera({
      facingMode: "environment",
    });

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

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
    if (config.mode === "custom" && config.customRects?.length) {
      return config.customRects;
    }
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

  const onCapture = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const container = containerRef.current;
    const video = videoRef.current;

    if (!canvas || !container || !video) return;
    if (!isStreaming) return;

    const containerW = containerSize.w;
    const containerH = containerSize.h;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    if (!videoW || !videoH) return;

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

    if (!crops.length) return;

    // 지금은 “첫 번째 crop”만 디버그로 그려보기
    captureToCanvas(canvas, { crop: crops[0] });

    // TODO(다음 단계): crops 전체를 blob으로 만들어 서버/로컬 inference로 넘기기
    // 예시:
    // const offscreens = crops.map((crop) => {
    //   const c = document.createElement("canvas");
    //   captureToCanvas(c, { crop });
    //   return c;
    // });
  }, [captureToCanvas, containerSize, isStreaming, rectsPx, videoRef]);

  return (
    <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
      {/* Header */}
      <div className="shrink-0 mx-auto w-full px-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Hwatu Vision</div>

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

      {/* Camera 영역: 남은 높이 꽉 사용 */}
      <div className="flex-1 min-h-0 mx-auto w-full px-3 pt-3">
        <div
          ref={containerRef}
          className="relative h-full w-full overflow-hidden rounded-2xl bg-black"
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />

          {/* 가이드: rectsPx를 그대로 표시 (2개/3개) */}
          <GuideOverlay rects={rectsPx} />

          {/* 안내 텍스트: 첫 가이드 기준으로 배치 */}
          {rectsPx[0] ? (
            <div
              className="absolute z-10 rounded-full bg-black/55 px-3 py-1 text-sm"
              style={{
                left: rectsPx[0].x,
                top: Math.max(8, rectsPx[0].y - 44),
              }}
            >
              패를 박스 안에 맞춰주세요
            </div>
          ) : null}

          {/* 디버그 캔버스 */}
          <canvas ref={previewCanvasRef} className="hidden" />
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 mx-auto w-full px-3 pb-6 pt-4 flex justify-center">
        <Button
          className="h-12 w-32 rounded-2xl text-base"
          onClick={onCapture}
          disabled={!isReady || !isStreaming}
        >
          촬영
        </Button>
      </div>
    </div>
  );
}
