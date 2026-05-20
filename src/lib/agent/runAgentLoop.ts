import {
  ensureAgentSession,
  getAgentMemorySnapshot,
  getFeedbackSummary,
  getLatestCaseStates,
  saveAgentAlerts,
  saveAgentCaseEvents,
} from "@/lib/db/agentRepository";
import { getMorningWarRoomInput } from "@/lib/db/intelligenceRepository";
import { buildMorningWarRoom } from "@/lib/intelligence/morningWarRoom";
import { runAutonomousDiscoveryScan } from "@/lib/intelligence/autonomousDiscovery";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";
import { evaluateAgentCaseState, getTradingSessionMode, type AgentCaseInput } from "@/lib/agent/stateEngine";

function uniqueByTicker(inputs: AgentCaseInput[]) {
  const map = new Map<string, AgentCaseInput>();
  for (const input of inputs) {
    const existing = map.get(input.ticker);
    if (!existing || priority(input) > priority(existing)) map.set(input.ticker, input);
  }
  return [...map.values()];
}

function priority(input: AgentCaseInput) {
  if (input.source === "rejected") return 0;
  return Number(input.preOpenScore ?? 0) + Number(input.confidence ?? 0) + Number(input.live?.relativeVolume ?? 0) * 10;
}

export async function runAgentLoop() {
  const now = new Date();
  const sessionMode = getTradingSessionMode(now);
  const session = await ensureAgentSession(sessionMode);
  const [warRoomInput, discovery, previousStates, feedbackMap] = await Promise.all([
    getMorningWarRoomInput(),
    runAutonomousDiscoveryScan({ provider: yahooLiveMarketReactionProvider }),
    getLatestCaseStates(session.sessionId),
    getFeedbackSummary(),
  ]);

  const warRoom = warRoomInput ? buildMorningWarRoom(warRoomInput) : null;
  const inputs: AgentCaseInput[] = [
    ...(warRoom?.topPreOpenSetups ?? []).map((setup) => ({
      ticker: setup.ticker,
      companyName: setup.companyName,
      exchange: setup.exchange,
      source: "war_room" as const,
      preOpenScore: setup.preOpenScore,
      confidence: setup.confidence,
      falsePositiveRisk: setup.falsePositiveRisk,
      openingAction: setup.openingAction,
      confirmation: setup.openingPlan?.confirms,
      invalidation: setup.invalidation ?? setup.openingPlan?.invalidates,
      live: setup.liveMarketReaction,
    })),
    ...(discovery?.candidates ?? []).map((candidate) => ({
      ticker: candidate.ticker,
      companyName: candidate.companyName,
      exchange: candidate.exchange,
      source: "discovery" as const,
      preOpenScore: candidate.autonomousDiscoveryScore,
      confidence: candidate.discoveryConfidence,
      falsePositiveRisk: candidate.bucket === "RISK" ? 70 : 30,
      confirmation: candidate.whyDiscovered.join(" / "),
      invalidation: candidate.whyNotRankedHigher.join(" / "),
      live: candidate.reaction,
    })),
    ...(warRoom?.rejectedCandidates ?? []).map((rejected) => ({
      ticker: rejected.ticker,
      companyName: rejected.trigger,
      exchange: rejected.tickerValidation?.identity.exchange,
      source: "rejected" as const,
      preOpenScore: rejected.preOpenScore,
      confidence: rejected.tickerValidation?.identity.sourceConfidence ?? 0,
      rejectedReasons: rejected.rejectedBecause,
    })),
  ];

  const cases = uniqueByTicker(inputs).map((input) =>
    evaluateAgentCaseState(input, previousStates.get(input.ticker) ?? null, feedbackMap.get(input.ticker), now)
  );

  const [eventsResult, alertsResult] = await Promise.all([
    saveAgentCaseEvents(session.sessionId, cases),
    saveAgentAlerts(session.sessionId, cases),
  ]);
  const memory = await getAgentMemorySnapshot();
  const liveAlerts = cases
    .filter((caseItem) => caseItem.alertType)
    .map((caseItem, index) => ({
      id: `${caseItem.eventKey}-${index}`,
      ticker: caseItem.ticker,
      alertType: caseItem.alertType ?? "CASE_UPGRADED",
      severity: caseItem.alertSeverity ?? "LOW",
      title: `${caseItem.ticker}: ${caseItem.state}`,
      message: caseItem.reason,
      createdAt: now.toISOString(),
    }));

  return {
    generatedAt: now.toISOString(),
    sessionId: session.sessionId,
    sessionMode,
    persistence: session.skipped ? "missing_supabase" as const : "active" as const,
    cases,
    alerts: memory.alerts.length > 0 ? memory.alerts : liveAlerts,
    feedback: memory.feedback,
    saved: {
      events: eventsResult.saved,
      alerts: alertsResult.saved,
    },
    diagnostics: {
      warRoomCases: warRoom?.topPreOpenSetups.length ?? 0,
      discoveryCases: discovery?.candidates.length ?? 0,
      rejectedCases: warRoom?.rejectedCandidates.length ?? 0,
      coverage: discovery
        ? {
            scannedCount: discovery.scannedCount,
            liveHits: discovery.liveHits,
            missingDataCount: discovery.missingDataCount,
            coverageByExchange: discovery.coverageByExchange,
          }
        : null,
    },
  };
}
