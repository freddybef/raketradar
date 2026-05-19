import type { RankedStock } from "../ranking/rankStocks";

export type PatternMatchType =
  | "liknar tidigare runner"
  | "tidig squeeze setup"
  | "dead cat bounce"
  | "slow accumulation"
  | "parabolic exhaustion";

export interface PatternMatch {
  ticker: string;
  type: PatternMatchType;
  confidence: number;
  evidence: string[];
}

export function matchHistoricalPatterns(stock: RankedStock): PatternMatch[] {
  const matches: PatternMatch[] = [];

  if (stock.tags.includes("squeeze") && stock.tags.includes("småbolag")) {
    matches.push({
      ticker: stock.ticker,
      type: "tidig squeeze setup",
      confidence: 76,
      evidence: ["Låg float/småbolag", "Squeeze-tag", "Hög total ranking"],
    });
  }

  if (stock.reasons.some((reason) => reason.toLowerCase().includes("insider"))) {
    matches.push({
      ticker: stock.ticker,
      type: "slow accumulation",
      confidence: 72,
      evidence: ["Insider/ackumuleringssignal", "Inte enbart momentum"],
    });
  }

  if (stock.totalScore >= 82 && stock.conviction >= 75) {
    matches.push({
      ticker: stock.ticker,
      type: "liknar tidigare runner",
      confidence: 70,
      evidence: stock.reasons.slice(0, 3),
    });
  }

  if (stock.tags.includes("social heat") && stock.risks.some((risk) => risk.includes("reversal"))) {
    matches.push({
      ticker: stock.ticker,
      type: "parabolic exhaustion",
      confidence: 62,
      evidence: ["Social heat", "Reversal-risk flaggad"],
    });
  }

  return matches;
}
