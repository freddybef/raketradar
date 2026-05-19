import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import { intelligenceEventBus } from "./eventBus";

export interface LiveRankingDelta {
  ticker: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  direction: "up" | "down" | "flat";
}

export function calculateLiveRankingUpdates(
  previous: RankedStock[],
  current: RankedStock[]
): LiveRankingDelta[] {
  const previousMap = new Map(previous.map((item) => [item.ticker, item]));

  return current.map((item) => {
    const previousScore = previousMap.get(item.ticker)?.totalScore ?? item.totalScore;
    const delta = item.totalScore - previousScore;

    return {
      ticker: item.ticker,
      previousScore,
      currentScore: item.totalScore,
      delta,
      direction: delta > 1 ? "up" : delta < -1 ? "down" : "flat",
    };
  });
}

export function publishRankingUpdates(deltas: LiveRankingDelta[]) {
  for (const delta of deltas) {
    intelligenceEventBus.publish("ranking:update", delta);
  }
}
