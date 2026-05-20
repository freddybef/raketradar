import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";

export type TradeSetupType = "SCALP" | "SWING" | "POSITION" | "WATCHLIST";

export interface TradeSetup {
  ticker: string;
  type: TradeSetupType;
  idealEntryZone: [number, number];
  breakoutLevel: number;
  invalidationLevel: number;
  riskRewardEstimate: number;
  volatilityAdjustedQuality: number;
}

export function buildTradeSetup(input: RankingInput, lastPrice = 10): TradeSetup {
  const volatilityBuffer = input.squeeze.score >= 80 ? 0.08 : 0.045;
  const breakoutBuffer = input.technicalMomentum >= 75 ? 0.035 : 0.055;
  const stopBuffer = input.squeeze.score >= 80 ? 0.095 : 0.065;
  const quality = Math.max(
    0,
    Math.min(
      100,
      input.relativeStrength * 0.25 +
        input.unusualVolume * 0.2 +
        input.squeeze.confidence * 0.25 +
        input.social.velocityScore * 0.15 +
        input.insider.score * 0.15
    )
  );
  const type: TradeSetupType =
    quality >= 82 && input.squeeze.score >= 75
      ? "SCALP"
      : quality >= 72
        ? "SWING"
        : input.insider.score >= 70
          ? "POSITION"
          : "WATCHLIST";

  return {
    ticker: input.ticker,
    type,
    idealEntryZone: [
      Number((lastPrice * (1 - volatilityBuffer)).toFixed(2)),
      Number((lastPrice * (1 - volatilityBuffer / 2)).toFixed(2)),
    ],
    breakoutLevel: Number((lastPrice * (1 + breakoutBuffer)).toFixed(2)),
    invalidationLevel: Number((lastPrice * (1 - stopBuffer)).toFixed(2)),
    riskRewardEstimate: Number(((breakoutBuffer * 3) / stopBuffer).toFixed(1)),
    volatilityAdjustedQuality: Math.round(quality),
  };
}
