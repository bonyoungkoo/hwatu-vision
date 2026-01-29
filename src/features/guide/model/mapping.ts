// src/features/guide/model/mapping.ts

import type { GuideCount, NormalizedRect } from "./types";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const clampRect = (r: NormalizedRect): NormalizedRect => {
  const x = clamp01(r.x);
  const y = clamp01(r.y);
  const w = clamp01(r.w);
  const h = clamp01(r.h);

  // 우/하 튀는 것 방지
  const ww = Math.min(w, 1 - x);
  const hh = Math.min(h, 1 - y);

  return { x, y, w: ww, h: hh };
};

export function normalizedToPx(
  r: NormalizedRect,
  W: number,
  H: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(r.x * W),
    y: Math.round(r.y * H),
    w: Math.round(r.w * W),
    h: Math.round(r.h * H),
  };
}

/**
 * "미리보기 컨테이너" 기준으로 자동 가이드 배치 (0~1 정규화 좌표)
 * - 절대 px로 계산하지 않는다 (스크롤/겹침 원인 제거)
 */
export function computeGuidesAuto(
  count: GuideCount,
  W: number,
  H: number,
): NormalizedRect[] {
  if (W <= 0 || H <= 0) return [];

  const isPortrait = H >= W;

  // 공통 튜닝값
  const m = 0.05; // margin(5%)
  const g = 0.03; // gap(3%)

  if (count === 2) {
    if (isPortrait) {
      // 상/하 (가로 긴)
      const h = 0.25;
      const top: NormalizedRect = { x: m, y: m, w: 1 - 2 * m, h };
      const bot: NormalizedRect = {
        x: m,
        y: 1 - m - h,
        w: 1 - 2 * m,
        h,
      };
      return [clampRect(top), clampRect(bot)];
    } else {
      // ✅ 좌/우 (세로 긴)  + 가운데 "점수패 영역" 여백 확보
      const gapX = 0.25; // 가운데 비워둘 비율 (0.12~0.18 추천)
      const availableW = 1 - 2 * m - gapX;

      // 기존 w=0.42를 '상한'으로만 쓰고,
      // 화면이 좁으면 자동으로 줄어들게
      const w = Math.min(0.42, availableW / 2);

      const left: NormalizedRect = { x: m, y: m, w, h: 1 - 2 * m };
      const right: NormalizedRect = {
        x: 1 - m - w,
        y: m,
        w,
        h: 1 - 2 * m,
      };

      return [clampRect(left), clampRect(right)];
    }
  }

  // count === 3
  if (isPortrait) {
    // ✅ 네가 올린 파란 도형(세로) 형태
    // 상(가로) + 우(세로) + 하(가로)

    const wideH = 0.22; // 상/하 박스 높이(22%)
    const topY = m;
    const bottomY = 1 - m - wideH;

    const midTop = topY + wideH + g;
    const midBottom = bottomY - g;
    const midH = Math.max(0.1, midBottom - midTop); // 안전장치

    const rightW = 0.42;

    const top: NormalizedRect = { x: m, y: topY, w: 1 - 2 * m, h: wideH };
    const right: NormalizedRect = {
      x: 1 - m - rightW,
      y: midTop,
      w: rightW,
      h: midH,
    };
    const bottom: NormalizedRect = {
      x: m,
      y: bottomY,
      w: 1 - 2 * m,
      h: wideH,
    };

    return [clampRect(top), clampRect(right), clampRect(bottom)];
  } else {
    // ✅ 네가 올린 파란 도형(가로) 형태
    // 좌(세로) + 상(가로) + 우(세로)

    const sideW = 0.26;
    const topH = 0.26;

    const left: NormalizedRect = { x: m, y: m, w: sideW, h: 1 - 2 * m };
    const right: NormalizedRect = {
      x: 1 - m - sideW,
      y: m,
      w: sideW,
      h: 1 - 2 * m,
    };

    const centerX = m + sideW + g;
    const centerW = 1 - 2 * m - 2 * sideW - 2 * g;

    const top: NormalizedRect = { x: centerX, y: m, w: centerW, h: topH };

    return [clampRect(left), clampRect(top), clampRect(right)];
  }
}
