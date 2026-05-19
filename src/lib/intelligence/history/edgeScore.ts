import type { HistoricalPattern } from "./historicalPatterns";

export interface EdgeScore {
  signalCombo: string;
  historicalWinrate: number;
  averageUpside: number;
  falseBreakoutProbability: number;
  averageDurationDays: number;
  edgeScore: number;
}

export function calculateEdgeScores(patterns: HistoricalPattern[]): EdgeScore[] {
  return patterns
    .map((pattern) => {
      const score = Math.max(
        0,
        Math.min(
          100,
          pattern.hitRate * 0.45 +
            pattern.averageUpside * 1.35 -
            pattern.falsePositiveRate * 0.35 +
            Math.min(12, pattern.sampleSize / 4)
        )
      );

      return {
        signalCombo: pattern.name,
        historicalWinrate: pattern.hitRate,
        averageUpside: pattern.averageUpside,
        falseBreakoutProbability: pattern.falsePositiveRate,
        averageDurationDays:
          pattern.averageUpside >= 25 ? 5 : pattern.averageUpside >= 15 ? 3 : 2,
        edgeScore: Math.round(score),
      };
    })
    .sort((a, b) => b.edgeScore - a.edgeScore);
}
