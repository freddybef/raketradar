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

function tickerKey(ticker: string) {
  return ticker.trim().toUpperCase();
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
        severity: item.state === "PARABOLIC_RISK" || item.state === "HIGH_CONVICTION" ? "HIGH" : "MEDIUM",
        reason: `${item.ticker} flyttades från ${before.state} till ${item.state}.`,
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
    if (!currentMap.has(ticker)) {
      changes.push({
        ticker,
        changeType: "dropped",
        previousValue: item.state,
        currentValue: null,
        severity: "MEDIUM",
        reason: `${item.ticker} försvann från aktuell agent-scan.`,
      });
    }
  }

  return changes;
}
