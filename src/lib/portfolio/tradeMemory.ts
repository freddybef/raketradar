import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export interface TradeMemoryEntry {
  ticker: string;
  setupTags: string[];
  conviction: number;
  outcomePercent?: number;
  falsePositive?: boolean;
  note: string;
}

export function rememberSignal(stock: RankedStock): TradeMemoryEntry {
  return {
    ticker: stock.ticker,
    setupTags: stock.tags,
    conviction: stock.conviction,
    note: `${stock.ticker} sparad som signal med ${stock.reasons[0]}.`,
  };
}

export function analyzeFalsePositives(memory: TradeMemoryEntry[]) {
  return memory.filter(
    (entry) => entry.falsePositive || (entry.outcomePercent ?? 0) < -5
  );
}

export function bestConvictionSignals(memory: TradeMemoryEntry[]) {
  return [...memory].sort((a, b) => b.conviction - a.conviction).slice(0, 5);
}
