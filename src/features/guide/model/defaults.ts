// src/features/guide/model/defaults.ts

import type { GuideConfig } from "./types";

export const GUIDE_CONFIG_VERSION = 1 as const;

export const DEFAULT_GUIDE_CONFIG: GuideConfig = {
  version: GUIDE_CONFIG_VERSION,
  count: 2,
  mode: "auto",
};
