import { getAgentMemorySnapshot } from "@/lib/db/agentRepository";
import { getIntelligenceDebugSnapshot } from "@/lib/db/intelligenceRepository";
import { getLatestRunChanges, getLearningObservations } from "@/lib/db/runnerRepository";

function unique<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export async function generateOvernightSummary() {
  const [observationsResult, changesResult, agentMemory, debug] = await Promise.all([
    getLearningObservations(18, 500),
    getLatestRunChanges(),
    getAgentMemorySnapshot(),
    getIntelligenceDebugSnapshot(),
  ]);
  const observations = observationsResult.observations;
  const changes = changesResult.changes;
  const byType = (type: string) => observations.filter((item) => item.observationType === type);

  const stateChanges = changes.filter((item) => item.changeType === "stateChanged" || item.changeType === "newEntrant");
  const upgraded = changes.filter((item) => ["movedUp", "confidenceChanged", "newEntrant"].includes(item.changeType) && item.severity !== "LOW");
  const downgraded = changes.filter((item) => ["movedDown", "riskChanged", "dropped"].includes(item.changeType) && item.severity !== "LOW");
  const parabolic = observations.filter((item) => item.signalState === "PARABOLIC_RISK" || item.observationType.includes("PARABOLIC"));
  const missedMovers = byType("missed_mover");
  const coverage = byType("discovery_coverage")[0];
  const providerHealth = byType("provider_health")[0];
  const outcomeCollector = byType("outcome_collector")[0];

  const focusNow = unique(
    observations
      .filter((item) => ["HIGH_CONVICTION", "EARLY_CONTINUATION", "CONFIRMATION_PENDING"].includes(String(item.signalState ?? "")))
      .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0)),
    (item) => item.ticker ?? item.observationType
  ).slice(0, 5);

  const avoid = unique(
    observations.filter((item) => ["PARABOLIC_RISK", "FADE_WARNING", "FAILED"].includes(String(item.signalState ?? ""))),
    (item) => item.ticker ?? item.observationType
  ).slice(0, 8);

  const coveragePayload = coverage?.payload as { scannedCount?: number; liveHits?: number; missingDataCount?: number } | undefined;
  const coverageRatio =
    coveragePayload?.scannedCount && coveragePayload.scannedCount > 0
      ? Math.round(((coveragePayload.liveHits ?? 0) / coveragePayload.scannedCount) * 100)
      : null;

  const dataWarnings = [
    coverageRatio !== null && coverageRatio < 35 ? `Låg market coverage: ${coverageRatio}% live hits.` : null,
    debug.outcomeCollector.status === "not_run" ? "Outcome collector har inte körts." : null,
    debug.outcomeTracking.missingOutcomeData > 0 ? `${debug.outcomeTracking.missingOutcomeData} outcomes saknar data.` : null,
    changesResult.persistence === "missing_supabase" || observationsResult.persistence === "missing_supabase"
      ? "Learning persistence saknas: kör RUN_THIS_IN_SUPABASE.sql."
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    generatedAt: new Date().toISOString(),
    persistence: observationsResult.persistence,
    windowHours: 18,
    biggestStateChanges: stateChanges.slice(0, 10),
    newCasesDiscovered: changes.filter((item) => item.changeType === "newEntrant").slice(0, 10),
    casesUpgraded: upgraded.slice(0, 10),
    casesDowngraded: downgraded.slice(0, 10),
    parabolicFakeSpikeWarnings: parabolic.slice(0, 10),
    portfolioHoldingsRequiringAttention: agentMemory.alerts.filter((alert) => alert.alertType.includes("PORTFOLIO")).slice(0, 10),
    missedMovers: missedMovers.slice(0, 10),
    dataCoverageIssues: dataWarnings,
    providerFailures: debug.providerRuns.filter((run) => run.status === "error").slice(0, 10),
    providerHealth,
    outcomeCollector,
    morningBrief: {
      focus_now: focusNow.map((item) => ({ ticker: item.ticker, state: item.signalState, confidence: item.confidence, reason: item.payload })),
      watchlist: observations.filter((item) => item.signalState === "WATCH").slice(0, 8),
      avoid,
      portfolio_alerts: agentMemory.alerts.filter((alert) => alert.alertType.includes("PORTFOLIO")).slice(0, 8),
      discovery_candidates: observations.filter((item) => item.source === "autonomous_discovery" && item.ticker).slice(0, 8),
      data_quality: {
        coverageRatio,
        warnings: dataWarnings,
        providerFreshness: debug.freshness,
      },
      unresolved_risks: avoid.map((item) => ({ ticker: item.ticker, state: item.signalState, risk: item.risk })),
      suggested_next_checks: [
        "Kontrollera parabolic/fake-spike innan köp.",
        "Prioritera case med förbättrad state och låg fade-risk.",
        "Kör outcome collector om pending outcomes finns.",
      ],
    },
    whatToFocusOnNextSession: focusNow.slice(0, 5),
    whatToIgnore: avoid.slice(0, 8),
  };
}
