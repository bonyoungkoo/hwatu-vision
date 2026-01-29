import type { GuideCount, Rect } from "./types";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function roundRect(r: Rect): Rect {
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.w),
    h: Math.round(r.h),
  };
}

/**
 * "컨테이너 안에 반드시 들어오는" 가이드 배치.
 * - 2인: 긴 방향으로 2분할 (세로가 길면 상/하, 가로가 길면 좌/우)
 * - 3인: 삼각(긴 방향 기준)
 *   - 세로가 길면: 상/우/하
 *   - 가로가 길면: 좌/상/우
 */
export function computeGuides(count: GuideCount, W: number, H: number): Rect[] {
  if (W <= 0 || H <= 0) return [];

  const isPortrait = H >= W;

  // 바깥 패딩(가이드가 화면 끝에 붙지 않도록)
  const padX = Math.round(W * 0.06);
  const padY = Math.round(H * 0.06);

  const innerW = Math.max(0, W - padX * 2);
  const innerH = Math.max(0, H - padY * 2);

  // 가이드 간 간격
  const gap = Math.round(Math.min(innerW, innerH) * 0.05);

  // 공통: 최소/최대 크기 제한(너무 커져서 스크롤 생기는 원인 제거)
  const minSide = 140;
  const maxW = innerW;
  const maxH = innerH;

  // 2인 배치
  if (count === 2) {
    if (isPortrait) {
      // 상/하 2개
      const h = clamp((innerH - gap) / 2, minSide, maxH);
      const w = clamp(innerW, minSide, maxW);

      const top: Rect = { x: padX, y: padY, w, h };
      const bottom: Rect = { x: padX, y: padY + h + gap, w, h };
      return [roundRect(top), roundRect(bottom)];
    }

    // 좌/우 2개
    const w = clamp((innerW - gap) / 2, minSide, maxW);
    const h = clamp(innerH, minSide, maxH);

    const left: Rect = { x: padX, y: padY, w, h };
    const right: Rect = { x: padX + w + gap, y: padY, w, h };
    return [roundRect(left), roundRect(right)];
  }

  // 3인 삼각 배치
  if (isPortrait) {
    // 상/우/하 (촬영자가 반대편에 서있다는 전제: 중앙은 비워둔다 느낌)
    // 1) 상단: 가로로 넓게
    const topH = clamp(innerH * 0.32, minSide, innerH * 0.45);
    const top: Rect = { x: padX, y: padY, w: innerW, h: topH };

    // 2) 하단 영역: top 아래 남은 공간
    const restH = innerH - topH - gap;
    const side = clamp(
      Math.min(innerW * 0.52, restH),
      minSide,
      Math.min(innerW, restH),
    );

    // 3) 우측(중간)
    const right: Rect = {
      x: padX + innerW - side,
      y: padY + topH + gap + (restH - side) / 2,
      w: side,
      h: side,
    };

    // 4) 하단: 가로로 넓게 (남은 높이에 맞춰)
    const bottomH = clamp(restH - side - gap, minSide, restH);
    const bottom: Rect = {
      x: padX,
      y: padY + topH + gap + restH - bottomH,
      w: innerW,
      h: bottomH,
    };

    return [roundRect(top), roundRect(right), roundRect(bottom)];
  } else {
    // 가로가 길면: 좌/상/우
    const sideW = clamp(innerW * 0.32, minSide, innerW * 0.45);
    const left: Rect = { x: padX, y: padY, w: sideW, h: innerH };

    const restW = innerW - sideW - gap;
    const square = clamp(
      Math.min(restW, innerH * 0.6),
      minSide,
      Math.min(restW, innerH),
    );

    const top: Rect = {
      x: padX + sideW + gap + (restW - square) / 2,
      y: padY,
      w: square,
      h: square,
    };

    const right: Rect = {
      x: padX + sideW + gap + (restW - square) / 2,
      y: padY + innerH - square,
      w: square,
      h: square,
    };

    return [roundRect(left), roundRect(top), roundRect(right)];
  }
}
