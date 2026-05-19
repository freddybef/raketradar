import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import type { AsymmetricSetup } from "@/lib/intelligence/history/asymmetricDetector";
import type { SignalDecayResult } from "@/lib/realtime/signalDecay";
import type { TimingResult } from "@/lib/realtime/timingEngine";
import { allocateCapital, type CapitalAllocation } from "./capitalAllocator";
import { analyzeExposure, type ExposureSummary } from "./exposureEngine";
import { calculatePositionQuality, type PositionQuality } from "./positionQuality";
import { scorePosition, type PositionScore } from "./positionScoring";

export interface PortfolioBrainResult {
  qualities: PositionQuality[];
  scores: PositionScore[];
  exposure: ExposureSummary;
  allocations: CapitalAllocation[];
  priority: string[];
}

export function runPortfolioBrain(input: {
  stocks: RankedStock[];
  asymmetry: AsymmetricSetup[];
  timing: Array<{ ticker: string; timing: TimingResult }>;
  decay: SignalDecayResult[];
}): PortfolioBrainResult {
  const qualities = input.stocks.map((stock) => {
    const asymmetry =
      input.asymmetry.find((item) => item.ticker === stock.ticker) ??
      ({ ticker: stock.ticker, score: 35 } as AsymmetricSetup);
    const timing = input.timing.find((item) => item.ticker === stock.ticker)?.timing ?? null;
    const decay = input.decay.find((item) => item.ticker === stock.ticker) ?? null;

    return calculatePositionQuality({ stock, asymmetry, timing, decay });
  });
  const scores = qualities.map(scorePosition).sort((a, b) => b.score - a.score);
  const exposure = analyzeExposure(input.stocks);
  const allocations = allocateCapital(scores, exposure);

  return {
    qualities,
    scores,
    exposure,
    allocations,
    priority: allocations
      .filter((item) => item.capitalTier === "core" || item.capitalTier === "starter")
      .map((item) => item.ticker),
  };
}
