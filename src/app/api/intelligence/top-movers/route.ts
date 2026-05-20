import { NextResponse } from "next/server";
import { getLatestIntelligenceSnapshot } from "@/lib/db/intelligenceRepository";

export async function GET() {
  const stored = await getLatestIntelligenceSnapshot();
  const report = stored?.report;

  return NextResponse.json({
    generatedAt: stored?.generatedAt ?? new Date().toISOString(),
    mode: stored?.mode ?? "empty",
    topRankedCases: report?.topRanked ?? [],
    strongestNarratives: report?.strongestNarratives ?? [],
    unusualActivity: report?.unusualActivity ?? [],
    highestSqueezeScore: report?.highestSqueezeScore ?? { ticker: "-", score: 0, factors: [] },
    strongestInsiderAccumulation: report?.strongestInsiderAccumulation ?? { ticker: "-", score: 0, reasons: [] },
  });
}
