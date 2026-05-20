import { NextResponse } from "next/server";
import { getOutcomeLearningReport } from "@/lib/db/intelligenceRepository";

export async function GET() {
  const report = await getOutcomeLearningReport();

  return NextResponse.json({
    generatedAt: report.generatedAt,
    bestTriggerCombos: report.bestTriggerCombos,
    worstTriggerCombos: report.worstTriggerCombos,
    insiderQualityRanking: report.insiderQualityRanking,
    falsePositivePatterns: report.falsePositivePatterns,
    currentAdaptiveWeights: report.currentAdaptiveWeights,
    recentOutcomeSummary: report.recentOutcomeSummary,
    confidenceChanges: report.confidenceChanges,
    regimePerformance: report.regimePerformance,
    missingOutcomeData: report.missingOutcomeData,
    recentClassifications: report.recentClassifications,
    topContinuationSetups: report.topContinuationSetups,
  });
}

