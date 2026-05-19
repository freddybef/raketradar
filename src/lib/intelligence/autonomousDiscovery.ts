import type { LiveMarketReaction, LiveMarketReactionProvider } from "@/lib/intelligence/liveMarketReaction";
import { calculateLiveMarketReactions } from "@/lib/intelligence/liveMarketReaction";
import { getSwedishEquityUniverse, type SwedishEquityUniverseEntry } from "@/lib/market/swedishEquityUniverse";
import { getYahooAliasDebugSnapshot, resetYahooAliasDebug, type YahooAliasDebugEntry } from "@/lib/providers/liveMarketReactionProvider";

export interface AutonomousDiscoveryCandidate {
  ticker: string;
  companyName: string;
  exchange: string;
  sector: string;
  marketCapBucket: string;
  liquidityBucket: string;
  autonomousDiscoveryScore: number;
  bucket: DiscoveryBucket;
  discoveryConfidence: number;
  labels: string[];
  sourceTags: Array<"Found autonomously" | "Portfolio-linked" | "News-driven" | "Momentum-driven">;
  whyDiscovered: string[];
  sourceWeights: {
    rvol: number;
    acceleration: number;
    continuation: number;
    newsVelocity: number;
    alignment: number;
    crowdingPenalty: number;
    fakeSpikePenalty: number;
    liquidityPenalty: number;
  };
  suppressionReasons: string[];
  whyNotRankedHigher: string[];
  reaction: LiveMarketReaction;
}

export type DiscoveryBucket = "HOT" | "WATCH" | "STEALTH" | "PARABOLIC_WATCH" | "RISK" | "SUPPRESSED";

export interface MissedMover {
  ticker: string;
  companyName: string;
  exchange: string;
  movePercent: number;
  relativeVolume: number;
  reason: "no data" | "feed latency" | "unresolved ticker" | "fake-spike filter" | "no continuation" | "no liquidity" | "no catalyst" | "ranking suppression";
  detail: string;
  reaction?: LiveMarketReaction;
}

export interface AutonomousDiscoveryResult {
  generatedAt: string;
  universeSize: number;
  scannedCount: number;
  liveHits: number;
  missingDataCount: number;
  coverageByExchange: Array<{ exchange: string; total: number; liveHits: number; missing: number; coveragePercent: number }>;
  missingTickers: Array<{ ticker: string; companyName: string; exchange: string; sector: string; reason: "no_price_data" | "identity_blocked" | "provider_failed" }>;
  aliasDebug: YahooAliasDebugEntry[];
  suppressedByReason: Array<{ reason: string; count: number }>;
  bucketCounts: Record<DiscoveryBucket, number>;
  scanned: number;
  candidates: AutonomousDiscoveryCandidate[];
  hotMovers: AutonomousDiscoveryCandidate[];
  watchMovers: AutonomousDiscoveryCandidate[];
  stealthMovers: AutonomousDiscoveryCandidate[];
  continuationLeaders: AutonomousDiscoveryCandidate[];
  highRiskParabolicMovers: AutonomousDiscoveryCandidate[];
  suppressedMovers: AutonomousDiscoveryCandidate[];
  topCandidatesByBucket: Record<DiscoveryBucket, AutonomousDiscoveryCandidate[]>;
  missedMovers: MissedMover[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function liquidityPenalty(entry: SwedishEquityUniverseEntry, reaction: LiveMarketReaction) {
  if (entry.liquidityBucket === "thin" && reaction.relativeVolume < 1.1 && reaction.continuationProbability < 55) return 14;
  if (entry.liquidityBucket === "thin" && reaction.relativeVolume < 1.5) return 8;
  if (entry.liquidityBucket === "thin") return 3;
  return 0;
}

function isExtremeParabolic(reaction: LiveMarketReaction) {
  return reaction.intradayMomentum > 25 && reaction.fadeProbability >= 55;
}

function isParabolicWatch(reaction: LiveMarketReaction) {
  return (
    reaction.fadeProbability >= 60 &&
    (
      reaction.intradayMomentum > 20 ||
      (reaction.label === "PARABOLIC_RISK" && reaction.intradayMomentum >= 12)
    ) &&
    (reaction.relativeVolume >= 1.1 || reaction.label === "PARABOLIC_RISK") &&
    reaction.continuationProbability >= 65
  );
}

function isMomentumQualityLabel(label: string) {
  return ["EARLY_MOMENTUM", "CONTINUATION", "EARLY_CONTINUATION", "PULLBACK_VALID", "REACCELERATION_WATCH", "COOLING_BUT_VALID", "LATE_BREAKOUT"].includes(label);
}

function candidateDiagnostics(entry: SwedishEquityUniverseEntry, reaction: LiveMarketReaction, score: number, liquidity: number) {
  const diagnostics = [
    reaction.relativeVolume >= 1.5 ? "volume confirmed" : "needs stronger RVOL",
    reaction.continuationProbability >= 65 ? "continuation confirmed" : "needs VWAP/next candle confirmation",
    entry.liquidityBucket === "thin" && reaction.relativeVolume >= 1.5 ? "liquidity weak but acceptable" : null,
    reaction.fadeProbability >= 60 ? "fake-spike risk" : null,
    reaction.fadeProbability < 45 && reaction.squeezeProbability >= 65 ? "squeeze-build without extreme fade" : null,
    score < 70 ? "missing news confirmation" : null,
    liquidity > 0 && reaction.relativeVolume < 1.5 ? "liquidity weak" : null,
  ].filter((reason): reason is string => Boolean(reason));
  return diagnostics.slice(0, 4);
}

function scoreCandidate(entry: SwedishEquityUniverseEntry, reaction: LiveMarketReaction): AutonomousDiscoveryCandidate {
  const fakeSpikePenalty = reaction.fadeProbability >= 78 ? 28 : reaction.fadeProbability >= 65 ? 16 : reaction.fadeProbability >= 55 ? 8 : 0;
  const crowdingPenalty = isExtremeParabolic(reaction) ? 18 : reaction.intradayMomentum >= 25 ? 10 : 0;
  const liquidity = liquidityPenalty(entry, reaction);
  const earlyContinuationBonus =
    reaction.relativeVolume >= 1.25 && reaction.continuationProbability >= 68 && reaction.intradayMomentum >= 2 && reaction.intradayMomentum <= 16 ? 22 : 0;
  const stealthBonus =
    reaction.relativeVolume >= 1.5 && reaction.intradayMomentum > 0.4 && reaction.intradayMomentum < 5 && reaction.continuationProbability >= 62 && reaction.fadeProbability < 55 ? 8 : 0;
  const squeezeNoFadeBonus = reaction.squeezeProbability >= 65 && reaction.fadeProbability < 55 ? 10 : 0;
  const expansionBonus =
    reaction.intradayMomentum >= 3 && reaction.relativeVolume >= 1.2
      ? Math.min(24, reaction.intradayMomentum * 1.5 + reaction.relativeVolume * 3)
      : reaction.intradayMomentum < 1.2
        ? -14
        : 0;
  const momentumQualityBonus = isMomentumQualityLabel(reaction.label) ? 12 : 0;
  const sourceWeights = {
    rvol: clamp(Math.min(reaction.relativeVolume, 5) * 16),
    acceleration: clamp(Math.max(0, reaction.acceleration) * 9),
    continuation: clamp(reaction.continuationProbability * 0.9),
    newsVelocity: 0,
    alignment: (reaction.flags.includes("squeeze build-up") && reaction.intradayMomentum >= 1.5 ? 10 : 0) + earlyContinuationBonus + stealthBonus + squeezeNoFadeBonus + expansionBonus + momentumQualityBonus,
    crowdingPenalty,
    fakeSpikePenalty,
    liquidityPenalty: liquidity,
  };
  const raw =
    sourceWeights.rvol * 0.28 +
    sourceWeights.acceleration * 0.2 +
    sourceWeights.continuation * 0.42 +
    sourceWeights.alignment * 0.9 +
    reaction.marketAggression * 0.36 +
    Math.max(0, reaction.intradayMomentum) * 0.9 -
    sourceWeights.fakeSpikePenalty -
    sourceWeights.crowdingPenalty -
    sourceWeights.liquidityPenalty;
  const expansionCap =
    reaction.intradayMomentum < 1.5
      ? 68
      : reaction.intradayMomentum < 2
        ? 78
        : 100;
  const score = clamp(Math.min(raw, expansionCap));
  const labels = [
    reaction.relativeVolume >= 1.5 ? "unusual volume" : null,
    reaction.continuationProbability >= 70 ? "continuation setup" : null,
    reaction.flags.includes("stealth accumulation") ? "stealth mover" : null,
    reaction.squeezeProbability >= 70 ? "squeeze-build" : null,
    isParabolicWatch(reaction) ? "parabolic no-chase" : null,
    isParabolicWatch(reaction) ? "re-entry watch" : null,
    reaction.fadeProbability >= 70 ? "fake-spike risk" : null,
    reaction.label === "EARLY_MOMENTUM" ? "early momentum" : null,
    reaction.label === "CONTINUATION" ? "continuation quality" : null,
    reaction.label === "PULLBACK_VALID" ? "pullback valid" : null,
    reaction.label === "REACCELERATION_WATCH" ? "reacceleration watch" : null,
    reaction.label === "COOLING_BUT_VALID" ? "cooling but valid" : null,
    reaction.label,
  ].filter((label): label is string => Boolean(label));
  const suppressionReasons = [
    fakeSpikePenalty > 0 ? "fake-spike filter" : null,
    crowdingPenalty > 0 ? "crowding/parabolic penalty" : null,
    liquidity > 0 && reaction.relativeVolume < 1.5 ? "liquidity penalty" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const bucket = classifyDiscoveryBucket({ entry, reaction, score, suppressionReasons });
  const diagnostics = candidateDiagnostics(entry, reaction, score, liquidity);

  return {
    ticker: reaction.ticker,
    companyName: reaction.companyName,
    exchange: reaction.exchange,
    sector: entry.sector,
    marketCapBucket: entry.marketCapBucket,
    liquidityBucket: entry.liquidityBucket,
    autonomousDiscoveryScore: score,
    bucket,
    discoveryConfidence: clamp(score * 0.7 + reaction.activeTraderAttention * 0.3),
    labels,
    sourceTags: ["Found autonomously", "Momentum-driven"],
    whyDiscovered: [
      `RVOL ${reaction.relativeVolume}`,
      `${reaction.intradayMomentum}% intraday`,
      `${reaction.continuationProbability}% continuation`,
      `${reaction.marketAggression}/100 market aggression`,
    ],
    sourceWeights,
    suppressionReasons,
    whyNotRankedHigher: bucket === "HOT" ? diagnostics.filter((item) => item.includes("news") || item.includes("VWAP")) : [...suppressionReasons, ...diagnostics],
    reaction,
  };
}

function classifyDiscoveryBucket(input: {
  entry: SwedishEquityUniverseEntry;
  reaction: LiveMarketReaction;
  score: number;
  suppressionReasons: string[];
}): DiscoveryBucket {
  if (isParabolicWatch(input.reaction)) return "PARABOLIC_WATCH";
  if (input.reaction.label === "FAKE_SPIKE" || input.reaction.fadeProbability >= 86 || isExtremeParabolic(input.reaction)) return "RISK";
  if (
    input.score >= 58 &&
    input.reaction.continuationProbability >= 66 &&
    input.reaction.intradayMomentum >= 2 &&
    input.reaction.relativeVolume >= 1.15 &&
    input.reaction.fadeProbability < 72 &&
    isMomentumQualityLabel(input.reaction.label)
  ) return "HOT";
  if (
    input.reaction.relativeVolume >= 1.35 &&
    input.reaction.intradayMomentum >= 0.3 &&
    input.reaction.intradayMomentum < 3.5 &&
    input.reaction.fadeProbability < 55 &&
    (input.reaction.continuationProbability >= 62 || input.reaction.marketAggression >= 45)
  ) return "STEALTH";
  if (
    input.score >= 58 &&
    input.reaction.continuationProbability >= 66 &&
    input.reaction.relativeVolume >= 1.2 &&
    input.reaction.fadeProbability < 68 &&
    input.reaction.intradayMomentum >= 2.5 &&
    input.reaction.intradayMomentum <= 18
  ) return "HOT";
  if (
    input.reaction.relativeVolume >= 1.35 &&
    input.reaction.intradayMomentum >= 0.3 &&
    input.reaction.intradayMomentum < 6 &&
    input.reaction.fadeProbability < 55 &&
    (input.reaction.continuationProbability >= 62 || input.reaction.marketAggression >= 45)
  ) return "STEALTH";
  if (input.score >= 35 || input.reaction.marketAggression >= 40 || input.reaction.continuationProbability >= 56 || input.reaction.relativeVolume >= 1.25) return "WATCH";
  return "SUPPRESSED";
}

function missedReason(candidate: AutonomousDiscoveryCandidate): MissedMover["reason"] {
  if (candidate.reaction.fadeProbability >= 70) return "fake-spike filter";
  if (candidate.reaction.continuationProbability < 55) return "no continuation";
  if (candidate.liquidityBucket === "thin" && candidate.reaction.relativeVolume < 1.5) return "no liquidity";
  if (candidate.autonomousDiscoveryScore < 45) return "ranking suppression";
  return "no catalyst";
}

export async function runAutonomousDiscoveryScan(input: {
  provider: LiveMarketReactionProvider;
  extraTickers?: string[];
}): Promise<AutonomousDiscoveryResult> {
  const extraEntries = (input.extraTickers ?? []).map((ticker): SwedishEquityUniverseEntry => ({
    ticker: ticker.toUpperCase().trim(),
    companyName: ticker.toUpperCase().trim(),
    exchange: "Sweden",
    sector: "manual",
    marketCapBucket: "small",
    liquidityBucket: "normal",
    verified: true,
  })).filter((entry) => entry.ticker.length > 0);
  const merged = new Map<string, SwedishEquityUniverseEntry>();
  [...getSwedishEquityUniverse().filter((entry) => entry.verified), ...extraEntries].forEach((entry) => merged.set(entry.ticker, entry));
  const universe = [...merged.values()];
  resetYahooAliasDebug();
  const reactions = await calculateLiveMarketReactions({
    symbols: universe.map((entry) => entry.ticker),
    provider: input.provider,
    universe,
    includeQuiet: true,
  });
  const entryByTicker = new Map(universe.map((entry) => [entry.ticker, entry]));
  const reactionByTicker = new Map(reactions.map((reaction) => [reaction.ticker, reaction]));
  const candidates = reactions
    .map((reaction) => {
      const entry = entryByTicker.get(reaction.ticker);
      if (!entry) return null;
      return scoreCandidate(entry, reaction);
    })
    .filter((candidate): candidate is AutonomousDiscoveryCandidate => Boolean(candidate))
    .sort((a, b) => b.autonomousDiscoveryScore - a.autonomousDiscoveryScore);
  const buckets = {
    HOT: uniqueByTicker(candidates.filter((candidate) => candidate.bucket === "HOT").slice(0, 5)),
    WATCH: uniqueByTicker(candidates.filter((candidate) => candidate.bucket === "WATCH").slice(0, 5)),
    STEALTH: uniqueByTicker(candidates.filter((candidate) => candidate.bucket === "STEALTH").slice(0, 5)),
    PARABOLIC_WATCH: uniqueByTicker(candidates.filter((candidate) => candidate.bucket === "PARABOLIC_WATCH").slice(0, 5)),
    RISK: uniqueByTicker(candidates.filter((candidate) => candidate.bucket === "RISK").slice(0, 5)),
    SUPPRESSED: uniqueByTicker(candidates.filter((candidate) => candidate.bucket === "SUPPRESSED").slice(0, 8)),
  } satisfies Record<DiscoveryBucket, AutonomousDiscoveryCandidate[]>;
  const ranked = uniqueByTicker([...buckets.HOT, ...buckets.WATCH, ...buckets.STEALTH, ...buckets.PARABOLIC_WATCH, ...buckets.RISK, ...buckets.SUPPRESSED]).slice(0, 16);
  const missedMovers = candidates
    .filter((candidate) => candidate.reaction.abnormalMoveScore >= 70 && candidate.autonomousDiscoveryScore < 40)
    .map((candidate) => ({
      ticker: candidate.ticker,
      companyName: candidate.companyName,
      exchange: candidate.exchange,
      movePercent: candidate.reaction.intradayMomentum,
      relativeVolume: candidate.reaction.relativeVolume,
      reason: candidate.suppressionReasons[0] === "liquidity penalty" ? "no liquidity" : missedReason(candidate),
      detail: candidate.whyNotRankedHigher.join(", ") || "ranked lower than stronger candidates",
      reaction: candidate.reaction,
    }));

  const coverageByExchange = [...new Set(universe.map((entry) => entry.exchange))].map((exchange) => {
    const scoped = universe.filter((entry) => entry.exchange === exchange);
    const liveHits = scoped.filter((entry) => reactionByTicker.has(entry.ticker)).length;
    return {
      exchange,
      total: scoped.length,
      liveHits,
      missing: scoped.length - liveHits,
      coveragePercent: scoped.length > 0 ? Math.round((liveHits / scoped.length) * 100) : 0,
    };
  });
  const missingTickers = universe
    .filter((entry) => !reactionByTicker.has(entry.ticker))
    .map((entry) => ({
      ticker: entry.ticker,
      companyName: entry.companyName,
      exchange: entry.exchange,
      sector: entry.sector,
      reason: "no_price_data" as const,
    }))
    .sort((a, b) => a.exchange.localeCompare(b.exchange) || a.ticker.localeCompare(b.ticker));
  const suppressedByReason = countReasons(candidates.flatMap((candidate) => candidate.suppressionReasons.length > 0 ? candidate.suppressionReasons : candidate.bucket === "SUPPRESSED" ? ["ranking suppression"] : []));
  const bucketCounts = {
    HOT: candidates.filter((candidate) => candidate.bucket === "HOT").length,
    WATCH: candidates.filter((candidate) => candidate.bucket === "WATCH").length,
    STEALTH: candidates.filter((candidate) => candidate.bucket === "STEALTH").length,
    PARABOLIC_WATCH: candidates.filter((candidate) => candidate.bucket === "PARABOLIC_WATCH").length,
    RISK: candidates.filter((candidate) => candidate.bucket === "RISK").length,
    SUPPRESSED: candidates.filter((candidate) => candidate.bucket === "SUPPRESSED").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    universeSize: universe.length,
    scannedCount: universe.length,
    liveHits: reactions.length,
    missingDataCount: Math.max(0, universe.length - reactions.length),
    coverageByExchange,
    missingTickers,
    aliasDebug: getYahooAliasDebugSnapshot(),
    suppressedByReason,
    bucketCounts,
    scanned: reactions.length,
    candidates: ranked,
    hotMovers: buckets.HOT,
    watchMovers: buckets.WATCH,
    stealthMovers: buckets.STEALTH,
    continuationLeaders: uniqueByTicker(candidates.filter((candidate) => candidate.reaction.continuationProbability >= 60 && candidate.bucket !== "RISK" && candidate.bucket !== "PARABOLIC_WATCH").sort((a, b) => b.reaction.continuationProbability - a.reaction.continuationProbability)).slice(0, 5),
    highRiskParabolicMovers: uniqueByTicker([...buckets.PARABOLIC_WATCH, ...buckets.RISK]).slice(0, 5),
    suppressedMovers: buckets.SUPPRESSED,
    topCandidatesByBucket: buckets,
    missedMovers,
  };
}

function uniqueByTicker<T extends { ticker: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.ticker)) return false;
    seen.add(item.ticker);
    return true;
  });
}

function countReasons(reasons: string[]) {
  const counts = new Map<string, number>();
  reasons.forEach((reason) => counts.set(reason, (counts.get(reason) ?? 0) + 1));
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}
