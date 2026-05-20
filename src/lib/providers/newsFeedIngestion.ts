import {
  getLastNewsSourceRuns,
  getProviderNews,
} from "@/lib/providers/newsProvider";
import type { StockNews } from "@/lib/providers/types";

export interface NewsIngestionResult {
  provider: "Swedish news feeds";
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  status: "success" | "empty" | "error";
  fetched: number;
  accepted: number;
  rejected: number;
  duplicateCount: number;
  parseErrors: number;
  news: StockNews[];
  sourceHealth: Array<{
    source: string;
    status: string;
    latencyMs: number;
    fetched: number;
    accepted: number;
    rejected: number;
    duplicateCount: number;
    parseErrors: number;
    freshness: string;
    error?: string;
  }>;
  error?: string;
}

export async function ingestNewsFeeds(symbols: string[]): Promise<NewsIngestionResult> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  try {
    const news = await getProviderNews(symbols);
    const runs = getLastNewsSourceRuns();
    const finishedAt = new Date().toISOString();
    const fetched = runs.reduce((sum, run) => sum + run.fetched, 0);
    const accepted = runs.reduce((sum, run) => sum + run.accepted, 0);
    const rejected = runs.reduce((sum, run) => sum + run.rejected, 0);
    const duplicateCount = runs.reduce((sum, run) => sum + run.duplicateCount, 0);
    const parseErrors = runs.reduce((sum, run) => sum + run.parseErrors, 0);
    const hasError = runs.some((run) => run.status === "error");

    return {
      provider: "Swedish news feeds",
      startedAt,
      finishedAt,
      latencyMs: Date.now() - startMs,
      status: news.length > 0 ? "success" : hasError ? "error" : "empty",
      fetched,
      accepted,
      rejected,
      duplicateCount,
      parseErrors,
      news,
      sourceHealth: runs.map((run) => ({
        source: run.source,
        status: run.status,
        latencyMs: run.latencyMs,
        fetched: run.fetched,
        accepted: run.accepted,
        rejected: run.rejected,
        duplicateCount: run.duplicateCount,
        parseErrors: run.parseErrors,
        freshness: run.freshness,
        error: run.error,
      })),
      error:
        news.length > 0
          ? undefined
          : hasError
            ? "Minst en news feed failade"
            : "Ingen live news-feed konfigurerad eller inga matchande PM",
    };
  } catch (error) {
    return {
      provider: "Swedish news feeds",
      startedAt,
      finishedAt: new Date().toISOString(),
      latencyMs: Date.now() - startMs,
      status: "error",
      fetched: 0,
      accepted: 0,
      rejected: 0,
      duplicateCount: 0,
      parseErrors: 1,
      news: [],
      sourceHealth: [],
      error: String(error),
    };
  }
}
