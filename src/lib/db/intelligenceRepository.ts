import { createClient } from "@supabase/supabase-js";
import type { InsiderEvent } from "@/lib/intelligence/insider/insiderTypes";
import type { IntelligenceReport } from "@/lib/intelligence/mockData";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import type { SocialMention } from "@/lib/intelligence/social/socialTypes";
import type { AlertPriority } from "@/lib/intelligence/alerts/priorityEngine";
import { analyzeOutcomePerformance, type OutcomePerformanceAnalytics } from "@/lib/intelligence/performanceAnalytics";
import type { DetailedSignalOutcome } from "@/lib/intelligence/outcomeTracker";
import {
  buildOutcomeLearningReport,
  type OutcomeLearningReport,
  type RawSignalOutcomeRow,
} from "@/lib/intelligence/outcomeLearningEngine";
import type {
  MorningWarRoomInput,
  MorningWarRoomResult,
} from "@/lib/intelligence/morningWarRoom";

export interface LatestIntelligenceSnapshot {
  generatedAt: string;
  mode: "stored" | "empty";
  report: IntelligenceReport;
  signalFeed: SignalFeedItem[];
  alerts: Array<{
    ticker: string;
    alertType: string;
    priority: AlertPriority;
    reason: string;
    triggeredAt: string;
  }>;
}

export interface StoredInsiderEvent extends InsiderEvent {
  id: string;
  source: string;
  createdAt: string;
  dedupeKey: string | null;
}

export interface ProviderRunLog {
  provider: string;
  status: "success" | "empty" | "error" | "skipped";
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  fetchedCount: number;
  savedCount: number;
  errorMessage?: string;
  rawPayload?: unknown;
}

export interface IntelligenceDebugSnapshot {
  generatedAt: string;
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
  newsFeed: {
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
      error?: string;
    }>;
    dedupeStats: {
      fetched: number;
      accepted: number;
      rejected: number;
      duplicateCount: number;
      parseErrors: number;
    };
  };
  outcomeLearning: OutcomePerformanceAnalytics;
  outcomeTracking: {
    status: "active" | "missing_supabase" | "no_data";
    pendingSignals: number;
    evaluatedSignals: number;
    missingOutcomeData: number;
  };
  outcomeCollector: {
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
  learningReport: OutcomeLearningReport | null;
  latestWarRoom: MorningWarRoomResult | null;
}

export interface AdaptiveLearningState {
  minSignalScore: number;
  crowdingPenalty: number;
  stealthBoost: number;
  lateMomentumPenalty: number;
  sampleSize: number;
  falsePositiveRatio: number;
}

const EMPTY_OUTCOME_ANALYTICS: OutcomePerformanceAnalytics = {
  topPerformingTriggerCombos: [],
  worstTriggerCombos: [],
  insiderContinuationRanking: [],
  falsePositiveRate: 0,
  regimePerformance: [],
  bestPre09Signals: [],
  squeezeSectors: [],
  bullishInsiderTypes: [],
  bestPmTypes: [],
  evaluatedCount: 0,
  pendingCount: 0,
  topFalsePositives: [],
  topContinuationSetups: [],
};

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function normalizeDedupePart(value: string | number | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildInsiderDedupeKey(event: InsiderEvent) {
  return [
    event.ticker,
    event.insiderName,
    event.role,
    event.type,
    Math.round(event.valueSek || 0),
    event.date.slice(0, 10),
  ]
    .map(normalizeDedupePart)
    .join("|");
}

export async function saveInsiderEvents(events: InsiderEvent[]) {
  const supabase = getServerSupabase();
  if (!supabase || events.length === 0) return { saved: 0, skipped: !supabase };

  const { error } = await supabase.from("insider_events").upsert(
    events.map((event) => ({
      ticker: event.ticker,
      insider_name: event.insiderName,
      role: event.role,
      event_type: event.type,
      value_sek: event.valueSek,
      event_date: event.date.slice(0, 10),
      source: "FI",
      dedupe_key: buildInsiderDedupeKey(event),
      raw_payload: event,
    })),
    { onConflict: "dedupe_key" }
  );

  if (error) throw error;
  return { saved: events.length, skipped: false };
}

export async function saveProviderRun(run: ProviderRunLog) {
  const supabase = getServerSupabase();
  if (!supabase) return { saved: 0, skipped: true };

  const { error } = await supabase.from("provider_runs").insert({
    provider: run.provider,
    status: run.status,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    latency_ms: run.latencyMs,
    fetched_count: run.fetchedCount,
    saved_count: run.savedCount,
    error_message: run.errorMessage ?? null,
    raw_payload: run.rawPayload ?? {},
  });

  if (error) throw error;
  return { saved: 1, skipped: false };
}

export async function savePendingInsiderOutcomes(
  events: InsiderEvent[],
  regime: string
) {
  const supabase = getServerSupabase();
  if (!supabase || events.length === 0) return { saved: 0, skipped: !supabase };

  const horizons = ["1d", "3d", "5d"];
  const rows = events.flatMap((event) =>
    horizons.map((horizon) => ({
      signal_id: `fi-insider-${buildInsiderDedupeKey(event)}`,
      ticker: event.ticker,
      triggered_at: new Date(event.date).toISOString(),
      horizon,
      entry_price: 0,
      catalyst_mix: [
        "insider",
        event.type,
        event.valueSek >= 250000 ? "stealth" : null,
      ].filter((item): item is string => Boolean(item)),
      conviction:
        event.type === "buy"
          ? Math.min(100, 45 + Math.round(event.valueSek / 100000))
          : Math.max(0, 55 - Math.round(event.valueSek / 100000)),
      regime,
      raw_payload: {
        status: "pending_market_price",
        source: "FI",
        event,
      },
    }))
  );

  const { error } = await supabase.from("signal_outcomes").upsert(rows, {
    onConflict: "signal_id,horizon",
  });

  if (error) throw error;
  return { saved: rows.length, skipped: false };
}

export async function savePendingSignalOutcomes(
  items: SignalFeedItem[],
  report: IntelligenceReport,
  regime: string
) {
  const supabase = getServerSupabase();
  if (!supabase || items.length === 0) return { saved: 0, skipped: !supabase };

  const horizons = ["5m", "15m", "30m", "60m", "1d", "3d", "5d", "close", "next_day_open"];
  const rows = items.flatMap((item) => {
    const ranked = report.topRanked.find((stock) => stock.ticker === item.ticker);
    const signalId = `${item.ticker}-${item.type}-${item.timestamp.slice(0, 16)}`.toLowerCase();
    const catalystMix = [
      item.type,
      ...item.tags,
      ranked?.tags.includes("low float") || item.tags.some((tag) => /low float|låg float|smallcap|småbolag/i.test(tag)) ? "low_float" : null,
      ranked?.reasons.some((reason) => /insider/i.test(reason)) || item.tags.includes("insider") ? "insider" : null,
    ].filter((value): value is string => Boolean(value));

    return horizons.map((horizon) => ({
      signal_id: signalId,
      ticker: item.ticker,
      triggered_at: item.timestamp,
      horizon,
      entry_price: 0,
      catalyst_mix: catalystMix,
      conviction: ranked?.conviction ?? item.confidence,
      regime,
      raw_payload: {
        status: "pending_market_price",
        source: "signal_feed",
        horizon,
        signal: item,
        rankedSnapshot: ranked ?? null,
      },
    }));
  });

  const { error } = await supabase.from("signal_outcomes").upsert(rows, {
    onConflict: "signal_id,horizon",
  });

  if (error) throw error;
  return { saved: rows.length, skipped: false };
}

export async function saveSocialMentions(mentions: SocialMention[]) {
  const supabase = getServerSupabase();
  if (!supabase || mentions.length === 0) return { saved: 0, skipped: !supabase };

  const { error } = await supabase.from("social_mentions").insert(
    mentions.map((mention) => ({
      ticker: mention.ticker,
      source: mention.source,
      mentions: mention.mentions,
      sentiment: mention.sentiment ?? null,
      velocity: mention.velocity ?? null,
      observed_at: mention.timestamp,
      raw_payload: mention,
    }))
  );

  if (error) throw error;
  return { saved: mentions.length, skipped: false };
}

export async function saveSignalFeed(items: SignalFeedItem[]) {
  const supabase = getServerSupabase();
  if (!supabase || items.length === 0) return { saved: 0, skipped: !supabase };
  const rows = items.map((item) => ({
    ticker: item.ticker,
    signal_type: item.type,
    title: item.title,
    description: item.description,
    score: item.score,
    confidence: item.confidence,
    priority: item.priority ?? null,
    tags: item.tags,
    observed_at: item.timestamp,
    signal_key: `${item.ticker}-${item.type}-${item.timestamp.slice(0, 13)}`,
  }));

  const { error } = await supabase
    .from("signal_feed")
    .upsert(rows, { onConflict: "signal_key" });

  if (error && String(error.message ?? error).includes("signal_key")) {
    const fallbackRows = rows.map((row) => ({
      ticker: row.ticker,
      signal_type: row.signal_type,
      title: row.title,
      description: row.description,
      score: row.score,
      confidence: row.confidence,
      priority: row.priority,
      tags: row.tags,
      observed_at: row.observed_at,
    }));
    const newest = rows.reduce(
      (latest, row) => (row.observed_at > latest ? row.observed_at : latest),
      rows[0].observed_at
    );
    const oldest = rows.reduce(
      (earliest, row) => (row.observed_at < earliest ? row.observed_at : earliest),
      rows[0].observed_at
    );
    const cleanup = await supabase
      .from("signal_feed")
      .delete()
      .gte("observed_at", oldest.slice(0, 13) + ":00:00.000Z")
      .lte("observed_at", newest.slice(0, 13) + ":59:59.999Z");
    if (cleanup.error) throw cleanup.error;

    const fallback = await supabase.from("signal_feed").insert(fallbackRows);
    if (fallback.error) throw fallback.error;
    return { saved: items.length, skipped: false };
  }

  if (error) throw error;
  return { saved: items.length, skipped: false };
}

export async function saveRankedSnapshots(report: IntelligenceReport) {
  const supabase = getServerSupabase();
  if (!supabase || report.topRanked.length === 0) return { saved: 0, skipped: !supabase };
  const now = new Date().toISOString();
  const bucket = now.slice(0, 13);
  const rows = report.topRanked.map((stock) => ({
    ticker: stock.ticker,
    total_score: stock.totalScore,
    conviction: stock.conviction,
    reasons: stock.reasons,
    risks: stock.risks,
    tags: stock.tags,
    snapshot_at: now,
    snapshot_key: `${stock.ticker}-${bucket}`,
    raw_payload: stock,
  }));

  const { error } = await supabase
    .from("ranked_snapshots")
    .upsert(rows, { onConflict: "snapshot_key" });

  if (error && String(error.message ?? error).includes("snapshot_key")) {
    const fallbackRows = rows.map((row) => ({
      ticker: row.ticker,
      total_score: row.total_score,
      conviction: row.conviction,
      reasons: row.reasons,
      risks: row.risks,
      tags: row.tags,
      snapshot_at: row.snapshot_at,
      raw_payload: row.raw_payload,
    }));
    const cleanup = await supabase
      .from("ranked_snapshots")
      .delete()
      .gte("snapshot_at", `${bucket}:00:00.000Z`)
      .lte("snapshot_at", `${bucket}:59:59.999Z`);
    if (cleanup.error) throw cleanup.error;

    const fallback = await supabase.from("ranked_snapshots").insert(fallbackRows);
    if (fallback.error) throw fallback.error;
    return { saved: report.topRanked.length, skipped: false };
  }

  if (error) throw error;
  return { saved: report.topRanked.length, skipped: false };
}

export async function saveNarrativeHistory(report: IntelligenceReport) {
  const supabase = getServerSupabase();
  if (!supabase || report.inputs.length === 0) return { saved: 0, skipped: !supabase };
  const now = new Date().toISOString();

  const { error } = await supabase.from("narrative_history").insert(
    report.inputs.map((input) => ({
      ticker: input.ticker,
      primary_narrative: input.narrative.primaryNarrative,
      narrative_strength: input.narrative.narrativeStrength,
      trend_direction: input.narrative.trendDirection,
      emerging_narrative: input.narrative.emergingNarrative,
      observed_at: now,
      raw_payload: input.narrative,
    }))
  );

  if (error) throw error;
  return { saved: report.inputs.length, skipped: false };
}

export async function saveAlertHistory(items: SignalFeedItem[]) {
  const supabase = getServerSupabase();
  const alerts = items.filter(
    (item) => item.priority === "HIGH" || item.priority === "EXTREME"
  );

  if (!supabase || alerts.length === 0) return { saved: 0, skipped: !supabase };

  const { error } = await supabase.from("alert_history").upsert(
    alerts.map((item) => ({
      ticker: item.ticker,
      alert_type: item.type,
      priority: item.priority ?? "LOW",
      reason: item.title,
      confluence_score: item.score,
      dedupe_key: `${item.ticker}-${item.type}-${item.timestamp.slice(0, 10)}`,
      triggered_at: item.timestamp,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      raw_payload: item,
    })),
    { onConflict: "dedupe_key" }
  );

  if (error) throw error;
  return { saved: alerts.length, skipped: false };
}

export async function saveDetailedSignalOutcomes(items: DetailedSignalOutcome[]) {
  const supabase = getServerSupabase();
  if (!supabase || items.length === 0) return { saved: 0, skipped: !supabase };

  const { error } = await supabase.from("signal_outcomes_detailed").upsert(
    items.map((item) => ({
      signal_key: item.signalKey,
      ticker: item.ticker,
      trigger: item.triggerType,
      catalyst: item.catalyst,
      market_regime: item.marketRegime,
      insider_activity: item.insiderActivity,
      float_profile: item.floatProfile,
      crowding: item.crowding,
      overnight_strength: item.overnightStrength,
      pre_open_score: item.preOpenScore,
      opening_plan: item.openingPlan,
      open_price: item.openPrice,
      high_price: item.highPrice,
      close_price: item.closePrice,
      opening_gap: item.openingGap,
      first_5m_move: item.first5mMove,
      first_15m_move: item.first15mMove,
      first_30m_move: item.first30mMove ?? 0,
      first_60m_move: item.first60mMove ?? 0,
      next_day_open_move: item.nextDayOpenPerformance ?? 0,
      max_move_pct: item.maxMovePct,
      fade_pct: item.fadePct,
      continuation_score: item.continuationScore,
      outcome_label: item.outcomeLabel,
      outcome_classification: item.outcomeClassification,
      trigger_combo: item.triggerCombo,
      learning_weight: item.learningWeight,
      outcome_status: item.outcomeStatus,
      observed_at: item.timestamp,
      raw_payload: item,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "signal_key" }
  );

  if (error) {
    if (String(error.message ?? error).includes("signal_outcomes_detailed")) {
      return { saved: 0, skipped: true };
    }
    throw error;
  }
  return { saved: items.length, skipped: false };
}

function mapDetailedOutcome(row: Record<string, unknown>): DetailedSignalOutcome {
  return {
    signalKey: String(row.signal_key ?? ""),
    ticker: String(row.ticker ?? ""),
    timestamp: String(row.observed_at ?? row.created_at ?? new Date().toISOString()),
    triggerType: String(row.trigger ?? ""),
    catalyst: String(row.catalyst ?? ""),
    marketRegime: String(row.market_regime ?? "unknown"),
    insiderActivity: Number(row.insider_activity ?? 0),
    floatProfile: String(row.float_profile ?? "unknown") as DetailedSignalOutcome["floatProfile"],
    crowding: Number(row.crowding ?? 0),
    overnightStrength: Number(row.overnight_strength ?? 0),
    openingGap: Number(row.opening_gap ?? 0),
    first5mMove: Number(row.first_5m_move ?? 0),
    first15mMove: Number(row.first_15m_move ?? 0),
    first30mMove: Number(row.first_30m_move ?? 0),
    first60mMove: Number(row.first_60m_move ?? 0),
    intradayHigh: Number(row.max_move_pct ?? 0),
    closePerformance:
      row.close_price !== null && row.open_price !== null && Number(row.open_price) > 0
        ? ((Number(row.close_price) - Number(row.open_price)) / Number(row.open_price)) * 100
        : 0,
    preOpenScore: Number(row.pre_open_score ?? 0),
    nextDayOpenPerformance: Number(row.next_day_open_move ?? 0),
    openingPlan: String(row.opening_plan ?? ""),
    openPrice: row.open_price === null ? null : Number(row.open_price ?? 0),
    highPrice: row.high_price === null ? null : Number(row.high_price ?? 0),
    closePrice: row.close_price === null ? null : Number(row.close_price ?? 0),
    maxMovePct: Number(row.max_move_pct ?? 0),
    fadePct: Number(row.fade_pct ?? 0),
    continuationScore: Number(row.continuation_score ?? 0),
    outcomeLabel: String(row.outcome_label ?? "DEAD") as DetailedSignalOutcome["outcomeLabel"],
    outcomeClassification: String(row.outcome_classification ?? "pending") as DetailedSignalOutcome["outcomeClassification"],
    triggerCombo: String(row.trigger_combo ?? row.trigger ?? "signal"),
    learningWeight: Number(row.learning_weight ?? 1),
    outcomeStatus: String(row.outcome_status ?? "pending") as DetailedSignalOutcome["outcomeStatus"],
  };
}

export async function getDetailedSignalOutcomes(limit = 1000): Promise<DetailedSignalOutcome[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("signal_outcomes_detailed")
    .select("*")
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapDetailedOutcome(row));
}

function mapSignalOutcomeRow(row: Record<string, unknown>): RawSignalOutcomeRow {
  return {
    id: String(row.id ?? ""),
    signalId: String(row.signal_id ?? ""),
    ticker: String(row.ticker ?? ""),
    horizon: String(row.horizon ?? ""),
    triggeredAt: String(row.triggered_at ?? row.created_at ?? new Date().toISOString()),
    entryPrice: Number(row.entry_price ?? 0),
    observedPrice: row.observed_price === null ? null : Number(row.observed_price ?? 0),
    maxUpsidePercent: row.max_upside_percent === null ? null : Number(row.max_upside_percent ?? 0),
    downsidePercent: row.downside_percent === null ? null : Number(row.downside_percent ?? 0),
    followThroughQuality: row.follow_through_quality === null ? null : Number(row.follow_through_quality ?? 0),
    catalystMix: Array.isArray(row.catalyst_mix) ? row.catalyst_mix.map(String) : [],
    conviction: row.conviction === null ? null : Number(row.conviction ?? 0),
    regime: row.regime === null ? null : String(row.regime ?? "unknown"),
    rawPayload: row.raw_payload ?? {},
  };
}

export async function getSignalOutcomeRows(limit = 2000): Promise<RawSignalOutcomeRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("signal_outcomes")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => mapSignalOutcomeRow(row));
}

export async function getPendingSignalOutcomeRows(limit = 80): Promise<RawSignalOutcomeRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("signal_outcomes")
    .select("*")
    .or("outcome_status.eq.pending,outcome_status.is.null,observed_price.is.null")
    .order("triggered_at", { ascending: true })
    .limit(limit);

  if (error) {
    const fallback = await supabase
      .from("signal_outcomes")
      .select("*")
      .is("observed_price", null)
      .order("triggered_at", { ascending: true })
      .limit(limit);

    if (fallback.error || !fallback.data) return [];
    return fallback.data.map((row) => mapSignalOutcomeRow(row));
  }
  if (!data) return [];
  return data.map((row) => mapSignalOutcomeRow(row));
}

export async function updateSignalOutcomeMarketResult(input: {
  signalId: string;
  horizon: string;
  observedPrice: number | null;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  closePrice: number | null;
  volume: number | null;
  maxUpsidePercent: number | null;
  maxDrawdownPercent: number | null;
  closeReturnPercent: number | null;
  followThroughQuality: number | null;
  outcomeLabel: string;
  outcomeStatus: "evaluated" | "dead" | "missing_market_data" | "blocked_identity";
  rawPayload: unknown;
}) {
  const supabase = getServerSupabase();
  if (!supabase) return { saved: 0, skipped: true };

  const { error } = await supabase
    .from("signal_outcomes")
    .update({
      observed_price: input.observedPrice,
      open_price: input.openPrice,
      high_price: input.highPrice,
      low_price: input.lowPrice,
      close_price: input.closePrice,
      volume: input.volume,
      max_upside_percent: input.maxUpsidePercent,
      downside_percent: input.maxDrawdownPercent,
      max_drawdown_percent: input.maxDrawdownPercent,
      close_return_percent: input.closeReturnPercent,
      follow_through_quality: input.followThroughQuality,
      outcome_label: input.outcomeLabel,
      outcome_status: input.outcomeStatus,
      raw_payload: input.rawPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("signal_id", input.signalId)
    .eq("horizon", input.horizon);

  if (error) {
    const fallback = await supabase
      .from("signal_outcomes")
      .update({
        observed_price: input.observedPrice,
        high_price: input.highPrice,
        low_price: input.lowPrice,
        max_upside_percent: input.maxUpsidePercent,
        downside_percent: input.maxDrawdownPercent,
        follow_through_quality: input.followThroughQuality,
        raw_payload: input.rawPayload,
      })
      .eq("signal_id", input.signalId)
      .eq("horizon", input.horizon);

    if (fallback.error) throw fallback.error;
  }
  return { saved: 1, skipped: false };
}

export async function getOutcomeLearningReport(): Promise<OutcomeLearningReport> {
  const [detailedOutcomes, signalOutcomes] = await Promise.all([
    getDetailedSignalOutcomes(1500),
    getSignalOutcomeRows(3000),
  ]);

  return buildOutcomeLearningReport(detailedOutcomes, signalOutcomes);
}

export async function getLatestIntelligenceSnapshot(): Promise<LatestIntelligenceSnapshot | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const [{ data: ranked }, { data: feed }, { data: narratives }, { data: alerts }] =
    await Promise.all([
      supabase
        .from("ranked_snapshots")
        .select("*")
        .order("snapshot_at", { ascending: false })
        .limit(20),
      supabase
        .from("signal_feed")
        .select("*")
        .order("observed_at", { ascending: false })
        .limit(40),
      supabase
        .from("narrative_history")
        .select("*")
        .order("observed_at", { ascending: false })
        .limit(20),
      supabase
        .from("alert_history")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(20),
    ]);

  if (!ranked || ranked.length === 0 || !feed) return null;

  return {
    generatedAt: ranked[0].snapshot_at,
    mode: "stored",
    report: {
      topRanked: ranked.map((row) => ({
        ticker: row.ticker,
        totalScore: row.total_score,
        conviction: row.conviction,
        reasons: row.reasons,
        risks: row.risks,
        tags: row.tags,
      })),
      strongestNarratives: (narratives ?? []).map((row) => ({
        ticker: row.ticker,
        narrative: row.primary_narrative,
        strength: row.narrative_strength,
      })),
      unusualActivity: [],
      highestSqueezeScore: { ticker: feed[0]?.ticker ?? "-", score: feed[0]?.score ?? 0, factors: [] },
      strongestInsiderAccumulation: { ticker: alerts?.[0]?.ticker ?? "-", score: alerts?.[0]?.confluence_score ?? 0, reasons: [] },
      inputs: [],
    },
    signalFeed: feed.map((row) => ({
      id: row.id,
      type: row.signal_type,
      ticker: row.ticker,
      title: row.title,
      description: row.description ?? "",
      score: row.score,
      confidence: row.confidence,
      timestamp: row.observed_at,
      tags: row.tags,
      priority: row.priority ?? undefined,
    })) as SignalFeedItem[],
    alerts: (alerts ?? []).map((row) => ({
      ticker: row.ticker,
      alertType: row.alert_type,
      priority: row.priority as AlertPriority,
      reason: row.reason,
      triggeredAt: row.triggered_at,
    })),
  };
}

export async function getLatestInsiderEvents(limit = 20): Promise<StoredInsiderEvent[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("insider_events")
    .select("*")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    insiderName: row.insider_name,
    role: row.role ?? "",
    type: row.event_type,
    valueSek: Number(row.value_sek ?? 0),
    date: row.event_date,
    source: row.source,
    createdAt: row.created_at,
    dedupeKey: row.dedupe_key ?? null,
  })) as StoredInsiderEvent[];
}

export async function getLatestProviderRuns(limit = 20) {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("provider_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    latencyMs: Number(row.latency_ms ?? 0),
    fetchedCount: Number(row.fetched_count ?? 0),
    savedCount: Number(row.saved_count ?? 0),
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
  }));
}

export async function getIntelligenceDebugSnapshot(): Promise<IntelligenceDebugSnapshot> {
  const supabase = getServerSupabase();
  const generatedAt = new Date().toISOString();
  if (!supabase) {
    return {
      generatedAt,
      providerRuns: [],
      acceptedSignals: 0,
      rejectedSignals: 0,
      falsePositiveRatio30d: 0,
      edgePerformance30d: {
        sampleSize: 0,
        averageUpside: 0,
        averageDownside: 0,
        continuationRate: 0,
        stealthSuccessRate: 0,
        decayRate: 0,
      },
      freshness: {
        latestSignalAt: null,
        latestProviderRunAt: null,
        freshnessScore: 0,
      },
      newsFeed: {
        latestFetch: null,
        accepted: 0,
        rejected: 0,
        freshness: "missing",
        acceptedNewsItems: [],
        sourceHealth: [],
        dedupeStats: {
          fetched: 0,
          accepted: 0,
          rejected: 0,
          duplicateCount: 0,
          parseErrors: 0,
        },
      },
      outcomeLearning: EMPTY_OUTCOME_ANALYTICS,
      outcomeTracking: {
        status: "missing_supabase",
        pendingSignals: 0,
        evaluatedSignals: 0,
        missingOutcomeData: 0,
      },
      outcomeCollector: {
        status: "missing_supabase",
        lastRunAt: null,
        processed: 0,
        updated: 0,
        stillPending: 0,
        dead: 0,
        missingMarketDataByTicker: [],
        latestClassifiedOutcomes: [],
      },
      learningReport: null,
      latestWarRoom: null,
    };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: runs }, { data: outcomes }, { data: signals }, detailedOutcomes, signalOutcomeRows] = await Promise.all([
    supabase
      .from("provider_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("signal_outcomes")
      .select("*")
      .gte("triggered_at", since)
      .limit(1000),
    supabase
      .from("signal_feed")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(200),
    getDetailedSignalOutcomes(1000),
    getSignalOutcomeRows(2000),
  ]);

  const evaluated = (outcomes ?? []).filter((row) => row.observed_price !== null);
  const falsePositives = evaluated.filter(
    (row) => Number(row.max_upside_percent ?? 0) < 3 && Number(row.downside_percent ?? 0) <= -4
  );
  const continuations = evaluated.filter((row) => Number(row.follow_through_quality ?? 0) >= 60);
  const stealthWins = evaluated.filter(
    (row) =>
      (row.catalyst_mix ?? []).includes("stealth") &&
      Number(row.max_upside_percent ?? 0) >= 8
  );
  const decayed = (signals ?? []).filter((row) => {
    const ageMs = Date.now() - new Date(row.observed_at).getTime();
    return ageMs > 24 * 60 * 60 * 1000 && Number(row.score ?? 0) < 55;
  });

  const average = (values: number[]) =>
    values.length === 0
      ? 0
      : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  const latestSignalAt = signals?.[0]?.observed_at ?? null;
  const latestProviderRunAt = runs?.[0]?.created_at ?? null;
  const latestNewsRun = runs?.find((row) => row.provider.includes("MFN") || row.provider.includes("news"));
  const latestNewsPayload = latestNewsRun?.raw_payload as
    | {
        acceptedNews?: number;
        acceptedNewsItems?: IntelligenceDebugSnapshot["newsFeed"]["acceptedNewsItems"];
        sourceHealth?: IntelligenceDebugSnapshot["newsFeed"]["sourceHealth"];
        dedupeStats?: IntelligenceDebugSnapshot["newsFeed"]["dedupeStats"];
      }
    | undefined;
  const latestCollectorRun = runs?.find((row) => row.provider === "outcome_collector");
  const latestCollectorPayload = latestCollectorRun?.raw_payload as
    | {
        processed?: number;
        updated?: number;
        stillPending?: number;
        dead?: number;
        missingMarketData?: Array<{ ticker: string; horizon: string; reason: string }>;
        latestClassified?: IntelligenceDebugSnapshot["outcomeCollector"]["latestClassifiedOutcomes"];
      }
    | undefined;
  const missingMarketDataByTicker = Object.entries(
    (latestCollectorPayload?.missingMarketData ?? []).reduce<Record<string, { count: number; horizons: string[] }>>(
      (acc, item) => {
        acc[item.ticker] = acc[item.ticker] ?? { count: 0, horizons: [] };
        acc[item.ticker].count += 1;
        if (!acc[item.ticker].horizons.includes(item.horizon)) acc[item.ticker].horizons.push(item.horizon);
        return acc;
      },
      {}
    )
  ).map(([ticker, value]) => ({ ticker, ...value }));
  const freshestAt = latestSignalAt ?? latestProviderRunAt;
  const freshnessAgeMs = freshestAt ? Date.now() - new Date(freshestAt).getTime() : Infinity;
  const learningReport = buildOutcomeLearningReport(detailedOutcomes, signalOutcomeRows);
  const pendingOutcomeRows = signalOutcomeRows.filter(
    (row) => row.observedPrice === null || row.maxUpsidePercent === null || row.followThroughQuality === null
  );

  return {
    generatedAt,
    providerRuns: (runs ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      latencyMs: Number(row.latency_ms ?? 0),
      fetchedCount: Number(row.fetched_count ?? 0),
      savedCount: Number(row.saved_count ?? 0),
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
    })),
    acceptedSignals: (signals ?? []).filter((row) => ["HIGH", "EXTREME"].includes(row.priority ?? "")).length,
    rejectedSignals: Math.max(0, (signals ?? []).filter((row) => Number(row.score ?? 0) < 55).length),
    falsePositiveRatio30d:
      evaluated.length > 0 ? Math.round((falsePositives.length / evaluated.length) * 100) : 0,
    edgePerformance30d: {
      sampleSize: evaluated.length,
      averageUpside: average(evaluated.map((row) => Number(row.max_upside_percent ?? 0))),
      averageDownside: average(evaluated.map((row) => Number(row.downside_percent ?? 0))),
      continuationRate:
        evaluated.length > 0 ? Math.round((continuations.length / evaluated.length) * 100) : 0,
      stealthSuccessRate:
        evaluated.length > 0 ? Math.round((stealthWins.length / evaluated.length) * 100) : 0,
      decayRate: signals && signals.length > 0 ? Math.round((decayed.length / signals.length) * 100) : 0,
    },
    freshness: {
      latestSignalAt,
      latestProviderRunAt,
      freshnessScore: Math.max(0, Math.min(100, Math.round(100 - freshnessAgeMs / 60000))),
    },
    newsFeed: {
      latestFetch: latestNewsRun?.created_at ?? null,
      accepted: Number(latestNewsPayload?.acceptedNews ?? latestNewsPayload?.acceptedNewsItems?.length ?? 0),
      rejected: Math.max(
        0,
        Number(latestNewsRun?.fetched_count ?? 0) -
          Number(latestNewsPayload?.acceptedNews ?? latestNewsPayload?.acceptedNewsItems?.length ?? 0)
      ),
      freshness: latestNewsRun?.status ?? "missing",
      acceptedNewsItems: latestNewsPayload?.acceptedNewsItems ?? [],
      sourceHealth: latestNewsPayload?.sourceHealth ?? [],
      dedupeStats: latestNewsPayload?.dedupeStats ?? {
        fetched: Number(latestNewsRun?.fetched_count ?? 0),
        accepted: Number(latestNewsPayload?.acceptedNews ?? latestNewsPayload?.acceptedNewsItems?.length ?? 0),
        rejected: Math.max(
          0,
          Number(latestNewsRun?.fetched_count ?? 0) -
            Number(latestNewsPayload?.acceptedNews ?? latestNewsPayload?.acceptedNewsItems?.length ?? 0)
        ),
        duplicateCount: 0,
        parseErrors: 0,
      },
    },
    outcomeLearning: {
      ...learningReport.analytics,
      topPerformingTriggerCombos: learningReport.bestTriggerCombos,
      worstTriggerCombos: learningReport.worstTriggerCombos,
      topFalsePositives: learningReport.analytics.topFalsePositives.length > 0 ? learningReport.analytics.topFalsePositives : learningReport.worstTriggerCombos,
      topContinuationSetups: learningReport.topContinuationSetups,
    },
    outcomeTracking: {
      status: signalOutcomeRows.length > 0 || detailedOutcomes.length > 0 ? "active" : "no_data",
      pendingSignals: pendingOutcomeRows.length,
      evaluatedSignals: signalOutcomeRows.length - pendingOutcomeRows.length + learningReport.recentOutcomeSummary.evaluatedSignals,
      missingOutcomeData: learningReport.missingOutcomeData.length,
    },
    outcomeCollector: {
      status: latestCollectorRun?.status ?? "not_run",
      lastRunAt: latestCollectorRun?.created_at ?? null,
      processed: Number(latestCollectorPayload?.processed ?? 0),
      updated: Number(latestCollectorPayload?.updated ?? 0),
      stillPending: Number(latestCollectorPayload?.stillPending ?? 0),
      dead: Number(latestCollectorPayload?.dead ?? 0),
      missingMarketDataByTicker,
      latestClassifiedOutcomes: latestCollectorPayload?.latestClassified ?? [],
    },
    learningReport,
    latestWarRoom: null,
  };
}

export async function getMorningWarRoomInput(): Promise<MorningWarRoomInput | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

  const [
    { data: insiders },
    { data: ranked },
    { data: feed },
    { data: outcomes },
    detailedOutcomes,
    { data: narratives },
    { data: runs },
  ] = await Promise.all([
    supabase
      .from("insider_events")
      .select("*")
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("ranked_snapshots")
      .select("*")
      .order("snapshot_at", { ascending: false })
      .limit(40),
    supabase
      .from("signal_feed")
      .select("*")
      .gte("observed_at", since)
      .order("observed_at", { ascending: false })
      .limit(80),
    supabase
      .from("signal_outcomes")
      .select("*")
      .gte("triggered_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000),
    getDetailedSignalOutcomes(1000),
    supabase
      .from("narrative_history")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(60),
    supabase
      .from("provider_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if ((!ranked || ranked.length === 0) && (!insiders || insiders.length === 0) && (!feed || feed.length === 0)) {
    return null;
  }

  return {
    insiderEvents: (insiders ?? []).map((row) => ({
      id: row.id,
      ticker: row.ticker,
      insiderName: row.insider_name,
      role: row.role ?? "",
      type: row.event_type,
      valueSek: Number(row.value_sek ?? 0),
      date: row.event_date,
      source: row.source,
      createdAt: row.created_at,
      dedupeKey: row.dedupe_key ?? null,
    })),
    newsClassifications: [],
    ranked: (ranked ?? []).map((row) => ({
      ticker: row.ticker,
      totalScore: Number(row.total_score ?? 0),
      conviction: Number(row.conviction ?? 0),
      tags: row.tags ?? [],
      reasons: row.reasons ?? [],
      risks: row.risks ?? [],
    })),
    signalFeed: (feed ?? []).map((row) => ({
      id: row.id,
      type: row.signal_type,
      ticker: row.ticker,
      title: row.title,
      description: row.description ?? "",
      score: Number(row.score ?? 0),
      confidence: Number(row.confidence ?? 0),
      timestamp: row.observed_at,
      tags: row.tags ?? [],
      priority: row.priority ?? undefined,
    })) as MorningWarRoomInput["signalFeed"],
    outcomes: (outcomes ?? []).map((row) => ({
      ticker: row.ticker,
      horizon: row.horizon,
      maxUpsidePercent:
        row.max_upside_percent === null ? null : Number(row.max_upside_percent),
      downsidePercent:
        row.downside_percent === null ? null : Number(row.downside_percent),
      followThroughQuality:
        row.follow_through_quality === null ? null : Number(row.follow_through_quality),
      catalystMix: row.catalyst_mix ?? [],
    })).concat(detailedOutcomes.map((row) => ({
      ticker: row.ticker,
      horizon: "pre-open",
      maxUpsidePercent: row.maxMovePct,
      downsidePercent: row.fadePct > row.maxMovePct ? -row.fadePct : null,
      followThroughQuality: row.continuationScore,
      catalystMix: [row.triggerType, row.catalyst, row.floatProfile, row.marketRegime],
      detailed: row,
    }))),
    narratives: (narratives ?? []).map((row) => ({
      ticker: row.ticker,
      primaryNarrative: row.primary_narrative,
      narrativeStrength: Number(row.narrative_strength ?? 0),
      trendDirection: row.trend_direction,
    })),
    providerRuns: (runs ?? []).map((row) => ({
      provider: row.provider,
      status: row.status,
      latencyMs: Number(row.latency_ms ?? 0),
      fetchedCount: Number(row.fetched_count ?? 0),
      savedCount: Number(row.saved_count ?? 0),
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at,
    })),
  };
}

export async function getAdaptiveLearningState(): Promise<AdaptiveLearningState> {
  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      minSignalScore: 60,
      crowdingPenalty: 6,
      stealthBoost: 5,
      lateMomentumPenalty: 8,
      sampleSize: 0,
      falsePositiveRatio: 0,
    };
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data }, detailedOutcomes] = await Promise.all([
    supabase
    .from("signal_outcomes")
    .select("*")
    .gte("triggered_at", since)
      .limit(1000),
    getDetailedSignalOutcomes(1000),
  ]);
  const evaluated = (data ?? []).filter((row) => row.observed_price !== null);
  const detailedAnalytics = analyzeOutcomePerformance(detailedOutcomes);
  const falsePositives = evaluated.filter(
    (row) => Number(row.max_upside_percent ?? 0) < 3 && Number(row.downside_percent ?? 0) <= -4
  );
  const stealthWins = evaluated.filter(
    (row) =>
      (row.catalyst_mix ?? []).includes("stealth") &&
      Number(row.max_upside_percent ?? 0) >= 8
  );
  const lateMomentumFails = evaluated.filter(
    (row) =>
      (row.catalyst_mix ?? []).includes("momentum") &&
      Number(row.max_upside_percent ?? 0) < 4
  );
  const falsePositiveRatio =
    detailedOutcomes.length > 0
      ? detailedAnalytics.falsePositiveRate / 100
      : evaluated.length > 0
        ? falsePositives.length / evaluated.length
        : 0;
  const bestStealth = detailedOutcomes.filter(
    (row) => row.outcomeLabel === "STEALTH_WINNER" || (row.floatProfile === "low" && row.continuationScore >= 65)
  );
  const weakMomentum = detailedOutcomes.filter(
    (row) => row.triggerType.toLowerCase().includes("momentum") && row.continuationScore < 45
  );

  return {
    minSignalScore: falsePositiveRatio >= 0.35 ? 72 : falsePositiveRatio >= 0.2 ? 66 : 60,
    crowdingPenalty: falsePositiveRatio >= 0.3 ? 14 : 8,
    stealthBoost:
      bestStealth.length >= 3
        ? 14
        : stealthWins.length >= 5 && evaluated.length > 0
          ? Math.min(14, 5 + Math.round((stealthWins.length / evaluated.length) * 20))
        : 5,
    lateMomentumPenalty: weakMomentum.length >= 3 || lateMomentumFails.length >= 5 ? 16 : 8,
    sampleSize: detailedOutcomes.length + evaluated.length,
    falsePositiveRatio: Math.round(falsePositiveRatio * 100),
  };
}
