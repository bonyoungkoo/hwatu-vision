// src/features/guide/model/types.ts

export type GuideCount = 2 | 3;

export type GuideMode = "auto" | "custom";

export type NormalizedRect = {
  /** 0~1 */
  x: number;
  /** 0~1 */
  y: number;
  /** 0~1 */
  w: number;
  /** 0~1 */
  h: number;
};

export type GuideConfig = {
  version: 1;
  count: GuideCount;
  mode: GuideMode;
  /**
   * mode === "custom" 인 경우에만 사용
   * (0~1 정규화 좌표로 저장)
   */
  customRects?: NormalizedRect[];
};
