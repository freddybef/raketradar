import type { PreOpenEdgeScore } from "@/lib/intelligence/preOpenEdgeScore";
import type { PreOpenClassification } from "@/lib/intelligence/preOpenClassifier";

export interface DoNotChaseResult {
  blocked: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

export function evaluateDoNotChase(input: {
  classification?: PreOpenClassification;
  edgeScore: PreOpenEdgeScore;
  historicalSignalWeak: boolean;
}) {
  const reasons = [
    input.edgeScore.breakdown.priorMove >= 88 ? "redan parabolisk rörelse" : null,
    input.edgeScore.breakdown.fakeSpikeRisk >= 72 ? "hög fake-spike-risk" : null,
    input.edgeScore.breakdown.newsStrength < 48 && input.edgeScore.breakdown.crowding >= 62
      ? "svag nyhet men hög hype"
      : null,
    input.edgeScore.breakdown.liquidityRisk >= 70 ? "låg likviditet" : null,
    input.edgeScore.breakdown.crowding >= 78 ? "hög crowding" : null,
    input.historicalSignalWeak ? "historiskt svag signaltyp" : null,
    input.classification?.catalystType === "företrädesemission" ? "företrädesemission kräver extra försiktighet" : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    blocked: reasons.length >= 2 || input.edgeScore.breakdown.fakeSpikeRisk >= 82,
    severity: reasons.length >= 3 ? "HIGH" : reasons.length >= 1 ? "MEDIUM" : "LOW",
    reasons,
  } satisfies DoNotChaseResult;
}
