import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/features/camera/useCamera";

type Rect = { x: number; y: number; w: number; h: number };

// clamp
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * “컨테이너 위에 object-fit: cover 로 그려진 비디오”에서
 * overlay(가이드)의 CSS px 좌표 -> 비디오 원본 픽셀 좌표(crop)로 변환
 */
function mapOverlayToVideoCrop(params: {
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

/**
 * 화면 크기(컨테이너) 기반 가이드 박스 계산
 * - 디바이스 비율 달라도 중앙 근처에 적절히 생성
 */
function computeGuideRect(containerW: number, containerH: number): Rect {
  const marginX = Math.round(containerW * 0.06); // 좌우 6%
  const topY = Math.round(containerH * 0.1); // 위에서 10%
  const guideW = containerW - marginX * 2;

  const guideH = Math.round(containerH * 0.28); // 세로 28%
  const minH = 180;
  const maxH = Math.round(containerH * 0.45);
  const finalH = clamp(guideH, minH, maxH);

  return { x: marginX, y: topY, w: guideW, h: finalH };
}

export default function CameraPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // ✅ 페이지 진입 시 1회 시작 / 이탈 시 정리
  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  // ✅ 탭 전환/화면 잠금 시 카메라 중단(모바일 안정성↑)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stop();
      else void start();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [start, stop]);

  // 컨테이너 크기 추적 (회전/리사이즈)
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

  const guideRect = useMemo(() => {
    if (!containerSize.w || !containerSize.h) return { x: 0, y: 0, w: 0, h: 0 };
    return computeGuideRect(containerSize.w, containerSize.h);
  }, [containerSize]);

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

    const crop = mapOverlayToVideoCrop({
      containerW,
      containerH,
      videoW,
      videoH,
      overlay: guideRect,
    });

    captureToCanvas(canvas, { crop });
  }, [captureToCanvas, containerSize, guideRect, isStreaming, videoRef]);

  return (
    // ✅ “계산식 height” 제거: flex 레이아웃으로 정확히 분배
    <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
      {/* Header */}
      <div className="shrink-0 mx-auto w-full px-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Hwatu Vision</div>
          <div className="flex items-center gap-1 text-xs font-medium">
            {isStreaming && (
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span className={isStreaming ? "text-emerald-400" : "opacity-80"}>
              {isStreaming ? "LIVE" : "OFF"}
            </span>
          </div>
        </div>

        {error ? (
          <div className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      {/* Camera 영역: 남은 높이 전부 */}
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

          {/* 가이드 오버레이 */}
          {guideRect.w > 0 && guideRect.h > 0 ? (
            <>
              <div className="absolute inset-0 bg-black/35" />

              <div
                className="absolute rounded-2xl ring-2 ring-emerald-400/90"
                style={{
                  left: guideRect.x,
                  top: guideRect.y,
                  width: guideRect.w,
                  height: guideRect.h,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                }}
              />

              <div
                className="absolute z-10 rounded-full bg-black/55 px-3 py-1 text-sm"
                style={{
                  left: guideRect.x,
                  top: Math.max(8, guideRect.y - 44),
                }}
              >
                패를 박스 안에 맞춰주세요
              </div>
            </>
          ) : null}

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
