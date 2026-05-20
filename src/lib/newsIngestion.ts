import type { RawHeadlineInput } from "@/lib/newsTriggerParsing";

export interface RawNewsHeadline extends RawHeadlineInput {
  id: string;
  source: string;
  publishedAt: string;
  url?: string;
}

export interface NewsProvider {
  name: string;
  mode: "mock" | "manual" | "rss" | "api" | "disabled";
  fetchLatestHeadlines(): Promise<RawNewsHeadline[]>;
}

export interface NewsIngestionResult {
  providerName: string;
  mode: "mock" | "manual" | "rss" | "api" | "disabled";
  isLive: boolean;
  isConfigured: boolean;
  lastFetchAt: string;
  error: string | null;
  headlineCount: number;
  generatedAt: string;
  headlines: RawNewsHeadline[];
}

function nowIso() {
  return new Date().toISOString();
}

function manualEnvHeadlines(): RawNewsHeadline[] {
  const raw = process.env.RAKETRADAR_NEWS_HEADLINES ?? process.env.NEWS_TRIGGER_HEADLINES;
  if (!raw?.trim()) return [];
  let items: Array<string | RawHeadlineInput> = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      items = parsed.filter((item): item is string | RawHeadlineInput =>
        typeof item === "string" ||
        (typeof item === "object" && item !== null && typeof (item as { headline?: unknown }).headline === "string")
      );
    }
  } catch {
    items = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  return items.map((item, index) => {
    const normalized = typeof item === "string" ? { headline: item } : item;
    return {
      id: normalized.id ?? `manual-env-${index}-${normalized.headline.slice(0, 24)}`,
      ticker: normalized.ticker,
      company: normalized.company,
      headline: normalized.headline,
      source: normalized.source ?? "manual-env",
      publishedAt: normalized.publishedAt ?? nowIso(),
    };
  });
}

export const manualMockNewsProvider: NewsProvider = {
  name: "MOCK/MANUAL headlines",
  mode: "mock",
  async fetchLatestHeadlines() {
    const publishedAt = nowIso();
    return [
      {
        id: "mock-diamyd-gmp",
        ticker: "DMYD B",
        company: "Diamyd Medical",
        headline: "Diamyd får GMP-certifikat för prövningsläkemedel",
        source: "mock/manual",
        publishedAt,
      },
      {
        id: "mock-apr-irca",
        ticker: "APR",
        company: "APR Technologies",
        headline: "APR Technologies ingår utvärderingsavtal med italienska IRCA/Zoppas Industries",
        source: "mock/manual",
        publishedAt,
      },
      {
        id: "mock-reds-vinst",
        ticker: "REDS",
        company: "Redsense Medical",
        headline: "Redsense Medical vänder till vinst",
        source: "mock/manual",
        publishedAt,
      },
      {
        id: "mock-obesity-signal",
        headline: "Market Signal: Obesitaskapplöpning skapar nya second-derivative case i nordisk medtech",
        source: "mock/manual",
        publishedAt,
      },
      {
        id: "mock-lagercrantz-target",
        ticker: "LAGR B",
        company: "Lagercrantz",
        headline: "Nordea höjer riktkursen för Lagercrantz",
        source: "mock/manual",
        publishedAt,
      },
    ];
  },
};

function rssFeedUrls() {
  return (process.env.NEWS_RSS_FEEDS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function tagValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : undefined;
}

function atomLink(item: string) {
  const href = item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? decodeXml(href) : undefined;
}

function stockholmDateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isCurrentStockholmTradingDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return stockholmDateKey(date) === stockholmDateKey(new Date());
}

function parseRssOrAtom(xml: string, sourceUrl: string): RawNewsHeadline[] {
  const source = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const rssItems = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomItems = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const items = rssItems.length > 0 ? rssItems : atomItems;
  return items
    .map((item, index): RawNewsHeadline | null => {
      const headline = tagValue(item, "title");
      if (!headline) return null;
      const link = tagValue(item, "link") ?? atomLink(item);
      const publishedAt = tagValue(item, "pubDate") ?? tagValue(item, "published") ?? tagValue(item, "updated") ?? nowIso();
      return {
        id: `${source}-${index}-${headline.slice(0, 40)}`,
        headline,
        source,
        publishedAt: new Date(publishedAt).toISOString(),
        url: link,
      };
    })
    .filter((item): item is RawNewsHeadline => Boolean(item))
    .filter((item) => isCurrentStockholmTradingDay(item.publishedAt));
}

export function rssNewsProvider(urls: string[]): NewsProvider {
  return {
    name: `RSS feeds (${urls.length})`,
    mode: "rss",
    async fetchLatestHeadlines() {
      const results = await Promise.allSettled(
        urls.map(async (url) => {
          const response = await fetch(url, {
            headers: { "User-Agent": "RaketRadar/1.0 RSS headline ingestion" },
            cache: "no-store",
          });
          if (!response.ok) throw new Error(`${url} returned ${response.status}`);
          return parseRssOrAtom(await response.text(), url);
        }),
      );
      const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason instanceof Error ? result.reason.message : "RSS fetch failed");
      if (errors.length === results.length && errors.length > 0) throw new Error(errors.join("; "));
      const seen = new Set<string>();
      return results
        .filter((result): result is PromiseFulfilledResult<RawNewsHeadline[]> => result.status === "fulfilled")
        .flatMap((result) => result.value)
        .filter((item) => {
          const key = `${item.url ?? ""}|${item.headline.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 50);
    },
  };
}

export async function fetchLatestNewsHeadlines(provider: NewsProvider = manualMockNewsProvider): Promise<NewsIngestionResult> {
  const lastFetchAt = nowIso();
  const manual = manualEnvHeadlines();
  if (manual.length > 0) {
    return {
      providerName: "MANUAL env headlines",
      mode: "manual",
      isLive: false,
      isConfigured: true,
      lastFetchAt,
      error: null,
      headlineCount: manual.length,
      generatedAt: lastFetchAt,
      headlines: manual,
    };
  }
  const urls = rssFeedUrls();
  const selectedProvider = urls.length > 0 ? rssNewsProvider(urls) : provider;
  try {
    const headlines = await selectedProvider.fetchLatestHeadlines();
    return {
      providerName: selectedProvider.name,
      mode: selectedProvider.mode,
      isLive: selectedProvider.mode === "rss" || selectedProvider.mode === "api",
      isConfigured: selectedProvider.mode === "rss" || selectedProvider.mode === "api",
      lastFetchAt,
      error: null,
      headlineCount: headlines.length,
      generatedAt: lastFetchAt,
      headlines,
    };
  } catch (error) {
    if (selectedProvider.mode === "rss" || selectedProvider.mode === "api") {
      return {
        providerName: selectedProvider.name,
        mode: selectedProvider.mode,
        isLive: false,
        isConfigured: true,
        lastFetchAt,
        error: error instanceof Error ? error.message : "News provider failed",
        headlineCount: 0,
        generatedAt: lastFetchAt,
        headlines: [],
      };
    }
    throw error;
  }
}

export async function fetchLatestNewsHeadlinesWithFallback(): Promise<NewsIngestionResult> {
  const result = await fetchLatestNewsHeadlines();
  if (result.headlines.length > 0 || result.mode !== "rss") return result;
  const fallback = await manualMockNewsProvider.fetchLatestHeadlines();
  return {
    providerName: manualMockNewsProvider.name,
    mode: fallback.length > 0 ? "mock" : "disabled",
    isLive: false,
    isConfigured: false,
    lastFetchAt: nowIso(),
    error: result.error ? `RSS failed/empty: ${result.error}` : "News provider not configured: NEWS_RSS_FEEDS is missing",
    headlineCount: fallback.length,
    generatedAt: nowIso(),
    headlines: fallback,
  };
}
