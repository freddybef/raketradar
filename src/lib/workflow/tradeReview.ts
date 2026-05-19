import type { MarketRegime } from "@/lib/marketRegime";

export interface TradeReviewInput {
  ticker: string;
  entryTiming: "opening_drive" | "pullback" | "early_breakout" | "confirmation";
  entryWasLate: boolean;
  crowdingDamagedEdge: boolean;
  outcomePercent: number;
  regime: MarketRegime["riskMode"];
  setupTags: string[];
}

export interface TradeReview {
  ticker: string;
  worked: boolean;
  reason: string;
  lessons: string[];
}

export function reviewTrade(input: TradeReviewInput): TradeReview {
  const worked = input.outcomePercent > 5;

  return {
    ticker: input.ticker,
    worked,
    reason: worked
      ? "Setup fungerade eftersom entry och regime stödde edge."
      : "Setup misslyckades eller gav svag follow-through.",
    lessons: [
      input.entryWasLate ? "Entry var för sen." : "Entry timing var acceptabel.",
      input.crowdingDamagedEdge ? "Crowding förstörde edge." : "Crowding var inte huvudproblemet.",
      `Regime: ${input.regime}.`,
      `Setup: ${input.setupTags.join(", ")}.`,
    ],
  };
}
