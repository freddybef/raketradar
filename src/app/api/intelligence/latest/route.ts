import { NextResponse } from "next/server";
import { getLatestIntelligenceSnapshot } from "@/lib/db/intelligenceRepository";

export async function GET() {
  const stored = await getLatestIntelligenceSnapshot();
  if (stored) return NextResponse.json(stored);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: "empty",
    report: {
      topRanked: [],
      strongestNarratives: [],
      unusualActivity: [],
      highestSqueezeScore: { ticker: "-", score: 0, factors: [] },
      strongestInsiderAccumulation: { ticker: "-", score: 0, reasons: [] },
      inputs: [],
    },
    signalFeed: [],
    alerts: [],
  });
}
