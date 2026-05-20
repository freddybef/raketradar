import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export function generateBullCase(stock: RankedStock) {
  return `${stock.ticker}: bull case bygger på ${stock.reasons.join(", ")} med conviction ${stock.conviction}/100.`;
}
