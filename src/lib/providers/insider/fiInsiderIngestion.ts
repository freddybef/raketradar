import type { InsiderEvent } from "@/lib/intelligence/insider/insiderTypes";
import {
  saveInsiderEvents,
  saveProviderRun,
} from "@/lib/db/intelligenceRepository";
import {
  detectInsiderPatterns,
  fetchFiInsiderSnapshot,
  type FiInsiderSignal,
} from "./fiInsiderProvider";

export interface FiInsiderIngestionResult {
  provider: "FI insider";
  sourceUrl: string;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  status: "success" | "empty" | "error";
  fetched: number;
  deduped: number;
  persisted: number;
  skippedPersistence: boolean;
  events: InsiderEvent[];
  patterns: FiInsiderSignal[];
  error?: string;
}

export function buildFiInsiderEventKey(event: InsiderEvent) {
  return [
    event.ticker,
    event.insiderName,
    event.role,
    event.type,
    Math.round(event.valueSek || 0),
    event.date.slice(0, 10),
  ]
    .map((part) => String(part).toLowerCase().replace(/\s+/g, " ").trim())
    .join("|");
}

export function dedupeInsiderEvents(events: InsiderEvent[]) {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = buildFiInsiderEventKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function ingestFiInsiderEvents(): Promise<FiInsiderIngestionResult> {
  const startedAt = new Date().toISOString();
  const snapshot = await fetchFiInsiderSnapshot({ limit: 100 });
  const events = dedupeInsiderEvents(snapshot.events);
  const patterns = detectInsiderPatterns(events);

  let persisted = 0;
  let skippedPersistence = false;
  let persistenceError: string | undefined;

  try {
    const persistence = await saveInsiderEvents(events);
    persisted = persistence.saved;
    skippedPersistence = persistence.skipped;
  } catch (error) {
    persistenceError = String(error);
  }

  const finishedAt = new Date().toISOString();
  const status: FiInsiderIngestionResult["status"] =
    snapshot.status === "error" || persistenceError ? "error" : events.length > 0 ? "success" : "empty";

  const result: FiInsiderIngestionResult = {
    provider: "FI insider",
    sourceUrl: snapshot.sourceUrl,
    startedAt,
    finishedAt,
    latencyMs: snapshot.latencyMs,
    status,
    fetched: snapshot.events.length,
    deduped: events.length,
    persisted,
    skippedPersistence,
    events,
    patterns,
    error: persistenceError ?? snapshot.error,
  };

  await saveProviderRun({
    provider: result.provider,
    status: result.status,
    startedAt,
    finishedAt,
    latencyMs: result.latencyMs,
    fetchedCount: result.fetched,
    savedCount: result.persisted,
    errorMessage: result.error,
    rawPayload: {
      sourceUrl: result.sourceUrl,
      rawCount: snapshot.rawEvents.length,
      deduped: result.deduped,
      skippedPersistence: result.skippedPersistence,
      patterns: result.patterns.map((pattern) => ({
        ticker: pattern.ticker,
        evidence: pattern.evidence,
      })),
    },
  }).catch((error) => {
    console.warn("RaketRadar FI provider health log failed", error);
  });

  return result;
}
