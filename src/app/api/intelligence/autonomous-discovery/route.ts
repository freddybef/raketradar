import { NextResponse } from "next/server";
import { runAutonomousDiscoveryScan } from "@/lib/intelligence/autonomousDiscovery";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";
import { getLatestCaseStateSnapshots } from "@/lib/db/runnerRepository";

type DiscoveryPayload = Awaited<ReturnType<typeof runAutonomousDiscoveryScan>> & {
  providerStatus?: {
    status: "live" | "fallback_cached" | "provider_failure" | "partial";
    message: string;
    latestGoodScanAt: string | null;
    attemptedSymbols: number;
    timeoutCount: number;
    partialResults: number;
    successfulDailyBars: number;
    successfulIntradayBars: number;
    failedSymbolSamples: string[];
  };
};
type ProviderStatusKind = NonNullable<DiscoveryPayload["providerStatus"]>["status"];

let latestGoodDiscovery: DiscoveryPayload | null = null;

function providerStatus(result: Awaited<ReturnType<typeof runAutonomousDiscoveryScan>>, status: ProviderStatusKind, message: string) {
  const attempts = result.aliasDebug.flatMap((entry) => entry.attemptedSymbols);
  const successfulDaily = result.aliasDebug.filter((entry) => entry.attemptedSymbols.some((attempt) => attempt.range === "1mo" && attempt.success)).length;
  const successfulIntraday = result.aliasDebug.filter((entry) => entry.attemptedSymbols.some((attempt) => attempt.range === "1d" && attempt.success)).length;
  const timeoutCount = result.aliasDebug.filter((entry) => /timeout|aborted|timed out/i.test(entry.lastError ?? "")).length;
  return {
    status,
    message,
    latestGoodScanAt: latestGoodDiscovery?.generatedAt ?? null,
    attemptedSymbols: attempts.length,
    timeoutCount,
    partialResults: result.liveHits,
    successfulDailyBars: successfulDaily,
    successfulIntradayBars: successfulIntraday,
    failedSymbolSamples: result.aliasDebug
      .filter((entry) => !entry.workingAlias)
      .slice(0, 8)
      .map((entry) => `${entry.ticker}: ${entry.attemptedSymbols.slice(0, 4).map((attempt) => attempt.symbol).join(", ")}`),
  };
}

function emptyCounts() {
  return { HOT: 0, WATCH: 0, STEALTH: 0, PARABOLIC_WATCH: 0, RISK: 0, SUPPRESSED: 0 };
}

async function loadPersistedDiscoveryFallback(): Promise<DiscoveryPayload | null> {
  try {
    const snapshots = await getLatestCaseStateSnapshots(200);
    const discoverySnapshots = snapshots.filter((snapshot) => snapshot.source === "discovery");
    if (discoverySnapshots.length === 0) return null;
    const candidates = discoverySnapshots
      .map((snapshot) => {
        const raw = snapshot.rawPayload as {
          raw?: {
            live?: Record<string, unknown>;
            confirmation?: string;
            invalidation?: string;
          };
          state?: string;
        };
        const live = raw.raw?.live;
        if (!live) return null;
        const fade = Number(live.fadeProbability ?? snapshot.risk ?? 0);
        const continuation = Number(live.continuationProbability ?? 0);
        const rvol = Number(live.relativeVolume ?? 0);
        const momentum = Number(live.intradayMomentumPct ?? live.intradayMomentum ?? 0);
        const dayChangePct = Number(live.dayChangePct ?? momentum);
        const label = String(live.label ?? "DEAD_BOUNCE");
        const bucket = momentum > 20 && rvol >= 1.5 && continuation >= 70 && fade >= 60
          ? "PARABOLIC_WATCH"
          : label === "PARABOLIC_RISK" || fade >= 78
          ? "RISK"
          : snapshot.score >= 75 && rvol >= 1.5 && continuation >= 70
            ? "HOT"
            : rvol >= 1.35 && momentum >= 0.3 && continuation >= 62
              ? "STEALTH"
              : snapshot.score >= 35
                ? "WATCH"
                : "SUPPRESSED";
        return {
          ticker: snapshot.ticker,
          companyName: snapshot.ticker,
          exchange: "",
          sector: "persisted",
          marketCapBucket: "small",
          liquidityBucket: "normal",
          autonomousDiscoveryScore: snapshot.score,
          bucket,
          discoveryConfidence: snapshot.confidence,
          labels: [rvol >= 1.5 ? "unusual volume" : null, continuation >= 70 ? "continuation setup" : null, label].filter(Boolean),
          sourceTags: ["Found autonomously", "Momentum-driven"],
          whyDiscovered: [`RVOL ${rvol}`, `${momentum}% intraday`, `${continuation}% continuation`, "persisted fallback"],
          sourceWeights: {
            rvol: Math.round(rvol * 18),
            acceleration: 0,
            continuation,
            newsVelocity: 0,
            alignment: 0,
            crowdingPenalty: 0,
            fakeSpikePenalty: fade >= 65 ? 16 : 0,
            liquidityPenalty: 0,
          },
          suppressionReasons: fade >= 65 ? ["fake-spike filter"] : [],
          whyNotRankedHigher: [raw.raw?.invalidation ?? "persisted fallback - provider live scan unavailable"].filter(Boolean),
          reaction: {
            ticker: snapshot.ticker,
            companyName: snapshot.ticker,
            exchange: "",
            asOf: new Date().toISOString(),
            price: Number(live.price ?? 0),
            volume: Number(live.volume ?? 0),
            dayChangePct,
            intradayMomentumPct: momentum,
            intradayMomentum: momentum,
            relativeVolume: rvol,
            gapPercent: Number(live.gapPercent ?? 0),
            acceleration: Number(live.acceleration ?? 0),
            volatilityExpansion: Number(live.volatilityExpansion ?? 0),
            squeezeProbability: Number(live.squeezeProbability ?? 0),
            continuationProbability: continuation,
            fadeProbability: fade,
            intradayStrengthScore: Number(live.intradayStrengthScore ?? 0),
            abnormalMoveScore: Number(live.abnormalMoveScore ?? 0),
            marketAggression: Number(live.marketAggression ?? 0),
            activeTraderAttention: Number(live.activeTraderAttention ?? 0),
            label,
            flags: Array.isArray(live.flags) ? live.flags.map(String) : [],
            reason: String(live.reason ?? "Persisted discovery fallback"),
          },
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .slice(0, 16);
    if (candidates.length === 0) return null;
    const bucketCounts = { ...emptyCounts() };
    for (const candidate of candidates) bucketCounts[candidate.bucket as keyof typeof bucketCounts] += 1;
    const generatedAt = new Date().toISOString();
    return {
      generatedAt,
      universeSize: 125,
      scannedCount: 125,
      liveHits: candidates.length,
      missingDataCount: Math.max(0, 125 - candidates.length),
      coverageByExchange: [],
      missingTickers: [],
      aliasDebug: [],
      prefilterDebug: {
        enabled: false,
        maxTickers: 400,
        baseUniverseSize: 125,
        prefilterCandidates: 0,
        finalSelectedCount: 0,
        fallbackReason: "persisted fallback",
        topSourceReasons: [],
        finalScannedCount: candidates.length,
        selectedSample: candidates.slice(0, 20).map((candidate) => candidate.ticker),
      },
      suppressedByReason: [],
      bucketCounts,
      scanned: candidates.length,
      liveReactions: candidates.map((candidate) => candidate.reaction),
      candidates,
      hotMovers: candidates.filter((candidate) => candidate.bucket === "HOT").slice(0, 5),
      watchMovers: candidates.filter((candidate) => candidate.bucket === "WATCH").slice(0, 5),
      stealthMovers: candidates.filter((candidate) => candidate.bucket === "STEALTH").slice(0, 5),
      continuationLeaders: candidates.filter((candidate) => candidate.bucket !== "RISK" && candidate.bucket !== "PARABOLIC_WATCH").slice(0, 5),
      highRiskParabolicMovers: candidates.filter((candidate) => candidate.bucket === "PARABOLIC_WATCH" || candidate.bucket === "RISK").slice(0, 5),
      suppressedMovers: candidates.filter((candidate) => candidate.bucket === "SUPPRESSED").slice(0, 8),
      topCandidatesByBucket: {
        HOT: candidates.filter((candidate) => candidate.bucket === "HOT").slice(0, 5),
        WATCH: candidates.filter((candidate) => candidate.bucket === "WATCH").slice(0, 5),
        STEALTH: candidates.filter((candidate) => candidate.bucket === "STEALTH").slice(0, 5),
        PARABOLIC_WATCH: candidates.filter((candidate) => candidate.bucket === "PARABOLIC_WATCH").slice(0, 5),
        RISK: candidates.filter((candidate) => candidate.bucket === "RISK").slice(0, 5),
        SUPPRESSED: candidates.filter((candidate) => candidate.bucket === "SUPPRESSED").slice(0, 8),
      },
      missedMovers: [],
      providerStatus: {
        status: "fallback_cached",
        message: "Live provider gav 0 träffar. Visar senaste persistade discovery/case-state snapshot.",
        latestGoodScanAt: generatedAt,
        attemptedSymbols: 0,
        timeoutCount: 0,
        partialResults: candidates.length,
        successfulDailyBars: 0,
        successfulIntradayBars: 0,
        failedSymbolSamples: [],
      },
    } as DiscoveryPayload;
  } catch (error) {
    console.error("[RaketRadar Discovery] persisted fallback failed", {
      message: error instanceof Error ? error.message : "Unknown persisted fallback error",
    });
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const extraTickers = (url.searchParams.get("extra") ?? "")
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
  try {
    const result = await runAutonomousDiscoveryScan({ provider: yahooLiveMarketReactionProvider, extraTickers });
    const payload: DiscoveryPayload = {
      ...result,
      providerStatus: providerStatus(
        result,
        result.liveHits === 0 ? "provider_failure" : result.liveHits < Math.max(10, Math.round(result.universeSize * 0.2)) ? "partial" : "live",
        result.liveHits === 0
          ? "Provider gav 0 live hits. Tolkas som provider failure, inte som tom marknad."
          : result.liveHits < Math.max(10, Math.round(result.universeSize * 0.2))
            ? "Provider gav partial results. Visa med försiktighet."
            : "Live provider scan OK."
      ),
    };

    if (payload.liveHits > 0) {
      latestGoodDiscovery = payload;
      return NextResponse.json(payload);
    }

    console.error("[RaketRadar Discovery] zero live hits", {
      attemptedSymbols: payload.providerStatus?.attemptedSymbols ?? 0,
      timeoutCount: payload.providerStatus?.timeoutCount ?? 0,
      missingDataCount: payload.missingDataCount,
      successfulDailyBars: payload.providerStatus?.successfulDailyBars ?? 0,
      successfulIntradayBars: payload.providerStatus?.successfulIntradayBars ?? 0,
      failedSymbolSamples: payload.providerStatus?.failedSymbolSamples ?? [],
      latestGoodScanAt: latestGoodDiscovery?.generatedAt ?? null,
    });

    if (latestGoodDiscovery) {
      return NextResponse.json({
        ...latestGoodDiscovery,
        providerStatus: {
          ...latestGoodDiscovery.providerStatus,
          status: "fallback_cached",
          message: "Live provider gav 0 träffar. Visar senaste lyckade discovery-scan.",
          latestGoodScanAt: latestGoodDiscovery.generatedAt,
          attemptedSymbols: payload.providerStatus?.attemptedSymbols ?? 0,
          timeoutCount: payload.providerStatus?.timeoutCount ?? 0,
          partialResults: latestGoodDiscovery.liveHits,
          successfulDailyBars: payload.providerStatus?.successfulDailyBars ?? 0,
          successfulIntradayBars: payload.providerStatus?.successfulIntradayBars ?? 0,
          failedSymbolSamples: payload.providerStatus?.failedSymbolSamples ?? [],
        },
      } satisfies DiscoveryPayload);
    }
    const persistedFallback = await loadPersistedDiscoveryFallback();
    if (persistedFallback) return NextResponse.json(persistedFallback);

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown autonomous discovery error";
    console.error("[RaketRadar Discovery] provider failure", {
      message,
      stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
      latestGoodScanAt: latestGoodDiscovery?.generatedAt ?? null,
    });
    if (latestGoodDiscovery) {
      return NextResponse.json({
        ...latestGoodDiscovery,
        providerStatus: {
          status: "fallback_cached",
          message: `Provider failade: ${message}. Visar senaste lyckade discovery-scan.`,
          latestGoodScanAt: latestGoodDiscovery.generatedAt,
          attemptedSymbols: latestGoodDiscovery.providerStatus?.attemptedSymbols ?? 0,
          timeoutCount: latestGoodDiscovery.providerStatus?.timeoutCount ?? 0,
          partialResults: latestGoodDiscovery.liveHits,
          successfulDailyBars: latestGoodDiscovery.providerStatus?.successfulDailyBars ?? 0,
          successfulIntradayBars: latestGoodDiscovery.providerStatus?.successfulIntradayBars ?? 0,
          failedSymbolSamples: latestGoodDiscovery.providerStatus?.failedSymbolSamples ?? [],
        },
      } satisfies DiscoveryPayload);
    }
    const persistedFallback = await loadPersistedDiscoveryFallback();
    if (persistedFallback) return NextResponse.json(persistedFallback);
    return NextResponse.json(
      {
        error: "Autonomous Discovery provider failure",
        details: message,
        providerStatus: {
          status: "provider_failure",
          message,
          latestGoodScanAt: null,
          attemptedSymbols: 0,
          timeoutCount: 0,
          partialResults: 0,
          successfulDailyBars: 0,
          successfulIntradayBars: 0,
          failedSymbolSamples: [],
        },
      },
      { status: 503 }
    );
  }
}
