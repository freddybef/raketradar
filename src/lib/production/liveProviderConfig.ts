export interface ProviderConfig {
  enabled: boolean;
  weight: number;
  throttleMs: number;
  precisionPreset: "balanced" | "strict" | "stealth";
}

export type LiveProviderConfig = Record<
  "fiInsider" | "mfnCision" | "marketData" | "redditX" | "avanzaNordnet",
  ProviderConfig
>;

export const defaultLiveProviderConfig: LiveProviderConfig = {
  fiInsider: { enabled: true, weight: 1.2, throttleMs: 120000, precisionPreset: "strict" },
  mfnCision: { enabled: true, weight: 1, throttleMs: 180000, precisionPreset: "balanced" },
  marketData: { enabled: true, weight: 1.25, throttleMs: 30000, precisionPreset: "balanced" },
  redditX: { enabled: false, weight: 0.7, throttleMs: 180000, precisionPreset: "strict" },
  avanzaNordnet: { enabled: false, weight: 0.8, throttleMs: 300000, precisionPreset: "stealth" },
};
