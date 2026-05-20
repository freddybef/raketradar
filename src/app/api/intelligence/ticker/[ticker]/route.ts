import { NextResponse, type NextRequest } from "next/server";
import { getLatestIntelligenceSnapshot } from "@/lib/db/intelligenceRepository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const snapshot =
    (await getLatestIntelligenceSnapshot()) ?? {
      generatedAt: new Date().toISOString(),
      mode: "empty" as const,
      report: { topRanked: [] },
      signalFeed: [],
      alerts: [],
    };
  const normalized = ticker.toUpperCase();

  return NextResponse.json({
    ticker: normalized,
    ranked: snapshot.report.topRanked.find((item) => item.ticker === normalized) ?? null,
    feed: snapshot.signalFeed.filter((item) => item.ticker === normalized),
    alerts: snapshot.alerts.filter((item) => item.ticker === normalized),
    generatedAt: snapshot.generatedAt,
    mode: snapshot.mode,
  });
}
