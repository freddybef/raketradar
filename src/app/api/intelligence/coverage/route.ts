import { NextResponse, type NextRequest } from "next/server";
import { runAutonomousDiscoveryScan } from "@/lib/intelligence/autonomousDiscovery";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";

function isAuthorized(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;

  const secrets = [
    process.env.INTELLIGENCE_RUN_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (secrets.length === 0) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-raketradar-secret");

  return secrets.some(
    (secret) => headerSecret === secret || bearer === `Bearer ${secret}`
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await runAutonomousDiscoveryScan({ provider: yahooLiveMarketReactionProvider });
  const weakestExchanges = [...scan.coverageByExchange]
    .sort((a, b) => a.coveragePercent - b.coveragePercent)
    .slice(0, 8);
  const missingByReason = scan.missingTickers.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});
  const missingExamples = scan.missingTickers.slice(0, 40).map((item) => ({
    ticker: item.ticker,
    companyName: item.companyName,
    exchange: item.exchange,
    reason: item.reason,
    detail: item.detail,
    attemptedSymbols: item.attemptedSymbols.slice(0, 8),
    quoteStatus: item.quoteStatus,
    volumeStatus: item.volumeStatus,
    rvolStatus: item.rvolStatus,
  }));

  return NextResponse.json({
    generatedAt: scan.generatedAt,
    universeSize: scan.universeSize,
    scannedCount: scan.scannedCount,
    liveHits: scan.liveHits,
    missingDataCount: scan.missingDataCount,
    coveragePercent: scan.universeSize > 0 ? Math.round((scan.liveHits / scan.universeSize) * 100) : 0,
    coverageByExchange: scan.coverageByExchange,
    weakestExchanges,
    missingByReason,
    missingExamples,
    bucketCounts: scan.bucketCounts,
    topCandidates: scan.candidates.slice(0, 12).map((candidate) => ({
      ticker: candidate.ticker,
      companyName: candidate.companyName,
      exchange: candidate.exchange,
      bucket: candidate.bucket,
      score: candidate.autonomousDiscoveryScore,
      momentum: candidate.reaction.intradayMomentum,
      dayChangePct: candidate.reaction.dayChangePct,
      rvol: candidate.reaction.relativeVolume,
      continuationProbability: candidate.reaction.continuationProbability,
      fadeProbability: candidate.reaction.fadeProbability,
      label: candidate.reaction.label,
      whyDiscovered: candidate.whyDiscovered,
      whyNotRankedHigher: candidate.whyNotRankedHigher,
    })),
  });
}
