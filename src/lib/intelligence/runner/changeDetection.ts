import type { RankingChange, RunnerCaseSnapshot } from "@/lib/db/runnerRepository";

type AgentSnapshotSource = {
  cases: Array<{
    ticker: string;
    state: string;
    confidence: number;
    raw?: {
      source?: string;
      preOpenScore?: number;
    };
  }>;
};

const RETENTION_HOURS = 18;
const RETENTION_MS = RETENTION_HOURS * 60 * 60 * 1000;
const TERMINAL_STATES = new Set(["DROPPED", "FAILED", "REJECTED"]);
const RETENTION_ELIGIBLE_STATES = new Set([
  "HIGH_CONVICTION",
  "EARLY_CONTINUATION",
  "CONFIRMATION_PENDING",
  "WATCH",
  "STEALTH",
  "STEALTH_STRENGTH",
  "PARABOLIC_RISK",
  "COOLING_BUT_VALID",
  "PULLBACK_VALID",
  "REACCELERATION_WATCH",
]);

function tickerKey(ticker: string) {
  return ticker.trim().toUpperCase();
}

function rawObject(snapshot: RunnerCaseSnapshot) {
  return snapshot.rawPayload && typeof snapshot.rawPayload === "object" && !Array.isArray(snapshot.rawPayload)
    ? snapshot.rawPayload as Record<string, unknown>
    : {};
}

function retentionStartedAt(snapshot: RunnerCaseSnapshot) {
  const raw = rawObject(snapshot);
  return typeof raw.retentionStartedAt === "string"
    ? raw.retentionStartedAt
    : snapshot.createdAt ?? null;
}

function ageMs(iso: string | null, nowMs: number) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? nowMs - parsed : Number.POSITIVE_INFINITY;
}

function retainedState(previousState: string) {
  if (previousState === "PARABOLIC_RISK") return "COOLING_RISK_WATCH";
  if (previousState === "HIGH_CONVICTION" || previousState === "EARLY_CONTINUATION") return "COOLING_CONTINUATION_WATCH";
  return "COOLING_WATCH";
}

function shouldRetainMissingCase(snapshot: RunnerCaseSnapshot, nowMs: number) {
  if (TERMINAL_STATES.has(snapshot.state)) return false;
  if (!RETENTION_ELIGIBLE_STATES.has(snapshot.state)) return false;
  return ageMs(retentionStartedAt(snapshot), nowMs) <= RETENTION_MS;
}

export function applyCaseLifecycleRetention(
  previous: RunnerCaseSnapshot[],
  current: RunnerCaseSnapshot[],
  now = new Date()
): RunnerCaseSnapshot[] {
  const nowMs = now.getTime();
  const currentKeys = new Set(current.map((item) => tickerKey(item.ticker)));
  const retained = previous
    .filter((item) => !currentKeys.has(tickerKey(item.ticker)))
    .filter((item) => shouldRetainMissingCase(item, nowMs))
    .map((item) => {
      const raw = rawObject(item);
      const startedAt = retentionStartedAt(item) ?? now.toISOString();
      return {
        ...item,
        state: retainedState(item.state),
        source: "lifecycle_retention",
        risk: item.state === "PARABOLIC_RISK" ? Math.max(item.risk, 75) : item.risk,
        rawPayload: {
          ...raw,
          retainedFromState: raw.retainedFromState ?? item.state,
          retentionStartedAt: startedAt,
          retentionReason: `Case saknas i aktuell scan men hålls kvar upp till ${RETENTION_HOURS}h för continuation/lifecycle-verifiering.`,
        },
      } satisfies RunnerCaseSnapshot;
    });

  return [...current, ...retained];
}

export function appendTerminalDroppedSnapshots(
  snapshots: RunnerCaseSnapshot[],
  previous: RunnerCaseSnapshot[],
  changes: RankingChange[]
): RunnerCaseSnapshot[] {
  const existing = new Set(snapshots.map((item) => tickerKey(item.ticker)));
  const previousMap = new Map(previous.map((item) => [tickerKey(item.ticker), item]));
  const dropped = changes
    .filter((change) => change.changeType === "dropped")
    .map((change) => previousMap.get(tickerKey(change.ticker)))
    .filter((item): item is RunnerCaseSnapshot => Boolean(item))
    .filter((item) => !existing.has(tickerKey(item.ticker)))
    .map((item) => ({
      ...item,
      state: "DROPPED",
      confidence: Math.max(0, Math.round(item.confidence * 0.65)),
      risk: Math.max(item.risk, 60),
      source: "lifecycle_terminal",
      rawPayload: {
        ...rawObject(item),
        droppedAt: new Date().toISOString(),
        droppedFromState: item.state,
        droppedReason: "Case passerade retention/grace eller saknar aktuell bekräftelse.",
      },
    } satisfies RunnerCaseSnapshot));

  return [...snapshots, ...dropped];
}

export function snapshotsFromAgent(agent: AgentSnapshotSource): RunnerCaseSnapshot[] {
  return agent.cases
    .filter((item) => item.state !== "REJECTED")
    .filter((item) => tickerKey(item.ticker).length > 0)
    .map((item) => ({
      ticker: tickerKey(item.ticker),
      state: item.state,
      score: Number(item.raw?.preOpenScore ?? 0),
      confidence: item.confidence,
      risk: item.state === "PARABOLIC_RISK" ? 90 : item.state === "FADE_WARNING" ? 70 : item.state === "FAILED" ? 60 : 30,
      source: item.raw?.source ?? "agent",
      rawPayload: item,
    }));
}

function severity(delta: number): "LOW" | "MEDIUM" | "HIGH" {
  if (Math.abs(delta) >= 20) return "HIGH";
  if (Math.abs(delta) >= 10) return "MEDIUM";
  return "LOW";
}

export function detectRankingChanges(previous: RunnerCaseSnapshot[], current: RunnerCaseSnapshot[]): RankingChange[] {
  const previousMap = new Map(previous.map((item) => [tickerKey(item.ticker), item]));
  const currentMap = new Map(current.map((item) => [tickerKey(item.ticker), item]));
  const changes: RankingChange[] = [];

  for (const item of current) {
    const ticker = tickerKey(item.ticker);
    const before = previousMap.get(ticker);
    if (!before) {
      changes.push({
        ticker,
        changeType: "newEntrant",
        previousValue: null,
        currentValue: item.state,
        severity: item.state === "PARABOLIC_RISK" || item.state === "HIGH_CONVICTION" ? "HIGH" : "MEDIUM",
        reason: `${item.ticker} är nytt i agentens scan med state ${item.state}.`,
      });
      continue;
    }
    if (before.state !== item.state) {
      changes.push({
        ticker,
        changeType: "stateChanged",
        previousValue: before.state,
        currentValue: item.state,
        severity: item.source === "lifecycle_retention" ? "LOW" : item.state === "PARABOLIC_RISK" || item.state === "HIGH_CONVICTION" ? "HIGH" : "MEDIUM",
        reason: item.source === "lifecycle_retention"
          ? `${item.ticker} saknas i aktuell scan men hålls kvar som ${item.state} för lifecycle-verifiering.`
          : `${item.ticker} flyttades från ${before.state} till ${item.state}.`,
      });
    }
    const confidenceDelta = item.confidence - before.confidence;
    if (Math.abs(confidenceDelta) >= 8) {
      changes.push({
        ticker,
        changeType: "confidenceChanged",
        previousValue: before.confidence,
        currentValue: item.confidence,
        severity: severity(confidenceDelta),
        reason: `${item.ticker} confidence ändrades ${confidenceDelta > 0 ? "+" : ""}${confidenceDelta} punkter.`,
      });
    }
    const riskDelta = item.risk - before.risk;
    if (Math.abs(riskDelta) >= 15) {
      changes.push({
        ticker,
        changeType: "riskChanged",
        previousValue: before.risk,
        currentValue: item.risk,
        severity: severity(riskDelta),
        reason: `${item.ticker} risk ändrades ${riskDelta > 0 ? "+" : ""}${riskDelta} punkter.`,
      });
    }
    const scoreDelta = item.score - before.score;
    if (Math.abs(scoreDelta) >= 12) {
      changes.push({
        ticker,
        changeType: scoreDelta > 0 ? "movedUp" : "movedDown",
        previousValue: before.score,
        currentValue: item.score,
        severity: severity(scoreDelta),
        reason: `${item.ticker} score ändrades ${scoreDelta > 0 ? "+" : ""}${scoreDelta} punkter.`,
      });
    }
  }

  for (const item of previous) {
    const ticker = tickerKey(item.ticker);
    if (TERMINAL_STATES.has(item.state)) continue;
    if (!currentMap.has(ticker)) {
      changes.push({
        ticker,
        changeType: "dropped",
        previousValue: item.state,
        currentValue: null,
        severity: "MEDIUM",
        reason: `${item.ticker} försvann från aktuell agent-scan efter lifecycle-retention eller utan fortsatt bekräftelse.`,
      });
    }
  }

  return changes;
}