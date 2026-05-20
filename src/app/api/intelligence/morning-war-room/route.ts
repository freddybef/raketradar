import { NextResponse } from "next/server";
import {
  getMorningWarRoomInput,
  saveProviderRun,
} from "@/lib/db/intelligenceRepository";
import { buildMorningWarRoom, type MorningWarRoomInput } from "@/lib/intelligence/morningWarRoom";
import { calculateLiveMarketReactions } from "@/lib/intelligence/liveMarketReaction";
import { getSwedishEquityUniverse } from "@/lib/market/swedishEquityUniverse";
import { buildOvernightContext } from "@/lib/intelligence/overnightContext";
import { classifyPreOpenNews } from "@/lib/intelligence/preOpenClassifier";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";
import { ingestNewsFeeds } from "@/lib/providers/newsFeedIngestion";

function symbolsFrom(input: MorningWarRoomInput) {
  return [
    ...new Set([
      ...input.ranked.map((item) => item.ticker),
      ...input.insiderEvents.map((item) => item.ticker),
      ...input.signalFeed.map((item) => item.ticker),
    ]),
  ].slice(0, 40);
}

function liveUniverse(symbols: string[]) {
  const configured = (process.env.LIVE_MARKET_SYMBOLS ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
  const universe = getSwedishEquityUniverse().map((entry) => entry.ticker);
  return [...new Set([...symbols, ...configured, ...universe])].slice(0, 80);
}

async function fallbackInput(): Promise<MorningWarRoomInput> {
  return {
    insiderEvents: [],
    newsClassifications: [],
    ranked: [],
    signalFeed: [],
    outcomes: [],
    narratives: [],
    providerRuns: [],
  };
}

export async function GET() {
  const baseInput = (await getMorningWarRoomInput()) ?? (await fallbackInput());
  const symbols = symbolsFrom(baseInput);
  const [newsIngestion, liveReactions] = await Promise.all([
    ingestNewsFeeds(symbols),
    calculateLiveMarketReactions({
      symbols: liveUniverse(symbols),
      provider: yahooLiveMarketReactionProvider,
    }),
  ]);

  await saveProviderRun({
    provider: newsIngestion.provider,
    status: newsIngestion.status,
    startedAt: newsIngestion.startedAt,
    finishedAt: newsIngestion.finishedAt,
    latencyMs: newsIngestion.latencyMs,
    fetchedCount: newsIngestion.fetched,
    savedCount: 0,
    errorMessage: newsIngestion.error,
    rawPayload: {
      source: "morning-war-room",
      symbols,
      acceptedNews: newsIngestion.news.length,
      dedupeStats: {
        fetched: newsIngestion.fetched,
        accepted: newsIngestion.accepted,
        rejected: newsIngestion.rejected,
        duplicateCount: newsIngestion.duplicateCount,
        parseErrors: newsIngestion.parseErrors,
      },
      sourceHealth: newsIngestion.sourceHealth,
      acceptedNewsItems: newsIngestion.news.slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title,
        source: item.source,
        url: item.url,
        publishedAt: item.publishedAt,
        tickers: item.tickers,
        detectedTriggers: item.detectedTriggers,
      })),
    },
  }).catch((error) => {
    console.warn("RaketRadar morning news provider log failed", error);
  });

  const result = buildMorningWarRoom({
    ...baseInput,
    newsClassifications: classifyPreOpenNews(newsIngestion.news),
    liveReactions,
    overnightContext: buildOvernightContext(newsIngestion.news),
    sourceHealth: newsIngestion.sourceHealth,
    dedupeStats: {
      fetched: newsIngestion.fetched,
      accepted: newsIngestion.accepted,
      rejected: newsIngestion.rejected,
      duplicateCount: newsIngestion.duplicateCount,
      parseErrors: newsIngestion.parseErrors,
    },
    providerRuns: [
      {
        provider: newsIngestion.provider,
        status: newsIngestion.status,
        latencyMs: newsIngestion.latencyMs,
        fetchedCount: newsIngestion.fetched,
        savedCount: 0,
        errorMessage: newsIngestion.error ?? null,
        createdAt: newsIngestion.finishedAt,
      },
      ...baseInput.providerRuns,
    ],
  });

  return NextResponse.json(result);
}
