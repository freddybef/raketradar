import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export type WatchlistEvolutionState =
  | "improving setup"
  | "deteriorating setup"
  | "nearing breakout"
  | "becoming crowded"
  | "regaining strength"
  | "failed but recovering";

export interface WatchlistEvolution {
  ticker: string;
  state: WatchlistEvolutionState;
  reason: string;
}

export function evaluateWatchlistEvolution(
  stocks: RankedStock[],
  previousScores: Record<string, number> = {}
): WatchlistEvolution[] {
  return stocks.map((stock) => {
    const previous = previousScores[stock.ticker] ?? stock.totalScore - 8;
    const delta = stock.totalScore - previous;
    const state: WatchlistEvolutionState =
      stock.tags.includes("social heat") && stock.totalScore >= 82
        ? "becoming crowded"
        : delta >= 12
          ? "regaining strength"
          : stock.totalScore >= 74
            ? "nearing breakout"
            : delta >= 4
              ? "improving setup"
              : delta <= -8
                ? "deteriorating setup"
                : "failed but recovering";

    return {
      ticker: stock.ticker,
      state,
      reason: `Score ${stock.totalScore}, delta ${delta >= 0 ? "+" : ""}${delta}.`,
    };
  });
}
