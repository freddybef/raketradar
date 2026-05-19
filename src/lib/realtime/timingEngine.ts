import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";

export type TimingPhase = "early" | "optimal" | "extended" | "exhaustion";

export interface TimingResult {
  ticker: string;
  phase: TimingPhase;
  score: number;
  reason: string;
}

export function evaluateTiming(input: RankingInput): TimingResult {
  if (input.social.score >= 90 && input.technicalMomentum >= 88) {
    return {
      ticker: input.ticker,
      phase: "exhaustion",
      score: 32,
      reason: "Social heat och momentum är redan extremt höga.",
    };
  }

  if (input.unusualVolume >= 75 && input.social.velocityScore >= 65 && input.squeeze.score >= 65) {
    return {
      ticker: input.ticker,
      phase: "optimal",
      score: 86,
      reason: "Volym, social velocity och squeeze sammanfaller utan full eufori.",
    };
  }

  if (input.insider.direction === "bullish" && input.social.score < 65) {
    return {
      ticker: input.ticker,
      phase: "early",
      score: 74,
      reason: "Insider/ackumulation syns innan bred social uppmärksamhet.",
    };
  }

  return {
    ticker: input.ticker,
    phase: "extended",
    score: 54,
    reason: "Setupen finns, men timing kräver bättre entry eller ny trigger.",
  };
}
