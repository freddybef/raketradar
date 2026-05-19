import { NextResponse } from "next/server";
import { getLatestIntelligenceSnapshot } from "@/lib/db/intelligenceRepository";

export async function GET() {
  const stored = await getLatestIntelligenceSnapshot();
  if (stored) {
    return NextResponse.json({
      generatedAt: stored.generatedAt,
      mode: stored.mode,
      alerts: stored.alerts,
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: "empty",
    alerts: [],
  });
}
