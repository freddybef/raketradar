import type { InsiderEvent } from "@/lib/intelligence/insider/insiderTypes";
import type { PreOpenClassification } from "@/lib/intelligence/preOpenClassifier";

export type OpeningAction =
  | "BUY WATCH"
  | "WAIT FOR PULLBACK"
  | "AVOID CHASE"
  | "NEWS ONLY"
  | "HIGH RISK";

export interface OpeningActionInput {
  ticker: string;
  classification?: PreOpenClassification;
  insiderEvents: InsiderEvent[];
  historicalContinuationRate: number;
  falsePositiveRatio: number;
  rankedScore: number;
  priorMoveScore: number;
  liquidityRisk: number;
  crowdingRisk: number;
}

export interface OpeningActionResult {
  action: OpeningAction;
  confidence: number;
  risk: number;
  reasons: string[];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function rankOpeningAction(input: OpeningActionInput): OpeningActionResult {
  const insiderSupport = input.insiderEvents.some((event) => event.type === "buy")
    ? Math.min(22, input.insiderEvents.reduce((sum, event) => sum + event.valueSek, 0) / 250000)
    : 0;
  const catalyst = input.classification?.catalystStrength ?? 35;
  const fakeRisk = input.classification?.fakeSpikeRisk ?? 35;
  const continuation = input.classification?.continuationProbability ?? input.historicalContinuationRate;
  const gap = input.classification?.gapProbability ?? 35;
  const risk = clamp(fakeRisk + input.crowdingRisk * 0.35 + input.liquidityRisk * 0.25 + input.falsePositiveRatio * 0.25);
  const confidence = clamp(
    catalyst * 0.33 +
      continuation * 0.24 +
      input.rankedScore * 0.18 +
      insiderSupport +
      input.historicalContinuationRate * 0.12 -
      risk * 0.18
  );

  const reasons = [
    catalyst >= 70 ? "stark pre-open catalyst" : null,
    insiderSupport > 0 ? "FI-insiderflöde stödjer caset" : null,
    continuation >= 65 ? "historisk continuation över tröskel" : null,
    risk >= 70 ? "hög fake-spike/crowding-risk" : null,
    gap >= 70 ? "hög gap-sannolikhet" : null,
  ].filter((reason): reason is string => Boolean(reason));

  if (risk >= 78) return { action: "HIGH RISK", confidence, risk, reasons };
  if (confidence >= 74 && risk < 58) return { action: "BUY WATCH", confidence, risk, reasons };
  if (gap >= 72 && input.priorMoveScore >= 68) return { action: "AVOID CHASE", confidence, risk, reasons };
  if (confidence >= 58 && risk < 70) return { action: "WAIT FOR PULLBACK", confidence, risk, reasons };
  if (insiderSupport > 0 && risk < 70) return { action: "WAIT FOR PULLBACK", confidence, risk, reasons };
  return { action: catalyst >= 55 ? "NEWS ONLY" : "HIGH RISK", confidence, risk, reasons };
}
