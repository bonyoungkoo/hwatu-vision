// src/features/guide/model/storage.ts

import type { GuideConfig } from "./types";
import { DEFAULT_GUIDE_CONFIG, GUIDE_CONFIG_VERSION } from "./defaults";

const KEY = "hwatu-vision:guide-config:v1";

export function saveGuideConfig(config: GuideConfig) {
  localStorage.setItem(KEY, JSON.stringify(config));
}

export function loadGuideConfig(): GuideConfig {
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT_GUIDE_CONFIG;

  try {
    const parsed = JSON.parse(raw) as Partial<GuideConfig>;

    if (!parsed || parsed.version !== GUIDE_CONFIG_VERSION)
      return DEFAULT_GUIDE_CONFIG;
    if (parsed.count !== 2 && parsed.count !== 3) return DEFAULT_GUIDE_CONFIG;
    if (parsed.mode !== "auto" && parsed.mode !== "custom")
      return DEFAULT_GUIDE_CONFIG;

    if (parsed.mode === "custom") {
      if (!Array.isArray(parsed.customRects)) return DEFAULT_GUIDE_CONFIG;
    }

    return parsed as GuideConfig;
  } catch {
    return DEFAULT_GUIDE_CONFIG;
  }
}

export function clearGuideConfig() {
  localStorage.removeItem(KEY);
}
