import type { GuideConfig } from "./types";

const KEY = "hwatu-vision:guide-config:v1";

export function saveGuideConfig(config: GuideConfig) {
  localStorage.setItem(KEY, JSON.stringify(config));
}

export function loadGuideConfig(): GuideConfig | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<GuideConfig>;
    if (!parsed) return null;
    if (parsed.count !== 2 && parsed.count !== 3) return null;
    return { count: parsed.count };
  } catch {
    return null;
  }
}

export function clearGuideConfig() {
  localStorage.removeItem(KEY);
}
