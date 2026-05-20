import { getAgentMemorySnapshot } from "@/lib/db/agentRepository";
import { getLearningObservations } from "@/lib/db/runnerRepository";
import { resolveTickerIdentity, type TickerValidationResult } from "@/lib/market/tickerIdentity";

export type CopilotEntityStatus = "resolved" | "unresolved" | "ambiguous" | "coverage_gap";

export interface CopilotResolvedEntity {
  queryText: string;
  normalizedTicker: string;
  status: CopilotEntityStatus;
  confidence: number;
  identity?: TickerValidationResult["identity"];
  displayTicker?: string;
  source: "ticker_identity" | "intelligence_data" | "user_query" | "selected_ticker";
  evidence: string[];
  guardrails: string[];
  coverageGap: boolean;
  rejectedState: boolean;
  recommendationAllowed: boolean;
}

const STOPWORDS = new Set([
  "VAD",
  "VAR",
  "HUR",
  "KAN",
  "KUNDE",
  "INNAN",
  "ELLER",
  "OCH",
  "DET",
  "DEN",
  "SOM",
  "HAR",
  "MED",
  "CASE",
  "DATA",
  "GAP",
  "AI",
  "API",
  "PM",
]);

function normalizeTicker(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeCopilotQuery(query: string) {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function extractTickerCandidates(query: string, selectedTicker?: string | null) {
  const candidates = new Set<string>();
  if (selectedTicker) candidates.add(normalizeTicker(selectedTicker));
  const matches = query.match(/\b[A-ZÅÄÖ]{2,8}(?:\s+[AB])?\b/g) ?? [];
  for (const match of matches) {
    const normalized = normalizeTicker(match);
    if (!normalized || STOPWORDS.has(normalized)) continue;
    candidates.add(normalized);
  }
  return [...candidates];
}

async function buildKnownTickerEvidence() {
  const [observations, agentMemory] = await Promise.all([getLearningObservations(72, 1000), getAgentMemorySnapshot()]);
  const evidence = new Map<string, Set<string>>();
  const rejected = new Set<string>();

  function add(ticker: string | null | undefined, source: string, state?: string | null) {
    if (!ticker) return;
    const key = normalizeTicker(ticker);
    if (!key) return;
    const current = evidence.get(key) ?? new Set<string>();
    current.add(source);
    evidence.set(key, current);
    if (String(state ?? "").toUpperCase() === "REJECTED") rejected.add(key);
  }

  for (const item of observations.observations) {
    add(item.ticker, `learning:${item.observationType}`, item.signalState);
  }
  for (const event of agentMemory.caseEvents) {
    add(event.ticker, `agent:${event.state}`, event.state);
  }
  for (const alert of agentMemory.alerts) {
    add(alert.ticker, `alert:${alert.alertType}`, alert.alertType);
  }

  return { evidence, rejected };
}

export async function resolveCopilotEntities(input: { query: string; selectedTicker?: string | null }) {
  const detected = extractTickerCandidates(input.query, input.selectedTicker);
  const known = await buildKnownTickerEvidence();
  const entities: CopilotResolvedEntity[] = detected.map((ticker) => {
    const validation = resolveTickerIdentity({ ticker, source: "copilot", swedishFirstMode: true });
    const evidence = [...(known.evidence.get(ticker) ?? new Set<string>())];
    const rejectedState = known.rejected.has(ticker);
    const unresolvedByIdentity = validation.rejectionReasons.includes("unresolved_symbol") || !validation.isCanonical;
    const nonSwedish = validation.rejectionReasons.includes("non_swedish_exchange");
    const collision = validation.rejectionReasons.includes("ticker_collision");
    const lowConfidence = validation.rejectionReasons.includes("low_ticker_confidence");
    const guardrails = [
      rejectedState ? "entity_has_rejected_state" : null,
      nonSwedish ? "non_swedish_exchange" : null,
      collision ? "ticker_collision" : null,
      lowConfidence && !unresolvedByIdentity ? "low_ticker_confidence" : null,
    ].filter((item): item is string => Boolean(item));

    if (evidence.length > 0 && !nonSwedish && !collision) {
      return {
        queryText: ticker,
        normalizedTicker: ticker,
        status: "resolved" as const,
        confidence: Math.max(65, validation.identity.sourceConfidence),
        identity: validation.isCanonical ? validation.identity : undefined,
        displayTicker: validation.isCanonical ? validation.displayTicker : ticker,
        source: validation.isCanonical ? "ticker_identity" as const : "intelligence_data" as const,
        evidence,
        guardrails,
        coverageGap: false,
        rejectedState,
        recommendationAllowed: !rejectedState && guardrails.length === 0,
      };
    }

    if (unresolvedByIdentity) {
      return {
        queryText: ticker,
        normalizedTicker: ticker,
        status: "coverage_gap" as const,
        confidence: 25,
        displayTicker: ticker,
        source: ticker === normalizeTicker(input.selectedTicker ?? "") ? "selected_ticker" as const : "user_query" as const,
        evidence,
        guardrails: ["unresolved_entity_not_bad_case"],
        coverageGap: true,
        rejectedState: false,
        recommendationAllowed: false,
      };
    }

    if (collision) {
      return {
        queryText: ticker,
        normalizedTicker: ticker,
        status: "ambiguous" as const,
        confidence: validation.identity.sourceConfidence,
        identity: validation.identity,
        displayTicker: validation.displayTicker,
        source: "ticker_identity",
        evidence,
        guardrails,
        coverageGap: false,
        rejectedState,
        recommendationAllowed: false,
      };
    }

    return {
      queryText: ticker,
      normalizedTicker: ticker,
      status: validation.isDisplayable ? "resolved" : "coverage_gap",
      confidence: validation.identity.sourceConfidence,
      identity: validation.identity,
      displayTicker: validation.displayTicker,
      source: "ticker_identity",
      evidence,
      guardrails,
      coverageGap: !validation.isDisplayable,
      rejectedState,
      recommendationAllowed: validation.isDisplayable && !rejectedState,
    };
  });

  return {
    normalizedQuery: normalizeCopilotQuery(input.query),
    detectedTickers: detected,
    entities,
  };
}
