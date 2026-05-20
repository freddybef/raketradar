import type { PositionQuality } from "./positionQuality";

export type PositionVerdict = "allocate" | "watch" | "trim" | "avoid";

export interface PositionScore {
  ticker: string;
  score: number;
  verdict: PositionVerdict;
  requiredConviction: number;
  reason: string;
}

export function scorePosition(quality: PositionQuality): PositionScore {
  const score = Math.max(
    0,
    Math.min(100, quality.totalQuality - quality.exhaustionRisk * 0.12)
  );
  const verdict: PositionVerdict =
    score >= 76
      ? "allocate"
      : score >= 58
        ? "watch"
        : quality.exhaustionRisk >= 65
          ? "trim"
          : "avoid";

  return {
    ticker: quality.ticker,
    score: Math.round(score),
    verdict,
    requiredConviction: verdict === "allocate" ? 72 : verdict === "watch" ? 60 : 80,
    reason:
      verdict === "allocate"
        ? "Kvalitet, asymmetri och timing är tillräckligt starka för kapital."
        : verdict === "watch"
          ? "Setupen är intressant men behöver bättre timing eller bekräftelse."
          : verdict === "trim"
            ? "Exhaustion/crowding gör risk/reward sämre."
            : "För låg edge relativt risk.",
  };
}
