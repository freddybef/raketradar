import type { NormalizedNewsItem } from "./newsIngest";

export interface ReleaseCadenceSignal {
  ticker: string;
  pmClusters: number;
  increasingReleaseFrequency: boolean;
  strategicShift: boolean;
  orderAcceleration: boolean;
  restructuringCadence: boolean;
  score: number;
}

export function analyzeMfnCisionAcceleration(
  items: NormalizedNewsItem[]
): ReleaseCadenceSignal[] {
  const grouped = items.reduce<Record<string, NormalizedNewsItem[]>>((acc, item) => {
    for (const ticker of item.tickers) {
      acc[ticker] = [...(acc[ticker] ?? []), item];
    }
    return acc;
  }, {});

  return Object.entries(grouped).map(([ticker, news]) => {
    const triggers = news.flatMap((item) => item.triggers.map((trigger) => trigger.type));
    const pmClusters = news.length;
    const strategicShift =
      triggers.includes("vd-byte") || triggers.includes("strategisk översyn");
    const orderAcceleration =
      triggers.filter((trigger) => trigger === "order" || trigger === "avtal").length >= 2;
    const restructuringCadence =
      triggers.includes("finansiering") || triggers.includes("emission");
    const increasingReleaseFrequency = pmClusters >= 3;

    return {
      ticker,
      pmClusters,
      increasingReleaseFrequency,
      strategicShift,
      orderAcceleration,
      restructuringCadence,
      score: Math.min(
        100,
        30 +
          pmClusters * 10 +
          (strategicShift ? 14 : 0) +
          (orderAcceleration ? 18 : 0) +
          (restructuringCadence ? 10 : 0)
      ),
    };
  });
}
