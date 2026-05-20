import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export function generateBearCase(stock: RankedStock) {
  return `${stock.ticker}: bear case är ${stock.risks.join(", ")}. Kräver verifiering innan position.`;
}
