import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";

export interface PreBreakoutSignal {
  ticker: string;
  score: number;
  tightConsolidation: boolean;
  risingVolumeUnderSurface: boolean;
  stealthAccumulation: boolean;
  decreasingVolatilityBeforeExpansion: boolean;
  repeatedFailedBreakouts: boolean;
  narrativeAwakening: boolean;
  evidence: string[];
}

export function detectPreBreakout(input: RankingInput): PreBreakoutSignal {
  const tightConsolidation = input.squeeze.score < 78 && input.relativeStrength >= 62;
  const risingVolumeUnderSurface = input.unusualVolume >= 58 && input.unusualVolume < 84;
  const stealthAccumulation =
    input.insider.direction === "bullish" && input.social.score < 78;
  const decreasingVolatilityBeforeExpansion =
    input.squeeze.triggeredFactors.includes("Låg float") &&
    input.squeeze.score < 82;
  const repeatedFailedBreakouts =
    input.technicalMomentum >= 62 && input.relativeStrength >= 60 && input.squeeze.score < 70;
  const narrativeAwakening =
    input.narrative.narrativeStrength >= 55 && input.narrative.trendDirection === "up";
  const evidence = [
    tightConsolidation ? "Tajt konsolidering med relativ styrka" : null,
    risingVolumeUnderSurface ? "Volym stiger under ytan" : null,
    stealthAccumulation ? "Insiderköp före bred social hype" : null,
    decreasingVolatilityBeforeExpansion ? "Låg float med kompression" : null,
    repeatedFailedBreakouts ? "Upprepade försök utan full breakout" : null,
    narrativeAwakening ? "Narrativet börjar vakna" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ticker: input.ticker,
    score: Math.min(100, 25 + evidence.length * 13),
    tightConsolidation,
    risingVolumeUnderSurface,
    stealthAccumulation,
    decreasingVolatilityBeforeExpansion,
    repeatedFailedBreakouts,
    narrativeAwakening,
    evidence,
  };
}
