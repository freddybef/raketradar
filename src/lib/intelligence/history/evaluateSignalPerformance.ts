import type { SignalOutcomeEvaluation } from "./trackSignalOutcome";

export interface SignalPerformanceSummary {
  sampleSize: number;
  winrate: number;
  averageUpside: number;
  averageDownside: number;
  averageVolatility: number;
  averageFollowThrough: number;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function evaluateSignalPerformance(
  outcomes: SignalOutcomeEvaluation[]
): SignalPerformanceSummary {
  const wins = outcomes.filter((outcome) => outcome.maxUpsidePercent >= 8);

  return {
    sampleSize: outcomes.length,
    winrate:
      outcomes.length > 0 ? Math.round((wins.length / outcomes.length) * 100) : 0,
    averageUpside: Math.round(average(outcomes.map((item) => item.maxUpsidePercent)) * 10) / 10,
    averageDownside: Math.round(average(outcomes.map((item) => item.downsidePercent)) * 10) / 10,
    averageVolatility: Math.round(average(outcomes.map((item) => item.volatilityPercent)) * 10) / 10,
    averageFollowThrough: Math.round(average(outcomes.map((item) => item.followThroughQuality))),
  };
}
