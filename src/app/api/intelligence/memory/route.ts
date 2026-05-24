import { NextResponse, type NextRequest } from "next/server";
import {
  getLatestCaseStateSnapshots,
  getLatestRunChanges,
  getLearningObservations,
} from "@/lib/db/runnerRepository";

function isAuthorized(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;

  const secrets = [
    process.env.INTELLIGENCE_RUN_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (secrets.length === 0) return process.env.NODE_ENV !== "production";

  const bearer = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-raketradar-secret");

  return secrets.some(
    (secret) => headerSecret === secret || bearer === `Bearer ${secret}`
  );
}

function countBy<T extends string | number | null | undefined>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = String(value ?? "unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hours = Number(request.nextUrl.searchParams.get("hours") ?? 72);
  const [latestRunChanges, snapshots, learning] = await Promise.all([
    getLatestRunChanges(),
    getLatestCaseStateSnapshots(300),
    getLearningObservations(hours, 600),
  ]);

  const snapshotStates = countBy(snapshots.map((item) => item.state));
  const snapshotSources = countBy(snapshots.map((item) => item.source));
  const observationTypes = countBy(learning.observations.map((item) => item.observationType));
  const observationSources = countBy(learning.observations.map((item) => item.source));
  const observationsByTicker = countBy(learning.observations.map((item) => item.ticker));
  const topObservationTickers = Object.entries(observationsByTicker)
    .filter(([ticker]) => ticker !== "unknown" && ticker !== "null")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ticker, count]) => ({ ticker, count }));

  const latestSnapshotAt = snapshots
    .map((item) => item.createdAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const latestObservationAt = learning.observations
    .map((item) => item.observedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    persistence: {
      latestRunChanges: latestRunChanges.persistence,
      learningObservations: learning.persistence,
      likelyActive: latestRunChanges.persistence === "active" && learning.persistence === "active",
    },
    latestRun: latestRunChanges.latestRun,
    latestRunChangeCount: latestRunChanges.changes.length,
    latestRunChanges: latestRunChanges.changes.slice(0, 30),
    caseSnapshots: {
      count: snapshots.length,
      latestSnapshotAt,
      states: snapshotStates,
      sources: snapshotSources,
      examples: snapshots.slice(0, 30).map((item) => ({
        ticker: item.ticker,
        state: item.state,
        score: item.score,
        confidence: item.confidence,
        risk: item.risk,
        source: item.source,
        createdAt: item.createdAt,
      })),
    },
    learning: {
      hours,
      count: learning.observations.length,
      latestObservationAt,
      observationTypes,
      observationSources,
      topObservationTickers,
      examples: learning.observations.slice(0, 30).map((item) => ({
        ticker: item.ticker,
        observedAt: item.observedAt,
        sessionMode: item.sessionMode,
        observationType: item.observationType,
        source: item.source,
        signalState: item.signalState,
        confidence: item.confidence,
        score: item.score,
        risk: item.risk,
        rvol: item.rvol,
        momentum: item.momentum,
        continuationProbability: item.continuationProbability,
        fadeProbability: item.fadeProbability,
        suppressionReason: item.suppressionReason,
      })),
    },
    verdict: {
      memoryWorking:
        latestRunChanges.persistence === "active" &&
        learning.persistence === "active" &&
        snapshots.length > 0 &&
        learning.observations.length > 0,
      blocker:
        latestRunChanges.persistence !== "active" || learning.persistence !== "active"
          ? "supabase_or_migration_missing"
          : snapshots.length === 0
            ? "case_state_snapshots_empty"
            : learning.observations.length === 0
              ? "learning_observations_empty"
              : latestRunChanges.changes.length === 0
                ? "no_recent_ranking_changes"
                : "none_obvious_from_memory_endpoint",
    },
  });
}
