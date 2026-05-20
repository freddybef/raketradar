import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import type { AsymmetricSetup } from "@/lib/intelligence/history/asymmetricDetector";
import type { SignalDecayResult } from "@/lib/realtime/signalDecay";
import type { TimingResult } from "@/lib/realtime/timingEngine";

export interface PositionQuality {
  ticker: string;
  edgeQuality: number;
  asymmetry: number;
  liquidityQuality: number;
  continuationProbability: number;
  exhaustionRisk: number;
  convictionDurability: number;
  totalQuality: number;
}

export function calculatePositionQuality(input: {
  stock: RankedStock;
  asymmetry: AsymmetricSetup;
  timing: TimingResult | null;
  decay: SignalDecayResult | null;
}): PositionQuality {
  const exhaustionRisk =
    input.decay?.state === "late" || input.decay?.state === "crowding_increasing"
      ? 74
      : input.stock.tags.includes("social heat") && !input.stock.tags.includes("insider accumulation")
        ? 52
        : 28;
  const liquidityQuality = input.stock.tags.includes("småbolag")
    ? 58
    : input.stock.tags.includes("large/mid")
      ? 78
      : 66;
  const continuationProbability =
    input.timing?.phase === "optimal"
      ? 82
      : input.timing?.phase === "early"
        ? 68
        : input.timing?.phase === "exhaustion"
          ? 34
          : 52;
  const convictionDurability = Math.max(
    0,
    Math.min(100, input.stock.conviction * 0.7 + input.asymmetry.score * 0.3 - exhaustionRisk * 0.2)
  );
  const totalQuality = Math.max(
    0,
    Math.min(
      100,
      input.stock.totalScore * 0.25 +
        input.asymmetry.score * 0.2 +
        liquidityQuality * 0.15 +
        continuationProbability * 0.2 +
        convictionDurability * 0.2 -
        exhaustionRisk * 0.18
    )
  );

  return {
    ticker: input.stock.ticker,
    edgeQuality: input.stock.totalScore,
    asymmetry: input.asymmetry.score,
    liquidityQuality,
    continuationProbability,
    exhaustionRisk,
    convictionDurability: Math.round(convictionDurability),
    totalQuality: Math.round(totalQuality),
  };
}
