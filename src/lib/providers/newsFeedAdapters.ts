import {
  attachTickers,
  deduplicateNewsWithStats,
  normalizeNewsItem,
  rankNewsFreshness,
  type NewsDedupeStats,
  type RawNewsItem,
} from "@/lib/newsIngest";
import type { StockNews } from "@/lib/providers/types";

export interface NewsFeedAdapter {
  source: string;
  envVar: string;
  url?: string;
  enabled: boolean;
}

export interface NewsFeedSourceRun {
  source: string;
  status: "success" | "empty" | "error" | "disabled";
  latencyMs: number;
  fetched: number;
  accepted: number;
  rejected: number;
  duplicateCount: number;
  parseErrors: number;
  freshness: "fresh" | "warm" | "stale" | "missing";
  error?: string;
  items: StockNews[];
}

const adapterDefinitions = [
  ["MFN", "MFN_FEED_URL"],
  ["Cision", "CISION_FEED_URL"],
  ["Finwire", "FINWIRE_FEED_URL"],
  ["Placera", "PLACERA_FEED_URL"],
  ["Börskollen", "BORSKOLLEN_FEED_URL"],
  ["Yahoo Finance Nordic", "YAHOO_NORDIC_FEED_URL"],
  ["DI Börs", "DI_BORS_FEED_URL"],
  ["Breakit", "BREAKIT_FEED_URL"],
  ["Redeye", "REDEYE_FEED_URL"],
  ["Mangold Insight", "MANGOLD_INSIGHT_FEED_URL"],
  ["Analyst Group", "ANALYST_GROUP_FEED_URL"],
  ["Generic News", "NEWS_FEED_URL"],
] as const;

const defaultNordicRssAdapters = [
  ["EFN", "https://www.efn.se/rss"],
  ["Placera default", "https://www.placera.se/placera.rss.xml"],
  ["Avanza Placera default", "https://www.avanza.se/placera/redaktionellt/alla-nyheter.rss"],
  ["BeQuoted default", "https://www.bequoted.com/rss"],
  ["Spotlight default", "https://spotlightstockmarket.com/sv/rss/pressmeddelanden"],
  ["NGM default", "https://www.ngm.se/rss/press-releases"],
] as const;

function defaultRssAdaptersEnabled() {
  return process.env.RAKETRADAR_DISABLE_DEFAULT_RSS_FEEDS !== "1";
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : undefined;
}

function tagValues(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) =>
    decodeXml(match[1])
  );
}

function attrValue(xml: string, attr: string) {
  const match = xml.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
  return match ? decodeXml(match[1]) : undefined;
}

function parseJsonFeed(text: string): RawNewsItem[] {
  const parsed = JSON.parse(text) as
    | RawNewsItem[]
    | { items?: RawNewsItem[]; data?: RawNewsItem[]; entries?: RawNewsItem[]; articles?: RawNewsItem[] };

  if (Array.isArray(parsed)) return parsed;
  return parsed.items ?? parsed.data ?? parsed.entries ?? parsed.articles ?? [];
}

function parseXmlFeed(text: string, adapter: NewsFeedAdapter): RawNewsItem[] {
  const rssItems = text.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const atomEntries = text.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  const blocks = rssItems.length > 0 ? rssItems : atomEntries;
  const channelSource = tagValue(text, "title") ?? adapter.source;

  return blocks.map((block, index) => {
    const linkTag = tagValue(block, "link");
    const atomLink = block.match(/<link\s[^>]*href=["'][^"']+["'][^>]*\/?>/i)?.[0];
    const title = tagValue(block, "title") ?? "Nyhet utan rubrik";
    const summary =
      tagValue(block, "description") ??
      tagValue(block, "summary") ??
      tagValue(block, "content") ??
      tagValue(block, "content:encoded");

    return {
      id: tagValue(block, "guid") ?? tagValue(block, "id") ?? `${adapter.source}-${index}-${title}`,
      title,
      source: adapter.source === "Generic News" ? channelSource : adapter.source,
      url: linkTag ?? (atomLink ? attrValue(atomLink, "href") : undefined),
      publishedAt:
        tagValue(block, "pubDate") ??
        tagValue(block, "published") ??
        tagValue(block, "updated"),
      rawText: `${title}. ${summary ?? ""}`,
      summary,
      categories: tagValues(block, "category"),
    };
  });
}

async function fetchRaw(adapter: NewsFeedAdapter) {
  if (!adapter.url) return [];
  const response = await fetch(adapter.url, {
    headers: {
      Accept: "application/json,application/rss+xml,application/atom+xml,text/xml,application/xml,text/plain,*/*",
      "User-Agent": "RaketRadar/0.1 Swedish smallcap news adapter",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${adapter.source} svarade ${response.status}`);

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const looksXml = contentType.includes("xml") || /<(rss|feed|channel|entry|item)[\s>]/i.test(text);

  if (looksXml) return parseXmlFeed(text, adapter);
  try {
    return parseJsonFeed(text).map((item) => ({ ...item, source: item.source ?? adapter.source }));
  } catch {
    return parseXmlFeed(text, adapter);
  }
}

function freshnessLabel(items: StockNews[]) {
  if (items.length === 0) return "missing" as const;
  const newest = Math.max(...items.map((item) => new Date(item.publishedAt).getTime()));
  const ageMinutes = (Date.now() - newest) / 60000;
  if (ageMinutes <= 30) return "fresh" as const;
  if (ageMinutes <= 180) return "warm" as const;
  return "stale" as const;
}

function toStockNews(items: ReturnType<typeof rankNewsFreshness>): StockNews[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    url: item.url,
    publishedAt: item.publishedAt,
    tickers: item.tickers,
    ticker: item.ticker,
    summary: item.summary,
    categories: item.categories,
    language: item.language,
    importanceScore: item.importanceScore,
    rawText: item.rawText,
    normalizedText: item.normalizedText,
    detectedTriggers: item.detectedTriggers,
    triggers: item.manualOverride?.triggers ?? item.triggers,
    freshnessScore: item.freshnessScore,
    aiClassificationStatus: item.aiClassificationStatus,
    aiSummary: item.aiSummary,
    manualOverride: item.manualOverride,
  }));
}

export function getNewsFeedAdapters(): NewsFeedAdapter[] {
  const envAdapters = adapterDefinitions.map(([source, envVar]) => {
    const url = process.env[envVar];
    return {
      source,
      envVar,
      url,
      enabled: Boolean(url),
    };
  });

  const defaultAdapters: NewsFeedAdapter[] = defaultRssAdaptersEnabled()
    ? defaultNordicRssAdapters.map(([source, url]) => ({
        source,
        envVar: "DEFAULT_NORDIC_RSS_FEEDS",
        url,
        enabled: true,
      }))
    : [];

  const seen = new Set<string>();
  return [...envAdapters, ...defaultAdapters].filter((adapter) => {
    const key = adapter.url ?? `${adapter.source}:${adapter.envVar}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runNewsFeedAdapter(
  adapter: NewsFeedAdapter,
  symbols: string[]
): Promise<NewsFeedSourceRun> {
  const started = Date.now();
  if (!adapter.enabled || !adapter.url) {
    return {
      source: adapter.source,
      status: "disabled",
      latencyMs: 0,
      fetched: 0,
      accepted: 0,
      rejected: 0,
      duplicateCount: 0,
      parseErrors: 0,
      freshness: "missing",
      items: [],
    };
  }

  try {
    const raw = await fetchRaw(adapter);
    let parseErrors = 0;
    const normalized = raw
      .map((item) => {
        try {
          return normalizeNewsItem({
            ...item,
            source: item.source ?? adapter.source,
            rawText: item.rawText ?? item.text ?? `${item.title ?? item.headline ?? ""}. ${item.summary ?? ""}`,
          });
        } catch {
          parseErrors += 1;
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const attached = attachTickers(normalized, symbols);
    const deduped = deduplicateNewsWithStats(attached);
    const ranked = rankNewsFreshness(deduped.accepted);
    const items = toStockNews(ranked);
    const stats: NewsDedupeStats = deduped.stats;

    return {
      source: adapter.source,
      status: items.length > 0 ? "success" : "empty",
      latencyMs: Date.now() - started,
      fetched: raw.length,
      accepted: items.length,
      rejected: stats.rejectedCount + parseErrors,
      duplicateCount: stats.duplicateCount,
      parseErrors,
      freshness: freshnessLabel(items),
      items,
    };
  } catch (error) {
    return {
      source: adapter.source,
      status: "error",
      latencyMs: Date.now() - started,
      fetched: 0,
      accepted: 0,
      rejected: 0,
      duplicateCount: 0,
      parseErrors: 1,
      freshness: "missing",
      error: String(error),
      items: [],
    };
  }
}