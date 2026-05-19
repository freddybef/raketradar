import type { NormalizedNewsItem } from "./newsIngest";

export interface NewsAccelerationSignal {
  ticker: string;
  intensityScore: number;
  clusterCount: number;
  storyBuilding: boolean;
  detectedPatterns: string[];
}

export function analyzeNewsAcceleration(
  news: NormalizedNewsItem[]
): NewsAccelerationSignal[] {
  const grouped = news.reduce<Record<string, NormalizedNewsItem[]>>((acc, item) => {
    for (const ticker of item.tickers) {
      acc[ticker] = [...(acc[ticker] ?? []), item];
    }
    return acc;
  }, {});

  return Object.entries(grouped).map(([ticker, items]) => {
    const triggerTypes = new Set(
      items.flatMap((item) => item.triggers.map((trigger) => trigger.type))
    );
    const patterns = [
      triggerTypes.has("order") && triggerTypes.has("insiderköp")
        ? "order + insiderköp"
        : null,
      triggerTypes.has("vd-byte") && triggerTypes.has("strategisk översyn")
        ? "ny VD + strategisk översyn"
        : null,
      triggerTypes.has("emission") && triggerTypes.has("finansiering")
        ? "emission/överlevnad -> turnaround"
        : null,
      triggerTypes.size >= 3 ? "PM-kluster med flera triggers" : null,
    ].filter((item): item is string => Boolean(item));

    return {
      ticker,
      intensityScore: Math.min(100, 35 + items.length * 13 + triggerTypes.size * 8),
      clusterCount: items.length,
      storyBuilding: patterns.length > 0 || items.length >= 3,
      detectedPatterns: patterns,
    };
  });
}
