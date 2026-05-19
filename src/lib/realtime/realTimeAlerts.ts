import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import { calculateAlertPriority } from "@/lib/intelligence/alerts/priorityEngine";

export interface RealTimeAlert {
  ticker: string;
  urgency: number;
  confidence: number;
  actionableSummary: string;
  whyNow: string;
  type: SignalFeedItem["type"];
  createdAt: string;
}

export function buildRealTimeAlerts(items: SignalFeedItem[]): RealTimeAlert[] {
  return items
    .map((item) => {
      const priority = calculateAlertPriority(item);

      return {
        ticker: item.ticker,
        urgency: priority.urgency,
        confidence: item.confidence,
        actionableSummary:
          priority.priority === "EXTREME" || priority.priority === "HIGH"
            ? `Agera: verifiera entry, spread och catalyst i ${item.ticker}`
            : `Bevaka ${item.ticker}: setup nära tröskel`,
        whyNow: `${item.title}: ${item.description}`,
        type: item.type,
        createdAt: new Date().toISOString(),
      };
    })
    .filter((alert) => alert.urgency >= 58)
    .sort((a, b) => b.urgency - a.urgency);
}
