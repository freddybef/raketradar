import type { RawHeadlineInput } from "@/lib/newsTriggerParsing";

export interface RawNewsHeadline extends RawHeadlineInput {
  id: string;
  source: string;
  publishedAt: string;
  url?: string;
  category?: string;
}

export type FeedHealthStatus = "HEALTHY" | "STALE" | "ERROR" | "EMPTY";

export interface FeedHealthEntry {
  url: string;
  source: string;
  health: FeedHealthStatus;
  statusCode?: number;
  headlineCount: number;
  latestPublishedAt?: string;
  error?: string;
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
  feedHealth: FeedHealthEntry[];
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

function sourceFromUrl(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

function categoryGuess(headline: string, explicitCategory?: string) {
  if (explicitCategory) return explicitCategory;
  const text = headline.toLowerCase();
  if (/rapport|q[1-4]|vinst|ebit/.test(text)) return "rapport";
  if (/order|kontrakt|avtal|samarbete|partner/.test(text)) return "avtal";
  if (/fda|ce\b|gmp|tillstånd|certifikat/.test(text)) return "regulatoriskt";
  if (/riktkurs|analytiker/.test(text)) return "analys";
  return "nyhet";
}

function tickerGuess(headline: string) {
  const match = headline.match(/\b[A-ZÅÄÖ]{2,6}(?:\s[AB])?\b/);
  return match?.[0] && !["Q1", "Q2", "Q3", "Q4", "CEO", "FDA", "GMP", "CE"].includes(match[0]) ? match[0] : undefined;
}

function looksTradableHeadline(headline: string, category?: string) {
  const text = `${headline} ${category ?? ""}`.toLowerCase();
  const catalyst = /order|kontrakt|ramavtal|avtal|partner|samarbete|finansiering|emission|rapport|q[1-4]\b|vinst|guidance|prognos|insider|köper aktier|säljer aktier|fda|ce\b|gmp|tillstånd|certifikat|produktion|kapacitet|förvärv|bud|uppköp|notering|pressmeddelande/.test(text);
  const broadNoise = /börsen|omx|index|futures|ränta|inflation|fed|ecb|wall street|asienbörser|geopolitik|olja|guld|dollar|kronan/.test(text);
  if (catalyst) return true;
  if (broadNoise && !tickerGuess(headline)) return false;
  return true;
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
  if (!/<(rss|feed|item|entry)\b/i.test(xml)) throw new Error("invalid XML/feed format");
  const source = sourceFromUrl(sourceUrl);
  const rssItems = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const atomItems = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const items = rssItems.length > 0 ? rssItems : atomItems;
  return items
    .map((item, index): RawNewsHeadline | null => {
      const headline = tagValue(item, "title");
      if (!headline) return null;
      const link = tagValue(item, "link") ?? atomLink(item);
      const publishedAt = tagValue(item, "pubDate") ?? tagValue(item, "published") ?? tagValue(item, "updated") ?? nowIso();
      const category = categoryGuess(headline, tagValue(item, "category"));
      if (!looksTradableHeadline(headline, category)) return null;
      return {
        id: `${source}-${index}-${headline.slice(0, 40)}`,
        ticker: tickerGuess(headline),
        headline,
        source,
        publishedAt: new Date(publishedAt).toISOString(),
        url: link,
        category,
      };
    })
    .filter((item): item is RawNewsHeadline => Boolean(item))
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

async function fetchRssFeed(url: string): Promise<{ headlines: RawNewsHeadline[]; health: FeedHealthEntry }> {
  const source = sourceFromUrl(url);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "RaketRadar/1.0 RSS headline ingestion" },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        headlines: [],
        health: { url, source, health: "ERROR", statusCode: response.status, headlineCount: 0, error: `HTTP ${response.status}` },
      };
    }
    const parsed = parseRssOrAtom(await response.text(), url);
    if (parsed.length === 0) {
      return { headlines: [], health: { url, source, health: "EMPTY", statusCode: response.status, headlineCount: 0 } };
    }
    const latestPublishedAt = parsed
      .map((item) => item.publishedAt)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    const currentDay = parsed.filter((item) => isCurrentStockholmTradingDay(item.publishedAt));
    const health: FeedHealthStatus = currentDay.length > 0 ? "HEALTHY" : "STALE";
    return {
      headlines: currentDay,
      health: { url, source, health, statusCode: response.status, headlineCount: currentDay.length, latestPublishedAt },
    };
  } catch (error) {
    return {
      headlines: [],
      health: {
        url,
        source,
        health: "ERROR",
        headlineCount: 0,
        error: error instanceof Error ? error.message : "RSS parse/fetch failed",
      },
    };
  }
}

async function fetchRssFeeds(urls: string[]): Promise<{ headlines: RawNewsHeadline[]; feedHealth: FeedHealthEntry[] }> {
  const results = await Promise.all(urls.map((url) => fetchRssFeed(url)));
  const seen = new Set<string>();
  const headlines = results
    .flatMap((result) => result.headlines)
    .filter((item) => {
      const key = `${item.url ?? ""}|${item.headline.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
  return { headlines, feedHealth: results.map((result) => result.health) };
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
      feedHealth: [],
      generatedAt: lastFetchAt,
      headlines: manual,
    };
  }
  const urls = rssFeedUrls();
  if (urls.length > 0) {
    const { headlines, feedHealth } = await fetchRssFeeds(urls);
    const healthyFeeds = feedHealth.filter((entry) => entry.health === "HEALTHY").length;
    const errors = feedHealth.filter((entry) => entry.health === "ERROR").map((entry) => `${entry.source}: ${entry.error ?? entry.statusCode ?? "error"}`);
    const emptyFeeds = feedHealth.filter((entry) => entry.health === "EMPTY").length;
    const staleFeeds = feedHealth.filter((entry) => entry.health === "STALE").length;
    return {
      providerName: `RSS feeds (${urls.length})`,
      mode: "rss",
      isLive: healthyFeeds > 0 && headlines.length > 0,
      isConfigured: true,
      lastFetchAt,
      error: errors.length > 0
        ? errors.join("; ")
        : healthyFeeds === 0
          ? staleFeeds > 0
            ? "RSS feed stale: no current Stockholm trading-day headlines"
            : emptyFeeds > 0
              ? "RSS feed empty"
              : null
          : null,
      headlineCount: headlines.length,
      feedHealth,
      generatedAt: lastFetchAt,
      headlines,
    };
  }
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
      feedHealth: [],
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
        feedHealth: [],
        generatedAt: lastFetchAt,
        headlines: [],
      };
    }
    throw error;
  }
}

export async function fetchLatestNewsHeadlinesWithFallback(): Promise<NewsIngestionResult> {
  const result = await fetchLatestNewsHeadlines();
  if (result.headlines.length > 0 || result.mode !== "rss" || result.isConfigured) return result;
  const fallback = await manualMockNewsProvider.fetchLatestHeadlines();
  return {
    providerName: manualMockNewsProvider.name,
    mode: fallback.length > 0 ? "mock" : "disabled",
    isLive: false,
    isConfigured: false,
    lastFetchAt: nowIso(),
    error: result.error ? `RSS failed/empty: ${result.error}` : "News provider not configured: NEWS_RSS_FEEDS is missing",
    headlineCount: fallback.length,
    feedHealth: result.feedHealth,
    generatedAt: nowIso(),
    headlines: fallback,
  };
}
