import { getAgentMemorySnapshot } from "@/lib/db/agentRepository";
import { getRecentCopilotFeedback } from "@/lib/db/copilotRepository";
import { getIntelligenceDebugSnapshot } from "@/lib/db/intelligenceRepository";
import { findSuspiciousUnknowns } from "@/lib/intelligence/discovery/suspiciousUnknowns";
import {
  getLatestRunChanges,
  getLearningObservations,
  saveLearningObservations,
  type LearningObservation,
} from "@/lib/db/runnerRepository";

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isRejectedState(value: unknown) {
  return String(value ?? "").toUpperCase() === "REJECTED";
}

export async function runLearningHarvest(input?: { sessionId?: string | null; reason?: string }) {
  const observedAt = new Date().toISOString();
  const [changes, observations, agentMemory, debug, copilotFeedback, suspiciousUnknowns] = await Promise.all([
    getLatestRunChanges(),
    getLearningObservations(18, 500),
    getAgentMemorySnapshot(),
    getIntelligenceDebugSnapshot(),
    getRecentCopilotFeedback(100),
    findSuspiciousUnknowns({ persist: true }),
  ]);

  const harvested: LearningObservation[] = [];

  for (const change of changes.changes.slice(0, 80)) {
    if (isRejectedState(change.currentValue)) {
      harvested.push({
        sessionId: input?.sessionId ?? null,
        observedAt,
        sessionMode: input?.reason ?? "learning-harvest",
        ticker: change.ticker,
        observationType: "rejected_guardrail",
        source: "learning_harvest",
        signalState: "REJECTED",
        risk: 100,
        suppressionReason: "rejected_tickers_never_upgrade",
        payload: change,
      });
      continue;
    }

    if (["movedUp", "confidenceChanged", "newEntrant", "stateChanged"].includes(change.changeType)) {
      harvested.push({
        sessionId: input?.sessionId ?? null,
        observedAt,
        sessionMode: input?.reason ?? "learning-harvest",
        ticker: change.ticker,
        observationType: "stronger_case",
        source: "learning_harvest",
        signalState: String(change.currentValue ?? ""),
        confidence: change.severity === "HIGH" ? 80 : change.severity === "MEDIUM" ? 60 : 35,
        payload: change,
      });
    }

    if (["movedDown", "riskChanged", "dropped"].includes(change.changeType)) {
      harvested.push({
        sessionId: input?.sessionId ?? null,
        observedAt,
        sessionMode: input?.reason ?? "learning-harvest",
        ticker: change.ticker,
        observationType: "weaker_case",
        source: "learning_harvest",
        signalState: String(change.currentValue ?? ""),
        risk: change.severity === "HIGH" ? 85 : 55,
        payload: change,
      });
    }
  }

  for (const item of observations.observations.slice(0, 200)) {
    const payload = asRecord(item.payload);
    if (item.signalState === "WATCH" && Number(item.fadeProbability ?? 0) >= 55) {
      harvested.push({
        sessionId: input?.sessionId ?? null,
        observedAt,
        sessionMode: input?.reason ?? "learning-harvest",
        ticker: item.ticker,
        observationType: "weak_watch_case",
        source: "learning_harvest",
        signalState: item.signalState,
        confidence: item.confidence,
        risk: item.fadeProbability,
        fadeProbability: item.fadeProbability,
        suppressionReason: "watch_with_high_fade_probability",
        payload: item,
      });
    }

    if (item.signalState === "PARABOLIC_RISK" || item.signalState === "FADE_WARNING" || item.signalState === "FAILED") {
      harvested.push({
        sessionId: input?.sessionId ?? null,
        observedAt,
        sessionMode: input?.reason ?? "learning-harvest",
        ticker: item.ticker,
        observationType: "false_positive_or_fade_risk",
        source: "learning_harvest",
        signalState: item.signalState,
        risk: item.risk ?? 80,
        suppressionReason: item.suppressionReason ?? "risk_state_observed",
        payload: item,
      });
    }

    const coverageByExchange = asArray(payload.coverageByExchange);
    if (item.observationType === "discovery_coverage" && coverageByExchange.length > 0) {
      for (const exchange of coverageByExchange) {
        const record = asRecord(exchange);
        const coveragePercent = Number(record.coveragePercent ?? 0);
        if (coveragePercent < 35) {
          harvested.push({
            sessionId: input?.sessionId ?? null,
            observedAt,
            sessionMode: input?.reason ?? "learning-harvest",
            ticker: null,
            observationType: "provider_coverage_gap",
            source: "learning_harvest",
            confidence: coveragePercent,
            suppressionReason: `low_coverage_${String(record.exchange ?? "unknown").toLowerCase()}`,
            payload: record,
          });
        }
      }
    }
  }

  for (const alert of agentMemory.alerts.slice(0, 50)) {
    if (alert.alertType.includes("PORTFOLIO") || alert.alertType.includes("COVERAGE")) {
      harvested.push({
        sessionId: input?.sessionId ?? null,
        observedAt,
        sessionMode: input?.reason ?? "learning-harvest",
        ticker: alert.ticker,
        observationType: "agent_memory_signal",
        source: "learning_harvest",
        signalState: alert.alertType,
        risk: alert.severity === "HIGH" ? 85 : alert.severity === "MEDIUM" ? 55 : 25,
        payload: alert,
      });
    }
  }

  const providerFailures = debug.providerRuns.filter((run) => run.status === "error").slice(0, 20);
  for (const failure of providerFailures) {
    harvested.push({
      sessionId: input?.sessionId ?? null,
      observedAt,
      sessionMode: input?.reason ?? "learning-harvest",
      ticker: null,
      observationType: "provider_failure",
      source: "learning_harvest",
      risk: 80,
      suppressionReason: failure.provider,
      payload: failure,
    });
  }

  for (const feedback of copilotFeedback.slice(0, 50)) {
    const record = asRecord(feedback);
    harvested.push({
      sessionId: input?.sessionId ?? null,
      observedAt,
      sessionMode: input?.reason ?? "learning-harvest",
      ticker: typeof record.ticker === "string" ? record.ticker : null,
      observationType: "copilot_feedback",
      source: "learning_harvest",
      signalState: typeof record.feedback_type === "string" ? record.feedback_type : null,
      risk: record.feedback_type === "WRONG_TICKER" || record.feedback_type === "MISSING_TICKER" ? 75 : 25,
      suppressionReason:
        record.feedback_type === "WRONG_TICKER"
          ? "copilot_wrong_ticker"
          : record.feedback_type === "MISSING_TICKER"
            ? "copilot_missing_ticker"
            : null,
      payload: record,
    });
  }

  for (const unknown of suspiciousUnknowns.candidates.slice(0, 25)) {
    if (unknown.suspicionLevel === "irrelevant_unknown") continue;
    harvested.push({
      sessionId: input?.sessionId ?? null,
      observedAt,
      sessionMode: input?.reason ?? "learning-harvest",
      ticker: unknown.ticker,
      observationType:
        unknown.suspicionLevel === "likely_hidden_runner"
          ? "possible_hidden_runner"
          : unknown.repeatedMentions > 0
            ? "unresolved_but_active"
            : "suppressed_due_to_coverage",
      source: "learning_harvest",
      signalState: unknown.suspicionLevel,
      confidence: unknown.unknownScore,
      score: unknown.unknownScore,
      risk: unknown.falseNegativeRisk,
      suppressionReason: "coverage_gap_not_buy_signal",
      payload: unknown,
    });
  }

  const saveResult = await saveLearningObservations(null, harvested);

  return {
    generatedAt: observedAt,
    persistence: observations.persistence === "active" && changes.persistence === "active" ? "active" as const : "missing_supabase" as const,
    created: harvested.length,
    saved: saveResult.saved,
    skipped: saveResult.skipped,
    strongerCases: harvested.filter((item) => item.observationType === "stronger_case").length,
    weakerCases: harvested.filter((item) => item.observationType === "weaker_case").length,
    coverageGaps: harvested.filter((item) => item.observationType === "provider_coverage_gap").length,
    copilotFeedback: harvested.filter((item) => item.observationType === "copilot_feedback").length,
    suspiciousUnknowns: harvested.filter((item) => ["possible_hidden_runner", "unresolved_but_active", "suppressed_due_to_coverage"].includes(item.observationType)).length,
    falsePositiveRisks: harvested.filter((item) => item.observationType === "false_positive_or_fade_risk").length,
    observations: harvested.slice(0, 80),
  };
}
