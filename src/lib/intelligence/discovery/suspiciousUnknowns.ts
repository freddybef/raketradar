import { getRecentCopilotFeedback, getRecentCopilotMessages } from "@/lib/db/copilotRepository";
import { saveProviderCoverageGaps, upsertTickerCoverageProfiles } from "@/lib/db/coverageRepository";
import { getLearningObservations } from "@/lib/db/runnerRepository";
import { resolveTickerIdentity } from "@/lib/market/tickerIdentity";

export type SuspicionLevel = "irrelevant_unknown" | "weak_unknown" | "suspicious_unknown" | "likely_hidden_runner";

export interface SuspiciousUnknown {
  ticker: string;
  unknownScore: number;
  suspicionLevel: SuspicionLevel;
  inferredInterest: "none" | "low" | "medium" | "high";
  inferredSector: string | null;
  inferredMarket: string | null;
  possibleAliases: string[];
  possiblePeers: string[];
  reasoning: string[];
  falseNegativeRisk: number;
  coverageLevel: number;
  repeatedMentions: number;
  unresolvedFrequency: number;
  hiddenRunnerProbability: number;
  guardrails: string[];
}

const THEME_PEERS: Record<string, string[]> = {
  biotech: ["CANTA", "BICO", "EPIS B", "MEDI", "XSPRAY", "VICO", "IMMU"],
  defense: ["SAAB B", "MILDEF", "CLAV"],
  tech: ["SINCH", "YUBICO", "TOBII", "G5EN", "MYCR"],
  real_estate: ["MOFAST", "SBB B", "LOGISTEA"],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeTicker(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function levelFromScore(score: number): SuspicionLevel {
  if (score >= 75) return "likely_hidden_runner";
  if (score >= 50) return "suspicious_unknown";
  if (score >= 25) return "weak_unknown";
  return "irrelevant_unknown";
}

function interestFromScore(score: number): SuspiciousUnknown["inferredInterest"] {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return "none";
}

function inferSectorFromText(text: string) {
  const normalized = text.toLowerCase();
  if (/biotech|medtech|fda|ce|klinisk|studie/.test(normalized)) return "biotech";
  if (/försvar|forsvar|defense|cyber|milit/.test(normalized)) return "defense";
  if (/ai|datacenter|mjukvara|tech|gaming/.test(normalized)) return "tech";
  if (/fastighet|real estate|hyra|logistik/.test(normalized)) return "real_estate";
  return null;
}

function tickerShapeScore(ticker: string) {
  if (/^[A-Z0-9]{3,5}(?: [AB])?$/.test(ticker)) return 12;
  if (/^[A-Z0-9]{2,8}$/.test(ticker)) return 8;
  return 0;
}

export async function findSuspiciousUnknowns(input?: { tickers?: string[]; persist?: boolean }) {
  const [messagesResult, feedbackRows, observationsResult] = await Promise.all([
    getRecentCopilotMessages(200),
    getRecentCopilotFeedback(200),
    getLearningObservations(72, 1000),
  ]);

  const candidates = new Map<string, { mentions: number; feedback: number; texts: string[]; unresolved: number; suppressed: number }>();

  function ensure(ticker: string) {
    const key = normalizeTicker(ticker);
    const current = candidates.get(key) ?? { mentions: 0, feedback: 0, texts: [], unresolved: 0, suppressed: 0 };
    candidates.set(key, current);
    return current;
  }

  for (const ticker of input?.tickers ?? []) ensure(ticker);

  for (const message of messagesResult.messages) {
    for (const ticker of message.detectedTickers ?? []) {
      const current = ensure(ticker);
      current.mentions += 1;
      current.texts.push(message.message);
      for (const entity of (message.resolvedEntities as Array<{ status?: string; coverageGap?: boolean }> | null) ?? []) {
        if (entity.status === "coverage_gap" || entity.coverageGap) current.unresolved += 1;
      }
    }
  }

  for (const feedback of feedbackRows) {
    const record = asRecord(feedback);
    const ticker = typeof record.ticker === "string" ? record.ticker : null;
    if (!ticker) continue;
    const current = ensure(ticker);
    if (record.feedback_type === "MISSING_TICKER" || record.feedback_type === "WRONG_TICKER") {
      current.feedback += 1;
      current.unresolved += 1;
    }
  }

  for (const observation of observationsResult.observations) {
    if (!observation.ticker) continue;
    if (observation.observationType.includes("coverage") || observation.observationType.includes("unresolved") || observation.observationType.includes("missed")) {
      const current = ensure(observation.ticker);
      current.mentions += observation.observationType === "missed_mover" ? 1 : 0;
      current.unresolved += observation.observationType.includes("coverage") ? 1 : 0;
      current.suppressed += observation.suppressionReason ? 1 : 0;
      current.texts.push(JSON.stringify(observation.payload ?? {}).slice(0, 500));
    }
  }

  const unknowns: SuspiciousUnknown[] = [];
  for (const [ticker, stats] of candidates) {
    const identity = resolveTickerIdentity({ ticker, source: "copilot", swedishFirstMode: true });
    if (identity.rejectionReasons.includes("non_swedish_exchange") || identity.rejectionReasons.includes("ticker_collision")) continue;
    if (identity.rejectionReasons.length === 0 && identity.isDisplayable && stats.unresolved === 0 && !input?.tickers?.includes(ticker)) continue;

    const text = stats.texts.join(" ");
    const inferredSector = inferSectorFromText(text);
    const peers = inferredSector ? THEME_PEERS[inferredSector] ?? [] : [];
    const repeatedMentions = stats.mentions;
    const unresolvedFrequency = stats.unresolved;
    const score = Math.min(
      100,
      tickerShapeScore(ticker) +
        Math.min(30, repeatedMentions * 8) +
        Math.min(25, unresolvedFrequency * 10) +
        Math.min(20, stats.feedback * 12) +
        Math.min(15, stats.suppressed * 5) +
        (inferredSector ? 8 : 0) +
        (peers.length > 0 ? 5 : 0)
    );
    const coverageLevel = Math.max(0, Math.min(100, identity.isDisplayable ? identity.identity.sourceConfidence : 100 - unresolvedFrequency * 20 - stats.feedback * 15));
    const falseNegativeRisk = Math.min(100, Math.round(score * 0.7 + (100 - coverageLevel) * 0.3));

    unknowns.push({
      ticker,
      unknownScore: score,
      suspicionLevel: levelFromScore(score),
      inferredInterest: interestFromScore(score),
      inferredSector,
      inferredMarket: identity.identity.country === "SE" || identity.isSwedishPreferred ? identity.identity.exchange : "unknown_swedish_candidate",
      possibleAliases: [ticker, ticker.replace(/\s+/g, "")],
      possiblePeers: peers.filter((peer) => peer !== ticker).slice(0, 6),
      reasoning: [
        `${repeatedMentions} mentions i Copilot/retrieval`,
        `${unresolvedFrequency} unresolved/coverage-gap observationer`,
        stats.feedback ? `${stats.feedback} feedback events pekar pa missing/wrong ticker` : null,
        inferredSector ? `mojlig sektor/theme: ${inferredSector}` : null,
        "Coverage gap ar inte kop-signal, men kan vara false negative-risk.",
      ].filter((item): item is string => Boolean(item)),
      falseNegativeRisk,
      coverageLevel,
      repeatedMentions,
      unresolvedFrequency,
      hiddenRunnerProbability: Math.min(85, Math.round(score * 0.65)),
      guardrails: ["not_buy_signal", "requires_coverage_expansion", "unknown_not_rejected"],
    });
  }

  const sorted = unknowns.sort((a, b) => b.unknownScore - a.unknownScore).slice(0, 25);

  if (input?.persist ?? true) {
    await Promise.all([
      upsertTickerCoverageProfiles(
        sorted.map((item) => ({
          ticker: item.ticker,
          providerSuccessRate: item.coverageLevel,
          lastSuccessfulFetch: null,
          newsCoverage: item.repeatedMentions > 0 ? 35 : 0,
          volumeCoverage: 0,
          marketCoverage: item.coverageLevel,
          entityConfidence: item.coverageLevel,
          unresolvedFrequency: item.unresolvedFrequency,
          suppressionCount: item.reasoning.filter((reason) => reason.includes("suppressed")).length,
          falseNegativeRisk: item.falseNegativeRisk,
          payload: item,
        }))
      ),
      saveProviderCoverageGaps(
        sorted
          .filter((item) => item.suspicionLevel !== "irrelevant_unknown")
          .map((item) => ({
            ticker: item.ticker,
            provider: "copilot_retrieval",
            gapType: "suspicious_unknown",
            severity: item.falseNegativeRisk >= 70 ? "HIGH" : item.falseNegativeRisk >= 45 ? "MEDIUM" : "LOW",
            reason: item.reasoning.join(" / "),
            observedAt: new Date().toISOString(),
            payload: item,
          }))
      ),
    ]);
  }

  return {
    generatedAt: new Date().toISOString(),
    persistence: messagesResult.persistence === "active" || observationsResult.persistence === "active" ? "active" as const : "missing_supabase" as const,
    candidates: sorted,
    counts: {
      likelyHiddenRunner: sorted.filter((item) => item.suspicionLevel === "likely_hidden_runner").length,
      suspiciousUnknown: sorted.filter((item) => item.suspicionLevel === "suspicious_unknown").length,
      weakUnknown: sorted.filter((item) => item.suspicionLevel === "weak_unknown").length,
      irrelevantUnknown: sorted.filter((item) => item.suspicionLevel === "irrelevant_unknown").length,
    },
  };
}
