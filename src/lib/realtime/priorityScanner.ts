import type { IntelligenceReport } from "@/lib/intelligence/mockData";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import { detectAsymmetricSetup } from "@/lib/intelligence/history/asymmetricDetector";
import { calculateAlertPriority } from "@/lib/intelligence/alerts/priorityEngine";
import { evaluateTiming } from "./timingEngine";

export interface PriorityScanItem {
  ticker: string;
  score: number;
  reason: string;
}

export function scanTopFiveJustNow(
  report: IntelligenceReport,
  feed: SignalFeedItem[]
): PriorityScanItem[] {
  return report.topRanked
    .map((stock) => {
      const input = report.inputs.find((item) => item.ticker === stock.ticker);
      const relatedFeed = feed.filter((item) => item.ticker === stock.ticker);
      const bestFeed = relatedFeed
        .map((item) => calculateAlertPriority(item))
        .sort((a, b) => b.urgency - a.urgency)[0];
      const timing = input ? evaluateTiming(input) : null;
      const asymmetry = detectAsymmetricSetup(stock);
      const score = Math.min(
        100,
        stock.totalScore * 0.35 +
          (bestFeed?.urgency ?? 40) * 0.25 +
          (timing?.score ?? 40) * 0.2 +
          asymmetry.score * 0.2
      );

      return {
        ticker: stock.ticker,
        score: Math.round(score),
        reason: `${timing?.phase ?? "watch"} · ${stock.reasons[0]}`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
