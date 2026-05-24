import {
  analyzeOutcomePerformance,
  type ComboPerformance,
  type OutcomePerformanceAnalytics,
} from "@/lib/intelligence/performanceAnalytics";
import type { DetailedSignalOutcome } from "@/lib/intelligence/outcomeTracker";
import {
  normalizeOutcomeClassification,
  type OutcomeLabel,
} from "@/lib/intelligence/outcomeTracker";

export interface RawSignalOutcomeRow {
  id?: string;
  signalId: string;
  ticker: string;
  horizon: string;
  triggeredAt: string;
  entryPrice: number;
  observedPrice: number | null;
  maxUpsidePercent: number | null;
  downsidePercent: number | null;
  followThroughQuality: number | null;
  catalystMix: string[];
  conviction: number | null;
  regime: string | null;
  rawPayload: unknown;
}

export interface AdaptiveWeight {
  key: string;
  learningWeight: number;
  confidenceDelta: number;
  reason: string;
  sampleSize: number;
}

export interface FalsePositivePattern {
  key: string;
  falsePositiveRate: number;
  avgFadePct: number;
  sampleSize: number;
  reason: string;
}

export interface RecentOutcomeSummary {
  totalSignals: number;
  evaluatedSignals: number;
  pendingSignals: number;
  continuation: number;
  squeeze: number;
  fade: number;
  fakeSpike: number;
  noFollowThrough: number;
}

export interface OutcomeLearningReport {
  generatedAt: string;
  bestTriggerCombos: ComboPerformance[];
  worstTriggerCombos: ComboPerformance[];
  insiderQualityRanking: OutcomePerformanceAnalytics["insiderContinuationRanking"];
  falsePositivePatterns: FalsePositivePattern[];
  currentAdaptiveWeights: AdaptiveWeight[];
  recentOutcomeSummary: RecentOutcomeSummary;
  confidenceChanges: Array<{
    key: string;
    delta: number;
    explanation: string;
  }>;
  regimePerformance: OutcomePerformanceAnalytics["regimePerformance"];
  missingOutcomeData: Array<{
    signalId: string;
    ticker: string;
    horizon: string;
    missing: string[];
  }>;
  recentClassifications: Array<{
    signalKey: string;
    ticker: string;
    trigger: string;
    classification: DetailedSignalOutcome["outcomeClassification"];
    continuationScore: number;
    maxMovePct: number;
    fadePct: number;
  }>;
  topContinuationSetups: ComboPerformance[];
  analytics: OutcomePerformanceAnalytics;
  sourceHealth: {
    detailedRows: number;
    rawRows: number;
    rawEvaluatedRows: number;
    syntheticDetailedRows: number;
    analyticsSource: "detailed" | "raw_fallback" | "mixed" | "empty";
  };
}

function clamp(value: number, min = -25, max = 25) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function weightFromCombo(combo: ComboPerformance): AdaptiveWeight {
  const confidenceDelta = clamp((combo.winRate - combo.falsePositiveRate) / 4 + combo.avgContinuation / 12 - combo.avgFadePct / 3);
  return {
    key: combo.key,
    learningWeight: Math.max(0.4, Math.min(1.8, Math.round((1 + confidenceDelta / 50) * 100) / 100)),
    confidenceDelta,
    reason:
      confidenceDelta >= 8
        ? "Historiken visar continuation/squeeze oftare än fade."
        : confidenceDelta <= -8
          ? "Historiken visar återkommande fade eller fake spikes."
          : "För liten eller neutral historik, håll vikten nära baslinjen.",
    sampleSize: combo.sampleSize,
  };
}

function summarize(outcomes: DetailedSignalOutcome[], signalOutcomes: RawSignalOutcomeRow[]): RecentOutcomeSummary {
  const pendingRawSignals = signalOutcomes.filter(
    (item) => item.observedPrice === null || item.maxUpsidePercent === null || item.followThroughQuality === null
  ).length;
  const evaluatedRawSignals = signalOutcomes.length - pendingRawSignals;

  return {
    totalSignals: outcomes.length + signalOutcomes.length,
    evaluatedSignals: outcomes.filter((item) => item.outcomeStatus !== "pending").length + evaluatedRawSignals,
    pendingSignals: outcomes.filter((item) => item.outcomeStatus === "pending").length + pendingRawSignals,
    continuation: outcomes.filter((item) => item.outcomeClassification === "continuation").length,
    squeeze: outcomes.filter((item) => item.outcomeClassification === "squeeze").length,
    fade: outcomes.filter((item) => item.outcomeClassification === "fade").length,
    fakeSpike: outcomes.filter((item) => item.outcomeClassification === "fake_spike").length,
    noFollowThrough: outcomes.filter((item) => item.outcomeClassification === "no_follow_through").length,
  };
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rawComboKey(row: RawSignalOutcomeRow) {
  const mix = row.catalystMix.length > 0 ? row.catalystMix : ["signal"];
  return mix
    .filter((item) => !["pending_market_price", "source"].includes(item))
    .slice(0, 4)
    .join("+")
    .toLowerCase();
}

function rawOutcomeLabel(row: RawSignalOutcomeRow): OutcomeLabel {
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

function syntheticDetailedFromRaw(row: RawSignalOutcomeRow): DetailedSignalOutcome | null {
  if (row.observedPrice === null || row.maxUpsidePercent === null || row.followThroughQuality === null) return null;
  const triggerType = rawComboKey(row) || "signal";
  const maxMovePct = Math.round((row.maxUpsidePercent ?? 0) * 10) / 10;
  const fadePct = Math.round(Math.abs(row.downsidePercent ?? 0) * 10) / 10;
  const outcomeLabel = rawOutcomeLabel(row);
  const catalyst = row.catalystMix.join("+") || "signal";
  const insiderActivity = row.catalystMix.some((item) => /insider|buy/i.test(item)) ? 100 : 0;
  const floatProfile = row.catalystMix.some((item) => /low_float|stealth|squeeze/i.test(item)) ? "low" : "unknown";
  const continuationScore = Math.max(0, Math.min(100, Math.round(row.followThroughQuality ?? 0)));

  return {
    signalKey: row.signalId,
    ticker: row.ticker,
    timestamp: row.triggeredAt,
    triggerType,
    catalyst,
    marketRegime: row.regime ?? "unknown",
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
    preOpenScore: row.conviction ?? 0,
    openingPlan: "raw_outcome_canonical_fallback",
    openPrice: row.entryPrice > 0 ? row.entryPrice : null,
    highPrice: null,
    closePrice: row.observedPrice,
    maxMovePct,
    fadePct,
    continuationScore,
    outcomeLabel,
    outcomeClassification: normalizeOutcomeClassification(outcomeLabel),
    triggerCombo: triggerType,
    learningWeight: 1,
    outcomeStatus: "evaluated",
  };
}

function rawComboPerformance(rows: RawSignalOutcomeRow[]): ComboPerformance[] {
  const evaluated = rows.filter(
    (row) => row.observedPrice !== null && row.maxUpsidePercent !== null && row.followThroughQuality !== null
  );
  const grouped = evaluated.reduce<Record<string, RawSignalOutcomeRow[]>>((acc, row) => {
    const key = rawComboKey(row);
    acc[key] = [...(acc[key] ?? []), row];
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([key, items]) => {
      const wins = items.filter((item) => (item.followThroughQuality ?? 0) >= 60 || (item.maxUpsidePercent ?? 0) >= 8);
      const falsePositives = items.filter((item) => (item.maxUpsidePercent ?? 0) < 3 && (item.downsidePercent ?? 0) <= -4);

      return {
        key,
        sampleSize: items.length,
        winRate: Math.round((wins.length / items.length) * 100),
        avgContinuation: Math.round(average(items.map((item) => item.followThroughQuality ?? 0)) * 10) / 10,
        avgMaxMovePct: Math.round(average(items.map((item) => item.maxUpsidePercent ?? 0)) * 10) / 10,
        avgFadePct: Math.round(Math.abs(average(items.map((item) => item.downsidePercent ?? 0))) * 10) / 10,
        falsePositiveRate: Math.round((falsePositives.length / items.length) * 100),
      };
    })
    .sort((a, b) => b.winRate - a.winRate || b.avgContinuation - a.avgContinuation);
}

function missingData(rows: RawSignalOutcomeRow[]) {
  return rows
    .filter((row) => row.observedPrice === null || row.maxUpsidePercent === null || row.followThroughQuality === null)
    .slice(0, 40)
    .map((row) => ({
      signalId: row.signalId,
      ticker: row.ticker,
      horizon: row.horizon,
      missing: [
        row.observedPrice === null ? "observed_price" : null,
        row.maxUpsidePercent === null ? "max_upside_percent" : null,
        row.followThroughQuality === null ? "follow_through_quality" : null,
      ].filter((item): item is string => Boolean(item)),
    }));
}

export function buildOutcomeLearningReport(
  detailedOutcomes: DetailedSignalOutcome[],
  signalOutcomes: RawSignalOutcomeRow[]
): OutcomeLearningReport {
  const syntheticFromRaw = signalOutcomes
    .map((row) => syntheticDetailedFromRaw(row))
    .filter((item): item is DetailedSignalOutcome => Boolean(item));
  const detailedEvaluated = detailedOutcomes.filter((item) => item.outcomeStatus !== "pending");
  const analyticsInput = detailedEvaluated.length > 0
    ? [...detailedOutcomes, ...syntheticFromRaw]
    : syntheticFromRaw;
  const analytics = analyzeOutcomePerformance(analyticsInput);
  const rawCombos = rawComboPerformance(signalOutcomes);
  const bestTriggerCombos = analytics.topPerformingTriggerCombos.length > 0 ? analytics.topPerformingTriggerCombos : rawCombos.slice(0, 8);
  const worstTriggerCombos =
    analytics.worstTriggerCombos.length > 0
      ? analytics.worstTriggerCombos
      : [...rawCombos].sort((a, b) => b.falsePositiveRate - a.falsePositiveRate || a.winRate - b.winRate).slice(0, 8);
  const currentAdaptiveWeights = [
    ...bestTriggerCombos.slice(0, 5),
    ...worstTriggerCombos.slice(0, 5),
  ]
    .reduce<ComboPerformance[]>((acc, combo) => {
      if (!acc.some((item) => item.key === combo.key)) acc.push(combo);
      return acc;
    }, [])
    .map(weightFromCombo);
  const recentOutcomeSummary = summarize(detailedOutcomes, signalOutcomes);

  return {
    generatedAt: new Date().toISOString(),
    bestTriggerCombos,
    worstTriggerCombos,
    insiderQualityRanking: analytics.insiderContinuationRanking,
    falsePositivePatterns: (analytics.topFalsePositives.length > 0 ? analytics.topFalsePositives : worstTriggerCombos).map((combo) => ({
      key: combo.key,
      falsePositiveRate: combo.falsePositiveRate,
      avgFadePct: combo.avgFadePct,
      sampleSize: combo.sampleSize,
      reason: "Hög andel fade/fake spike efter stark pre-open signal.",
    })),
    currentAdaptiveWeights,
    recentOutcomeSummary,
    confidenceChanges: currentAdaptiveWeights.map((item) => ({
      key: item.key,
      delta: item.confidenceDelta,
      explanation: item.reason,
    })),
    regimePerformance: analytics.regimePerformance,
    missingOutcomeData: missingData(signalOutcomes),
    recentClassifications: analyticsInput.slice(0, 20).map((item) => ({
      signalKey: item.signalKey,
      ticker: item.ticker,
      trigger: item.triggerType,
      classification: item.outcomeClassification,
      continuationScore: item.continuationScore,
      maxMovePct: item.maxMovePct,
      fadePct: item.fadePct,
    })),
    topContinuationSetups: analytics.topContinuationSetups.length > 0 ? analytics.topContinuationSetups : rawCombos.filter((item) => item.winRate >= 50).slice(0, 5),
    analytics,
    sourceHealth: {
      detailedRows: detailedOutcomes.length,
      rawRows: signalOutcomes.length,
      rawEvaluatedRows: syntheticFromRaw.length,
      syntheticDetailedRows: syntheticFromRaw.length,
      analyticsSource:
        analyticsInput.length === 0
          ? "empty"
          : detailedEvaluated.length > 0 && syntheticFromRaw.length > 0
            ? "mixed"
            : detailedEvaluated.length > 0
              ? "detailed"
              : "raw_fallback",
    },
  };
}