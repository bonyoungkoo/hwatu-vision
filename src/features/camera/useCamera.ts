import { useCallback, useEffect, useRef, useState } from "react";

type FacingMode = "user" | "environment";

export type UseCameraOptions = {
  facingMode?: FacingMode;
  audio?: boolean;
};

export type CropRect = { x: number; y: number; w: number; h: number };

export type CaptureOptions = {
  crop?: CropRect; // video 원본 픽셀 기준
  out?: { w: number; h: number }; // 결과 캔버스 크기 지정(선택)
};

export type UseCameraReturn = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  isStreaming: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  captureToCanvas: (canvas: HTMLCanvasElement, opts?: CaptureOptions) => void;
};

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode = "environment", audio = false } = options;

  const videoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false); // start() 중복 방지
  const mountedRef = useRef(true);

  const [isReady, setIsReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    startingRef.current = false;

    const stream = streamRef.current;
    streamRef.current = null;

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    const video = videoRef.current;
    if (video) {
      // iOS/Safari 포함 안전하게 detach
      try {
        (
          video as HTMLVideoElement & { srcObject?: MediaStream | null }
        ).srcObject = null;
      } catch {
        // ignore
      }
      video.removeAttribute("src");
      // video.load()는 상황에 따라 play 인터럽트 유발하기도 해서 굳이 안 함
    }

    setIsStreaming(false);
    setIsReady(false);
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    if (streamRef.current) return; // 이미 스트리밍 중이면 재시작 금지

    const video = videoRef.current;
    if (!video) return;

    startingRef.current = true;
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
        },
        audio,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // srcObject 세팅
      (video as HTMLVideoElement & { srcObject?: MediaStream }).srcObject =
        stream;

      // metadata 준비 대기 후 play (이 순서가 중요)
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        video.addEventListener("loadedmetadata", onLoaded);
      });

      // play()는 실패할 수 있으니 try/catch
      try {
        await video.play();
      } catch (e: unknown) {
        let message = "";

        if (e instanceof Error) {
          message = e.message;
        } else if (typeof e === "string") {
          message = e;
        }
        // hot reload / 화면전환 등으로 흔히 나는 메시지 -> 치명적 아님
        if (
          !message.includes("interrupted") &&
          !message.includes("AbortError")
        ) {
          throw e;
        }
      }

      setIsStreaming(true);
      setIsReady(true);
    } catch (e: unknown) {
      let msg = "카메라 시작 실패";

      if (e instanceof DOMException) {
        switch (e.name) {
          case "NotAllowedError":
            msg = "카메라 권한이 필요합니다. 브라우저 설정에서 허용해주세요.";
            break;
          case "NotFoundError":
            msg = "카메라를 찾을 수 없습니다.";
            break;
          case "NotReadableError":
            msg =
              "카메라에 접근할 수 없습니다. 다른 앱에서 사용 중일 수 있습니다.";
            break;
          default:
            msg = `카메라 시작 실패: ${e.message}`;
        }
      } else if (e instanceof Error) {
        msg = `카메라 시작 실패: ${e.message}`;
      } else if (typeof e === "string") {
        msg = `카메라 시작 실패: ${e}`;
      }

      setError(msg);
      stop();
    } finally {
      startingRef.current = false;
    }
  }, [audio, facingMode, stop]);

  const captureToCanvas = useCallback(
    (canvas: HTMLCanvasElement, opts?: CaptureOptions) => {
      const video = videoRef.current;
      if (!video) throw new Error("videoRef가 연결되지 않았습니다.");
      if (!video.videoWidth || !video.videoHeight)
        throw new Error("video metadata가 준비되지 않았습니다.");

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const crop = opts?.crop ?? { x: 0, y: 0, w: vw, h: vh };
      const outW = opts?.out?.w ?? Math.round(crop.w);
      const outH = opts?.out?.h ?? Math.round(crop.h);

      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2d context 생성 실패");

      ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    // 페이지 들어오면 자동 시작하고 싶으면 여기서 start() 호출 가능
    // 지금은 페이지에서 호출하는 구조라면 호출하지 마.
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  return {
    videoRef,
    isReady,
    isStreaming,
    error,
    start,
    stop,
    captureToCanvas,
  };
}
