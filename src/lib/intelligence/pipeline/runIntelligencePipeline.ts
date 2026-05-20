import { buildSignalFeed } from "@/lib/intelligence/feed/buildSignalFeed";
import type { IntelligenceReport } from "@/lib/intelligence/mockData";
import { buildLiveIntelligenceReport } from "@/lib/intelligence/pipeline/liveIntelligenceReport";
import {
  saveAlertHistory,
  saveNarrativeHistory,
  savePendingInsiderOutcomes,
  saveProviderRun,
  saveRankedSnapshots,
  saveDetailedSignalOutcomes,
  saveSignalFeed,
  saveSocialMentions,
  getAdaptiveLearningState,
  savePendingSignalOutcomes,
} from "@/lib/db/intelligenceRepository";
import { applyAdaptiveSignalLearning } from "@/lib/intelligence/pipeline/adaptiveSignalLearning";
import { ingestFiInsiderEvents } from "@/lib/providers/insider/fiInsiderIngestion";
import { ingestNewsFeeds } from "@/lib/providers/newsFeedIngestion";
import { fetchRedditMentions } from "@/lib/providers/social/redditProvider";
import { trackSignalOutcome } from "@/lib/intelligence/outcomeTracker";
import { getMarketSessionStatus, nextSuggestedScan } from "@/lib/scheduler";

export interface PipelineSummary {
  startedAt: string;
  finishedAt: string;
  mode: "real" | "empty";
  freshnessScore: number;
  session: ReturnType<typeof getMarketSessionStatus>;
  nextScan: ReturnType<typeof nextSuggestedScan>;
  counts: {
    insiderEvents: number;
    socialMentions: number;
    rankedStocks: number;
    feedItems: number;
    highConvictionAlerts: number;
  };
  persistence: Array<{ step: string; saved: number; skipped: boolean }>;
  providerRuns: Array<{
    provider: string;
    status: "success" | "empty" | "error";
    latencyMs: number;
    fetched: number;
    persisted: number;
    error?: string;
  }>;
  adaptiveLearning?: {
    threshold: number;
    accepted: number;
    rejected: number;
    falsePositiveRatio: number;
  };
  errors: string[];
}

const DEFAULT_TICKERS = ["NCC", "MOFAST", "MANGOLD", "NORDNET", "LOGISTEA", "NORDREST"];
let lastRunStartedAt = 0;
let runningPromise: Promise<PipelineSummary> | null = null;

const EMPTY_REPORT: IntelligenceReport = {
  topRanked: [],
  strongestNarratives: [],
  unusualActivity: [],
  highestSqueezeScore: { ticker: "-", score: 0, factors: [] },
  strongestInsiderAccumulation: { ticker: "-", score: 0, reasons: [] },
  inputs: [],
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

async function executePipeline(tickers: string[]): Promise<PipelineSummary> {
  const startedAt = new Date().toISOString();
  const runStartedMs = Date.now();
  const errors: string[] = [];
  const persistence: PipelineSummary["persistence"] = [];

  const [fiIngestion, newsIngestion, socialMentions] = await Promise.all([
    ingestFiInsiderEvents().catch((error: unknown) => {
      errors.push(`FI insider ingestion failed: ${errorMessage(error)}`);
      return {
        provider: "FI insider" as const,
        status: "error" as const,
        latencyMs: 0,
        fetched: 0,
        deduped: 0,
        persisted: 0,
        skippedPersistence: false,
        sourceUrl: "",
        startedAt,
        finishedAt: new Date().toISOString(),
        events: [],
        patterns: [],
        error: errorMessage(error),
      };
    }),
    ingestNewsFeeds(tickers).catch((error: unknown) => {
      errors.push(`MFN/Cision ingestion failed: ${errorMessage(error)}`);
      return {
        provider: "Swedish news feeds" as const,
        status: "error" as const,
        latencyMs: 0,
        fetched: 0,
        accepted: 0,
        rejected: 0,
        duplicateCount: 0,
        parseErrors: 1,
        news: [],
        sourceHealth: [],
        startedAt,
        finishedAt: new Date().toISOString(),
        error: errorMessage(error),
      };
    }),
    fetchRedditMentions(tickers).catch((error: unknown) => {
      errors.push(`Reddit fetch failed: ${errorMessage(error)}`);
      return [];
    }),
  ]);
  const liveReport = buildLiveIntelligenceReport({
    insiderEvents: fiIngestion.events,
    news: newsIngestion.news,
  });
  const report = liveReport ?? EMPTY_REPORT;
  const learning = await getAdaptiveLearningState();
  const signalDecision = applyAdaptiveSignalLearning(buildSignalFeed(report), learning);
  const feed = signalDecision.accepted;
  const session = getMarketSessionStatus();
  const detailedOutcomes = feed.slice(0, 20).map((item) => {
    const ranked = report.topRanked.find((stock) => stock.ticker === item.ticker);
    return trackSignalOutcome({
      ticker: item.ticker,
      timestamp: item.timestamp,
      triggerType: item.type,
      catalyst: item.title,
      marketRegime: `${session.phase}:pipeline`,
      insiderActivity: item.type === "insider" || item.tags.includes("insider") ? 100 : 0,
      floatProfile: item.tags.some((tag) => /low float|låg float|squeeze|smallcap|småbolag/i.test(tag)) ? "low" : "unknown",
      crowding: item.tags.some((tag) => /crowd|pump|parabol/i.test(tag)) ? 75 : 30,
      overnightStrength: ranked?.conviction ?? item.confidence,
      openingGap: 0,
      first5mMove: 0,
      first15mMove: 0,
      intradayHigh: 0,
      closePerformance: 0,
      preOpenScore: ranked?.totalScore ?? item.score,
      openingPlan: item.priority ?? "WATCH",
    });
  });

  const persistSteps = [
    ["social", () => saveSocialMentions(socialMentions)] as const,
    ["feed", () => saveSignalFeed(feed)] as const,
    ["ranked", () => saveRankedSnapshots(report)] as const,
    ["narratives", () => saveNarrativeHistory(report)] as const,
    ["alerts", () => saveAlertHistory(feed)] as const,
    ["detailed outcomes", () => saveDetailedSignalOutcomes(detailedOutcomes)] as const,
    ["feed outcomes", () => savePendingSignalOutcomes(feed, report, session.phase)] as const,
    [
      "outcomes",
      () => savePendingInsiderOutcomes(fiIngestion.events, session.phase),
    ] as const,
  ];

  for (const [step, run] of persistSteps) {
    try {
      const result = await run();
      persistence.push({ step, ...result });
    } catch (error) {
      errors.push(`${step} persistence failed: ${errorMessage(error)}`);
      persistence.push({ step, saved: 0, skipped: false });
    }
  }

  persistence.unshift({
    step: "fi-insider",
    saved: fiIngestion.persisted,
    skipped: fiIngestion.skippedPersistence,
  });

  if (fiIngestion.error) {
    errors.push(`FI insider: ${fiIngestion.error}`);
  }
  if (newsIngestion.error && newsIngestion.status === "error") {
    errors.push(`MFN/Cision: ${newsIngestion.error}`);
  }

  const highConvictionAlerts = feed.filter(
    (item) => item.priority === "HIGH" || item.priority === "EXTREME"
  );
  await saveProviderRun({
    provider: newsIngestion.provider,
    status: newsIngestion.status,
    startedAt: newsIngestion.startedAt,
    finishedAt: newsIngestion.finishedAt,
    latencyMs: newsIngestion.latencyMs,
    fetchedCount: newsIngestion.fetched,
    savedCount: 0,
    errorMessage: newsIngestion.error,
    rawPayload: {
      tickers,
      fetched: newsIngestion.fetched,
      dedupeStats: {
        fetched: newsIngestion.fetched,
        accepted: newsIngestion.accepted,
        rejected: newsIngestion.rejected,
        duplicateCount: newsIngestion.duplicateCount,
        parseErrors: newsIngestion.parseErrors,
      },
      sourceHealth: newsIngestion.sourceHealth,
      acceptedNewsItems: newsIngestion.news.slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
        url: item.url,
        publishedAt: item.publishedAt,
        tickers: item.tickers,
        detectedTriggers: item.detectedTriggers,
      })),
    },
  }).catch((error) => {
    console.warn("RaketRadar news provider health log failed", error);
  });

  const finishedAt = new Date().toISOString();
  const hasRealData = fiIngestion.fetched > 0 || newsIngestion.fetched > 0 || socialMentions.length > 0;
  const freshnessScore = Math.max(
    0,
    Math.min(100, Math.round(100 - (Date.now() - runStartedMs) / 1000))
  );
  const summary: PipelineSummary = {
    startedAt,
    finishedAt,
    mode: hasRealData ? "real" : "empty",
    freshnessScore,
    session: getMarketSessionStatus(),
    nextScan: nextSuggestedScan(),
    counts: {
      insiderEvents: fiIngestion.deduped,
      socialMentions: socialMentions.length,
      rankedStocks: report.topRanked.length,
      feedItems: feed.length,
      highConvictionAlerts: highConvictionAlerts.length,
    },
    persistence,
    providerRuns: [
      {
        provider: fiIngestion.provider,
        status: fiIngestion.status,
        latencyMs: fiIngestion.latencyMs,
        fetched: fiIngestion.fetched,
        persisted: fiIngestion.persisted,
        error: fiIngestion.error,
      },
      {
        provider: newsIngestion.provider,
        status: newsIngestion.status,
        latencyMs: newsIngestion.latencyMs,
        fetched: newsIngestion.fetched,
        persisted: newsIngestion.accepted,
        error: newsIngestion.error,
      },
    ],
    adaptiveLearning: {
      threshold: learning.minSignalScore,
      accepted: signalDecision.accepted.length,
      rejected: signalDecision.rejected.length,
      falsePositiveRatio: learning.falsePositiveRatio,
    },
    errors,
  };

  await saveProviderRun({
    provider: "intelligence_pipeline",
    status: errors.length > 0 ? "error" : "success",
    startedAt,
    finishedAt,
    latencyMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    fetchedCount: summary.counts.insiderEvents + summary.counts.socialMentions,
    savedCount: persistence.reduce((sum, item) => sum + item.saved, 0),
    errorMessage: errors.join("\n") || undefined,
      rawPayload: summary,
  }).catch((error) => {
    console.warn("RaketRadar pipeline health log failed", error);
  });

  return summary;
}

export async function runIntelligencePipeline(
  tickers = DEFAULT_TICKERS
): Promise<PipelineSummary> {
  const minIntervalMs = Number(process.env.INTELLIGENCE_RUN_MIN_INTERVAL_MS ?? 45000);
  const now = Date.now();

  if (runningPromise) return runningPromise;
  if (lastRunStartedAt > 0 && now - lastRunStartedAt < minIntervalMs) {
    const startedAt = new Date().toISOString();
    const skipped: PipelineSummary = {
      startedAt,
      finishedAt: startedAt,
      mode: "empty",
      freshnessScore: 0,
      session: getMarketSessionStatus(),
      nextScan: nextSuggestedScan(),
      counts: {
        insiderEvents: 0,
        socialMentions: 0,
        rankedStocks: 0,
        feedItems: 0,
        highConvictionAlerts: 0,
      },
      persistence: [],
      providerRuns: [
        {
          provider: "intelligence_pipeline",
          status: "empty",
          latencyMs: 0,
          fetched: 0,
          persisted: 0,
          error: "Rate limit guard aktiv",
        },
      ],
      errors: ["Rate limit guard aktiv"],
    };
    await saveProviderRun({
      provider: "intelligence_pipeline",
      status: "skipped",
      startedAt,
      finishedAt: startedAt,
      latencyMs: 0,
      fetchedCount: 0,
      savedCount: 0,
      errorMessage: "Rate limit guard aktiv",
      rawPayload: skipped,
    }).catch(() => undefined);
    return skipped;
  }

  lastRunStartedAt = now;
  runningPromise = executePipeline(tickers).finally(() => {
    runningPromise = null;
  });

  return runningPromise;
}
