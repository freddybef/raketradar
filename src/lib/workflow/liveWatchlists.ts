import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import type { TimingResult } from "@/lib/realtime/timingEngine";
import type { CrowdingSignal } from "@/lib/crowdingDetector";

export interface WatchlistPing {
  ticker: string;
  type: "conviction_up" | "timing_optimal" | "crowding_up" | "setup_worse";
  message: string;
}

export function buildWatchlistPings(input: {
  stocks: RankedStock[];
  previousScores?: Record<string, number>;
  timing: Array<{ ticker: string; timing: TimingResult }>;
  crowding: CrowdingSignal[];
}): WatchlistPing[] {
  return input.stocks.flatMap((stock) => {
    const previous = input.previousScores?.[stock.ticker] ?? stock.totalScore - 6;
    const timing = input.timing.find((item) => item.ticker === stock.ticker)?.timing;
    const crowding = input.crowding.find((item) => item.ticker === stock.ticker);
    const pings: WatchlistPing[] = [];

    if (stock.totalScore - previous >= 8) {
      pings.push({
        ticker: stock.ticker,
        type: "conviction_up",
        message: "Conviction ökar snabbt.",
      });
    }

    if (timing?.phase === "optimal") {
      pings.push({
        ticker: stock.ticker,
        type: "timing_optimal",
        message: "Timing är optimal enligt execution-lagret.",
      });
    }

    if ((crowding?.crowdingScore ?? 0) >= 60) {
      pings.push({
        ticker: stock.ticker,
        type: "crowding_up",
        message: "Crowding ökar, risk för sämre edge.",
      });
    }

    if (stock.totalScore < previous - 8) {
      pings.push({
        ticker: stock.ticker,
        type: "setup_worse",
        message: "Setup försämras relativt föregående snapshot.",
      });
    }

    return pings;
  });
}
