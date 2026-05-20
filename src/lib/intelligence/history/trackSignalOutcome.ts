import type { MarketRegime } from "@/lib/marketRegime";

export type OutcomeHorizon = "1h" | "1d" | "3d" | "1w" | "1m";

export interface SignalOutcomeSnapshot {
  signalId: string;
  ticker: string;
  triggeredAt: string;
  entryPrice: number;
  rankingScore: number;
  conviction: number;
  catalystMix: string[];
  regime: MarketRegime["riskMode"];
  marketCapRange: "micro" | "small" | "mid" | "large";
}

export interface SignalOutcomeMark {
  horizon: OutcomeHorizon;
  price: number;
  high: number;
  low: number;
  observedAt: string;
}

export interface SignalOutcomeEvaluation {
  signalId: string;
  ticker: string;
  horizon: OutcomeHorizon;
  maxUpsidePercent: number;
  downsidePercent: number;
  volatilityPercent: number;
  followThroughQuality: number;
}

export function createSignalOutcomeSnapshot(input: SignalOutcomeSnapshot) {
  return input;
}

export function evaluateOutcomeMark(
  snapshot: SignalOutcomeSnapshot,
  mark: SignalOutcomeMark
): SignalOutcomeEvaluation {
  const maxUpsidePercent =
    ((mark.high - snapshot.entryPrice) / snapshot.entryPrice) * 100;
  const downsidePercent =
    ((mark.low - snapshot.entryPrice) / snapshot.entryPrice) * 100;
  const volatilityPercent = ((mark.high - mark.low) / snapshot.entryPrice) * 100;
  const closeReturn = ((mark.price - snapshot.entryPrice) / snapshot.entryPrice) * 100;
  const followThroughQuality = Math.max(
    0,
    Math.min(100, Math.round(closeReturn * 4 + maxUpsidePercent * 2 - Math.abs(downsidePercent)))
  );

  return {
    signalId: snapshot.signalId,
    ticker: snapshot.ticker,
    horizon: mark.horizon,
    maxUpsidePercent: Math.round(maxUpsidePercent * 10) / 10,
    downsidePercent: Math.round(downsidePercent * 10) / 10,
    volatilityPercent: Math.round(volatilityPercent * 10) / 10,
    followThroughQuality,
  };
}
