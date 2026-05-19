import type { NewsDataProvider, ProviderHealth, StockNews } from "./types";
import {
  getNewsFeedAdapters,
  runNewsFeedAdapter,
  type NewsFeedSourceRun,
} from "./newsFeedAdapters";

const now = () => new Date().toISOString();
let lastSourceRuns: NewsFeedSourceRun[] = [];

export function getNewsProviderHealth(): ProviderHealth {
  const adapters = getNewsFeedAdapters();
  const enabled = adapters.filter((adapter) => adapter.enabled);

  return {
    name: "News adapter",
    status: enabled.length > 0 ? "healthy" : "disabled",
    message:
      enabled.length > 0
        ? `Live news-feeds konfigurerade (${enabled.map((adapter) => adapter.source).join(", ")})`
        : "API-källa saknas; sätt minst en svensk news feed-env",
    lastCheckedAt: now(),
  };
}

export function getLastNewsSourceRuns() {
  return lastSourceRuns;
}

export async function getProviderNews(symbols: string[]): Promise<StockNews[]> {
  const adapters = getNewsFeedAdapters();
  const enabled = adapters.filter((adapter) => adapter.enabled);
  if (enabled.length === 0) {
    lastSourceRuns = adapters.map((adapter) => ({
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
    }));
    return [];
  }

  lastSourceRuns = await Promise.all(enabled.map((adapter) => runNewsFeedAdapter(adapter, symbols)));

  const seen = new Set<string>();
  return lastSourceRuns
    .flatMap((run) => run.items)
    .filter((item) => {
      const key = `${item.tickers.join(",")}-${item.title.toLowerCase()}-${item.publishedAt.slice(0, 13)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.importanceScore + b.freshnessScore - (a.importanceScore + a.freshnessScore));
}

export const newsProvider: NewsDataProvider = {
  name: "newsProvider",
  getHealth: getNewsProviderHealth,
  getNews: getProviderNews,
};
