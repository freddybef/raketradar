import { getCopilotRetrievalRows } from "@/lib/db/copilotRepository";
import { resolveCopilotEntities } from "@/lib/intelligence/copilot/entityResolver";
import { findSuspiciousUnknowns } from "@/lib/intelligence/discovery/suspiciousUnknowns";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function includesTicker(row: unknown, ticker: string) {
  const record = asRecord(row);
  return String(record.ticker ?? "").toUpperCase() === ticker.toUpperCase();
}

function isRetroQuestion(query: string) {
  const normalized = query.toLowerCase();
  return (
    normalized.includes("kunde vi") ||
    normalized.includes("hittat") ||
    normalized.includes("missade") ||
    normalized.includes("innan upp") ||
    normalized.includes("coverage gap") ||
    normalized.includes("dåligt case") ||
    normalized.includes("daligt case")
  );
}

function summarizeCoverage(providerCoverage: unknown[]) {
  const latest = asRecord(providerCoverage[0]);
  return {
    provider: latest.provider ?? null,
    observedAt: latest.observed_at ?? null,
    scannedCount: latest.scanned_count ?? null,
    liveHits: latest.live_hits ?? null,
    missingDataCount: latest.missing_data_count ?? null,
    coverageByExchange: latest.coverage_by_exchange ?? [],
  };
}

export async function buildCopilotRetrieval(input: { query: string; selectedTicker?: string | null }) {
  const resolved = await resolveCopilotEntities(input);
  const tickers = resolved.entities.map((entity) => entity.normalizedTicker);
  const [rows, suspiciousUnknowns] = await Promise.all([
    getCopilotRetrievalRows(tickers),
    findSuspiciousUnknowns({ tickers, persist: false }),
  ]);

  const perTicker = resolved.entities.map((entity) => {
    const ticker = entity.normalizedTicker;
    const data = {
      rankingChanges: rows.rankingChanges.filter((row) => includesTicker(row, ticker)).slice(0, 20),
      learningObservations: rows.learningObservations.filter((row) => includesTicker(row, ticker)).slice(0, 40),
      agentAlerts: rows.agentAlerts.filter((row) => includesTicker(row, ticker)).slice(0, 20),
      caseStateSnapshots: rows.caseStateSnapshots.filter((row) => includesTicker(row, ticker)).slice(0, 30),
      signalOutcomes: rows.signalOutcomes.filter((row) => includesTicker(row, ticker)).slice(0, 30),
      signalOutcomesDetailed: rows.signalOutcomesDetailed.filter((row) => includesTicker(row, ticker)).slice(0, 30),
    };
    const foundInData = Object.values(data).some((items) => items.length > 0);
    const wasSuppressed = data.learningObservations.some((row) => Boolean(asRecord(row).suppression_reason));
    return {
      entity,
      foundInData,
      data,
      wasSuppressed,
      coverageStatus: entity.coverageGap || !foundInData ? "coverage_or_entity_gap" : "covered",
      warning:
        entity.coverageGap || !foundInData
          ? `${ticker} saknar verifierad coverage i nuvarande intelligence-lager. Det betyder inte svagt case.`
          : null,
      suspiciousUnknown: suspiciousUnknowns.candidates.find((candidate) => candidate.ticker === ticker) ?? null,
    };
  });

  const retroAnalysis = isRetroQuestion(input.query)
    ? perTicker.map((item) => ({
        ticker: item.entity.normalizedTicker,
        entityStatus: item.entity.status,
        foundInData: item.foundInData,
        hadPreMoveSignals:
          item.data.rankingChanges.length > 0 ||
          item.data.learningObservations.some((row) => ["stronger_case", "case_state_snapshot", "missed_mover"].includes(String(asRecord(row).observation_type ?? ""))),
        wasSuppressed: item.wasSuppressed,
        rejectedState: item.entity.rejectedState,
        coverageGap: item.entity.coverageGap || !item.foundInData,
        suspiciousUnknown: item.suspiciousUnknown,
        falseNegativeRisk: item.suspiciousUnknown?.falseNegativeRisk ?? (item.entity.coverageGap || !item.foundInData ? 65 : 25),
        missingProviderEvidence: summarizeCoverage(rows.providerCoverage),
        whatExisted: {
          mentions: item.suspiciousUnknown?.repeatedMentions ?? 0,
          unresolvedFrequency: item.suspiciousUnknown?.unresolvedFrequency ?? 0,
          inferredSector: item.suspiciousUnknown?.inferredSector ?? null,
          suppressed: item.wasSuppressed,
        },
        whyMissed: item.foundInData
          ? "Symbolen fanns delvis i data men var inte tillrackligt stark eller var undertryckt av risk/coverage-filter."
          : "Symbolen saknades i relevant universe/snapshots/coverage och maste behandlas som coverage/entity-gap.",
        whatWouldBeNeeded: [
          "ticker finns i Swedish equity universe eller resolveras via ISIN/market source",
          "intraday price/volume feed täcker symbolen",
          "news/provider kan koppla PM eller catalyst till symbolen",
          "case_state_snapshots skapas innan rörelsen, inte efteråt",
        ],
      }))
    : [];

  const contextPayload = {
    query: input.query,
    normalizedQuery: resolved.normalizedQuery,
    detectedTickers: resolved.detectedTickers,
    resolvedEntities: resolved.entities,
    perTicker,
    retroAnalysis,
    providerCoverage: rows.providerCoverage.slice(0, 10),
    suspiciousUnknowns: suspiciousUnknowns.candidates,
    morningBriefPayloads: rows.morningBriefs.slice(0, 3),
    overnightSummaries: rows.overnightSummaries.slice(0, 3),
    recentCopilotMessages: rows.recentMessages,
    guardrails: {
      unknownMeansCoverageGap: true,
      rejectedNeverUpgrade: true,
      doNotAnswerDifferentTickerWithoutExplaining: true,
      bioxRulesStillApply: true,
      portfolioDoesNotAffectAutonomousDiscoveryScore: true,
    },
  };

  return {
    ...resolved,
    contextPayload,
    contextSummary: {
      detectedTickers: resolved.detectedTickers,
      entityStatuses: resolved.entities.map((entity) => ({
        ticker: entity.normalizedTicker,
        status: entity.status,
        confidence: entity.confidence,
        coverageGap: entity.coverageGap,
        rejectedState: entity.rejectedState,
        recommendationAllowed: entity.recommendationAllowed,
      })),
      hasRetroAnalysis: retroAnalysis.length > 0,
      providerCoverage: summarizeCoverage(rows.providerCoverage),
      suspiciousUnknowns: suspiciousUnknowns.candidates.map((item) => ({
        ticker: item.ticker,
        suspicionLevel: item.suspicionLevel,
        unknownScore: item.unknownScore,
        falseNegativeRisk: item.falseNegativeRisk,
      })),
      recentMessages: rows.recentMessages.length,
    },
  };
}
