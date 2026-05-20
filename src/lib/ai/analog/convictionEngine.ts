import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";
import type { PreBreakoutSignal } from "./preBreakoutDetector";
import type { MarketBlindspot } from "./marketBlindspotDetector";

export interface ConvictionResult {
  ticker: string;
  convictionScore: number;
  fragilityScore: number;
  sustainabilityScore: number;
  breakoutProbability: number;
  exhaustionProbability: number;
}

export function calculateConviction(
  input: RankingInput,
  preBreakout: PreBreakoutSignal,
  blindspot: MarketBlindspot
): ConvictionResult {
  const exhaustionProbability = Math.min(
    100,
    input.social.score > 88 && input.technicalMomentum > 86 ? 72 : input.squeeze.score > 90 ? 58 : 24
  );
  const sustainabilityScore = Math.max(
    0,
    Math.min(
      100,
      input.insider.score * 0.25 +
        input.narrative.narrativeStrength * 0.25 +
        input.relativeStrength * 0.25 +
        preBreakout.score * 0.25 -
        exhaustionProbability * 0.2
    )
  );
  const breakoutProbability = Math.max(
    0,
    Math.min(
      100,
      preBreakout.score * 0.35 +
        input.squeeze.score * 0.25 +
        input.unusualVolume * 0.2 +
        blindspot.score * 0.2
    )
  );
  const fragilityScore = Math.max(
    0,
    Math.min(100, exhaustionProbability + (input.insider.direction === "bearish" ? 18 : 0))
  );

  return {
    ticker: input.ticker,
    convictionScore: Math.round((sustainabilityScore + breakoutProbability - fragilityScore * 0.25)),
    fragilityScore: Math.round(fragilityScore),
    sustainabilityScore: Math.round(sustainabilityScore),
    breakoutProbability: Math.round(breakoutProbability),
    exhaustionProbability: Math.round(exhaustionProbability),
  };
}
