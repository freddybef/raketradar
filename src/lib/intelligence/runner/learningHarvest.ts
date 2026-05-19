import type { LearningObservation, RankingChange, RunnerCaseSnapshot } from "@/lib/db/runnerRepository";

type RunnerResults = Record<string, unknown>;
type AgentHarvestSource = {
  sessionMode: string;
  alerts: Array<{
    ticker: string;
    alertType: string;
    severity: string;
    message: string;
    [key: string]: unknown;
  }>;
} | null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function buildLearningObservations(input: {
  observedAt: string;
  sessionMode: string;
  changes: RankingChange[];
  snapshots: RunnerCaseSnapshot[];
  agent: AgentHarvestSource;
  results: RunnerResults;
}): LearningObservation[] {
  const observations: LearningObservation[] = [];

  for (const change of input.changes) {
    observations.push({
      observedAt: input.observedAt,
      sessionMode: input.sessionMode,
      ticker: change.ticker,
      observationType: `ranking_${change.changeType}`,
      source: "ranking_changes",
      signalState: String(change.currentValue ?? ""),
      confidence: null,
      score: null,
      risk: change.severity === "HIGH" ? 80 : change.severity === "MEDIUM" ? 50 : 25,
      suppressionReason: change.currentValue === "REJECTED" ? "rejected_not_upgraded" : null,
      payload: change,
    });
  }

  for (const snapshot of input.snapshots) {
    const raw = asRecord(snapshot.rawPayload);
    const live = asRecord(raw.live);
    observations.push({
      observedAt: input.observedAt,
      sessionMode: input.sessionMode,
      ticker: snapshot.ticker,
      observationType: "case_state_snapshot",
      source: snapshot.source,
      signalState: snapshot.state,
      confidence: snapshot.confidence,
      score: snapshot.score,
      risk: snapshot.risk,
      rvol: typeof live.relativeVolume === "number" ? live.relativeVolume : null,
      momentum: typeof live.intradayMomentum === "number" ? live.intradayMomentum : null,
      continuationProbability: typeof live.continuationProbability === "number" ? live.continuationProbability : null,
      fadeProbability: typeof live.fadeProbability === "number" ? live.fadeProbability : null,
      suppressionReason: typeof raw.invalidation === "string" ? raw.invalidation : null,
      payload: snapshot.rawPayload,
    });
  }

  for (const alert of input.agent?.alerts ?? []) {
    observations.push({
      observedAt: input.observedAt,
      sessionMode: input.sessionMode,
      ticker: alert.ticker,
      observationType: "agent_alert",
      source: "agent_loop",
      signalState: alert.alertType,
      risk: alert.severity === "HIGH" ? 85 : alert.severity === "MEDIUM" ? 55 : 25,
      payload: alert,
    });
  }

  const discovery = asRecord(input.results.discovery);
  if (Object.keys(discovery).length > 0) {
    observations.push({
      observedAt: input.observedAt,
      sessionMode: input.sessionMode,
      ticker: null,
      observationType: "discovery_coverage",
      source: "autonomous_discovery",
      confidence: typeof discovery.liveHits === "number" && typeof discovery.scannedCount === "number"
        ? Math.round((discovery.liveHits / Math.max(1, discovery.scannedCount)) * 100)
        : null,
      payload: {
        scannedCount: discovery.scannedCount,
        liveHits: discovery.liveHits,
        missingDataCount: discovery.missingDataCount,
        coverageByExchange: discovery.coverageByExchange,
        bucketCounts: discovery.bucketCounts,
      },
    });

    const missed = Array.isArray(discovery.missedMovers) ? discovery.missedMovers : [];
    for (const item of missed.slice(0, 20)) {
      const record = asRecord(item);
      observations.push({
        observedAt: input.observedAt,
        sessionMode: input.sessionMode,
        ticker: String(record.ticker ?? ""),
        observationType: "missed_mover",
        source: "autonomous_discovery",
        score: typeof record.movePercent === "number" ? record.movePercent : null,
        rvol: typeof record.relativeVolume === "number" ? record.relativeVolume : null,
        suppressionReason: typeof record.reason === "string" ? record.reason : null,
        payload: record,
      });
    }
  }

  const health = asRecord(input.results.health);
  const freshness = asRecord(health.freshness);
  if (Object.keys(health).length > 0) {
    observations.push({
      observedAt: input.observedAt,
      sessionMode: input.sessionMode,
      ticker: null,
      observationType: "provider_health",
      source: "health",
      confidence: typeof freshness.freshnessScore === "number" ? freshness.freshnessScore : null,
      payload: health,
    });
  }

  const outcomes = asRecord(input.results.outcomes);
  if (Object.keys(outcomes).length > 0) {
    observations.push({
      observedAt: input.observedAt,
      sessionMode: input.sessionMode,
      ticker: null,
      observationType: "outcome_collector",
      source: "outcomes",
      payload: outcomes,
    });
  }

  return observations;
}
