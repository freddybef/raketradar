export type AgentCaseState =
  | "NEW_SIGNAL"
  | "WATCH"
  | "CONFIRMATION_PENDING"
  | "EARLY_CONTINUATION"
  | "HIGH_CONVICTION"
  | "PARABOLIC_RISK"
  | "FADE_WARNING"
  | "FAILED"
  | "COOLDOWN"
  | "REJECTED";

export type AgentAlertType =
  | "CASE_UPGRADED"
  | "CASE_DOWNGRADED"
  | "CONFIRMATION_TRIGGERED"
  | "FADE_WARNING"
  | "PARABOLIC_RISK"
  | "PORTFOLIO_HOLDING_ACCELERATING"
  | "MISSED_MOVER_DETECTED"
  | "DATA_COVERAGE_WARNING";

export type TradingSessionMode = "pre-open" | "opening-drive" | "mid-day" | "power-hour" | "closed";

export interface AgentCaseInput {
  ticker: string;
  companyName?: string;
  exchange?: string;
  source: "war_room" | "discovery" | "rejected";
  preOpenScore?: number;
  confidence?: number;
  falsePositiveRisk?: number;
  openingAction?: string;
  rejectedReasons?: string[];
  owned?: boolean;
  confirmation?: string;
  invalidation?: string;
  live?: {
    relativeVolume?: number;
    continuationProbability?: number;
    fadeProbability?: number;
    intradayMomentum?: number;
    marketAggression?: number;
    label?: string;
    flags?: string[];
  };
}

export interface AgentFeedbackSummary {
  ticker: string;
  feedbackScore: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  userOverrideCount: number;
}

export interface AgentCaseStateResult {
  ticker: string;
  companyName?: string;
  exchange?: string;
  state: AgentCaseState;
  previousState?: AgentCaseState | null;
  sessionMode: TradingSessionMode;
  reason: string;
  confidence: number;
  alertType?: AgentAlertType;
  alertSeverity?: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  confirmation?: string;
  invalidation?: string;
  feedbackScore: number;
  eventKey: string;
  raw: AgentCaseInput;
}

export function getTradingSessionMode(now = new Date()): TradingSessionMode {
  const stockholm = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(stockholm.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(stockholm.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;

  if (minutes >= 6 * 60 + 30 && minutes < 9 * 60) return "pre-open";
  if (minutes >= 9 * 60 && minutes < 10 * 60 + 15) return "opening-drive";
  if (minutes >= 10 * 60 + 15 && minutes < 15 * 60) return "mid-day";
  if (minutes >= 15 * 60 && minutes < 17 * 60 + 30) return "power-hour";
  return "closed";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sessionContinuationBoost(mode: TradingSessionMode) {
  if (mode === "opening-drive") return 10;
  if (mode === "power-hour") return 6;
  if (mode === "mid-day") return -6;
  if (mode === "closed") return -4;
  return 0;
}

function isRejected(input: AgentCaseInput) {
  return input.source === "rejected" || (input.rejectedReasons ?? []).some((reason) =>
    /unresolved_symbol|exchange_conflict|low_ticker_confidence|non_swedish_exchange|ticker_collision/i.test(reason)
  );
}

export function evaluateAgentCaseState(
  input: AgentCaseInput,
  previousState: AgentCaseState | null,
  feedback?: AgentFeedbackSummary,
  now = new Date()
): AgentCaseStateResult {
  const sessionMode = getTradingSessionMode(now);
  const live = input.live ?? {};
  const rvol = Number(live.relativeVolume ?? 0);
  const continuation = Number(live.continuationProbability ?? 0);
  const fade = Number(live.fadeProbability ?? 0);
  const momentum = Number(live.intradayMomentum ?? 0);
  const falsePositiveRisk = Number(input.falsePositiveRisk ?? 0);
  const score = Number(input.preOpenScore ?? 0);
  const baseConfidence = Number(input.confidence ?? 0);
  const feedbackScore = feedback?.feedbackScore ?? 0;
  const adjustedConfidence = clamp(baseConfidence + feedbackScore + sessionContinuationBoost(sessionMode));

  let state: AgentCaseState = "WATCH";
  let reason = "Bevaka tills bekräftelse finns.";

  if (isRejected(input)) {
    state = "REJECTED";
    reason = `Ticker/signalen är blockerad: ${(input.rejectedReasons ?? ["rejected"]).join(", ")}`;
  } else if (/PARABOLIC_RISK/i.test(String(live.label ?? "")) || momentum >= 22 || fade >= 85 || falsePositiveRisk >= 65) {
    state = "PARABOLIC_RISK";
    reason = "Extrem rörelse eller hög fake-spike/fade-risk. Ingen chase.";
  } else if (fade >= 62 && continuation < 55) {
    state = "FADE_WARNING";
    reason = "Fade-risken stiger och continuation är otillräcklig.";
  } else if (rvol >= 1.4 && continuation >= 72 && adjustedConfidence >= 70 && falsePositiveRisk < 35) {
    state = "HIGH_CONVICTION";
    reason = "RVOL, continuation och confidence är samtidigt starka utan hög fake-spike-risk.";
  } else if (rvol >= 1.15 && continuation >= 65 && falsePositiveRisk < 50) {
    state = "EARLY_CONTINUATION";
    reason = "Tidigt continuation-läge: volym och marknadsreaktion stärker caset.";
  } else if (score >= 60 || adjustedConfidence >= 58) {
    state = "CONFIRMATION_PENDING";
    reason = "Edge finns, men kräver bekräftelse innan agerande.";
  } else if (score < 35 && continuation < 45) {
    state = "FAILED";
    reason = "Signal saknar fortsatt edge just nu.";
  }

  if (previousState && previousState !== state && previousState !== "REJECTED" && state === "WATCH") {
    state = "COOLDOWN";
    reason = "Caset har tappat styrka och läggs i cooldown.";
  }

  const alert = alertForTransition(previousState, state, input);
  return {
    ticker: input.ticker,
    companyName: input.companyName,
    exchange: input.exchange,
    state,
    previousState,
    sessionMode,
    reason,
    confidence: adjustedConfidence,
    alertType: alert?.type,
    alertSeverity: alert?.severity,
    confirmation: input.confirmation,
    invalidation: input.invalidation,
    feedbackScore,
    eventKey: `${input.ticker}-${state}-${new Date(now).toISOString().slice(0, 13)}`.toLowerCase(),
    raw: input,
  };
}

function alertForTransition(
  previousState: AgentCaseState | null,
  state: AgentCaseState,
  input: AgentCaseInput
): { type: AgentAlertType; severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME" } | null {
  if (state === "REJECTED") return null;
  if (state === "PARABOLIC_RISK") return { type: "PARABOLIC_RISK", severity: "HIGH" };
  if (state === "FADE_WARNING") return { type: "FADE_WARNING", severity: "MEDIUM" };
  if (state === "HIGH_CONVICTION" && previousState !== "HIGH_CONVICTION") return { type: "CASE_UPGRADED", severity: "HIGH" };
  if (state === "EARLY_CONTINUATION" && previousState && previousState !== "EARLY_CONTINUATION") {
    return { type: "CONFIRMATION_TRIGGERED", severity: input.owned ? "HIGH" : "MEDIUM" };
  }
  if ((state === "FAILED" || state === "COOLDOWN") && previousState && !["FAILED", "COOLDOWN"].includes(previousState)) {
    return { type: "CASE_DOWNGRADED", severity: "MEDIUM" };
  }
  if (input.owned && state === "EARLY_CONTINUATION") return { type: "PORTFOLIO_HOLDING_ACCELERATING", severity: "MEDIUM" };
  return null;
}
