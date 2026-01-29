import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/features/camera/useCamera";

import { loadGuideConfig } from "@/features/guide/model/storage";
import { computeGuides } from "@/features/guide/model/defaults";
import { mapOverlayToVideoCrop } from "@/features/guide/model/mapping";
import type { GuideCount } from "@/features/guide/model/types";

type Size = { w: number; h: number };

export default function CameraPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { videoRef, isReady, isStreaming, error, captureToCanvas } = useCamera({
    facingMode: "environment",
  });

  const [containerSize, setContainerSize] = useState<Size>({ w: 0, h: 0 });

  // 가이드 count 로드 (기본 2)
  const [count, setCount] = useState<GuideCount>(2);
  useEffect(() => {
    const cfg = loadGuideConfig();
    setCount(cfg?.count ?? 2);
  }, []);

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

  // 현재 화면 기준 가이드들
  const guides = useMemo(() => {
    const { w, h } = containerSize;
    return computeGuides(count, w, h);
  }, [count, containerSize]);

  // 여러 crop을 캔버스로 캡처해서 Blob 배열로 만드는 헬퍼
  const captureGuideBlobs = useCallback(async (): Promise<Blob[]> => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return [];
    if (!isStreaming) return [];

    const containerW = containerSize.w;
    const containerH = containerSize.h;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    if (!videoW || !videoH) return [];

    const blobs: Blob[] = [];

    for (const guide of guides) {
      const crop = mapOverlayToVideoCrop({
        containerW,
        containerH,
        videoW,
        videoH,
        overlay: guide,
      });

      const canvas = document.createElement("canvas");

      // 너의 useCamera 시그니처에 맞춘 호출
      captureToCanvas(canvas, { crop });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );

      if (blob) blobs.push(blob);
    }

    return blobs;
  }, [captureToCanvas, containerSize, guides, isStreaming, videoRef]);

  const onCapture = useCallback(async () => {
    const blobs = await captureGuideBlobs();
    console.log("captured blobs:", blobs);

    // TODO: 여기서 blobs를 서버로 업로드하거나,
    // 로컬에서 미리보기 페이지로 넘기거나 하면 됨.
  }, [captureGuideBlobs]);

  return (
    <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
      {/* Header */}
      <div className="shrink-0 mx-auto w-full px-3 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Hwatu Vision</div>

          {/* LIVE면 초록색 */}
          <div
            className={[
              "text-xs font-medium",
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

      {/* Camera 영역: 남은 높이를 전부 사용 */}
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

          {/* 어둡게 */}
          {guides.length > 0 ? (
            <div className="absolute inset-0 bg-black/35" />
          ) : null}

          {/* 여러 가이드 렌더 */}
          {guides.map((g, idx) => (
            <div
              key={idx}
              className="absolute rounded-2xl ring-2 ring-emerald-400/90"
              style={{
                left: g.x,
                top: g.y,
                width: g.w,
                height: g.h,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
              }}
            />
          ))}

          {/* 안내 */}
          {guides[0] ? (
            <div
              className="absolute z-10 rounded-full bg-black/55 px-3 py-1 text-sm"
              style={{
                left: guides[0].x,
                top: Math.max(8, guides[0].y - 44),
              }}
            >
              패를 박스 안에 맞춰주세요
            </div>
          ) : null}
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
