"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IntelligenceCard } from "@/components/intelligence/IntelligenceCard";
import { InsiderFlowPanel } from "@/components/intelligence/InsiderFlowPanel";
import { NarrativeHeatmap } from "@/components/intelligence/NarrativeHeatmap";
import { SignalFeed } from "@/components/intelligence/SignalFeed";
import { SocialMomentumPanel } from "@/components/intelligence/SocialMomentumPanel";
import { TopRankedPanel } from "@/components/intelligence/TopRankedPanel";
import {
  ensureUserProfile,
  getSession,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from "@/lib/auth";
import {
  getAiAnalyses,
  getMockAiAnalysisFeed,
  type AiAnalysis,
} from "@/lib/aiAnalysis";
import { getAlerts, type Alert } from "@/lib/alerts";
import type { TradingAlert } from "@/lib/alertsEngine";
import type { IntelligenceReport } from "@/lib/intelligence/mockData";
import type { InsiderEvent } from "@/lib/intelligence/insider/insiderTypes";
import { buildAnalogDiscoveryReport } from "@/lib/ai/analog/historicalAnalogsReport";
import { buildSignalFeed } from "@/lib/intelligence/feed/buildSignalFeed";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import { buildRealTimeAlerts } from "@/lib/realtime/realTimeAlerts";
import { evaluateSignalDecay } from "@/lib/realtime/signalDecay";
import { evaluateTiming } from "@/lib/realtime/timingEngine";
import { scanTopFiveJustNow } from "@/lib/realtime/priorityScanner";
import { detectMarketRegime } from "@/lib/marketRegime";
import { calculateAdaptiveWeights } from "@/lib/portfolio/adaptiveWeights";
import { detectCapitalRotation } from "@/lib/portfolio/capitalRotation";
import { personalizeConviction } from "@/lib/portfolio/personalConviction";
import { runPortfolioBrain } from "@/lib/portfolio/portfolioBrain";
import { rememberSignal } from "@/lib/portfolio/tradeMemory";
import { evaluateWatchlistEvolution } from "@/lib/portfolio/watchlistEvolution";
import { explainWhyNow } from "@/lib/portfolio/whyNow";
import { detectCrowding } from "@/lib/crowdingDetector";
import { applyPrecisionMode, type PrecisionMode } from "@/lib/precisionMode";
import { splitLatencyLanes } from "@/lib/workflow/latencyLanes";
import { buildWatchlistPings } from "@/lib/workflow/liveWatchlists";
import { generatePersonalDailyBrief } from "@/lib/workflow/personalDailyBrief";
import { buildSignalTimeline } from "@/lib/workflow/signalTimeline";
import { filterDataQuality } from "@/lib/production/dataQuality";
import { buildIngestSchedule } from "@/lib/production/ingestScheduler";
import { createPipelineMetrics } from "@/lib/production/pipelineMetrics";
import { evaluateProviderHealth } from "@/lib/production/providerHealth";
import {
  getPerformanceModeConfig,
  type PerformanceMode,
} from "@/lib/production/performanceMode";
import { detectAsymmetricSetup } from "@/lib/intelligence/history/asymmetricDetector";
import { calculateEdgeScores } from "@/lib/intelligence/history/edgeScore";
import { getMockHistoricalPatterns } from "@/lib/intelligence/history/historicalPatterns";
import { matchHistoricalPatterns } from "@/lib/intelligence/history/patternMatcher";
import { filterSignalNoise } from "@/lib/intelligence/history/noiseFilter";
import {
  generateMorningBrief,
  type BriefingResult,
} from "@/lib/briefing";
import {
  getPortfolioPositions,
  type PortfolioPosition,
} from "@/lib/portfolio";
import {
  fetchMarketSnapshot,
  getStaticProviderHealth,
} from "@/lib/providers/providerRegistry";
import type { MarketSnapshot, ProviderHealth } from "@/lib/providers/types";
import {
  getMarketSessionStatus,
  nextSuggestedScan,
  type MarketSessionStatus,
} from "@/lib/scheduler";
import type { RankedStockSignal } from "@/lib/signals";
import { supabase } from "@/lib/supabase";
import {
  getWatchlists,
  type Watchlist,
  type WatchlistItem,
} from "@/lib/watchlist";

type View = "signals" | "portfolio" | "watchlist" | "alerts" | "analysis";

const EMPTY_INTELLIGENCE_REPORT: IntelligenceReport = {
  topRanked: [],
  strongestNarratives: [],
  unusualActivity: [],
  highestSqueezeScore: { ticker: "-", score: 0, factors: [] },
  strongestInsiderAccumulation: { ticker: "-", score: 0, reasons: [] },
  inputs: [],
};
type AuthMode = "login" | "signup";
type DashboardWatchlist = Watchlist & { watchlist_items: WatchlistItem[] };
type LiveInsiderEvent = InsiderEvent & {
  id: string;
  source: string;
  createdAt: string;
  dedupeKey: string | null;
};
type DebugSnapshot = {
  providerRuns: Array<{
    id: string;
    provider: string;
    status: string;
    latencyMs: number;
    fetchedCount: number;
    savedCount: number;
    errorMessage: string | null;
    createdAt: string;
  }>;
  acceptedSignals: number;
  rejectedSignals: number;
  falsePositiveRatio30d: number;
  edgePerformance30d: {
    sampleSize: number;
    averageUpside: number;
    averageDownside: number;
    continuationRate: number;
    stealthSuccessRate: number;
    decayRate: number;
  };
  freshness: {
    latestSignalAt: string | null;
    latestProviderRunAt: string | null;
    freshnessScore: number;
  };
  newsFeed?: {
    latestFetch: string | null;
    accepted: number;
    rejected: number;
    freshness: string;
    acceptedNewsItems: Array<{
      id: string;
      title: string;
      source: string;
      url: string | null;
      publishedAt: string;
      tickers: string[];
      detectedTriggers: string[];
    }>;
    sourceHealth: Array<{
      source: string;
      status: string;
      latencyMs: number;
      fetched: number;
      accepted: number;
      rejected: number;
      duplicateCount: number;
      parseErrors: number;
      freshness: string;
    }>;
    dedupeStats: {
      fetched: number;
      accepted: number;
      rejected: number;
      duplicateCount: number;
      parseErrors: number;
    };
  };
  outcomeLearning: {
    topPerformingTriggerCombos: Array<{ key: string; sampleSize: number; winRate: number; avgContinuation: number; avgMaxMovePct: number; avgFadePct: number; falsePositiveRate: number }>;
    worstTriggerCombos: Array<{ key: string; sampleSize: number; winRate: number; avgContinuation: number; avgMaxMovePct: number; avgFadePct: number; falsePositiveRate: number }>;
    insiderContinuationRanking: Array<{ ticker: string; sampleSize: number; continuationRate: number; avgContinuation: number }>;
    falsePositiveRate: number;
    regimePerformance: Array<{ regime: string; sampleSize: number; winRate: number; avgContinuation: number }>;
    evaluatedCount?: number;
    pendingCount?: number;
    topFalsePositives?: Array<{ key: string; sampleSize: number; winRate: number; avgContinuation: number; avgMaxMovePct: number; avgFadePct: number; falsePositiveRate: number }>;
    topContinuationSetups?: Array<{ key: string; sampleSize: number; winRate: number; avgContinuation: number; avgMaxMovePct: number; avgFadePct: number; falsePositiveRate: number }>;
  };
  outcomeTracking?: {
    status: "active" | "missing_supabase" | "no_data";
    pendingSignals: number;
    evaluatedSignals: number;
    missingOutcomeData: number;
  };
  outcomeCollector?: {
    status: string;
    lastRunAt: string | null;
    processed: number;
    updated: number;
    stillPending: number;
    dead: number;
    missingMarketDataByTicker: Array<{ ticker: string; count: number; horizons: string[] }>;
    latestClassifiedOutcomes: Array<{
      signalId: string;
      ticker: string;
      horizon: string;
      outcomeLabel: string;
      followThroughQuality: number;
      maxUpsidePercent: number;
    }>;
  };
  latestWarRoom?: MorningWarRoomState | null;
};
type MorningWarRoomState = {
  generatedAt: string;
  mode: "stored" | "fallback";
  topPreOpenSetups: Array<{
    ticker: string;
    trigger: string;
    catalyst: string;
    whyNow: string;
    preOpenScore: number;
    openingAction: string;
    risk: number;
    confidence: number;
    invalidation: string;
    tags: string[];
    newsSource?: string;
    freshness?: number;
    catalystStrength?: number;
    overnightAlignment?: number;
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
  }>;
  rejectedCandidates: Array<{
    ticker: string;
    trigger: string;
    preOpenScore: number;
    rejectedBecause: string[];
    tickerValidation?: {
      identity: {
        exchange: string;
        sourceConfidence: number;
      };
    };
  }>;
  acceptedCount: number;
  rejectedCount: number;
  overnightRegime?: {
    nasdaqFutures: "positive" | "neutral" | "negative" | "unknown";
    activeThemes: string[];
    alignmentScore: number;
  };
  sourceHealth?: NonNullable<DebugSnapshot["newsFeed"]>["sourceHealth"];
  dedupeStats?: NonNullable<DebugSnapshot["newsFeed"]>["dedupeStats"];
  tickerValidation?: {
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
    }>;
  };
  outcomeLearning?: DebugSnapshot["outcomeLearning"];
  feedStatus: {
    status: "healthy" | "missing" | "stale" | "error";
    message: string;
    latestNewsFetch: string | null;
    acceptedNews: number;
    rejectedNews: number;
  };
};

function sek(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function compactDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("sv-SE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getScoreColor(score: number) {
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-lime-400";
  if (score >= 70) return "text-yellow-300";
  if (score >= 60) return "text-orange-300";
  return "text-red-400";
}

function getActionStyle(score: number) {
  if (score >= 90) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (score >= 80) return "bg-lime-500/20 text-lime-300 border-lime-500/30";
  if (score >= 70) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  if (score >= 60) return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  return "bg-red-500/20 text-red-300 border-red-500/30";
}

function alertLabel(type: Alert["alert_type"]) {
  const labels: Record<Alert["alert_type"], string> = {
    price_above: "Pris över",
    price_below: "Pris under",
    signal_score: "Signal-score",
    news: "Nyhet",
    volume: "Volym",
    custom: "Egen regel",
  };

  return labels[type];
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-zinc-800 rounded-2xl p-8 text-center bg-zinc-950">
      <p className="text-lg font-semibold text-zinc-200">{title}</p>
      <p className="text-zinc-500 mt-2">{body}</p>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-zinc-300">
      {label}
    </div>
  );
}

function healthStyle(status: ProviderHealth["status"]) {
  if (status === "healthy") return "text-emerald-300 bg-emerald-500/15 border-emerald-500/25";
  if (status === "fallback") return "text-yellow-300 bg-yellow-500/15 border-yellow-500/25";
  if (status === "disabled") return "text-zinc-300 bg-zinc-800 border-zinc-700";
  return "text-red-300 bg-red-500/15 border-red-500/25";
}

function formatSek(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "okänt värde";
  return `${Math.round(value).toLocaleString("sv-SE")} SEK`;
}

function ProviderHealthPanel({ health }: { health: ProviderHealth[] }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
      {health.map((provider) => (
        <div
          key={provider.name}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-sm">{provider.name}</p>
            <span
              className={`border px-2 py-1 rounded-full text-xs ${healthStyle(
                provider.status
              )}`}
            >
              {provider.status}
            </span>
          </div>
          <p className="text-zinc-500 text-xs mt-3">{provider.message}</p>
        </div>
      ))}
    </section>
  );
}

function severityStyle(severity: TradingAlert["severity"]) {
  if (severity === "critical") return "text-red-200 bg-red-500/20 border-red-500/30";
  if (severity === "high") return "text-orange-200 bg-orange-500/20 border-orange-500/30";
  if (severity === "medium") return "text-yellow-200 bg-yellow-500/20 border-yellow-500/30";
  return "text-zinc-200 bg-zinc-800 border-zinc-700";
}

function triggerDirectionStyle(direction: "bullish" | "bearish" | "neutral") {
  if (direction === "bullish") return "text-emerald-300 bg-emerald-500/15 border-emerald-500/25";
  if (direction === "bearish") return "text-red-300 bg-red-500/15 border-red-500/25";
  return "text-zinc-300 bg-zinc-800 border-zinc-700";
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const result =
      mode === "login"
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);

    if (result.error) {
      setMessage(result.error.message);
      setIsSubmitting(false);
      return;
    }

    if (result.data.user) {
      await ensureUserProfile(result.data.user);
    }

    setMessage(
      mode === "signup"
        ? "Konto skapat. Bekräfta email om Supabase kräver det."
        : ""
    );
    setIsSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 flex items-center">
      <section className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
        <div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            RaketRadar Core
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Logga in för att se din personliga portfölj, watchlist, alerts och
            AI-analyser. Marknadssignalerna laddas när sessionen är klar.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {["Personlig data", "RLS-skyddad", "Premium redo"].map((item) => (
              <div
                key={item}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
              >
                <p className="font-semibold">{item}</p>
                <p className="text-zinc-500 text-sm mt-2">Supabase Auth</p>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl"
        >
          <div className="flex gap-2 mb-6">
            {[
              ["login", "Logga in"],
              ["signup", "Skapa konto"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setMode(key as AuthMode)}
                className={`px-4 py-2 rounded-full text-sm border transition ${
                  mode === key
                    ? "bg-white text-black border-white"
                    : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block text-sm text-zinc-400 mb-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500"
            required
          />

          <label
            className="block text-sm text-zinc-400 mb-2 mt-5"
            htmlFor="password"
          >
            Lösenord
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500"
            minLength={6}
            required
          />

          {message && (
            <p className="mt-4 text-sm text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full bg-white text-black rounded-full px-5 py-3 font-semibold disabled:opacity-60"
          >
            {isSubmitting
              ? "Jobbar..."
              : mode === "login"
                ? "Logga in"
                : "Skapa konto"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [view, setView] = useState<View>("signals");
  const [signals, setSignals] = useState<RankedStockSignal[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
  const [watchlists, setWatchlists] = useState<DashboardWatchlist[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [analyses, setAnalyses] = useState<AiAnalysis[]>([]);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>(
    getStaticProviderHealth()
  );
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(
    null
  );
  const [marketSession, setMarketSession] = useState<MarketSessionStatus>(
    getMarketSessionStatus()
  );
  const [intelligenceReport, setIntelligenceReport] =
    useState<IntelligenceReport>(EMPTY_INTELLIGENCE_REPORT);
  const [storedSignalFeed, setStoredSignalFeed] = useState<SignalFeedItem[]>([]);
  const [liveInsiderEvents, setLiveInsiderEvents] = useState<LiveInsiderEvent[]>([]);
  const [liveInsiderMode, setLiveInsiderMode] = useState("empty");
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot | null>(null);
  const [morningWarRoom, setMorningWarRoom] = useState<MorningWarRoomState | null>(null);
  const [intelligenceMode, setIntelligenceMode] = useState("empty");
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [precisionMode, setPrecisionMode] = useState<PrecisionMode>("ALL");
  const [performanceMode, setPerformanceMode] =
    useState<PerformanceMode>("TRADER");
  const [feedMode, setFeedMode] = useState<"live" | "fallback">("fallback");
  const [selectedSignal, setSelectedSignal] = useState<RankedStockSignal | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  const userId = session?.user.id;
  const userEmail = session?.user.email ?? "Okänd användare";

  const clearPersonalData = useCallback(() => {
    setPortfolio([]);
    setWatchlists([]);
    setAlerts([]);
    setAnalyses([]);
  }, []);

  const loadSignals = useCallback(async () => {
    const snapshot = await fetchMarketSnapshot();
    setSignals(snapshot.candidates);
    setMarketSnapshot(snapshot);
    setProviderHealth(snapshot.health);
    setFeedMode(snapshot.mode);
  }, []);

  const loadLiveInsiders = useCallback(async () => {
    const response = await fetch("/api/intelligence/insiders");
    const payload = (await response.json()) as {
      mode?: string;
      events?: LiveInsiderEvent[];
    };

    setLiveInsiderEvents(payload.events ?? []);
    setLiveInsiderMode(payload.mode ?? "empty");
  }, []);

  const loadDebugSnapshot = useCallback(async () => {
    const response = await fetch("/api/intelligence/debug");
    if (!response.ok) return;
    setDebugSnapshot((await response.json()) as DebugSnapshot);
  }, []);

  const loadMorningWarRoom = useCallback(async () => {
    const response = await fetch("/api/intelligence/morning-war-room");
    if (!response.ok) return;
    setMorningWarRoom((await response.json()) as MorningWarRoomState);
  }, []);

  const loadPortfolio = useCallback(async (nextUserId: string) => {
    const { data, error } = await getPortfolioPositions(nextUserId);
    if (!error && data) setPortfolio(data);
  }, []);

  const loadWatchlists = useCallback(async (nextUserId: string) => {
    const { data, error } = await getWatchlists(nextUserId);
    if (!error && data) {
      const rows = data as unknown as DashboardWatchlist[];

      setWatchlists(
        rows.map((watchlist) => ({
          ...watchlist,
          watchlist_items: watchlist.watchlist_items ?? [],
        }))
      );
    }
  }, []);

  const loadAlerts = useCallback(async (nextUserId: string) => {
    const { data, error } = await getAlerts(nextUserId);
    if (!error && data) setAlerts(data);
  }, []);

  const loadAnalyses = useCallback(async (nextUserId: string) => {
    const { data, error } = await getAiAnalyses(nextUserId, 30);
    if (!error && data) {
      setAnalyses(data.length > 0 ? data : getMockAiAnalysisFeed(nextUserId));
    }
  }, []);

  const loadDashboard = useCallback(
    async (nextUserId: string) => {
      await Promise.all([
        loadSignals(),
        loadPortfolio(nextUserId),
        loadWatchlists(nextUserId),
        loadAlerts(nextUserId),
        loadAnalyses(nextUserId),
      ]);
      setIsLoading(false);
    },
    [loadAlerts, loadAnalyses, loadPortfolio, loadSignals, loadWatchlists]
  );

  async function handleLogout() {
    await signOut();
    clearPersonalData();
    setSession(null);
  }

  useEffect(() => {
    let isMounted = true;

    getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);

      if (!nextSession) {
        clearPersonalData();
        setIsLoading(true);
      } else {
        ensureUserProfile(nextSession.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearPersonalData]);

  useEffect(() => {
    if (!userId) return;

    const initialLoad = window.setTimeout(() => {
      loadDashboard(userId);
    }, 0);

    const channel = supabase
      .channel(`raketradar-core-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_signals" },
        () => loadSignals()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "portfolio_positions",
          filter: `user_id=eq.${userId}`,
        },
        () => loadPortfolio(userId)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watchlists",
          filter: `user_id=eq.${userId}`,
        },
        () => loadWatchlists(userId)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watchlist_items",
          filter: `user_id=eq.${userId}`,
        },
        () => loadWatchlists(userId)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alerts",
          filter: `user_id=eq.${userId}`,
        },
        () => loadAlerts(userId)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_analyses",
          filter: `user_id=eq.${userId}`,
        },
        () => loadAnalyses(userId)
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoad);
      supabase.removeChannel(channel);
    };
  }, [
    loadAlerts,
    loadAnalyses,
    loadDashboard,
    loadPortfolio,
    loadSignals,
    loadWatchlists,
    userId,
  ]);

  const filters = ["ALL", "Rapport", "AI", "Microcap", "Momentum", "Squeeze"];

  const filteredSignals = useMemo(() => {
    if (filter === "ALL") return signals;

    return signals.filter((signal) => {
      const haystack =
        `${signal.signal_type} ${signal.description} ${signal.company_name} ${signal.ai_reason ?? ""}`.toLowerCase();

      return haystack.includes(filter.toLowerCase());
    });
  }, [signals, filter]);

  const portfolioStats = useMemo(() => {
    const invested = portfolio.reduce(
      (sum, item) => sum + item.shares * item.average_price,
      0
    );

    const value = portfolio.reduce(
      (sum, item) => sum + item.shares * item.current_price,
      0
    );

    const pnl = value - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    return { invested, value, pnl, pnlPct };
  }, [portfolio]);

  const watchlistItems = useMemo(
    () => watchlists.flatMap((watchlist) => watchlist.watchlist_items),
    [watchlists]
  );

  const activeAlerts = alerts.filter((alert) => alert.is_active);
  const nextScan = useMemo(() => nextSuggestedScan(), []);
  const unifiedSignalFeed = useMemo(
    () =>
      storedSignalFeed.length > 0
        ? storedSignalFeed
        : buildSignalFeed(intelligenceReport),
    [intelligenceReport, storedSignalFeed]
  );
  const historicalPatterns = useMemo(() => getMockHistoricalPatterns(), []);
  const edgeScores = useMemo(
    () => calculateEdgeScores(historicalPatterns),
    [historicalPatterns]
  );
  const learningSummary = useMemo(() => {
    const asymmetric = intelligenceReport.topRanked.map(detectAsymmetricSetup);
    const patternMatches = intelligenceReport.topRanked.flatMap(matchHistoricalPatterns);
    const noise = intelligenceReport.topRanked.map(filterSignalNoise);

    return {
      bestEdge: edgeScores[0],
      asymmetric,
      patternMatches,
      noise,
      recentWinners: patternMatches.filter(
        (item) => item.type === "liknar tidigare runner"
      ),
    };
  }, [edgeScores, intelligenceReport]);
  const analogDiscovery = useMemo(
    () => buildAnalogDiscoveryReport(intelligenceReport),
    [intelligenceReport]
  );
  const realtimeAlerts = useMemo(
    () => buildRealTimeAlerts(unifiedSignalFeed),
    [unifiedSignalFeed]
  );
  const topFiveJustNow = useMemo(
    () => scanTopFiveJustNow(intelligenceReport, unifiedSignalFeed),
    [intelligenceReport, unifiedSignalFeed]
  );
  const timingByTicker = useMemo(
    () =>
      intelligenceReport.inputs.map((input) => ({
        ticker: input.ticker,
        timing: evaluateTiming(input),
      })),
    [intelligenceReport]
  );
  const decaySignals = useMemo(
    () => unifiedSignalFeed.map(evaluateSignalDecay),
    [unifiedSignalFeed]
  );
  const regime = useMemo(() => detectMarketRegime(), []);
  const portfolioBrain = useMemo(
    () =>
      runPortfolioBrain({
        stocks: intelligenceReport.topRanked,
        asymmetry: learningSummary.asymmetric,
        timing: timingByTicker,
        decay: decaySignals,
      }),
    [decaySignals, intelligenceReport, learningSummary.asymmetric, timingByTicker]
  );
  const adaptiveWeights = useMemo(
    () =>
      calculateAdaptiveWeights({
        edgeScores,
        regime,
        marketCapEnvironment: "small",
      }),
    [edgeScores, regime]
  );
  const capitalRotation = useMemo(
    () => detectCapitalRotation(intelligenceReport),
    [intelligenceReport]
  );
  const watchlistEvolution = useMemo(
    () => evaluateWatchlistEvolution(intelligenceReport.topRanked),
    [intelligenceReport]
  );
  const whyNowItems = useMemo(
    () =>
      intelligenceReport.topRanked.slice(0, 3).map((stock) =>
        explainWhyNow(
          stock,
          timingByTicker.find((item) => item.ticker === stock.ticker)?.timing ??
            null
        )
      ),
    [intelligenceReport, timingByTicker]
  );
  const tradeMemory = useMemo(
    () => intelligenceReport.topRanked.slice(0, 3).map(rememberSignal),
    [intelligenceReport]
  );
  const crowdingSignals = useMemo(
    () =>
      intelligenceReport.topRanked.map((stock) =>
        detectCrowding(
          stock,
          unifiedSignalFeed.filter((item) => item.ticker === stock.ticker),
          portfolioBrain.exposure.crowdedThemes
        )
      ),
    [intelligenceReport, portfolioBrain.exposure.crowdedThemes, unifiedSignalFeed]
  );
  const precisionCandidates = useMemo(
    () =>
      intelligenceReport.topRanked.map((stock) => ({
        stock,
        asymmetry:
          learningSummary.asymmetric.find((item) => item.ticker === stock.ticker) ??
          null,
        timing:
          timingByTicker.find((item) => item.ticker === stock.ticker)?.timing ??
          null,
        feedItems: unifiedSignalFeed.filter((item) => item.ticker === stock.ticker),
        crowding:
          crowdingSignals.find((item) => item.ticker === stock.ticker) ?? null,
      })),
    [
      crowdingSignals,
      intelligenceReport,
      learningSummary.asymmetric,
      timingByTicker,
      unifiedSignalFeed,
    ]
  );
  const precisionResult = useMemo(
    () => applyPrecisionMode(precisionCandidates, precisionMode),
    [precisionCandidates, precisionMode]
  );
  const dailyBrief = useMemo(
    () =>
      generatePersonalDailyBrief({
        report: intelligenceReport,
        decay: decaySignals,
        crowding: crowdingSignals,
      }),
    [crowdingSignals, decaySignals, intelligenceReport]
  );
  const watchlistPings = useMemo(
    () =>
      buildWatchlistPings({
        stocks: intelligenceReport.topRanked,
        timing: timingByTicker,
        crowding: crowdingSignals,
      }),
    [crowdingSignals, intelligenceReport, timingByTicker]
  );
  const latencyLanes = useMemo(
    () => splitLatencyLanes(unifiedSignalFeed),
    [unifiedSignalFeed]
  );
  const signalTimeline = useMemo(
    () =>
      intelligenceReport.topRanked[0]
        ? buildSignalTimeline(intelligenceReport.topRanked[0], unifiedSignalFeed)
        : [],
    [intelligenceReport, unifiedSignalFeed]
  );
  const performanceConfig = useMemo(
    () => getPerformanceModeConfig(performanceMode),
    [performanceMode]
  );
  const productionHealth = useMemo(
    () => [
      evaluateProviderHealth({
        name: "FI insider",
        checks: [{ ok: true, latencyMs: 220, checkedAt: new Date().toISOString() }],
      }),
      evaluateProviderHealth({
        name: "MFN/Cision",
        checks: [{ ok: true, latencyMs: 180, checkedAt: new Date().toISOString() }],
      }),
      evaluateProviderHealth({
        name: "Market data",
        checks: [{ ok: feedMode === "live", latencyMs: 95, checkedAt: new Date().toISOString() }],
        rateLimited: feedMode !== "live",
      }),
    ],
    [feedMode]
  );
  const ingestSchedule = useMemo(() => buildIngestSchedule(), []);
  const dataQuality = useMemo(
    () =>
      filterDataQuality(
        unifiedSignalFeed.map((item) => ({
          id: item.id,
          ticker: item.ticker,
          timestamp: item.timestamp,
          source: item.type,
          rawText: item.description,
          score: item.score,
        })),
        { minScore: 45 }
      ),
    [unifiedSignalFeed]
  );
  const pipelineMetrics = useMemo(
    () =>
      createPipelineMetrics({
        ingestTimeMs: 420,
        rankingTimeMs: 95,
        alertLatencyMs: 35,
        providerLatencyMs: {
          fi: 220,
          news: 180,
          market: feedMode === "live" ? 95 : 0,
        },
        dashboardFreshnessMs: 45000,
      }),
    [feedMode]
  );
  const newsTriggers = useMemo(() => {
    return (
      marketSnapshot?.news.flatMap((item) =>
        item.triggers.map((trigger) => ({
          newsId: item.id,
          ticker: item.tickers[0] ?? "-",
          title: item.title,
          source: item.source,
          publishedAt: item.publishedAt,
          trigger,
        }))
      ) ?? []
    ).sort((a, b) => b.trigger.impactScore - a.trigger.impactScore);
  }, [marketSnapshot]);
  const morningBrief = useMemo<BriefingResult | null>(() => {
    if (!marketSnapshot || feedMode !== "live") return null;

    return generateMorningBrief({
      snapshot: marketSnapshot,
      portfolio,
      watchlistTickers: watchlistItems.map((item) => item.ticker),
    });
  }, [feedMode, marketSnapshot, portfolio, watchlistItems]);
  const assistantAlerts = useMemo<TradingAlert[]>(
    () => (feedMode === "live" ? morningBrief?.alertsToCreate ?? [] : []),
    [feedMode, morningBrief]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMarketSession(getMarketSessionStatus());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch("/api/intelligence/latest")
      .then((response) => response.json())
      .then(
        (payload: {
          mode?: string;
          report?: IntelligenceReport;
          signalFeed?: SignalFeedItem[];
        }) => {
          if (payload.report) setIntelligenceReport(payload.report);
          if (payload.signalFeed) setStoredSignalFeed(payload.signalFeed);
          setIntelligenceMode(payload.mode ?? "empty");
        }
      )
      .catch(() => {
        setIntelligenceMode("empty");
      });

    const insiderTimer = window.setTimeout(() => {
      void loadLiveInsiders().catch(() => {
        setLiveInsiderEvents([]);
        setLiveInsiderMode("empty");
      });
      void loadDebugSnapshot().catch(() => {
        setDebugSnapshot(null);
      });
      void loadMorningWarRoom().catch(() => {
        setMorningWarRoom(null);
      });
    }, 0);

    return () => window.clearTimeout(insiderTimer);
  }, [loadDebugSnapshot, loadLiveInsiders, loadMorningWarRoom]);

  async function runPipelineNow() {
    setIsRunningPipeline(true);

    try {
      await fetch("/api/intelligence/run", { method: "POST" });
      const response = await fetch("/api/intelligence/latest");
      const payload = (await response.json()) as {
        mode?: string;
        report?: IntelligenceReport;
        signalFeed?: SignalFeedItem[];
      };
      if (payload.report) setIntelligenceReport(payload.report);
      if (payload.signalFeed) setStoredSignalFeed(payload.signalFeed);
      setIntelligenceMode(payload.mode ?? "empty");
      await loadLiveInsiders();
      await loadDebugSnapshot();
      await loadMorningWarRoom();
    } finally {
      setIsRunningPipeline(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-black text-white p-4 md:p-8 flex items-center justify-center">
        <LoadingPanel label="Kontrollerar Supabase-session..." />
      </main>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold mb-2">
              RaketRadar Core
            </h1>

            <p className="text-zinc-400">
              AI Trading Agent för svenska småbolag
            </p>
          </div>

          <div className="flex gap-3 flex-wrap xl:justify-end">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3">
              <p className="text-zinc-500 text-xs">Inloggad</p>
              <p className="text-zinc-200 text-sm">{userEmail}</p>
              <p className="text-green-300 text-xs mt-1">Premium: planerad</p>
            </div>

            <button
              onClick={handleLogout}
              className="bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white px-4 py-2 rounded-full text-sm transition h-fit"
            >
              Logga ut
            </button>

            <span className="bg-green-500/20 text-green-300 px-4 py-2 rounded-full text-sm h-fit">
              {isLoading ? "Synkar personlig data" : "Supabase session aktiv"}
            </span>

            <span className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-full text-sm h-fit">
              {signals.length} signaler
            </span>

            <span className="bg-yellow-500/15 text-yellow-300 px-4 py-2 rounded-full text-sm h-fit">
              {feedMode === "live" ? "Live feed aktiv" : "Ingen verifierad live-signal"}
            </span>

            <span className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-full text-sm h-fit">
              {portfolio.length} innehav
            </span>

            <span className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-full text-sm h-fit">
              {activeAlerts.length} alerts
            </span>
          </div>
        </header>

        <nav className="flex gap-2 flex-wrap mb-6">
          {[
            ["signals", "Signalhistorik"],
            ["portfolio", "Sparad portfölj"],
            ["watchlist", "Watchlist"],
            ["alerts", "Alerts"],
            ["analysis", "AI analyser"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key as View)}
              className={`px-5 py-2 rounded-full text-sm border transition ${
                view === key
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {isLoading && <LoadingPanel label="Laddar dashboard-data..." />}

        {!isLoading && view === "signals" && (
          <>
            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                <div>
                  <p className="text-zinc-500 text-sm">Morning War Room</p>
                  <h2 className="text-2xl font-bold">Pre-open trading intelligence</h2>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs ${
                  morningWarRoom?.feedStatus.status === "healthy"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                }`}>
                  {morningWarRoom?.feedStatus.message ?? "Laddar War Room"}
                </span>
              </div>

              <div className="grid gap-2">
                {(morningWarRoom?.topPreOpenSetups ?? []).slice(0, 5).map((item) => (
                  <div
                    key={`${item.ticker}-${item.openingAction}`}
                    className="grid grid-cols-12 gap-2 border-t border-zinc-900 pt-3 text-xs"
                  >
                    <span className="col-span-1 font-bold text-zinc-100" title={item.companyName}>
                      {item.ticker}
                      <span className="block text-[10px] font-normal text-zinc-500">{item.exchange}</span>
                    </span>
                    <span className="col-span-2 text-zinc-300 truncate">
                      {item.trigger}
                    </span>
                    <span className="col-span-1 text-emerald-300">{item.preOpenScore}</span>
                    <span className="col-span-2 text-yellow-200">{item.openingAction}</span>
                    <span className="col-span-2 text-zinc-400 truncate">{item.whyNow}</span>
                    <span className={item.risk >= 70 ? "col-span-1 text-red-300" : "col-span-1 text-zinc-400"}>
                      R {item.risk}
                    </span>
                    <span className="col-span-2 text-red-200 truncate">{item.invalidation}</span>
                    <span className="col-span-1 text-right text-emerald-300">
                      C {item.confidence}
                    </span>
                    <div className="col-span-12 grid grid-cols-12 gap-2 text-[11px] text-zinc-500">
                      <span className="col-span-3 truncate">
                        Källa {item.newsSource ?? "persistent"}
                      </span>
                      <span className="col-span-2">
                        Fresh {item.freshness ?? 0}/100
                      </span>
                      <span className="col-span-3">
                        Catalyst {item.catalystStrength ?? item.preOpenScore}/100
                      </span>
                      <span className="col-span-2 truncate">
                        Overnight {item.overnightAlignment ?? morningWarRoom?.overnightRegime?.alignmentScore ?? 50}/100
                      </span>
                      <span className="col-span-2 text-right">
                        Ticker {item.tickerConfidence}/100
                      </span>
                      <span className="col-span-3">
                        Winrate {item.historicalSetupWinrate}% · cont {item.avgContinuation}
                      </span>
                      <span className="col-span-3">
                        Combo {item.triggerComboGrade} · FP-risk {item.falsePositiveRisk}%
                      </span>
                      <span className="col-span-2 text-right">
                        ΔC {item.adaptiveConfidenceDelta >= 0 ? "+" : ""}{item.adaptiveConfidenceDelta}
                      </span>
                      <span className="col-span-3 truncate">
                        {item.similarPastSetups?.[0] ?? item.similarSetupOutcome ?? "Ingen verifierad historik"}
                      </span>
                      <span className="col-span-1 text-right">
                        Fade {item.avgFadeRisk}%
                      </span>
                    </div>
                  </div>
                ))}
                {(!morningWarRoom || morningWarRoom.topPreOpenSetups.length === 0) && (
                  <div className="border-t border-zinc-900 pt-3 text-sm">
                    <p className="text-zinc-300 font-medium">Ingen verifierad live-signal just nu</p>
                    <p className="text-zinc-500 mt-1">
                      War Room visar inga mock- eller fallback-kandidater. Kontrollera provider health,
                      freshness och debug innan beslut.
                    </p>
                    <button
                      type="button"
                      onClick={() => setView("signals")}
                      className="mt-2 text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Visa debug längre ned
                    </button>
                  </div>
                )}
              </div>

              {morningWarRoom && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
                    News {morningWarRoom.feedStatus.acceptedNews}/{morningWarRoom.feedStatus.rejectedNews}
                  </span>
                  <span className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
                    Dedupe {morningWarRoom.dedupeStats?.duplicateCount ?? 0}
                  </span>
                  <span className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
                    Overnight {morningWarRoom.overnightRegime?.alignmentScore ?? 50}/100
                  </span>
                  <span className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
                    Themes {morningWarRoom.overnightRegime?.activeThemes.join(", ") || "-"}
                  </span>
                  <span className="bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
                    Ticker conflicts {morningWarRoom.tickerValidation?.exchangeConflicts.length ?? 0}
                  </span>
                </div>
              )}
            </section>

            <ProviderHealthPanel health={providerHealth} />

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-6">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex gap-3 flex-wrap">
                  {productionHealth.map((provider) => (
                    <span
                      key={provider.name}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs"
                    >
                      {provider.name}: {provider.status} · {provider.latencyMs}ms · uptime{" "}
                      {provider.uptimePercent}%
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {(["ULTRA_LIGHT", "TRADER", "FULL_INTELLIGENCE"] as const).map(
                    (mode) => (
                      <button
                        key={mode}
                        onClick={() => setPerformanceMode(mode)}
                        className={`px-3 py-1 rounded-full text-xs border ${
                          performanceMode === mode
                            ? "bg-white text-black border-white"
                            : "bg-zinc-900 text-zinc-300 border-zinc-800"
                        }`}
                      >
                        {mode}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-zinc-500">
                <p>
                  Ingest:{" "}
                  {ingestSchedule
                    .filter((task) => task.shouldRun)
                    .map((task) => task.lane)
                    .join(", ") || "väntar"}
                </p>
                <p>
                  Quality: {dataQuality.accepted.length} accepted /{" "}
                  {dataQuality.rejected.length} rejected
                </p>
                <p>
                  Pipeline: {pipelineMetrics.totalPipelineMs}ms ·{" "}
                  {pipelineMetrics.freshnessLabel}
                </p>
                <p>
                  Render: max {performanceConfig.maxFeedItems} feed items · refresh{" "}
                  {performanceConfig.refreshMs / 1000}s
                </p>
              </div>
            </section>

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <p className="text-zinc-500 text-sm">Admin / live-loop debug</p>
                  <h2 className="text-xl font-bold">Pipeline health och edge-feedback</h2>
                </div>
                <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs w-fit">
                  Freshness {debugSnapshot?.freshness.freshnessScore ?? 0}/100
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-8 gap-3 text-sm">
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">Accepted</p>
                  <p className="text-lg font-bold">{debugSnapshot?.acceptedSignals ?? 0}</p>
                </div>
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">Rejected</p>
                  <p className="text-lg font-bold">{debugSnapshot?.rejectedSignals ?? 0}</p>
                </div>
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">False positive</p>
                  <p className="text-lg font-bold">{debugSnapshot?.falsePositiveRatio30d ?? 0}%</p>
                </div>
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">Continuation</p>
                  <p className="text-lg font-bold">
                    {debugSnapshot?.edgePerformance30d.continuationRate ?? 0}%
                  </p>
                </div>
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">Stealth hitrate</p>
                  <p className="text-lg font-bold">
                    {debugSnapshot?.edgePerformance30d.stealthSuccessRate ?? 0}%
                  </p>
                </div>
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">Decay</p>
                  <p className="text-lg font-bold">
                    {debugSnapshot?.edgePerformance30d.decayRate ?? 0}%
                  </p>
                </div>
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">News accepted</p>
                  <p className="text-lg font-bold">{debugSnapshot?.newsFeed?.accepted ?? 0}</p>
                </div>
                <div className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-500 text-xs">War Room</p>
                  <p className="text-lg font-bold">
                    {debugSnapshot?.latestWarRoom?.acceptedCount ?? 0}/
                    {debugSnapshot?.latestWarRoom?.rejectedCount ?? 0}
                  </p>
                </div>
              </div>

              {debugSnapshot?.latestWarRoom && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div className="border border-zinc-800 rounded-xl p-3">
                    <p className="text-zinc-500 mb-2">Rankades in</p>
                    {debugSnapshot.latestWarRoom.topPreOpenSetups.slice(0, 5).map((item, index) => (
                      <p key={`${item.ticker}-${item.trigger}-${index}-accepted`} className="text-zinc-300 truncate">
                        {item.ticker} ({item.exchange}): {item.preOpenScore}/100 · ticker {item.tickerConfidence}/100 · {item.trigger}
                      </p>
                    ))}
                  </div>
                  <div className="border border-zinc-800 rounded-xl p-3">
                    <p className="text-zinc-500 mb-2">Filtrerades bort</p>
                    {debugSnapshot.latestWarRoom.rejectedCandidates.slice(0, 5).map((item, index) => (
                      <p key={`${item.ticker}-${item.trigger}-${index}-rejected`} className="text-zinc-300 truncate">
                        {item.ticker}
                        {item.tickerValidation ? ` (${item.tickerValidation.identity.exchange}, ${item.tickerValidation.identity.sourceConfidence}/100)` : ""}:{" "}
                        {item.rejectedBecause[0]}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {debugSnapshot?.latestWarRoom?.tickerValidation && (
                <div className="mt-4 border-t border-zinc-900 pt-3">
                  <p className="text-zinc-500 text-sm mb-2">Ticker identity validation</p>
                  <div className="grid gap-1 text-xs">
                    {debugSnapshot.latestWarRoom.tickerValidation.confidenceBreakdown.slice(0, 10).map((item, index) => (
                      <div key={`${item.ticker}-${item.exchange}-${index}`} className="grid grid-cols-12 gap-2">
                        <span className="col-span-2 text-zinc-300">{item.displayTicker}</span>
                        <span className={item.displayable ? "col-span-2 text-emerald-300" : "col-span-2 text-red-300"}>
                          {item.confidence}/100
                        </span>
                        <span className="col-span-8 text-zinc-500 truncate">
                          {item.issues.join(" · ") || "OK"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugSnapshot?.outcomeLearning && (
                <div className="mt-4 border-t border-zinc-900 pt-3">
                  <p className="text-zinc-500 text-sm mb-2">Outcome learning</p>
                  {debugSnapshot.outcomeTracking && (
                    <div className="mb-3 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                      <span className="border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300">
                        Status {debugSnapshot.outcomeTracking.status}
                      </span>
                      <span className="border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300">
                        Pending {debugSnapshot.outcomeTracking.pendingSignals}
                      </span>
                      <span className="border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300">
                        Evaluerade {debugSnapshot.outcomeTracking.evaluatedSignals}
                      </span>
                      <span className="border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300">
                        Saknar data {debugSnapshot.outcomeTracking.missingOutcomeData}
                      </span>
                    </div>
                  )}
                  {debugSnapshot.outcomeCollector && (
                    <div className="mb-3 border border-zinc-800 rounded-xl p-3 text-xs">
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-zinc-300">
                        <span>Collector {debugSnapshot.outcomeCollector.status}</span>
                        <span>Processed {debugSnapshot.outcomeCollector.processed}</span>
                        <span>Updated {debugSnapshot.outcomeCollector.updated}</span>
                        <span>Pending {debugSnapshot.outcomeCollector.stillPending}</span>
                        <span>Dead {debugSnapshot.outcomeCollector.dead}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-2 text-zinc-500">
                        <span>
                          Senast {compactDate(debugSnapshot.outcomeCollector.lastRunAt)}
                        </span>
                        <span className="truncate">
                          Saknar market data:{" "}
                          {debugSnapshot.outcomeCollector.missingMarketDataByTicker
                            .slice(0, 4)
                            .map((item) => `${item.ticker} (${item.horizons.join("/")})`)
                            .join(", ") || "-"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                    <div className="border border-zinc-800 rounded-xl p-3">
                      <p className="text-zinc-500 mb-2">Bäst combos</p>
                      {debugSnapshot.outcomeLearning.topPerformingTriggerCombos.slice(0, 4).map((item) => (
                        <p key={item.key} className="text-zinc-300 truncate">
                          {item.key}: {item.winRate}% · cont {item.avgContinuation}
                        </p>
                      ))}
                    </div>
                    <div className="border border-zinc-800 rounded-xl p-3">
                      <p className="text-zinc-500 mb-2">Sämst combos</p>
                      {debugSnapshot.outcomeLearning.worstTriggerCombos.slice(0, 4).map((item) => (
                        <p key={item.key} className="text-zinc-300 truncate">
                          {item.key}: false {item.falsePositiveRate}% · fade {item.avgFadePct}%
                        </p>
                      ))}
                    </div>
                    <div className="border border-zinc-800 rounded-xl p-3">
                      <p className="text-zinc-500 mb-2">Regime/insider</p>
                      <p className="text-zinc-300">
                        False positive {debugSnapshot.outcomeLearning.falsePositiveRate}%
                      </p>
                      <p className="text-zinc-500">
                        Eval {debugSnapshot.outcomeLearning.evaluatedCount ?? 0} · pending {debugSnapshot.outcomeLearning.pendingCount ?? 0}
                      </p>
                      {debugSnapshot.outcomeLearning.insiderContinuationRanking.slice(0, 3).map((item, index) => (
                        <p key={`${item.ticker}-${index}-insider-learning`} className="text-zinc-300 truncate">
                          {item.ticker}: {item.continuationRate}% · n {item.sampleSize}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-2">
                {(debugSnapshot?.providerRuns ?? []).slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="grid grid-cols-12 gap-2 border-t border-zinc-900 pt-2 text-xs"
                  >
                    <span className="col-span-3 text-zinc-200">{run.provider}</span>
                    <span className={run.status === "success" ? "col-span-2 text-emerald-300" : "col-span-2 text-yellow-300"}>
                      {run.status}
                    </span>
                    <span className="col-span-2 text-zinc-400">{run.latencyMs}ms</span>
                    <span className="col-span-2 text-zinc-400">
                      {run.savedCount}/{run.fetchedCount}
                    </span>
                    <span className="col-span-3 text-zinc-500 text-right">
                      {compactDate(run.createdAt)}
                    </span>
                  </div>
                ))}
                {!debugSnapshot && (
                  <p className="text-zinc-500 text-sm">
                    Ingen debug-snapshot laddad. Kontrollera server-env och Supabase service role.
                  </p>
                )}
              </div>

              {(debugSnapshot?.newsFeed?.acceptedNewsItems.length ?? 0) > 0 && (
                <div className="mt-4 border-t border-zinc-900 pt-3">
                  <p className="text-zinc-500 text-sm mb-2">
                    Senaste accepterade nyheter
                  </p>
                  <div className="grid gap-2">
                    {debugSnapshot?.newsFeed?.acceptedNewsItems.slice(0, 10).map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 text-xs">
                        <span className="col-span-2 text-zinc-400">{item.tickers.join(", ") || "-"}</span>
                        <span className="col-span-6 text-zinc-200 truncate">{item.title}</span>
                        <span className="col-span-2 text-zinc-500">{item.source}</span>
                        <span className="col-span-2 text-zinc-500 text-right">
                          {compactDate(item.publishedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(debugSnapshot?.newsFeed?.sourceHealth.length ?? 0) > 0 && (
                <div className="mt-4 border-t border-zinc-900 pt-3">
                  <p className="text-zinc-500 text-sm mb-2">Source health / dedupe</p>
                  <div className="grid gap-1">
                    {debugSnapshot?.newsFeed?.sourceHealth.slice(0, 10).map((source) => (
                      <div key={source.source} className="grid grid-cols-12 gap-2 text-xs">
                        <span className="col-span-3 text-zinc-300">{source.source}</span>
                        <span className="col-span-2 text-zinc-500">{source.status}</span>
                        <span className="col-span-2 text-zinc-500">{source.freshness}</span>
                        <span className="col-span-2 text-zinc-500">{source.latencyMs}ms</span>
                        <span className="col-span-3 text-zinc-500 text-right">
                          {source.accepted}/{source.fetched} acc · dup {source.duplicateCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {feedMode === "fallback" && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-6 text-yellow-100">
                Ingen verifierad live-signal just nu. Fallback skapar inte längre
                War Room-case, assistent-alerts eller portföljåtgärder.
              </div>
            )}

            <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-5 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-zinc-500 text-sm">Morgonbrief</p>
                    <h2 className="text-2xl font-bold mt-1">
                      {morningBrief?.marketTone ?? "Live data ej aktiverad"}
                    </h2>
                  </div>
                  <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                    {marketSession.label} {marketSession.stockholmTime}
                  </span>
                </div>

                <p className="text-zinc-300 mt-4">
                  {morningBrief?.plainSwedishSummary ??
                    "Ingen verifierad live-signal just nu. Morgonbriefen väntar på live-data."}
                </p>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(morningBrief?.topCandidates ?? []).map(
                    (candidate) => (
                      <div
                        key={candidate.id}
                        className="border border-zinc-800 rounded-xl p-4 bg-black/25"
                      >
                        <p className="font-bold">{candidate.ticker}</p>
                        <p className={`text-2xl font-bold ${getScoreColor(candidate.raket_score)}`}>
                          {candidate.raket_score}/100
                        </p>
                        <p className="text-zinc-500 text-sm mt-1">
                          {candidate.why_moving[0] ?? "Bevaka ny trigger"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6">
                <p className="text-zinc-500 text-sm">Nästa scan</p>
                <h2 className="text-2xl font-bold mt-1">{nextScan.label}</h2>
                <p className="text-zinc-300 mt-3">{nextScan.reason}</p>
                <p className="text-zinc-500 text-sm mt-4">
                  Föreslagen tid: {compactDate(nextScan.runAt)}
                </p>
                <p className="text-yellow-300 text-sm mt-3">
                  Struktur redo för Supabase Edge Functions, Vercel Cron,
                  Cloudflare Workers Cron eller lokal dev.
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-zinc-500 text-sm">Aktiva alerts</p>
                    <h2 className="text-2xl font-bold">
                      {assistantAlerts.length} assistent-alerts
                    </h2>
                  </div>
                  <span className="bg-yellow-500/15 text-yellow-300 border border-yellow-500/25 px-3 py-1 rounded-full text-xs">
                    {feedMode === "live" ? "Live" : "Ingen live-signal"}
                  </span>
                </div>

                <div className="grid gap-3">
                  {assistantAlerts.length === 0 && (
                    <p className="text-zinc-400">
                      Inga nya regelbaserade alerts från nuvarande snapshot.
                    </p>
                  )}

                  {assistantAlerts.slice(0, 4).map((item) => (
                    <div
                      key={`${item.ticker}-${item.reason}`}
                      className="border border-zinc-800 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{item.ticker}</p>
                          <p className="text-zinc-300 text-sm mt-1">
                            {item.reason}
                          </p>
                        </div>
                        <span
                          className={`border px-2 py-1 rounded-full text-xs ${severityStyle(
                            item.severity
                          )}`}
                        >
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-sm mt-3">
                        {item.recommendedAction}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6">
                <p className="text-zinc-500 text-sm">Portföljåtgärder idag</p>
                <h2 className="text-2xl font-bold mt-1">
                  {morningBrief?.portfolioActions.length ?? 0} förslag
                </h2>

                <div className="grid gap-3 mt-4">
                  {(morningBrief?.portfolioActions ?? []).map((action) => (
                    <div
                      key={`${action.ticker}-${action.action}`}
                      className="border border-zinc-800 rounded-xl p-4"
                    >
                      <p className="font-bold">{action.ticker}</p>
                      <p className="text-zinc-300 mt-1">{action.action}</p>
                      <p className="text-zinc-500 text-sm mt-2">
                        {action.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-zinc-500 text-sm">Nyhetstriggers</p>
                  <h2 className="text-2xl font-bold">
                    {newsTriggers.length} detekterade triggers
                  </h2>
                </div>
                <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                  AI-klassning: förberedd
                </span>
              </div>

              {newsTriggers.length === 0 && (
                <p className="text-zinc-400">
                  Inga nyhetstriggers hittades. API-källa saknas eller feeden
                  saknar verifierade träffar.
                </p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {newsTriggers.slice(0, 8).map((item) => (
                  <div
                    key={`${item.newsId}-${item.trigger.type}`}
                    className="border border-zinc-800 rounded-xl p-4 bg-black/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{item.ticker}</p>
                        <p className="text-zinc-400 text-sm mt-1">
                          {item.title}
                        </p>
                      </div>
                      <span
                        className={`border px-2 py-1 rounded-full text-xs ${triggerDirectionStyle(
                          item.trigger.direction
                        )}`}
                      >
                        {item.trigger.direction}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-zinc-500 text-xs">Trigger</p>
                        <p className="text-sm font-semibold">
                          {item.trigger.type}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Impact</p>
                        <p className={`text-sm font-semibold ${getScoreColor(item.trigger.impactScore)}`}>
                          {item.trigger.impactScore}/100
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Confidence</p>
                        <p className="text-sm font-semibold">
                          {item.trigger.confidence}/100
                        </p>
                      </div>
                    </div>

                    <p className="text-zinc-300 text-sm mt-4">
                      {item.trigger.evidence}
                    </p>
                    <p className="text-yellow-200 text-sm mt-3">
                      {item.trigger.suggestedAction}
                    </p>
                    <p className="text-zinc-500 text-xs mt-3">
                      {item.source} · {compactDate(item.publishedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-6">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
                <div>
                  <p className="text-zinc-500 text-sm">
                    Live Intelligence Dashboard
                  </p>
                  <h2 className="text-3xl font-bold">
                    Något håller på att hända
                  </h2>
                  <p className="text-zinc-500 text-sm mt-2">
                    Källa: {intelligenceMode}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={runPipelineNow}
                    disabled={isRunningPipeline}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-green-500/50 px-3 py-1 rounded-full text-sm disabled:opacity-60"
                  >
                    {isRunningPipeline ? "Kör pipeline..." : "Kör pipeline"}
                  </button>
                  <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
                    Top conviction: {intelligenceReport.topRanked[0]?.ticker}
                  </span>
                  <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
                    Feed: {unifiedSignalFeed.length} signaler
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-5">
                <div className="grid gap-5">
                  <TopRankedPanel stocks={intelligenceReport.topRanked} />
                  <InsiderFlowPanel report={intelligenceReport} />
                </div>
                <SignalFeed items={unifiedSignalFeed} />
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                <NarrativeHeatmap
                  narratives={intelligenceReport.strongestNarratives}
                />
                <SocialMomentumPanel report={intelligenceReport} />
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-zinc-500 text-sm">Squeeze Watchlist</p>
                  <p className="text-3xl font-bold mt-2">
                    {intelligenceReport.highestSqueezeScore.ticker}
                  </p>
                  <p className="text-orange-200 mt-2">
                    {intelligenceReport.highestSqueezeScore.score}/100
                  </p>
                  <p className="text-zinc-500 text-sm mt-3">
                    {intelligenceReport.highestSqueezeScore.factors.join(", ")}
                  </p>
                  <p className="text-yellow-200 text-sm mt-4">
                    Ingen verifierad live-signal. Provider-lagret är redo för X, Reddit,
                    Discord, Placera, Flashback, Finansinspektionen,
                    Avanza/Nordnet sentiment och microstructure APIs.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-zinc-500 text-sm">
                    Edge Validation Engine
                  </p>
                  <h2 className="text-2xl font-bold">
                    Lärande från historiska runners
                  </h2>
                </div>
                <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                  Hit rate {learningSummary.bestEdge?.historicalWinrate ?? 0}%
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs">Historical hit rate</p>
                  <p className="text-2xl font-bold text-emerald-300">
                    {learningSummary.bestEdge?.historicalWinrate ?? 0}%
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    {learningSummary.bestEdge?.signalCombo}
                  </p>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs">Best signal combo</p>
                  <p className="text-lg font-bold">
                    {edgeScores[0]?.signalCombo}
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    Edge {edgeScores[0]?.edgeScore}/100 · avg upside{" "}
                    {edgeScores[0]?.averageUpside}%
                  </p>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs">
                    Highest conviction setups
                  </p>
                  <p className="text-lg font-bold">
                    {learningSummary.asymmetric
                      .filter((item) => item.score >= 70)
                      .map((item) => item.ticker)
                      .join(", ") || "-"}
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    Asymmetri före retail
                  </p>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs">
                    Recent winners detected
                  </p>
                  <p className="text-lg font-bold">
                    {learningSummary.recentWinners
                      .map((item) => item.ticker)
                      .join(", ") || "-"}
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    Liknar tidigare runner
                  </p>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-xs">
                    Discovered before breakout
                  </p>
                  <p className="text-lg font-bold">
                    {learningSummary.patternMatches[0]?.ticker ?? "-"}
                  </p>
                  <p className="text-zinc-500 text-xs mt-2">
                    {learningSummary.patternMatches[0]?.type ?? "Inväntar data"}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-zinc-500 text-sm mb-2">Pattern memory</p>
                  <div className="grid gap-2">
                    {learningSummary.patternMatches.slice(0, 4).map((item) => (
                      <div
                        key={`${item.ticker}-${item.type}`}
                        className="border border-zinc-800 rounded-xl p-3"
                      >
                        <p className="font-semibold">
                          {item.ticker}: {item.type}
                        </p>
                        <p className="text-zinc-500 text-xs mt-1">
                          Confidence {item.confidence}/100 ·{" "}
                          {item.evidence.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-zinc-500 text-sm mb-2">Noise filter</p>
                  <div className="grid gap-2">
                    {learningSummary.noise.slice(0, 4).map((item, index) => (
                      <div
                        key={`${item.ticker}-${index}-noise`}
                        className="border border-zinc-800 rounded-xl p-3"
                      >
                        <p className="font-semibold">
                          {item.ticker}: {item.pass ? "godkänd" : "filtrera"}
                        </p>
                        <p className="text-zinc-500 text-xs mt-1">
                          Noise {item.noiseScore}/100 ·{" "}
                          {item.reasons.join(", ") || "ingen större brusflagga"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-zinc-500 text-sm">Early Discovery</p>
                  <h2 className="text-2xl font-bold">
                    Pre-breakout setups och analoger
                  </h2>
                </div>
                <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                  {analogDiscovery[0]?.ticker}: conviction{" "}
                  {analogDiscovery[0]?.conviction.convictionScore}/100
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {analogDiscovery.slice(0, 3).map((item, index) => (
                  <div
                    key={`${item.ticker}-${index}-analog`}
                    className="border border-zinc-800 rounded-xl p-4 bg-black/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl font-bold">{item.ticker}</p>
                        <p className="text-zinc-500 text-sm mt-1">
                          {item.psychology.phase}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-300 font-bold">
                          {item.preBreakout.score}
                        </p>
                        <p className="text-zinc-500 text-xs">pre-breakout</p>
                      </div>
                    </div>

                    <p className="text-zinc-300 text-sm mt-4">
                      {item.explanation}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-zinc-500 text-xs">Analog</p>
                        <p className="text-sm font-semibold">
                          {item.analog.bestMatch.analog.name}
                        </p>
                        <p className="text-zinc-500 text-xs">
                          {item.analog.bestMatch.similarityScore}% likhet
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">
                          Market missing this
                        </p>
                        <p className="text-sm font-semibold">
                          {item.blindspot.score}/100
                        </p>
                        <p className="text-zinc-500 text-xs">
                          {item.blindspot.blindspots[0] ?? "Ingen blindspot"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {item.preBreakout.evidence.slice(0, 4).map((evidence) => (
                        <p key={evidence} className="text-zinc-400 text-xs">
                          {evidence}
                        </p>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2 flex-wrap">
                      {[
                        item.fingerprint.accumulationPattern,
                        item.fingerprint.socialVelocity,
                        item.fingerprint.floatCharacteristics,
                      ].map((tag) => (
                        <span
                          key={tag}
                          className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-1 rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-zinc-500 text-sm">
                    Real-Time Execution Intelligence
                  </p>
                  <h2 className="text-2xl font-bold">
                    TOP 5 JUST NOW
                  </h2>
                </div>
                <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                  Stream redo för Supabase Realtime / SSE / WebSocket
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
                {topFiveJustNow.map((item, index) => (
                  <div
                    key={`${item.ticker}-${index}-top-now`}
                    className="border border-zinc-800 rounded-xl p-4 bg-black/20"
                  >
                    <p className="text-zinc-500 text-xs">#{index + 1}</p>
                    <p className="text-2xl font-bold">{item.ticker}</p>
                    <p className="text-emerald-300 font-bold">
                      {item.score}/100
                    </p>
                    <p className="text-zinc-500 text-xs mt-2">{item.reason}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-3">
                    Immediate Opportunities
                  </p>
                  <div className="grid gap-2">
                    {timingByTicker
                      .filter((item) => item.timing.phase === "optimal")
                      .map((item, index) => (
                        <p key={`${item.ticker}-${index}-optimal`} className="text-zinc-200 text-sm">
                          {item.ticker}: {item.timing.reason}
                        </p>
                      ))}
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-3">Early Setups</p>
                  <div className="grid gap-2">
                    {timingByTicker
                      .filter((item) => item.timing.phase === "early")
                      .map((item, index) => (
                        <p key={`${item.ticker}-${index}-early`} className="text-zinc-200 text-sm">
                          {item.ticker}: {item.timing.reason}
                        </p>
                      ))}
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-3">
                    Real-Time Alerts
                  </p>
                  <div className="grid gap-2">
                    {realtimeAlerts.slice(0, 4).map((item) => (
                      <p key={`${item.ticker}-${item.type}`} className="text-zinc-200 text-sm">
                        {item.ticker}: urgency {item.urgency}/100 ·{" "}
                        {item.actionableSummary}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-3">
                    Crowd Noticing Now
                  </p>
                  <div className="grid gap-2">
                    {intelligenceReport.inputs
                      .filter((item) => item.social.velocityScore >= 70)
                      .map((item, index) => (
                        <p key={`${item.ticker}-${index}-crowd`} className="text-zinc-200 text-sm">
                          {item.ticker}: velocity {item.social.velocityScore}
                        </p>
                      ))}
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-3">Losing Edge</p>
                  <div className="grid gap-2">
                    {decaySignals
                      .filter((item) => item.state !== "strengthening")
                      .slice(0, 4)
                      .map((item) => (
                        <p key={`${item.ticker}-${item.state}`} className="text-zinc-200 text-sm">
                          {item.ticker}: {item.state} · {item.reason}
                        </p>
                      ))}
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-3">
                    Failed Breakouts
                  </p>
                  <div className="grid gap-2">
                    {decaySignals
                      .filter((item) => item.state === "failed_breakout")
                      .map((item, index) => (
                        <p key={`${item.ticker}-${index}-failed`} className="text-zinc-200 text-sm">
                          {item.ticker}: {item.reason}
                        </p>
                      ))}
                    {decaySignals.every(
                      (item) => item.state !== "failed_breakout"
                    ) && (
                      <p className="text-zinc-500 text-sm">
                        Inga failed breakouts i nuvarande feed.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-zinc-500 text-sm">Portfolio Brain</p>
                  <h2 className="text-2xl font-bold">
                    Kapital mot högsta edge
                  </h2>
                </div>
                <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                  Regime: {regime.riskMode}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
                <div className="grid gap-3">
                  {portfolioBrain.allocations.slice(0, 5).map((item, index) => (
                    <div
                      key={`${item.ticker}-${item.capitalTier}-${index}`}
                      className="grid grid-cols-[5rem_1fr_auto] gap-3 border border-zinc-800 rounded-xl p-4"
                    >
                      <div>
                        <p className="font-bold">{item.ticker}</p>
                        <p className="text-zinc-500 text-xs">
                          {item.capitalTier}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-200 text-sm">{item.reason}</p>
                        <p className="text-zinc-500 text-xs mt-1">
                          Personal conviction{" "}
                          {personalizeConviction(
                            intelligenceReport.topRanked.find(
                              (stock) => stock.ticker === item.ticker
                            ) ?? intelligenceReport.topRanked[0]
                          )}
                          /100
                        </p>
                      </div>
                      <p className="text-emerald-300 font-bold">
                        {item.suggestedWeightPercent}%
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4">
                  <div className="border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-sm">Exponering</p>
                    <p className="text-2xl font-bold">
                      {portfolioBrain.exposure.concentrationRisk}/100
                    </p>
                    <p className="text-zinc-500 text-xs mt-2">
                      Småbolag {portfolioBrain.exposure.smallCapExposure}% ·{" "}
                      {portfolioBrain.exposure.crowdedThemes.join(", ") ||
                        "ingen crowding"}
                    </p>
                  </div>

                  <div className="border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-sm">Adaptive weights</p>
                    <p className="text-zinc-300 text-sm mt-2">
                      insider {adaptiveWeights.insider.toFixed(2)} · social{" "}
                      {adaptiveWeights.social.toFixed(2)} · squeeze{" "}
                      {adaptiveWeights.squeeze.toFixed(2)}
                    </p>
                    <p className="text-zinc-500 text-xs mt-2">
                      Vikter justeras efter historisk edge och regime.
                    </p>
                  </div>

                  <div className="border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-sm">Capital rotation</p>
                    <p className="text-zinc-300 text-sm mt-2">
                      {capitalRotation.reason}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-2">
                    Watchlist evolution
                  </p>
                  {watchlistEvolution.slice(0, 3).map((item, index) => (
                    <p key={`${item.ticker}-${item.state}-${index}`} className="text-zinc-300 text-sm">
                      {item.ticker}: {item.state}
                    </p>
                  ))}
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-2">Why this now?</p>
                  {whyNowItems.slice(0, 2).map((item, index) => (
                    <p key={`${item.ticker}-${index}-why-now`} className="text-zinc-300 text-sm mb-2">
                      {item.explanation}
                    </p>
                  ))}
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm mb-2">
                    Trade memory
                  </p>
                  {tradeMemory.map((item, index) => (
                    <p key={`${item.ticker}-${index}-trade-memory`} className="text-zinc-300 text-sm">
                      {item.note}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-zinc-500 text-sm">Precision Mode</p>
                  <h2 className="text-2xl font-bold">
                    Få, högkvalitativa setups
                  </h2>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    ["ALL", "ALL"],
                    ["HIGH_CONVICTION", "HIGH CONVICTION"],
                    ["EARLY_ONLY", "EARLY ONLY"],
                    ["STEALTH_ONLY", "STEALTH ONLY"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPrecisionMode(key as PrecisionMode)}
                      className={`px-3 py-1 rounded-full text-xs border ${
                        precisionMode === key
                          ? "bg-white text-black border-white"
                          : "bg-zinc-900 text-zinc-300 border-zinc-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[5rem_5rem_1fr_5rem_5rem_5rem] gap-3 px-4 py-2 text-zinc-500 text-xs border-b border-zinc-800">
                    <span>Ticker</span>
                    <span>Conv</span>
                    <span>Why now</span>
                    <span>Timing</span>
                    <span>Edge</span>
                    <span>Crowd</span>
                  </div>
                  {precisionResult.survivors.map((stock) => {
                    const timing = timingByTicker.find(
                      (item) => item.ticker === stock.ticker
                    )?.timing;
                    const crowding = crowdingSignals.find(
                      (item) => item.ticker === stock.ticker
                    );
                    const whyNow = whyNowItems.find(
                      (item) => item.ticker === stock.ticker
                    );
                    const quality = portfolioBrain.qualities.find(
                      (item) => item.ticker === stock.ticker
                    );
                    const decay = decaySignals.find(
                      (item) => item.ticker === stock.ticker
                    );

                    return (
                      <div
                        key={`${stock.ticker}-${stock.totalScore}-${stock.conviction}`}
                        className="grid grid-cols-[5rem_5rem_1fr_5rem_5rem_5rem] gap-3 px-4 py-3 text-sm border-b border-zinc-900 last:border-b-0"
                      >
                        <span className="font-bold">{stock.ticker}</span>
                        <span className="text-emerald-300">
                          {stock.conviction}
                        </span>
                        <span className="text-zinc-300">
                          {whyNow?.timingChangedBecause ?? stock.reasons[0]}
                        </span>
                        <span className="text-zinc-400">
                          {timing?.phase ?? "-"}
                        </span>
                        <span className="text-zinc-300">
                          {quality?.totalQuality ?? stock.totalScore}
                        </span>
                        <span
                          className={
                            (crowding?.crowdingScore ?? 0) >= 60
                              ? "text-red-300"
                              : "text-zinc-400"
                          }
                        >
                          {crowding?.crowdingScore ?? 0}
                        </span>
                        <span className="col-span-6 text-zinc-500 text-xs">
                          Decay: {decay?.state ?? "strengthening"} · Liquidity
                          quality {quality?.liquidityQuality ?? "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-4">
                  <div className="border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-sm">Filtreras bort</p>
                    <div className="mt-3 grid gap-2">
                      {precisionResult.filteredOut.slice(0, 6).map((item) => (
                        <p key={`${item.ticker}-${item.reason}`} className="text-zinc-300 text-sm">
                          {item.ticker}: {item.reason}
                        </p>
                      ))}
                      {precisionResult.filteredOut.length === 0 && (
                        <p className="text-zinc-500 text-sm">
                          Inget filtrerat i valt läge.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-sm">Crowding detector</p>
                    <div className="mt-3 grid gap-2">
                      {crowdingSignals.map((item, index) => (
                        <p key={`${item.ticker}-${index}-crowding`} className="text-zinc-300 text-sm">
                          {item.ticker}: {item.crowdingScore}/100{" "}
                          {item.evidence.join(", ")}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 md:p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-zinc-500 text-sm">Morning War Room</p>
                  <h2 className="text-2xl font-bold">
                    Dagens beslutsyta
                  </h2>
                </div>
                <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                  Fast lane {latencyLanes.fastLane.length} · Slow lane{" "}
                  {latencyLanes.slowLane.length}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-4">
                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm">Top conviction</p>
                  <p className="text-xl font-bold mt-2">
                    {dailyBrief.topConviction}
                  </p>
                  <p className="text-zinc-500 text-sm mt-3">
                    {dailyBrief.changedOvernight}
                  </p>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm">Stealth / insider</p>
                  <p className="text-xl font-bold mt-2">
                    {dailyBrief.stealthSetups}
                  </p>
                  <p className="text-zinc-500 text-sm mt-3">
                    {dailyBrief.marketIgnores}
                  </p>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm">Crowding / lost edge</p>
                  <p className="text-zinc-300 mt-2">{dailyBrief.becomingCrowded}</p>
                  <p className="text-zinc-500 text-sm mt-3">
                    {dailyBrief.lostEdge}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm">Execution watchlist</p>
                  <div className="mt-3 grid gap-2">
                    {watchlistPings.slice(0, 5).map((ping) => (
                      <p key={`${ping.ticker}-${ping.type}`} className="text-zinc-300 text-sm">
                        {ping.ticker}: {ping.message}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm">Signal timeline</p>
                  <div className="mt-3 grid gap-2">
                    {signalTimeline.slice(0, 5).map((item) => (
                      <p key={`${item.label}-${item.timestamp}`} className="text-zinc-300 text-sm">
                        {item.label}: {item.value}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="border border-zinc-800 rounded-xl p-4">
                  <p className="text-zinc-500 text-sm">Latency priorities</p>
                  <p className="text-zinc-300 text-sm mt-3">
                    FAST: alerts, conviction jumps, insider spikes och momentum.
                  </p>
                  <p className="text-zinc-500 text-sm mt-2">
                    SLOW: {latencyLanes.slowLane.join(", ")}.
                  </p>
                </div>
              </div>

              <div className="mt-4 border border-zinc-800 rounded-xl p-4 bg-black/20">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="text-zinc-500 text-sm">FI Insider Live</p>
                    <h3 className="text-lg font-semibold">Verkliga insider-signaler</h3>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs ${
                    liveInsiderMode === "stored"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                  }`}>
                    {liveInsiderMode === "stored"
                      ? `${liveInsiderEvents.length} lagrade events`
                      : "Väntar på lagrad FI-data"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {liveInsiderEvents.slice(0, 6).map((event) => (
                    <div
                      key={event.id}
                      className="grid grid-cols-12 gap-2 border-t border-zinc-900 pt-2 text-sm"
                    >
                      <span className="col-span-2 font-semibold text-zinc-100">
                        {event.ticker}
                      </span>
                      <span className={event.type === "buy" ? "col-span-2 text-emerald-300" : "col-span-2 text-red-300"}>
                        {event.type === "buy" ? "Köp" : "Sälj"}
                      </span>
                      <span className="col-span-4 text-zinc-300 truncate">
                        {event.insiderName}
                      </span>
                      <span className="col-span-2 text-zinc-400">
                        {formatSek(event.valueSek)}
                      </span>
                      <span className="col-span-2 text-zinc-500 text-right">
                        {event.date}
                      </span>
                    </div>
                  ))}

                  {liveInsiderEvents.length === 0 && (
                    <p className="text-zinc-500 text-sm">
                      Inga lagrade FI-events ännu. Kör pipeline när
                      SUPABASE_SERVICE_ROLE_KEY och FI-källan är aktiva.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="mb-6">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
                <div>
                  <p className="text-zinc-500 text-sm">Market Intelligence Engine v1</p>
                  <h2 className="text-3xl font-bold">
                    Edge före vanliga börsappar
                  </h2>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
                    Högsta squeeze: {intelligenceReport.highestSqueezeScore.ticker} {intelligenceReport.highestSqueezeScore.score}/100
                  </span>
                  <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
                    Starkast insider: {intelligenceReport.strongestInsiderAccumulation.ticker} {intelligenceReport.strongestInsiderAccumulation.score}/100
                  </span>
                </div>
              </div>

              <div className="grid gap-5">
                {intelligenceReport.topRanked.slice(0, 3).map((stock) => {
                  const input = intelligenceReport.inputs.find(
                    (item) => item.ticker === stock.ticker
                  );

                  if (!input) return null;

                  return (
                    <IntelligenceCard
                      key={`${stock.ticker}-${stock.totalScore}-${stock.conviction}-intelligence`}
                      stock={stock}
                      input={input}
                    />
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-zinc-500 text-sm">Starkaste narrativ</p>
                  <div className="mt-3 grid gap-2">
                    {intelligenceReport.strongestNarratives
                      .slice(0, 3)
                      .map((item) => (
                        <p key={`${item.ticker}-${item.narrative}`} className="text-zinc-200">
                          {item.ticker}: {item.narrative} ({item.strength})
                        </p>
                      ))}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-zinc-500 text-sm">Ovanlig aktivitet</p>
                  <div className="mt-3 grid gap-2">
                    {intelligenceReport.unusualActivity.slice(0, 3).map((item, index) => (
                      <p key={`${item.ticker}-${index}-unusual`} className="text-zinc-200">
                        {item.ticker}: social {item.socialScore}/100
                      </p>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <p className="text-zinc-500 text-sm">Datastatus</p>
                  <p className="text-yellow-200 mt-3">
                    Ingen verifierad live-signal. Provider-lagret är redo för X, Reddit,
                    Discord, Placera, Flashback, insiderdata och squeeze-metrics.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex gap-2 flex-wrap mb-6">
              {filters.map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`px-4 py-2 rounded-full text-sm border transition ${
                    filter === item
                      ? "bg-white text-black border-white"
                      : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <section className="grid gap-5">
              {filteredSignals.length === 0 && (
                <EmptyState
                  title="Ingen signalhistorik ännu"
                  body="När stock_signals fylls i Supabase visas historik, score och AI-motivering här."
                />
              )}

              {filteredSignals.map((signal) => (
                <button
                  key={signal.id}
                  onClick={() => setSelectedSignal(signal)}
                  className="text-left bg-zinc-900 border border-zinc-800 hover:border-green-500/60 transition rounded-2xl p-5 md:p-6"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-3xl font-bold">{signal.ticker}</h2>

                        <span
                          className={`border px-3 py-1 rounded-full text-xs font-semibold ${getActionStyle(
                            signal.score
                          )}`}
                        >
                          {signal.action}
                        </span>
                      </div>

                      <p className="text-zinc-400 text-lg mt-1">
                        {signal.company_name}
                      </p>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-3xl font-bold ${getScoreColor(
                          signal.score
                        )}`}
                      >
                        {signal.score}/100
                      </div>

                      <div className="text-sm text-zinc-500">
                        {compactDate(signal.detected_at)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="inline-block bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm">
                      {signal.signal_type}
                    </div>

                    <p className="text-zinc-300 mt-4">{signal.description}</p>

                    <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
                      {signal.factors.slice(0, 6).map((factor) => (
                        <div
                          key={factor.key}
                          className="border border-zinc-800 rounded-xl p-3 bg-black/25"
                        >
                          <p className="text-zinc-500 text-xs">
                            {factor.label}
                          </p>
                          <p
                            className={`text-lg font-bold ${getScoreColor(
                              factor.score
                            )}`}
                          >
                            {factor.score}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </section>
          </>
        )}

        {!isLoading && view === "portfolio" && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Portföljvärde</p>
                <p className="text-2xl font-bold">
                  {sek(portfolioStats.value)}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Investerat</p>
                <p className="text-2xl font-bold">
                  {sek(portfolioStats.invested)}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Resultat</p>
                <p
                  className={`text-2xl font-bold ${
                    portfolioStats.pnl >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {sek(portfolioStats.pnl)}
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Utveckling</p>
                <p
                  className={`text-2xl font-bold ${
                    portfolioStats.pnlPct >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {pct(portfolioStats.pnlPct)}
                </p>
              </div>
            </section>

            <section className="grid gap-5">
              {portfolio.length === 0 && (
                <EmptyState
                  title="Ingen sparad portfölj ännu"
                  body="Din portfölj är personlig och hämtas med auth.uid() från portfolio_positions."
                />
              )}

              {portfolio.map((item) => {
                const invested = item.shares * item.average_price;
                const value = item.shares * item.current_price;
                const pnl = value - invested;
                const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

                return (
                  <div
                    key={item.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6"
                  >
                    <div className="flex flex-col md:flex-row md:justify-between gap-5">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-3xl font-bold">{item.ticker}</h2>

                          <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 px-3 py-1 rounded-full text-xs font-semibold">
                            {item.status}
                          </span>
                        </div>

                        <p className="text-zinc-400 text-lg mt-1">
                          {item.company_name}
                        </p>

                        <p className="text-zinc-300 mt-4">
                          {item.thesis ?? "Investeringscase saknas ännu."}
                        </p>

                        <p className="text-orange-300 mt-3 text-sm">
                          Risk: {item.risk_note ?? "Ej angiven"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:text-right min-w-56">
                        <div>
                          <p className="text-zinc-500 text-sm">Värde</p>
                          <p className="text-xl font-bold">{sek(value)}</p>
                        </div>

                        <div>
                          <p className="text-zinc-500 text-sm">P/L</p>
                          <p
                            className={`text-xl font-bold ${
                              pnl >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {sek(pnl)} · {pct(pnlPct)}
                          </p>
                        </div>

                        <div>
                          <p className="text-zinc-500 text-sm">GAV / Nu</p>
                          <p className="text-zinc-200">
                            {item.average_price} → {item.current_price}
                          </p>
                        </div>

                        <div>
                          <p className="text-zinc-500 text-sm">Antal</p>
                          <p className="text-zinc-200">{item.shares}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {!isLoading && view === "watchlist" && (
          <section className="grid gap-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Listor</p>
                <p className="text-2xl font-bold">{watchlists.length}</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Bevakade bolag</p>
                <p className="text-2xl font-bold">{watchlistItems.length}</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Högsta prioritet</p>
                <p className="text-2xl font-bold">
                  {watchlistItems.filter((item) => item.priority <= 2).length}
                </p>
              </div>
            </div>

            {watchlists.length === 0 && (
              <EmptyState
                title="Ingen watchlist ännu"
                body="Dina listor hämtas med auth.uid() från watchlists och watchlist_items."
              />
            )}

            {watchlists.map((watchlist) => (
              <div
                key={watchlist.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold">{watchlist.name}</h2>
                      {watchlist.is_default && (
                        <span className="bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                          Standard
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400 mt-1">
                      {watchlist.description ?? "Ingen beskrivning"}
                    </p>
                  </div>

                  <p className="text-zinc-500 text-sm">
                    {watchlist.watchlist_items.length} bolag
                  </p>
                </div>

                <div className="mt-5 grid gap-3">
                  {watchlist.watchlist_items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 md:items-center border border-zinc-800 rounded-xl p-4"
                    >
                      <div>
                        <p className="font-bold text-xl">{item.ticker}</p>
                        <p className="text-zinc-400">{item.company_name}</p>
                        {item.notes && (
                          <p className="text-zinc-300 mt-2">{item.notes}</p>
                        )}
                      </div>

                      <div className="text-zinc-300 md:text-right">
                        <p className="text-zinc-500 text-sm">Entry / Exit</p>
                        <p>
                          {item.target_entry ?? "-"} / {item.target_exit ?? "-"}
                        </p>
                      </div>

                      <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm w-fit">
                        Prio {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {!isLoading && view === "alerts" && (
          <section className="grid gap-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Aktiva alerts</p>
                <p className="text-2xl font-bold">{activeAlerts.length}</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Totalt</p>
                <p className="text-2xl font-bold">{alerts.length}</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-zinc-500 text-sm">Triggade</p>
                <p className="text-2xl font-bold">
                  {alerts.filter((alert) => alert.triggered_at).length}
                </p>
              </div>
            </div>

            {alerts.length === 0 && (
              <EmptyState
                title="Inga alerts ännu"
                body="Alerts är personlig data och filtreras på auth.uid()."
              />
            )}

            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-3xl font-bold">{alert.ticker}</h2>
                      <span
                        className={`border px-3 py-1 rounded-full text-xs font-semibold ${
                          alert.is_active
                            ? "bg-green-500/20 text-green-300 border-green-500/30"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {alert.is_active ? "Aktiv" : "Pausad"}
                      </span>
                    </div>

                    <p className="text-zinc-400 text-lg mt-1">
                      {alert.company_name ?? alertLabel(alert.alert_type)}
                    </p>

                    <p className="text-zinc-300 mt-4">{alert.message}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:text-right min-w-48">
                    <div>
                      <p className="text-zinc-500 text-sm">Typ</p>
                      <p className="font-semibold">
                        {alertLabel(alert.alert_type)}
                      </p>
                    </div>

                    <div>
                      <p className="text-zinc-500 text-sm">Tröskel</p>
                      <p className="font-semibold">
                        {alert.threshold_value ?? "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-zinc-500 text-sm">Senast triggad</p>
                      <p className="font-semibold">
                        {compactDate(alert.triggered_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {!isLoading && view === "analysis" && (
          <section className="grid gap-5">
            {analyses.length === 0 && (
              <EmptyState
                title="Inga AI-analyser ännu"
                body="När ai_analyses skapas för din användare visas thesis, case och rekommendation här."
              />
            )}

            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-3xl font-bold">{analysis.ticker}</h2>
                      {analysis.recommendation && (
                        <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 px-3 py-1 rounded-full text-xs font-semibold">
                          {analysis.recommendation}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-lg mt-1">
                      {analysis.company_name ?? analysis.analysis_type}
                    </p>
                    <p className="text-zinc-300 mt-4">{analysis.thesis}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:text-right min-w-48">
                    <div>
                      <p className="text-zinc-500 text-sm">Confidence</p>
                      <p className="font-semibold">
                        {analysis.confidence ?? "-"}%
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-sm">Skapad</p>
                      <p className="font-semibold">
                        {compactDate(analysis.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-sm">Modell</p>
                      <p className="font-semibold">{analysis.model ?? "-"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {selectedSignal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex justify-between gap-6">
              <div>
                <h2 className="text-4xl font-bold">{selectedSignal.ticker}</h2>
                <p className="text-zinc-400 text-xl">
                  {selectedSignal.company_name}
                </p>
              </div>

              <button
                onClick={() => setSelectedSignal(null)}
                className="text-zinc-400 hover:text-white"
              >
                Stäng
              </button>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900 rounded-2xl p-5">
                <div className="text-zinc-500 text-sm">Score</div>
                <div
                  className={`text-4xl font-bold ${getScoreColor(
                    selectedSignal.score
                  )}`}
                >
                  {selectedSignal.score}/100
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-5">
                <div className="text-zinc-500 text-sm">Beslut</div>

                <div
                  className={`inline-block mt-2 border px-3 py-1 rounded-full text-sm font-semibold ${getActionStyle(
                    selectedSignal.score
                  )}`}
                >
                  {selectedSignal.action}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-5">
                <div className="text-zinc-500 text-sm">Confidence</div>
                <div className="text-3xl font-bold text-cyan-400">
                  {selectedSignal.confidence ?? "-"}%
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-5">
                <div className="text-zinc-500 text-sm">Tidshorisont</div>
                <div className="text-xl font-semibold">
                  {selectedSignal.time_horizon ?? "-"}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-5">
                <div className="text-zinc-500 text-sm">Trigger</div>
                <div className="text-lg font-semibold">
                  {selectedSignal.trigger_source ?? "-"}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-2xl p-5">
                <div className="text-zinc-500 text-sm">Risknivå</div>
                <div className="text-lg font-semibold text-orange-400">
                  {selectedSignal.risk_level ?? "-"}
                </div>
              </div>
            </div>

            <div className="mt-6 bg-zinc-900 rounded-2xl p-5">
              <div className="text-zinc-500 text-sm mb-3">Why moving?</div>
              <div className="grid gap-3">
                {selectedSignal.why_moving.map((reason) => (
                  <div
                    key={reason}
                    className="border border-zinc-800 rounded-xl p-3 text-zinc-200"
                  >
                    {reason}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 bg-zinc-900 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-zinc-500 text-sm">AI summary</div>
                  <div className="text-xl font-semibold">
                    Confidence {selectedSignal.ai_summary.confidence}%
                  </div>
                </div>
                <span className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 px-3 py-1 rounded-full text-xs font-semibold">
                  Edge engine v1
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["Bullish", selectedSignal.ai_summary.bullish],
                  ["Bearish", selectedSignal.ai_summary.bearish],
                  ["Risker", selectedSignal.ai_summary.risks],
                  ["Triggers", selectedSignal.ai_summary.triggers],
                ].map(([title, items]) => (
                  <div key={title as string} className="border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-sm mb-2">{title as string}</p>
                    <div className="grid gap-2">
                      {(items as string[]).map((item) => (
                        <p key={item} className="text-zinc-200 text-sm">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 bg-zinc-900 rounded-2xl p-5">
              <div className="text-zinc-500 text-sm mb-2">Signaltyp</div>
              <div className="text-white text-lg">
                {selectedSignal.signal_type}
              </div>
            </div>

            <div className="mt-6 bg-zinc-900 rounded-2xl p-5">
              <div className="text-zinc-500 text-sm mb-2">AI-motivering</div>
              <p className="text-zinc-200 leading-relaxed">
                {selectedSignal.ai_reason ?? "Saknas ännu."}
              </p>
            </div>

            <div className="mt-6 bg-zinc-900 rounded-2xl p-5">
              <div className="text-zinc-500 text-sm mb-2">Analys</div>
              <p className="text-zinc-200">{selectedSignal.description}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
