import type { PositionScore } from "./positionScoring";
import type { ExposureSummary } from "./exposureEngine";

export interface CapitalAllocation {
  ticker: string;
  suggestedWeightPercent: number;
  capitalTier: "core" | "starter" | "watch" | "no_add";
  reason: string;
}

export function allocateCapital(
  scores: PositionScore[],
  exposure: ExposureSummary
): CapitalAllocation[] {
  const allocatable = scores.filter((score) => score.verdict === "allocate");
  const riskPenalty = exposure.concentrationRisk >= 60 ? 0.72 : 1;

  return scores
    .map((score) => {
      if (score.verdict === "avoid" || score.verdict === "trim") {
        return {
          ticker: score.ticker,
          suggestedWeightPercent: 0,
          capitalTier: "no_add" as const,
          reason: score.reason,
        };
      }

      const base =
        score.verdict === "allocate"
          ? Math.max(4, (score.score / 100) * 12 * riskPenalty)
          : 2;
      const weight =
        allocatable.length > 3 && score.verdict === "allocate"
          ? Math.min(base, 8)
          : base;

      const capitalTier: CapitalAllocation["capitalTier"] =
        score.verdict === "allocate" && score.score >= 82
          ? "core"
          : score.verdict === "allocate"
            ? "starter"
            : "watch";

      return {
        ticker: score.ticker,
        suggestedWeightPercent: Math.round(weight * 10) / 10,
        capitalTier,
        reason: score.reason,
      };
    })
    .sort((a, b) => b.suggestedWeightPercent - a.suggestedWeightPercent);
}
