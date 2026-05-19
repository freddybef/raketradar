import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import type { AdaptiveLearningState } from "@/lib/db/intelligenceRepository";

export interface AdaptiveSignalDecision {
  accepted: SignalFeedItem[];
  rejected: Array<{ item: SignalFeedItem; reason: string }>;
}

function adjustedScore(item: SignalFeedItem, learning: AdaptiveLearningState) {
  let score = item.score;
  const isStealth =
    item.tags.includes("stealth accumulation") || item.tags.includes("insider");
  const isCrowded =
    item.tags.includes("pump-risk") || item.tags.includes("parabolisk");
  const isLateMomentum =
    item.type === "momentum" && item.score >= 86 && !item.tags.includes("confluence");

  if (isStealth) score += learning.stealthBoost;
  if (isCrowded) score -= learning.crowdingPenalty;
  if (isLateMomentum) score -= learning.lateMomentumPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function applyAdaptiveSignalLearning(
  feed: SignalFeedItem[],
  learning: AdaptiveLearningState
): AdaptiveSignalDecision {
  const accepted: SignalFeedItem[] = [];
  const rejected: AdaptiveSignalDecision["rejected"] = [];

  for (const item of feed) {
    const score = adjustedScore(item, learning);
    const adjusted = { ...item, score };

    if (score >= learning.minSignalScore || item.priority === "EXTREME") {
      accepted.push(adjusted);
      continue;
    }

    rejected.push({
      item: adjusted,
      reason:
        score < learning.minSignalScore
          ? `Under adaptive threshold ${learning.minSignalScore}`
          : "Signal degraderad av historisk edge",
    });
  }

  return { accepted, rejected };
}
