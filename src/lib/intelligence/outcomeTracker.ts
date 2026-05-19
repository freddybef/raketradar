import type { MorningWarRoomCase } from "@/lib/intelligence/morningWarRoom";
import type { OvernightContext } from "@/lib/intelligence/overnightContext";

export type OutcomeLabel =
  | "EXPLODED"
  | "CONTINUED"
  | "FADED"
  | "FAILED"
  | "SQUEEZE"
  | "STEALTH_WINNER"
  | "DEAD";

export type OutcomeClassification =
  | "continuation"
  | "squeeze"
  | "fade"
  | "fake_spike"
  | "no_follow_through"
  | "pending";

export type SignalOutcomeHorizon = "5m" | "15m" | "30m" | "60m" | "1d" | "3d" | "5d" | "close" | "next_day_open";

export interface OutcomeTrackingInput {
  ticker: string;
  timestamp: string;
  triggerType: string;
  catalyst: string;
  marketRegime: string;
  insiderActivity: number;
  floatProfile: "low" | "medium" | "high" | "unknown";
  crowding: number;
  overnightStrength: number;
  openingGap: number;
  first5mMove: number;
  first15mMove: number;
  first30mMove?: number;
  first60mMove?: number;
  intradayHigh: number;
  closePerformance: number;
  nextDayOpenPerformance?: number;
  preOpenScore: number;
  openingPlan: string;
}

export interface DetailedSignalOutcome extends OutcomeTrackingInput {
  signalKey: string;
  openPrice: number | null;
  highPrice: number | null;
  closePrice: number | null;
  maxMovePct: number;
  fadePct: number;
  continuationScore: number;
  outcomeLabel: OutcomeLabel;
  outcomeClassification: OutcomeClassification;
  triggerCombo: string;
  learningWeight: number;
  outcomeStatus: "pending" | "evaluated";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function classifyOutcome(input: Pick<OutcomeTrackingInput, "openingGap" | "first15mMove" | "intradayHigh" | "closePerformance" | "crowding" | "floatProfile">): OutcomeLabel {
  const maxMove = Math.max(input.openingGap, input.first15mMove, input.intradayHigh);
  const fade = maxMove - input.closePerformance;

  if (maxMove >= 18 && input.closePerformance >= 10) return "EXPLODED";
  if (maxMove >= 12 && input.floatProfile === "low") return "SQUEEZE";
  if (input.closePerformance >= 6 && input.openingGap <= 3) return "STEALTH_WINNER";
  if (input.closePerformance >= 4 && fade <= 5) return "CONTINUED";
  if (maxMove >= 6 && fade >= 7) return "FADED";
  if (input.closePerformance <= -5 || (input.first15mMove <= -3 && input.closePerformance <= 0)) return "FAILED";
  return "DEAD";
}

export function normalizeOutcomeClassification(label: OutcomeLabel): OutcomeClassification {
  if (label === "EXPLODED" || label === "CONTINUED" || label === "STEALTH_WINNER") return "continuation";
  if (label === "SQUEEZE") return "squeeze";
  if (label === "FADED") return "fade";
  if (label === "FAILED") return "fake_spike";
  return "no_follow_through";
}

export function classifyOutcomeFromMarketData(input: {
  horizon: SignalOutcomeHorizon | string;
  maxUpsidePercent: number;
  maxDrawdownPercent: number;
  closeReturnPercent: number;
  followThroughQuality: number;
  volumeExpansion?: number | null;
  hadMarketData: boolean;
}): OutcomeLabel {
  if (!input.hadMarketData) return "DEAD";
  if (input.maxUpsidePercent >= 18 && input.followThroughQuality >= 72 && input.maxDrawdownPercent > -8) return "EXPLODED";
  if ((input.maxUpsidePercent >= 12 && (input.volumeExpansion ?? 1) >= 1.8) || (input.maxUpsidePercent >= 15 && input.followThroughQuality >= 55)) return "SQUEEZE";
  if (input.closeReturnPercent >= 4 && input.followThroughQuality >= 55 && Math.abs(input.maxDrawdownPercent) <= 7) return "CONTINUED";
  if (input.maxUpsidePercent >= 5 && input.closeReturnPercent <= 1 && input.maxUpsidePercent - input.closeReturnPercent >= 5) return "FADED";
  if (input.maxUpsidePercent <= 2 && input.closeReturnPercent <= -2) return "FAILED";
  if (["3d", "5d"].includes(input.horizon) && input.maxUpsidePercent < 4 && input.closeReturnPercent >= 5 && input.followThroughQuality >= 58) return "STEALTH_WINNER";
  return "DEAD";
}

export function calculateContinuationScore(input: OutcomeTrackingInput) {
  return clamp(
    input.closePerformance * 5 +
      input.first15mMove * 3 +
      input.intradayHigh * 2 -
      Math.max(0, input.intradayHigh - input.closePerformance) * 4 -
      input.crowding * 0.18 +
      input.overnightStrength * 0.18
  );
}

export function buildSignalKey(ticker: string, timestamp: string, triggerType: string) {
  return `${ticker.toUpperCase()}-${triggerType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp.slice(0, 10)}`;
}

export function buildTriggerCombo(input: Pick<OutcomeTrackingInput, "triggerType" | "insiderActivity" | "floatProfile" | "crowding" | "openingGap">) {
  const parts = [
    input.triggerType.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "signal",
    input.insiderActivity >= 60 ? "insider" : null,
    input.openingGap >= 3 ? "pre_open_gap" : null,
    input.floatProfile === "low" ? "low_float" : null,
    input.crowding >= 70 ? "crowded" : null,
  ].filter((item): item is string => Boolean(item));

  return parts.join("+");
}

export function trackSignalOutcome(
  input: OutcomeTrackingInput & {
    openPrice?: number | null;
    highPrice?: number | null;
    closePrice?: number | null;
  }
): DetailedSignalOutcome {
  const maxMovePct =
    Math.round(
      Math.max(
        input.openingGap,
        input.first5mMove,
        input.first15mMove,
        input.first30mMove ?? 0,
        input.first60mMove ?? 0,
        input.intradayHigh
      ) * 10
    ) / 10;
  const fadePct = Math.round(Math.max(0, maxMovePct - input.closePerformance) * 10) / 10;
  const hasEvaluation =
    input.openPrice !== null ||
    input.highPrice !== null ||
    input.closePrice !== null ||
    input.first5mMove !== 0 ||
    input.first15mMove !== 0 ||
    input.intradayHigh !== 0 ||
    input.closePerformance !== 0;
  const outcomeLabel = hasEvaluation ? classifyOutcome(input) : "DEAD";

  return {
    ...input,
    first30mMove: input.first30mMove ?? 0,
    first60mMove: input.first60mMove ?? 0,
    nextDayOpenPerformance: input.nextDayOpenPerformance ?? 0,
    signalKey: buildSignalKey(input.ticker, input.timestamp, input.triggerType),
    openPrice: input.openPrice ?? null,
    highPrice: input.highPrice ?? null,
    closePrice: input.closePrice ?? null,
    maxMovePct,
    fadePct,
    continuationScore: calculateContinuationScore(input),
    outcomeLabel,
    outcomeClassification: hasEvaluation ? normalizeOutcomeClassification(outcomeLabel) : "pending",
    triggerCombo: buildTriggerCombo(input),
    learningWeight: 1,
    outcomeStatus: hasEvaluation ? "evaluated" : "pending",
  };
}

export function createPendingOutcomeFromWarRoomCase(
  item: MorningWarRoomCase,
  overnightRegime: OvernightContext
): DetailedSignalOutcome {
  const hasLowFloat = item.tags.some((tag) => /low float|låg float|smallcap|småbolag|squeeze/i.test(tag));
  const hasCrowding = item.tags.some((tag) => /crowd|pump|parabol/i.test(tag));

  return trackSignalOutcome({
    ticker: item.ticker,
    timestamp: new Date().toISOString(),
    triggerType: item.trigger,
    catalyst: item.catalyst,
    marketRegime: `${overnightRegime.nasdaqFutures}:${overnightRegime.activeThemes.join("|") || "neutral"}`,
    insiderActivity: item.tags.includes("insider") || item.catalyst === "FI insider" ? 100 : 0,
    floatProfile: hasLowFloat ? "low" : "unknown",
    crowding: hasCrowding ? 75 : item.scoringBreakdown.crowding,
    overnightStrength: item.overnightAlignment,
    openingGap: 0,
    first5mMove: 0,
    first15mMove: 0,
    intradayHigh: 0,
    closePerformance: 0,
    preOpenScore: item.preOpenScore,
    openingPlan: item.openingAction,
  });
}
