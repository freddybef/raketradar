import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import type { TimingResult } from "@/lib/realtime/timingEngine";

export interface WhyNow {
  ticker: string;
  explanation: string;
  timingChangedBecause: string;
  marketJustDiscovered: string;
  convictionIncreasedBecause: string;
}

export function explainWhyNow(stock: RankedStock, timing: TimingResult | null): WhyNow {
  return {
    ticker: stock.ticker,
    explanation: `${stock.ticker} är intressant nu eftersom ${stock.reasons.slice(0, 2).join(" och ")}.`,
    timingChangedBecause: timing?.reason ?? "Timing behöver ny realtidsbekräftelse.",
    marketJustDiscovered: stock.tags.includes("social heat")
      ? "Crowden börjar upptäcka caset via social velocity."
      : "Marknaden har ännu inte fullt prisat in setupen.",
    convictionIncreasedBecause: `Conviction ${stock.conviction}/100 med total score ${stock.totalScore}/100.`,
  };
}
