import type { RankedStock } from "./intelligence/ranking/rankStocks";

export type WatchlistIntelligenceSignal =
  | "dormant_awakening"
  | "repeated_accumulation"
  | "narrative_returning"
  | "failed_breakout_retry"
  | "stealth_strength";

export interface WatchlistIntelligenceResult {
  ticker: string;
  signals: WatchlistIntelligenceSignal[];
  score: number;
  reason: string;
}

export function analyzeWatchlistIntelligence(input: {
  ranked: RankedStock[];
  previousScores?: Record<string, number>;
}): WatchlistIntelligenceResult[] {
  return input.ranked.map((stock) => {
    const previous = input.previousScores?.[stock.ticker] ?? 0;
    const signals: WatchlistIntelligenceSignal[] = [];

    if (previous < 35 && stock.totalScore >= 62) signals.push("dormant_awakening");
    if (stock.tags.includes("insider accumulation")) signals.push("repeated_accumulation");
    if (stock.tags.some((tag) => tag.includes("AI") || tag.includes("biotech"))) {
      signals.push("narrative_returning");
    }
    if (previous >= 70 && stock.totalScore >= 70) signals.push("failed_breakout_retry");
    if (stock.reasons.some((reason) => reason.toLowerCase().includes("insider"))) {
      signals.push("stealth_strength");
    }

    return {
      ticker: stock.ticker,
      signals,
      score: Math.min(100, stock.totalScore + signals.length * 5),
      reason:
        signals.length > 0
          ? `Watchlist edge: ${signals.join(", ")}`
          : "Ingen särskild watchlist-anomali ännu",
    };
  });
}
