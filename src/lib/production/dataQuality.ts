export interface QualityEvent {
  id: string;
  ticker?: string;
  timestamp: string;
  source: string;
  rawText?: string;
  score?: number;
}

export interface DataQualityResult<T extends QualityEvent> {
  accepted: T[];
  rejected: Array<{ item: T; reason: string }>;
}

export function filterDataQuality<T extends QualityEvent>(
  items: T[],
  options?: { staleAfterMs?: number; minScore?: number }
): DataQualityResult<T> {
  const seen = new Set<string>();
  const accepted: T[] = [];
  const rejected: DataQualityResult<T>["rejected"] = [];
  const staleAfterMs = options?.staleAfterMs ?? 24 * 60 * 60 * 1000;

  for (const item of items) {
    const dedupeKey = `${item.source}-${item.ticker ?? ""}-${item.rawText ?? item.id}`;

    if (seen.has(dedupeKey)) {
      rejected.push({ item, reason: "duplicate event" });
      continue;
    }

    if (Date.now() - new Date(item.timestamp).getTime() > staleAfterMs) {
      rejected.push({ item, reason: "stale signal" });
      continue;
    }

    if (!item.id || !item.source || Number.isNaN(new Date(item.timestamp).getTime())) {
      rejected.push({ item, reason: "malformed provider data" });
      continue;
    }

    if (typeof item.score === "number" && item.score < (options?.minScore ?? 0)) {
      rejected.push({ item, reason: "low quality / spam noise" });
      continue;
    }

    seen.add(dedupeKey);
    accepted.push(item);
  }

  return { accepted, rejected };
}
