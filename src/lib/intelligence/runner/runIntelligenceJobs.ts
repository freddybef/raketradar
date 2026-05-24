import { runAgentLoop } from "@/lib/agent/runAgentLoop";
import { getIntelligenceDebugSnapshot, getMorningWarRoomInput } from "@/lib/db/intelligenceRepository";
import {
  createIntelligenceRun,
  finishIntelligenceRun,
  getLatestCaseStateSnapshots,
  saveCaseStateSnapshots,
  saveChangeAlerts,
  saveLearningObservations,
  saveRankingChanges,
} from "@/lib/db/runnerRepository";
import { runAutonomousDiscoveryScan } from "@/lib/intelligence/autonomousDiscovery";
import { buildMorningWarRoom } from "@/lib/intelligence/morningWarRoom";
import { collectPendingOutcomes } from "@/lib/intelligence/outcomeCollector";
import { calculateLiveMarketReactions } from "@/lib/intelligence/liveMarketReaction";
import { getSwedishEquityUniverse } from "@/lib/market/swedishEquityUniverse";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";
import {
  appendTerminalDroppedSnapshots,
  applyCaseLifecycleRetention,
  detectRankingChanges,
  snapshotsFromAgent,
} from "@/lib/intelligence/runner/changeDetection";
import { buildLearningObservations } from "@/lib/intelligence/runner/learningHarvest";

export type IntelligenceJob = "marketReaction" | "discovery" | "warRoom" | "agentLoop" | "outcomes" | "health";
export type IntelligenceRunReason = "manual" | "scheduled" | "market-open" | "feedback" | "intraday" | "evening" | "overnight";

const DEFAULT_JOBS: IntelligenceJob[] = ["marketReaction", "discovery", "warRoom", "agentLoop", "health"];

export async function runIntelligenceJobs(input?: { jobs?: IntelligenceJob[]; reason?: IntelligenceRunReason }) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const jobs = input?.jobs?.length ? input.jobs : DEFAULT_JOBS;
  const reason = input?.reason ?? "manual";
  const run = await createIntelligenceRun({ jobs, reason, status: "running", startedAt });
  const results: Record<string, unknown> = {};
  const failedJobs: Array<{ job: string; error: string }> = [];

  async function runJob<T>(job: IntelligenceJob, fn: () => Promise<T>) {
    if (!jobs.includes(job)) return null;
    try {
      const result = await fn();
      results[job] = result;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Okänt jobbfel";
      failedJobs.push({ job, error: message });
      results[job] = { error: message };
      return null;
    }
  }

  await runJob("marketReaction", async () => {
    const universe = getSwedishEquityUniverse();
    const symbols = universe.map((entry) => entry.ticker);
    const reactions = await calculateLiveMarketReactions({ symbols, provider: yahooLiveMarketReactionProvider, universe });
    return {
      checked: symbols.length,
      liveHits: reactions.length,
      strongest: reactions.slice(0, 10).map((item) => ({
        ticker: item.ticker,
        momentum: item.intradayMomentum,
        rvol: item.relativeVolume,
        label: item.label,
      })),
    };
  });

  await runJob("discovery", () => runAutonomousDiscoveryScan({ provider: yahooLiveMarketReactionProvider }));

  await runJob("warRoom", async () => {
    const input = await getMorningWarRoomInput();
    return input ? buildMorningWarRoom(input) : null;
  });

  const agent = await runJob("agentLoop", () => runAgentLoop());

  await runJob("outcomes", () => collectPendingOutcomes());
  await runJob("health", () => getIntelligenceDebugSnapshot());

  const previousSnapshots = await getLatestCaseStateSnapshots();
  const freshSnapshots = agent ? snapshotsFromAgent(agent) : [];
  const retainedSnapshots = applyCaseLifecycleRetention(previousSnapshots, freshSnapshots);
  const changes = detectRankingChanges(previousSnapshots, retainedSnapshots);
  const currentSnapshots = appendTerminalDroppedSnapshots(retainedSnapshots, previousSnapshots, changes);
  const observations = buildLearningObservations({
    observedAt: new Date().toISOString(),
    sessionMode: agent?.sessionMode ?? reason,
    changes,
    snapshots: currentSnapshots,
    agent,
    results,
  });
  const [snapshotSave, changeSave, alertSave, observationSave] = await Promise.all([
    saveCaseStateSnapshots(run.id, currentSnapshots),
    saveRankingChanges(run.id, changes),
    saveChangeAlerts(run.id, changes),
    saveLearningObservations(run.id, observations),
  ]);

  const finishedAt = new Date().toISOString();
  const status = failedJobs.length === 0 ? "success" : failedJobs.length === jobs.length ? "error" : "partial";
  const summary = {
    generatedAt: finishedAt,
    runId: run.id,
    persistence: run.persistence,
    jobs,
    reason,
    status,
    failedJobs,
    results,
    lifecycle: {
      previousSnapshots: previousSnapshots.length,
      freshSnapshots: freshSnapshots.length,
      retainedSnapshots: retainedSnapshots.length - freshSnapshots.length,
      persistedSnapshots: currentSnapshots.length,
    },
    changes,
    saved: {
      snapshots: snapshotSave.saved,
      rankingChanges: changeSave.saved,
      agentAlerts: alertSave.saved,
      learningObservations: observationSave.saved,
    },
  };

  await finishIntelligenceRun({
    runId: run.id,
    status,
    finishedAt,
    latencyMs: Date.now() - started,
    summary,
    errorMessage: failedJobs.map((item) => `${item.job}: ${item.error}`).join("; ") || null,
  });

  return summary;
}