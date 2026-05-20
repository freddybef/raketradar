import type { RankedStock } from "../ranking/rankStocks";

export interface NoiseFilterResult {
  ticker: string;
  pass: boolean;
  noiseScore: number;
  reasons: string[];
}

export function filterSignalNoise(stock: RankedStock): NoiseFilterResult {
  const reasons: string[] = [];
  let noiseScore = 0;

  if (stock.tags.includes("social heat") && !stock.tags.includes("insider accumulation")) {
    noiseScore += 24;
    reasons.push("Social hype utan insider/fundamental bekräftelse");
  }

  if (stock.risks.some((risk) => risk.toLowerCase().includes("spread"))) {
    noiseScore += 18;
    reasons.push("Likviditetsfälla/spread-risk");
  }

  if (stock.tags.includes("parabolisk")) {
    noiseScore += 28;
    reasons.push("Redan överutsträckt mover");
  }

  if (stock.conviction < 45) {
    noiseScore += 16;
    reasons.push("Låg continuation-conviction");
  }

  return {
    ticker: stock.ticker,
    pass: noiseScore < 45,
    noiseScore,
    reasons,
  };
}
