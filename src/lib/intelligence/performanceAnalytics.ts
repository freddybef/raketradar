import type { DetailedSignalOutcome, OutcomeLabel } from "@/lib/intelligence/outcomeTracker";

export interface ComboPerformance {
  key: string;
  sampleSize: number;
  winRate: number;
  avgContinuation: number;
  avgMaxMovePct: number;
  avgFadePct: number;
  falsePositiveRate: number;
}

export interface InsiderContinuationRank {
  ticker: string;
  insiderName?: string;
  sampleSize: number;
  continuationRate: number;
  avgContinuation: number;
  insiderQualityScore?: number;
}

export interface RegimePerformance {
  regime: string;
  sampleSize: number;
  winRate: number;
  avgContinuation: number;
}

export interface OutcomePerformanceAnalytics {
  topPerformingTriggerCombos: ComboPerformance[];
  worstTriggerCombos: ComboPerformance[];
  insiderContinuationRanking: InsiderContinuationRank[];
  falsePositiveRate: number;
  regimePerformance: RegimePerformance[];
  bestPre09Signals: ComboPerformance[];
  squeezeSectors: Array<{ sector: string; squeezeRate: number; sampleSize: number }>;
  bullishInsiderTypes: InsiderContinuationRank[];
  bestPmTypes: ComboPerformance[];
  evaluatedCount: number;
  pendingCount: number;
  topFalsePositives: ComboPerformance[];
  topContinuationSetups: ComboPerformance[];
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function isWin(outcome: DetailedSignalOutcome) {
  return ["EXPLODED", "CONTINUED", "SQUEEZE", "STEALTH_WINNER"].includes(outcome.outcomeLabel);
}

function isFalsePositive(outcome: DetailedSignalOutcome) {
  return ["FADED", "FAILED", "DEAD"].includes(outcome.outcomeLabel) && outcome.preOpenScore >= 55;
}

function comboKey(outcome: DetailedSignalOutcome) {
  return outcome.triggerCombo || `${outcome.triggerType}+${outcome.insiderActivity >= 60 ? "insider" : "no-insider"}+${outcome.floatProfile === "low" ? "low-float" : "normal-float"}`;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = getKey(item);
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});
}

function comboPerformance(key: string, items: DetailedSignalOutcome[]): ComboPerformance {
  const wins = items.filter(isWin);
  const falsePositives = items.filter(isFalsePositive);
  return {
    key,
    sampleSize: items.length,
    winRate: items.length > 0 ? Math.round((wins.length / items.length) * 100) : 0,
    avgContinuation: round(average(items.map((item) => item.continuationScore))),
    avgMaxMovePct: round(average(items.map((item) => item.maxMovePct))),
    avgFadePct: round(average(items.map((item) => item.fadePct))),
    falsePositiveRate: items.length > 0 ? Math.round((falsePositives.length / items.length) * 100) : 0,
  };
}

export function analyzeOutcomePerformance(outcomes: DetailedSignalOutcome[]): OutcomePerformanceAnalytics {
  const evaluatedOutcomes = outcomes.filter((item) => item.outcomeStatus !== "pending");
  const combos = Object.entries(groupBy(evaluatedOutcomes, comboKey))
    .map(([key, items]) => comboPerformance(key, items))
    .sort((a, b) => b.winRate - a.winRate || b.avgContinuation - a.avgContinuation);
  const byRegime = Object.entries(groupBy(evaluatedOutcomes, (item) => item.marketRegime || "unknown"))
    .map(([regime, items]) => ({
      regime,
      sampleSize: items.length,
      winRate: items.length > 0 ? Math.round((items.filter(isWin).length / items.length) * 100) : 0,
      avgContinuation: round(average(items.map((item) => item.continuationScore))),
    }))
    .sort((a, b) => b.winRate - a.winRate);
  const byTicker = Object.entries(groupBy(evaluatedOutcomes.filter((item) => item.insiderActivity >= 60), (item) => item.ticker))
    .map(([ticker, items]) => ({
      ticker,
      sampleSize: items.length,
      continuationRate: items.length > 0 ? Math.round((items.filter(isWin).length / items.length) * 100) : 0,
      avgContinuation: round(average(items.map((item) => item.continuationScore))),
      insiderQualityScore: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (items.filter(isWin).length / Math.max(1, items.length)) * 55 +
              average(items.map((item) => item.continuationScore)) * 0.35 +
              Math.max(0, 20 - average(items.map((item) => item.fadePct)))
          )
        )
      ),
    }))
    .sort((a, b) => (b.insiderQualityScore ?? 0) - (a.insiderQualityScore ?? 0) || b.continuationRate - a.continuationRate);
  const byTrigger = Object.entries(groupBy(evaluatedOutcomes, (item) => item.triggerType))
    .map(([key, items]) => comboPerformance(key, items))
    .sort((a, b) => b.winRate - a.winRate || b.avgContinuation - a.avgContinuation);
  const falsePositiveCount = evaluatedOutcomes.filter(isFalsePositive).length;

  return {
    topPerformingTriggerCombos: combos.slice(0, 8),
    worstTriggerCombos: [...combos].sort((a, b) => b.falsePositiveRate - a.falsePositiveRate || a.winRate - b.winRate).slice(0, 8),
    insiderContinuationRanking: byTicker.slice(0, 8),
    falsePositiveRate: evaluatedOutcomes.length > 0 ? Math.round((falsePositiveCount / evaluatedOutcomes.length) * 100) : 0,
    regimePerformance: byRegime.slice(0, 8),
    bestPre09Signals: combos.filter((item) => item.sampleSize >= 1).slice(0, 5),
    squeezeSectors: Object.entries(groupBy(evaluatedOutcomes, (item) => item.marketRegime.split(":")[1]?.split("|")[0] || "unknown"))
      .map(([sector, items]) => ({
        sector,
        sampleSize: items.length,
        squeezeRate: items.length > 0 ? Math.round((items.filter((item) => item.outcomeLabel === "SQUEEZE" || item.outcomeLabel === "EXPLODED").length / items.length) * 100) : 0,
      }))
      .sort((a, b) => b.squeezeRate - a.squeezeRate)
      .slice(0, 8),
    bullishInsiderTypes: byTicker.slice(0, 5),
    bestPmTypes: byTrigger.slice(0, 8),
    evaluatedCount: evaluatedOutcomes.length,
    pendingCount: outcomes.length - evaluatedOutcomes.length,
    topFalsePositives: [...combos].sort((a, b) => b.falsePositiveRate - a.falsePositiveRate || b.avgFadePct - a.avgFadePct).slice(0, 5),
    topContinuationSetups: combos.filter((item) => item.winRate >= 50).slice(0, 5),
  };
}

function calibratedWinRate(wins: number, sampleSize: number) {
  const priorWins = 2;
  const priorLosses = 2;
  return Math.round(((wins + priorWins) / (sampleSize + priorWins + priorLosses)) * 100);
}

function sampleReliability(sampleSize: number) {
  if (sampleSize >= 12) return 1;
  if (sampleSize >= 6) return 0.72;
  if (sampleSize >= 3) return 0.48;
  if (sampleSize >= 1) return 0.25;
  return 0;
}

export function historicalStatsForSetup(
  outcomes: DetailedSignalOutcome[],
  input: { ticker: string; trigger: string; catalyst: string; marketRegime: string }
) {
  const similar = outcomes.filter(
    (item) =>
      item.outcomeStatus !== "pending" &&
      (item.triggerType === input.trigger ||
        item.catalyst === input.catalyst ||
        item.marketRegime.split(":")[0] === input.marketRegime.split(":")[0])
  );
  const wins = similar.filter(isWin);
  const rawWinRate = similar.length > 0 ? Math.round((wins.length / similar.length) * 100) : 50;
  const winRate = similar.length > 0 ? calibratedWinRate(wins.length, similar.length) : 50;
  const reliability = sampleReliability(similar.length);

  return {
    sampleSize: similar.length,
    rawWinRate,
    winRate,
    reliability,
    avgContinuation: round(average(similar.map((item) => item.continuationScore)) * reliability + 50 * (1 - reliability)),
    avgFadeRisk: round(average(similar.map((item) => item.fadePct)) * reliability),
    similarOutcome: similar[0]?.outcomeLabel as OutcomeLabel | undefined,
  };
}