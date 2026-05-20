import type { EdgeScore } from "@/lib/intelligence/history/edgeScore";
import type { MarketRegime } from "@/lib/marketRegime";

export interface AdaptiveWeights {
  social: number;
  insider: number;
  squeeze: number;
  narrative: number;
  momentum: number;
  news: number;
}

export function calculateAdaptiveWeights(input: {
  edgeScores: EdgeScore[];
  regime: MarketRegime;
  sector?: string;
  marketCapEnvironment?: "micro" | "small" | "mid" | "large";
}): AdaptiveWeights {
  const best = input.edgeScores[0];
  const base: AdaptiveWeights = {
    social: input.regime.rankingWeights.social,
    insider: input.regime.rankingWeights.insider,
    squeeze: input.regime.rankingWeights.squeeze,
    narrative: input.regime.rankingWeights.narrative,
    momentum: input.regime.rankingWeights.momentum,
    news: 0.13,
  };

  if (best?.signalCombo.includes("insider")) base.insider += 0.04;
  if (best?.signalCombo.includes("social")) base.social += 0.03;
  if (best?.signalCombo.includes("low float")) base.squeeze += 0.03;
  if (input.marketCapEnvironment === "micro" || input.marketCapEnvironment === "small") {
    base.squeeze += 0.02;
    base.insider += 0.02;
  }
  if (input.sector === "biotech") base.news += 0.04;

  return base;
}
