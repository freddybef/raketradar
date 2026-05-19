export type PerformanceMode = "ULTRA_LIGHT" | "TRADER" | "FULL_INTELLIGENCE";

export interface PerformanceModeConfig {
  maxFeedItems: number;
  showAiPanels: boolean;
  showHistoricalPanels: boolean;
  refreshMs: number;
}

export function getPerformanceModeConfig(mode: PerformanceMode): PerformanceModeConfig {
  if (mode === "ULTRA_LIGHT") {
    return {
      maxFeedItems: 8,
      showAiPanels: false,
      showHistoricalPanels: false,
      refreshMs: 15000,
    };
  }

  if (mode === "TRADER") {
    return {
      maxFeedItems: 20,
      showAiPanels: false,
      showHistoricalPanels: true,
      refreshMs: 30000,
    };
  }

  return {
    maxFeedItems: 50,
    showAiPanels: true,
    showHistoricalPanels: true,
    refreshMs: 60000,
  };
}
