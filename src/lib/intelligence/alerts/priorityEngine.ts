import type { SignalFeedItem } from "../feed/buildSignalFeed";

export type AlertPriority = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface PriorityResult {
  priority: AlertPriority;
  urgency: number;
  breakoutProbability: number;
  exhaustionProbability: number;
  rankingDecay: number;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateAlertPriority(item: SignalFeedItem): PriorityResult {
  const confluenceBoost = item.tags.includes("confluence") ? 18 : 0;
  const smallCapBoost = item.tags.includes("småbolag") ? 8 : 0;
  const accelerationBoost = item.tags.includes("acceleration") ? 12 : 0;
  const exhaustionProbability = clamp(
    item.tags.includes("parabolisk") ? 72 : item.score > 90 ? 48 : 22
  );
  const breakoutProbability = clamp(
    item.score * 0.62 + item.confidence * 0.28 + confluenceBoost + smallCapBoost
  );
  const urgency = clamp(
    item.score * 0.55 +
      item.confidence * 0.25 +
      accelerationBoost +
      confluenceBoost -
      exhaustionProbability * 0.22
  );
  const rankingDecay = clamp(exhaustionProbability - confluenceBoost / 2);
  const raw = clamp(urgency * 0.55 + breakoutProbability * 0.35 - rankingDecay * 0.2);
  const priority: AlertPriority =
    raw >= 88 && exhaustionProbability < 58
      ? "EXTREME"
      : raw >= 72
        ? "HIGH"
        : raw >= 52
          ? "MEDIUM"
          : "LOW";

  return {
    priority,
    urgency,
    breakoutProbability,
    exhaustionProbability,
    rankingDecay,
  };
}
