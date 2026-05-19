import {
  createAutonomySession,
  getLatestAutonomySession,
  recordAutonomyRun,
  saveOvernightSummary,
  saveProviderCoverageSnapshot,
  stopAutonomySession,
} from "@/lib/db/autonomyRepository";
import { runLearningHarvest } from "@/lib/intelligence/learningHarvest";
import { generateMorningBriefPayload } from "@/lib/intelligence/morningBriefPayload";
import { generateOvernightSummary } from "@/lib/intelligence/overnightSummary";
import { runIntelligenceJobs, type IntelligenceJob, type IntelligenceRunReason } from "@/lib/intelligence/runner/runIntelligenceJobs";

export type AutonomyMode = "market-open" | "intraday" | "evening" | "overnight" | "manual";

interface AutonomyRuntime {
  mode: AutonomyMode;
  status: "idle" | "running" | "stopped" | "error";
  intervalMs: number;
  sessionId: string | null;
  persistence: "active" | "missing_supabase";
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
  lastRunAt: string | null;
  runCount: number;
  observationsSaved: number;
  lastError: string | null;
}

const DEFAULT_INTERVAL_MS = 15 * 60_000;

const runtime: AutonomyRuntime = {
  mode: "manual",
  status: "idle",
  intervalMs: DEFAULT_INTERVAL_MS,
  sessionId: null,
  persistence: "missing_supabase",
  timer: null,
  running: false,
  lastRunAt: null,
  runCount: 0,
  observationsSaved: 0,
  lastError: null,
};

export function intervalForAutonomyMode(mode: AutonomyMode) {
  if (mode === "market-open") return 60_000;
  if (mode === "intraday") return 5 * 60_000;
  if (mode === "evening") return 15 * 60_000;
  if (mode === "overnight") return 30 * 60_000;
  return DEFAULT_INTERVAL_MS;
}

function jobsForAutonomyMode(mode: AutonomyMode): IntelligenceJob[] {
  if (mode === "overnight" || mode === "evening") return ["discovery", "warRoom", "agentLoop", "outcomes", "health"];
  return ["marketReaction", "discovery", "warRoom", "agentLoop", "health"];
}

function reasonForMode(mode: AutonomyMode): IntelligenceRunReason {
  if (mode === "market-open") return "market-open";
  if (mode === "intraday" || mode === "evening" || mode === "overnight") return mode;
  return "manual";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractDiscovery(summary: unknown) {
  const results = asRecord(asRecord(summary).results);
  return asRecord(results.discovery);
}

function extractHealth(summary: unknown) {
  const results = asRecord(asRecord(summary).results);
  return asRecord(results.health);
}

function countCases(summary: unknown) {
  const discovery = extractDiscovery(summary);
  const agent = asRecord(asRecord(summary).results).agentLoop;
  return asArray(discovery.candidates).length + asArray(asRecord(agent).cases).length;
}

function failedProvidersFromSummary(summary: unknown) {
  const health = extractHealth(summary);
  return asArray(health.providerRuns).filter((item) => asRecord(item).status === "error").slice(0, 20);
}

function missingCoverageFromSummary(summary: unknown) {
  const discovery = extractDiscovery(summary);
  return asArray(discovery.coverageByExchange)
    .filter((item) => Number(asRecord(item).coveragePercent ?? 0) < 35)
    .slice(0, 20);
}

export async function runAutonomyOnce(reason = "manual-trigger") {
  if (runtime.running) {
    return {
      status: "skipped_parallel_run",
      sessionId: runtime.sessionId,
      lastRunAt: runtime.lastRunAt,
      runCount: runtime.runCount,
    };
  }

  runtime.running = true;
  runtime.status = "running";
  runtime.lastError = null;

  try {
    const summary = await runIntelligenceJobs({
      jobs: jobsForAutonomyMode(runtime.mode),
      reason: reasonForMode(runtime.mode),
    });
    const harvest = await runLearningHarvest({ sessionId: runtime.sessionId, reason });
    const ranAt = summary.generatedAt ?? new Date().toISOString();
    const changes = asArray(asRecord(summary).changes);
    const discovery = extractDiscovery(summary);

    await Promise.all([
      saveProviderCoverageSnapshot({
        sessionId: runtime.sessionId,
        runId: typeof summary.runId === "string" ? summary.runId : null,
        observedAt: ranAt,
        provider: "autonomous_discovery",
        scannedCount: Number(discovery.scannedCount ?? 0),
        liveHits: Number(discovery.liveHits ?? 0),
        missingDataCount: Number(discovery.missingDataCount ?? 0),
        coverageByExchange: discovery.coverageByExchange ?? [],
        payload: discovery,
      }),
      recordAutonomyRun({
        sessionId: runtime.sessionId,
        runId: typeof summary.runId === "string" ? summary.runId : null,
        ranAt,
        casesObserved: countCases(summary),
        observationsSaved: Number(summary.saved?.learningObservations ?? 0) + harvest.saved,
        failedProviders: failedProvidersFromSummary(summary),
        missingCoverage: missingCoverageFromSummary(summary),
        notableChanges: changes.slice(0, 30),
        learnedObservations: harvest.observations.slice(0, 30),
        summary,
      }),
    ]);

    runtime.runCount += 1;
    runtime.observationsSaved += Number(summary.saved?.learningObservations ?? 0) + harvest.saved;
    runtime.lastRunAt = ranAt;
    runtime.status = runtime.timer ? "running" : "idle";

    return {
      status: "success",
      sessionId: runtime.sessionId,
      run: summary,
      harvest,
      runCount: runtime.runCount,
      observationsSaved: runtime.observationsSaved,
      lastRunAt: runtime.lastRunAt,
    };
  } catch (error) {
    runtime.status = "error";
    runtime.lastError = error instanceof Error ? error.message : "Okant autonomy-fel";
    if (runtime.sessionId) {
      await stopAutonomySession({
        sessionId: runtime.sessionId,
        endedAt: new Date().toISOString(),
        status: "error",
        errorMessage: runtime.lastError,
      });
    }
    return {
      status: "error",
      sessionId: runtime.sessionId,
      error: runtime.lastError,
    };
  } finally {
    runtime.running = false;
  }
}

export async function startAutonomy(input?: { mode?: AutonomyMode; intervalMs?: number; runImmediately?: boolean }) {
  if (runtime.timer) clearInterval(runtime.timer);
  const mode = input?.mode ?? "intraday";
  const intervalMs = input?.intervalMs ?? intervalForAutonomyMode(mode);
  const startedAt = new Date().toISOString();
  const session = await createAutonomySession({ mode, intervalMs, startedAt });

  runtime.mode = mode;
  runtime.status = "running";
  runtime.intervalMs = intervalMs;
  runtime.sessionId = session.id;
  runtime.persistence = session.persistence;
  runtime.runCount = 0;
  runtime.observationsSaved = 0;
  runtime.lastRunAt = null;
  runtime.lastError = null;

  runtime.timer = setInterval(() => {
    void runAutonomyOnce("scheduled-autonomy");
  }, intervalMs);

  if (input?.runImmediately ?? true) {
    void runAutonomyOnce("start-autonomy");
  }

  return getAutonomyStatus();
}

export async function stopAutonomy() {
  if (runtime.timer) clearInterval(runtime.timer);
  runtime.timer = null;
  runtime.status = "stopped";
  await stopAutonomySession({ sessionId: runtime.sessionId, endedAt: new Date().toISOString(), status: "stopped" });
  return getAutonomyStatus();
}

export async function getAutonomyStatus() {
  const latest = await getLatestAutonomySession();
  return {
    mode: runtime.mode,
    status: runtime.status,
    intervalMs: runtime.intervalMs,
    running: runtime.running,
    hasLocalTimer: Boolean(runtime.timer),
    sessionId: runtime.sessionId,
    persistence: runtime.persistence,
    lastRunAt: runtime.lastRunAt,
    runCount: runtime.runCount,
    observationsSaved: runtime.observationsSaved,
    lastError: runtime.lastError,
    databaseSession: latest.session,
    note: "Local server-side autonomy kör bara medan Next.js-processen är igång. Ingen OpenAI/Copilot körs automatiskt.",
  };
}

export async function generateAndPersistOvernightSummary() {
  const summary = await generateOvernightSummary();
  const morningBrief = generateMorningBriefPayload(summary);
  await saveOvernightSummary({
    sessionId: runtime.sessionId,
    generatedAt: summary.generatedAt,
    summary,
    morningBriefPayload: morningBrief,
  });
  return {
    ...summary,
    morningBriefPayload: morningBrief,
  };
}
