import type { StoredInsiderEvent } from "@/lib/db/intelligenceRepository";
import { evaluateDoNotChase, type DoNotChaseResult } from "@/lib/intelligence/doNotChaseFilter";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import { buildOpeningPlan, type OpeningPlan } from "@/lib/intelligence/openingPlan";
import type { OvernightContext } from "@/lib/intelligence/overnightContext";
import type { PreOpenClassification } from "@/lib/intelligence/preOpenClassifier";
import { calculatePreOpenEdgeScore, type PreOpenEdgeScore } from "@/lib/intelligence/preOpenEdgeScore";
import { historicalStatsForSetup } from "@/lib/intelligence/performanceAnalytics";
import type { DetailedSignalOutcome, OutcomeLabel } from "@/lib/intelligence/outcomeTracker";
import { normalizeOutcomeClassification } from "@/lib/intelligence/outcomeTracker";
import { resolveTickerIdentity, type TickerValidationResult } from "@/lib/market/tickerIdentity";
import type { LiveMarketReaction } from "@/lib/intelligence/liveMarketReaction";

export interface WarRoomOutcomeRow {
  ticker: string;
  horizon: string;
  maxUpsidePercent: number | null;
  downsidePercent: number | null;
  followThroughQuality: number | null;
  catalystMix: string[];
  detailed?: DetailedSignalOutcome;
}

export interface WarRoomNarrativeRow {
  ticker: string;
  primaryNarrative: string;
  narrativeStrength: number;
  trendDirection: string;
}

export interface WarRoomProviderRun {
  provider: string;
  status: string;
  latencyMs: number;
  fetchedCount: number;
  savedCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface MorningWarRoomInput {
  insiderEvents: StoredInsiderEvent[];
  newsClassifications: PreOpenClassification[];
  ranked: Array<{ ticker: string; totalScore: number; conviction: number; tags: string[]; reasons: string[]; risks: string[] }>;
  signalFeed: SignalFeedItem[];
  outcomes: WarRoomOutcomeRow[];
  narratives: WarRoomNarrativeRow[];
  providerRuns: WarRoomProviderRun[];
  liveReactions?: LiveMarketReaction[];
  overnightContext?: OvernightContext;
  sourceHealth?: Array<{
    source: string;
    status: string;
    latencyMs: number;
    fetched: number;
    accepted: number;
    rejected: number;
    duplicateCount: number;
    parseErrors: number;
    freshness: string;
    error?: string;
  }>;
  dedupeStats?: {
    fetched: number;
    accepted: number;
    rejected: number;
    duplicateCount: number;
    parseErrors: number;
  };
}

export interface MorningWarRoomCase {
  ticker: string;
  trigger: string;
  catalyst: string;
  whyNow: string;
  preOpenScore: number;
  openingAction: OpeningPlan["action"];
  openingPlan: OpeningPlan;
  risk: number;
  confidence: number;
  invalidation: string;
  tags: string[];
  scoringBreakdown: PreOpenEdgeScore["breakdown"];
  rankedInReasons: string[];
  newsSource?: string;
  freshness?: number;
  catalystStrength?: number;
  overnightAlignment: number;
  exchange: string;
  companyName: string;
  tickerConfidence: number;
  historicalSetupWinrate: number;
  triggerComboGrade: "A" | "B" | "C" | "D" | "N/A";
  falsePositiveRisk: number;
  adaptiveConfidenceDelta: number;
  similarPastSetups: string[];
  similarSetupOutcome?: string;
  avgContinuation: number;
  avgFadeRisk: number;
  liveMarketReaction?: LiveMarketReaction;
}

export interface RejectedPreOpenCandidate {
  ticker: string;
  trigger: string;
  preOpenScore: number;
  rejectedBecause: string[];
  scoringBreakdown: PreOpenEdgeScore["breakdown"];
  doNotChase: DoNotChaseResult;
  tickerValidation: TickerValidationResult;
}

export interface MorningWarRoomResult {
  generatedAt: string;
  mode: "stored" | "fallback";
  topPreOpenSetups: MorningWarRoomCase[];
  rejectedCandidates: RejectedPreOpenCandidate[];
  acceptedCount: number;
  rejectedCount: number;
  overnightCatalysts: string[];
  stealthSignals: string[];
  highRiskFakeMovers: string[];
  openingSqueezeCandidates: string[];
  overnightRegime: OvernightContext;
  sourceHealth: MorningWarRoomInput["sourceHealth"];
  dedupeStats: NonNullable<MorningWarRoomInput["dedupeStats"]>;
  tickerValidation: {
    tickerMismatches: Array<{ ticker: string; message: string; confidence: number }>;
    exchangeConflicts: Array<{ ticker: string; exchange: string; message: string; confidence: number }>;
    unresolvedSymbols: Array<{ ticker: string; message: string; confidence: number }>;
    confidenceBreakdown: Array<{
      ticker: string;
      displayTicker: string;
      exchange: string;
      confidence: number;
      displayable: boolean;
      issues: string[];
      rejectionReasons: TickerValidationResult["rejectionReasons"];
      breakdown: TickerValidationResult["confidenceBreakdown"];
    }>;
  };
  feedStatus: {
    status: "healthy" | "missing" | "stale" | "error";
    message: string;
    latestNewsFetch: string | null;
    acceptedNews: number;
    rejectedNews: number;
  };
}

function uniqueTickers(input: MorningWarRoomInput) {
  return [
    ...new Set([
      ...input.ranked.map((item) => item.ticker),
      ...input.insiderEvents.map((item) => item.ticker),
      ...input.newsClassifications.map((item) => item.ticker),
      ...input.signalFeed.map((item) => item.ticker),
      ...(input.liveReactions ?? []).map((item) => item.ticker),
    ]),
  ];
}

function continuationRate(ticker: string, outcomes: WarRoomOutcomeRow[]) {
  const scoped = outcomes.filter((row) => row.ticker === ticker && row.followThroughQuality !== null);
  if (scoped.length === 0) return 50;
  const wins = scoped.filter((row) => (row.followThroughQuality ?? 0) >= 60);
  return Math.round((wins.length / scoped.length) * 100);
}

function falsePositiveRatio(ticker: string, outcomes: WarRoomOutcomeRow[]) {
  const scoped = outcomes.filter((row) => row.ticker === ticker && row.maxUpsidePercent !== null);
  if (scoped.length === 0) return 0;
  const falsePositives = scoped.filter(
    (row) => (row.maxUpsidePercent ?? 0) < 3 && (row.downsidePercent ?? 0) <= -4
  );
  return Math.round((falsePositives.length / scoped.length) * 100);
}

function rawOutcomeLabel(row: WarRoomOutcomeRow): OutcomeLabel {
  const maxUpside = row.maxUpsidePercent ?? 0;
  const downside = row.downsidePercent ?? 0;
  const quality = row.followThroughQuality ?? 0;
  if (maxUpside >= 18 && quality >= 72 && downside > -8) return "EXPLODED";
  if (maxUpside >= 12 && quality >= 55) return "SQUEEZE";
  if (quality >= 60 || maxUpside >= 8) return "CONTINUED";
  if (maxUpside >= 5 && quality < 45) return "FADED";
  if (maxUpside < 3 && downside <= -4) return "FAILED";
  return "DEAD";
}

function rawComboKey(row: WarRoomOutcomeRow) {
  const mix = row.catalystMix.length > 0 ? row.catalystMix : ["signal"];
  return mix.slice(0, 4).join("+").toLowerCase();
}

function syntheticDetailedOutcome(row: WarRoomOutcomeRow): DetailedSignalOutcome | null {
  if (row.maxUpsidePercent === null || row.followThroughQuality === null) return null;
  const maxMovePct = Math.round(row.maxUpsidePercent * 10) / 10;
  const fadePct = Math.round(Math.abs(row.downsidePercent ?? 0) * 10) / 10;
  const outcomeLabel = rawOutcomeLabel(row);
  const triggerType = rawComboKey(row);
  const insiderActivity = row.catalystMix.some((item) => /insider|buy/i.test(item)) ? 100 : 0;
  const floatProfile = row.catalystMix.some((item) => /low_float|stealth|squeeze/i.test(item)) ? "low" : "unknown";

  return {
    signalKey: `${row.ticker}-${row.horizon}-raw-outcome`,
    ticker: row.ticker,
    timestamp: new Date().toISOString(),
    triggerType,
    catalyst: row.catalystMix.join("+") || "signal",
    marketRegime: "raw_outcome",
    insiderActivity,
    floatProfile,
    crowding: 0,
    overnightStrength: 0,
    openingGap: 0,
    first5mMove: row.horizon === "5m" ? maxMovePct : 0,
    first15mMove: row.horizon === "15m" ? maxMovePct : 0,
    first30mMove: row.horizon === "30m" ? maxMovePct : 0,
    first60mMove: row.horizon === "60m" ? maxMovePct : 0,
    intradayHigh: maxMovePct,
    closePerformance: 0,
    nextDayOpenPerformance: row.horizon === "next_day_open" ? maxMovePct : 0,
    preOpenScore: 0,
    openingPlan: "raw_outcome_canonical_fallback",
    openPrice: null,
    highPrice: null,
    closePrice: null,
    maxMovePct,
    fadePct,
    continuationScore: Math.max(0, Math.min(100, Math.round(row.followThroughQuality))),
    outcomeLabel,
    outcomeClassification: normalizeOutcomeClassification(outcomeLabel),
    triggerCombo: triggerType,
    learningWeight: 1,
    outcomeStatus: "evaluated",
  };
}

function detailedOutcomes(outcomes: WarRoomOutcomeRow[]) {
  return outcomes
    .map((row) => row.detailed ?? syntheticDetailedOutcome(row))
    .filter((row): row is DetailedSignalOutcome => Boolean(row));
}

function feedStatus(providerRuns: WarRoomProviderRun[], acceptedNews: number): MorningWarRoomResult["feedStatus"] {
  const newsRun = providerRuns.find((run) => run.provider.includes("MFN") || run.provider.includes("news"));
  if (!newsRun) {
    return {
      status: "missing",
      message: "News feed saknas. Sätt MFN_FEED_URL, CISION_FEED_URL eller NEWS_FEED_URL.",
      latestNewsFetch: null,
      acceptedNews,
      rejectedNews: 0,
    };
  }

  const ageMs = Date.now() - new Date(newsRun.createdAt).getTime();
  return {
    status:
      newsRun.status === "error"
        ? "error"
        : newsRun.status === "empty"
          ? "missing"
          : ageMs > 30 * 60 * 1000
            ? "stale"
            : "healthy",
    message: newsRun.errorMessage ?? (newsRun.status === "empty" ? "Feed missing eller inga matchande nyheter." : "News feed aktiv."),
    latestNewsFetch: newsRun.createdAt,
    acceptedNews,
    rejectedNews: Math.max(0, newsRun.fetchedCount - acceptedNews),
  };
}

export function buildMorningWarRoom(input: MorningWarRoomInput): MorningWarRoomResult {
  const overnightRegime =
    input.overnightContext ?? {
      nasdaqFutures: "unknown" as const,
      sectorMomentum: [],
      activeThemes: [],
      alignmentScore: 50,
    };
  const tickers = uniqueTickers(input);
  const evaluated = tickers.map((ticker) => {
    const classification = input.newsClassifications.find((item) => item.ticker === ticker);
    const ranked = input.ranked.find((item) => item.ticker === ticker);
    const insiders = input.insiderEvents.filter((item) => item.ticker === ticker);
    const feed = input.signalFeed.filter((item) => item.ticker === ticker);
    const narrative = input.narratives.find((item) => item.ticker === ticker);
    const liveReaction = input.liveReactions?.find((item) => item.ticker === ticker);
    const tickerValidation = resolveTickerIdentity({
      ticker,
      source: classification?.source ?? (insiders.length > 0 ? "FI insider" : feed[0]?.type),
      swedishFirstMode: true,
    });
    const tags = [...new Set([...(ranked?.tags ?? []), ...feed.flatMap((item) => item.tags)])].slice(0, 5);
    const edgeScore = calculatePreOpenEdgeScore({
      ticker,
      classification,
      insiderEvents: insiders,
      signalFeed: feed,
      outcomes: input.outcomes,
      rankedScore: ranked?.totalScore ?? Math.max(...feed.map((item) => item.score), 35),
      tags,
    });
    const historicalWeak =
      falsePositiveRatio(ticker, input.outcomes) >= 35 ||
      continuationRate(ticker, input.outcomes) < 42;
    const doNotChase = evaluateDoNotChase({
      classification,
      edgeScore,
      historicalSignalWeak: historicalWeak,
    });
    let openingPlan = buildOpeningPlan({
      ticker,
      classification,
      edgeScore,
      doNotChase,
      hasInsiderSupport: insiders.some((item) => item.type === "buy"),
    });
    const liveScoreBoost = liveReaction
      ? Math.max(
          0,
          Math.round(
              liveReaction.intradayStrengthScore * 0.22 +
              liveReaction.abnormalMoveScore * 0.16 +
              liveReaction.marketAggression * 0.18 -
              liveReaction.fadeProbability * 0.25
          )
        )
      : 0;
    const adjustedPreOpenScore = Math.min(
      100,
      Math.max(edgeScore.totalScore + liveScoreBoost, liveReaction?.marketAggression && liveReaction.marketAggression >= 75 ? 58 : 0)
    );
    if (liveReaction && openingPlan.action === "IGNORE" && adjustedPreOpenScore >= 58 && liveReaction.fadeProbability < 65) {
      openingPlan = {
        action: adjustedPreOpenScore >= 76 ? "WATCH" : "WAIT_PULLBACK",
        whyBeforeOpen: `${ticker}: live market reaction lyfter caset trots svag lagrad catalyst.`,
        confirms: "Stark continuation efter första spike, RVOL över 1.5 och spread under kontroll.",
        invalidates: "Rörelsen tappar VWAP, volymen dör eller fade-risk stiger.",
        doNot: "Jaga inte parabolisk spike utan pullback/continuation.",
      };
    }
    if (liveReaction && openingPlan.action === "IGNORE" && adjustedPreOpenScore >= 58 && liveReaction.fadeProbability >= 65) {
      openingPlan = {
        action: "HIGH_RISK_ONLY",
        whyBeforeOpen: `${ticker}: marknaden attackerar aktien, men fake-spike/parabolic risk ar hog.`,
        confirms: "Continuation efter forsta spike med fortsatt RVOL och kontrollerad spread.",
        invalidates: "Snabb reversal, volymen dor eller priset tappar VWAP.",
        doNot: "Jaga inte gron spike. Endast bevakning vid tydlig continuation.",
      };
    }
    const trigger = classification?.catalystType ?? (insiders.length > 0 ? "FI insider" : narrative?.primaryNarrative ?? "signal");
    const marketRegime = `${overnightRegime.nasdaqFutures}:${overnightRegime.activeThemes.join("|") || "neutral"}`;
    const historicalStats = historicalStatsForSetup(detailedOutcomes(input.outcomes), {
      ticker,
      trigger,
      catalyst: trigger,
      marketRegime,
    });
    const adaptiveConfidence = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          edgeScore.totalScore * 0.42 +
            edgeScore.breakdown.historicalHitrate * 0.22 +
            historicalStats.winRate * 0.22 +
            Math.max(0, 100 - historicalStats.avgFadeRisk * 6) * 0.08 +
            overnightRegime.alignmentScore * 0.06
        )
      )
    );
    const triggerComboGrade =
      historicalStats.sampleSize === 0
        ? "N/A"
        : historicalStats.winRate >= 65 && historicalStats.avgFadeRisk <= 4
          ? "A"
          : historicalStats.winRate >= 52
            ? "B"
            : historicalStats.avgFadeRisk >= 7 || historicalStats.winRate < 40
              ? "D"
              : "C";
    const whyNow = [
      liveReaction?.marketAggression && liveReaction.marketAggression >= 55 ? `Marknaden attackerar aktien: ${liveReaction.reason}` : null,
      classification?.evidence[0],
      insiders.length > 0 ? `${insiders.length} FI-event senaste flödet` : null,
      narrative && narrative.primaryNarrative !== "none" ? `${narrative.primaryNarrative} ${narrative.narrativeStrength}/100` : null,
      feed[0]?.title,
    ].filter((item): item is string => Boolean(item))[0] ?? "Senaste lagrade signalen har pre-open relevans.";
    const identityRejections = tickerValidation.isDisplayable ? [] : tickerValidation.rejectionReasons;
    const rejectedBecause = [
      adjustedPreOpenScore < 44 ? "pre-open score under miniminivå" : null,
      ...identityRejections,
      doNotChase.blocked ? doNotChase.reasons.join(", ") : null,
      openingPlan.action === "IGNORE" ? openingPlan.invalidates : null,
    ].filter((item): item is string => Boolean(item));

    return {
      case: {
        ticker,
        trigger,
        catalyst: trigger,
        whyNow,
        preOpenScore: adjustedPreOpenScore,
        openingAction: openingPlan.action,
        openingPlan,
        risk: edgeScore.breakdown.fakeSpikeRisk,
        confidence: Math.max(adaptiveConfidence, liveReaction ? Math.round(adaptiveConfidence * 0.7 + liveReaction.continuationProbability * 0.3) : adaptiveConfidence),
        invalidation: openingPlan.invalidates,
        tags,
        scoringBreakdown: edgeScore.breakdown,
        rankedInReasons: [
          ...edgeScore.reasons,
          liveReaction?.relativeVolume && liveReaction.relativeVolume >= 1.5 ? `Live RVOL ${liveReaction.relativeVolume}` : null,
          liveReaction?.continuationProbability && liveReaction.continuationProbability >= 65 ? "stark intraday continuation" : null,
          liveReaction?.fadeProbability && liveReaction.fadeProbability >= 60 ? "parabolic/fake-spike risk" : null,
        ].filter((value): value is string => Boolean(value)),
        newsSource: classification?.source,
        freshness: classification?.timeSensitivity,
        catalystStrength: classification?.catalystStrength,
        overnightAlignment: overnightRegime.alignmentScore,
        exchange: tickerValidation.identity.exchange,
        companyName: tickerValidation.identity.companyName,
        tickerConfidence: tickerValidation.identity.sourceConfidence,
        historicalSetupWinrate: historicalStats.winRate,
        triggerComboGrade,
        falsePositiveRisk: Math.min(100, Math.round(historicalStats.avgFadeRisk * 8 + falsePositiveRatio(ticker, input.outcomes) * 0.35 + (liveReaction?.fadeProbability ?? 0) * 0.25)),
        adaptiveConfidenceDelta: (liveReaction ? Math.round(adaptiveConfidence * 0.7 + liveReaction.continuationProbability * 0.3) : adaptiveConfidence) - edgeScore.totalScore,
        similarPastSetups: [
          historicalStats.similarOutcome ? `Liknande utfall: ${historicalStats.similarOutcome}` : null,
          historicalStats.sampleSize > 0 ? `${historicalStats.sampleSize} historiska matchningar` : "Ingen verifierad historik än",
          `Avg continuation ${historicalStats.avgContinuation}`,
        ].filter((value): value is string => Boolean(value)),
        similarSetupOutcome: historicalStats.similarOutcome,
        avgContinuation: historicalStats.avgContinuation,
        avgFadeRisk: historicalStats.avgFadeRisk,
        liveMarketReaction: liveReaction,
      } satisfies MorningWarRoomCase,
      rejectedBecause,
      doNotChase,
      edgeScore,
      tickerValidation,
    };
  });

  const accepted = evaluated
    .filter((item) => item.rejectedBecause.length === 0 && item.case.openingAction !== "IGNORE")
    .sort((a, b) => b.case.preOpenScore - a.case.preOpenScore)
    .slice(0, 5)
    .map((item) => item.case);
  const rejectedCandidates = evaluated
    .filter((item) => item.rejectedBecause.length > 0 || item.case.openingAction === "IGNORE")
    .sort((a, b) => b.edgeScore.totalScore - a.edgeScore.totalScore)
    .slice(0, 10)
    .map((item) => ({
      ticker: item.case.ticker,
      trigger: item.case.trigger,
      preOpenScore: item.case.preOpenScore,
      rejectedBecause: item.rejectedBecause.length > 0 ? item.rejectedBecause : ["opening plan = IGNORE"],
      scoringBreakdown: item.edgeScore.breakdown,
      doNotChase: item.doNotChase,
      tickerValidation: item.tickerValidation,
    }));
  const validationBreakdown = evaluated.map((item) => ({
    ticker: item.case.ticker,
    displayTicker: item.tickerValidation.displayTicker,
    exchange: item.tickerValidation.identity.exchange,
    confidence: item.tickerValidation.identity.sourceConfidence,
    displayable: item.tickerValidation.isDisplayable,
    issues: item.tickerValidation.issues.map((issue) => issue.message),
    rejectionReasons: item.tickerValidation.rejectionReasons,
    breakdown: item.tickerValidation.confidenceBreakdown,
  }));

  return {
    generatedAt: new Date().toISOString(),
    mode: tickers.length > 0 ? "stored" : "fallback",
    topPreOpenSetups: accepted,
    rejectedCandidates,
    acceptedCount: accepted.length,
    rejectedCount: rejectedCandidates.length,
    overnightCatalysts: input.newsClassifications.slice(0, 5).map((item) => `${item.ticker}: ${item.catalystType} ${item.catalystStrength}/100`),
    stealthSignals: accepted.filter((item) => item.tags.includes("stealth accumulation") || item.catalyst === "FI insider").map((item) => item.ticker),
    highRiskFakeMovers: accepted.filter((item) => item.risk >= 70).map((item) => item.ticker),
    openingSqueezeCandidates: accepted.filter((item) => item.tags.includes("squeeze")).map((item) => item.ticker),
    overnightRegime,
    sourceHealth: input.sourceHealth ?? [],
    dedupeStats: input.dedupeStats ?? {
      fetched: 0,
      accepted: input.newsClassifications.length,
      rejected: 0,
      duplicateCount: 0,
      parseErrors: 0,
    },
    tickerValidation: {
      tickerMismatches: evaluated.flatMap((item) =>
        item.tickerValidation.issues
          .filter((issue) => issue.type === "name_mismatch" || issue.type === "source_mismatch" || issue.type === "exchange_conflict")
          .map((issue) => ({
            ticker: item.case.ticker,
            message: issue.message,
            confidence: item.tickerValidation.identity.sourceConfidence,
          }))
      ),
      exchangeConflicts: evaluated.flatMap((item) =>
        item.tickerValidation.issues
          .filter((issue) => issue.type === "ticker_collision" || issue.type === "exchange_conflict")
          .map((issue) => ({
            ticker: item.case.ticker,
            exchange: item.tickerValidation.identity.exchange,
            message: issue.message,
            confidence: item.tickerValidation.identity.sourceConfidence,
          }))
      ),
      unresolvedSymbols: evaluated.flatMap((item) =>
        item.tickerValidation.issues
          .filter((issue) => issue.type === "unresolved_symbol" || issue.type === "low_ticker_confidence" || issue.type === "non_swedish_exchange")
          .map((issue) => ({
            ticker: item.case.ticker,
            message: issue.message,
            confidence: item.tickerValidation.identity.sourceConfidence,
          }))
      ),
      confidenceBreakdown: validationBreakdown,
    },
    feedStatus: feedStatus(input.providerRuns, input.newsClassifications.length),
  };
}