import type { MarketRegime } from "@/lib/marketRegime";
import type { RankedStock } from "../ranking/rankStocks";
import type { EdgeScore } from "./edgeScore";

export function applyHistoricalLearning(
  stocks: RankedStock[],
  edgeScores: EdgeScore[],
  regime: MarketRegime
) {
  return stocks
    .map((stock) => {
      const matchingEdge = edgeScores.find((edge) =>
        stock.tags.some((tag) => edge.signalCombo.toLowerCase().includes(tag.toLowerCase()))
      );
      const regimeBoost = regime.riskMode === "risk_on" && stock.tags.includes("småbolag") ? 5 : 0;
      const edgeBoost = matchingEdge ? (matchingEdge.edgeScore - 50) * 0.18 : 0;
      const adjustedScore = Math.max(
        0,
        Math.min(100, Math.round(stock.totalScore + edgeBoost + regimeBoost))
      );

      return {
        ...stock,
        totalScore: adjustedScore,
        reasons: matchingEdge
          ? [...stock.reasons, `Historiskt edge-mönster: ${matchingEdge.signalCombo}`]
          : stock.reasons,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}
