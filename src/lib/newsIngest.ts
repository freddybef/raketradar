import { extractTriggers, type NewsTrigger } from "./triggerExtraction";

export type NewsSource =
  | "MFN"
  | "Cision"
  | "Börskollen"
  | "Placera"
  | "Finwire"
  | "Yahoo"
  | "DI Börs"
  | "Breakit"
  | "Redeye"
  | "Mangold Insight"
  | "Analyst Group"
  | "Manual"
  | "Mock";

export type RawNewsItem = {
  id?: string;
  title?: string;
  headline?: string;
  source?: string;
  url?: string | null;
  publishedAt?: string;
  published_at?: string;
  tickers?: string[];
  ticker?: string | null;
  rawText?: string;
  text?: string;
  summary?: string | null;
  categories?: string[];
  category?: string;
  language?: "sv" | "en" | "unknown";
};

export type NormalizedNewsItem = {
  id: string;
  title: string;
  source: NewsSource | string;
  url: string | null;
  publishedAt: string;
  tickers: string[];
  ticker?: string;
  summary?: string;
  categories: string[];
  language: "sv" | "en" | "unknown";
  importanceScore: number;
  rawText: string;
  normalizedText: string;
  triggers: NewsTrigger[];
  detectedTriggers: string[];
  freshnessScore: number;
  aiClassificationStatus: "not_requested" | "pending" | "completed" | "failed";
  aiSummary?: string;
  manualOverride?: {
    tickers?: string[];
    triggers?: NewsTrigger[];
    note?: string;
  };
};

export interface NewsDedupeStats {
  inputCount: number;
  acceptedCount: number;
  duplicateCount: number;
  rejectedCount: number;
}

function stableId(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return `news-${Math.abs(hash)}`;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeSource(source?: string): NewsSource | string {
  const value = source ?? "Manual";
  const lower = value.toLowerCase();
  if (lower.includes("mfn")) return "MFN";
  if (lower.includes("cision")) return "Cision";
  if (lower.includes("börskollen") || lower.includes("borskollen")) return "Börskollen";
  if (lower.includes("placera")) return "Placera";
  if (lower.includes("finwire")) return "Finwire";
  if (lower.includes("yahoo")) return "Yahoo";
  if (lower.includes("dagens industri") || lower === "di" || lower.includes("di börs")) return "DI Börs";
  if (lower.includes("breakit")) return "Breakit";
  if (lower.includes("redeye")) return "Redeye";
  if (lower.includes("mangold")) return "Mangold Insight";
  if (lower.includes("analyst group")) return "Analyst Group";
  if (lower.includes("mock")) return "Mock";
  return value;
}

function detectLanguage(text: string, source?: string): "sv" | "en" | "unknown" {
  const lower = `${source ?? ""} ${text}`.toLowerCase();
  if (/[åäö]/i.test(lower) || /\b(och|bolaget|aktier|order|rapport|emission)\b/.test(lower)) return "sv";
  if (/\b(the|and|shares|stock|market|company)\b/.test(lower)) return "en";
  return "unknown";
}

function calculateImportance(triggers: NewsTrigger[], freshnessScore: number) {
  if (triggers.length === 0) return Math.max(10, Math.round(freshnessScore * 0.25));
  const impact = triggers.reduce((sum, trigger) => sum + trigger.impactScore, 0) / triggers.length;
  const confidence = triggers.reduce((sum, trigger) => sum + trigger.confidence, 0) / triggers.length;
  return Math.max(0, Math.min(100, Math.round(impact * 0.65 + confidence * 0.2 + freshnessScore * 0.15)));
}

export function normalizeNewsItem(raw: RawNewsItem): NormalizedNewsItem {
  const title = raw.title ?? raw.headline ?? "Nyhet utan rubrik";
  const publishedAt =
    raw.publishedAt ?? raw.published_at ?? new Date().toISOString();
  const rawText = raw.rawText ?? `${title}. ${raw.summary ?? ""}`;
  const normalizedText = normalizeText(rawText);
  const triggers = extractTriggers(rawText);
  const tickers = [
    ...(raw.tickers ?? []),
    ...(raw.ticker ? [raw.ticker] : []),
  ].map((ticker) => ticker.replace(".ST", "").toUpperCase());

  return {
    id: raw.id ?? stableId(`${title}-${publishedAt}-${raw.source ?? ""}`),
    title,
    source: normalizeSource(raw.source),
    url: raw.url ?? null,
    publishedAt,
    tickers,
    ticker: tickers[0],
    summary: raw.summary ?? undefined,
    categories: [
      ...(raw.categories ?? []),
      ...(raw.category ? [raw.category] : []),
      ...triggers.map((trigger) => trigger.type),
    ],
    language: raw.language ?? detectLanguage(rawText, raw.source),
    importanceScore: calculateImportance(triggers, 0),
    rawText,
    normalizedText,
    triggers,
    detectedTriggers: triggers.map((trigger) => trigger.type),
    freshnessScore: 0,
    aiClassificationStatus: "not_requested",
  };
}

function similarityKey(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 10)
    .sort()
    .join(" ");
}

export function deduplicateNewsWithStats(items: NormalizedNewsItem[]) {
  const seen = new Set<string>();
  const fuzzySeen = new Set<string>();
  let duplicateCount = 0;

  const accepted = items.filter((item) => {
    const windowTime = new Date(item.publishedAt);
    windowTime.setMinutes(Math.floor(windowTime.getMinutes() / 30) * 30, 0, 0);
    const tickerKey = item.tickers.sort().join(",") || "NO_TICKER";
    const key = `${item.title.toLowerCase()}-${item.publishedAt.slice(0, 10)}-${tickerKey}`;
    const fuzzyKey = `${tickerKey}-${windowTime.toISOString()}-${similarityKey(item.title)}`;
    if (seen.has(key) || fuzzySeen.has(fuzzyKey)) {
      duplicateCount += 1;
      return false;
    }
    seen.add(key);
    fuzzySeen.add(fuzzyKey);
    return true;
  });

  return {
    accepted,
    stats: {
      inputCount: items.length,
      acceptedCount: accepted.length,
      duplicateCount,
      rejectedCount: duplicateCount,
    } satisfies NewsDedupeStats,
  };
}

export function deduplicateNews(items: NormalizedNewsItem[]) {
  return deduplicateNewsWithStats(items).accepted;
}

export function attachTickers(
  items: NormalizedNewsItem[],
  knownSymbols: string[]
) {
  const symbols = knownSymbols.map((symbol) => ({
    raw: symbol,
    ticker: symbol.replace(".ST", "").toUpperCase(),
  }));

  return items.map((item) => {
    const found = symbols
      .filter(
        (symbol) =>
          item.normalizedText.includes(symbol.ticker.toLowerCase()) ||
          item.normalizedText.includes(symbol.raw.toLowerCase())
      )
      .map((symbol) => symbol.ticker);
    const tickers = Array.from(new Set([...item.tickers, ...found]));

    return {
      ...item,
      tickers,
      ticker: tickers[0],
    };
  });
}

export function rankNewsFreshness(items: NormalizedNewsItem[]) {
  return items
    .map((item) => {
      const ageHours = Math.max(
        0,
        (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60)
      );
      const freshnessScore = Math.max(0, Math.round(100 - ageHours * 4));

      return {
        ...item,
        freshnessScore,
        importanceScore: calculateImportance(item.triggers, freshnessScore),
      };
    })
    .sort((a, b) => b.importanceScore + b.freshnessScore - (a.importanceScore + a.freshnessScore));
}

export function groupNewsByTicker(items: NormalizedNewsItem[]) {
  return items.reduce<Record<string, NormalizedNewsItem[]>>((groups, item) => {
    for (const ticker of item.tickers) {
      groups[ticker] = [...(groups[ticker] ?? []), item];
    }

    return groups;
  }, {});
}
