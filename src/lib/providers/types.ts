import type { RankedStockSignal, StockSignal } from "../signals";
import type { NewsTrigger } from "../triggerExtraction";

export type ProviderStatus = "healthy" | "fallback" | "disabled" | "error";

export type ProviderHealth = {
  name: string;
  status: ProviderStatus;
  message: string;
  lastCheckedAt: string;
};

export type StockQuote = {
  symbol: string;
  name: string;
  exchange: "Nasdaq Stockholm" | "First North" | "Spotlight" | "Unknown";
  currency: "SEK" | string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  averageVolume: number | null;
  marketCap: number | null;
  source: string;
  asOf: string;
};

export type StockNews = {
  id: string;
  title: string;
  source: string;
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
  detectedTriggers: string[];
  triggers: NewsTrigger[];
  freshnessScore: number;
  aiClassificationStatus: "not_requested" | "pending" | "completed" | "failed";
  aiSummary?: string;
  manualOverride?: {
    tickers?: string[];
    triggers?: NewsTrigger[];
    note?: string;
  };
};

export type InsiderEvent = {
  id: string;
  symbol: string;
  insiderName: string;
  role: string;
  eventType: "buy" | "sell" | "option" | "unknown";
  valueSek: number | null;
  publishedAt: string;
  source: string;
};

export type SocialSignal = {
  symbol: string;
  mentions: number;
  sentiment: "positive" | "neutral" | "negative";
  buzzScore: number;
  source: string;
  asOf: string;
};

export type MarketDataProvider = {
  name: string;
  getHealth: () => ProviderHealth;
  getQuotes: (symbols: string[]) => Promise<StockQuote[]>;
};

export type NewsDataProvider = {
  name: string;
  getHealth: () => ProviderHealth;
  getNews: (symbols: string[]) => Promise<StockNews[]>;
};

export type AlternativeDataProvider = {
  name: string;
  getHealth: () => ProviderHealth;
  getInsiderEvents: (symbols: string[]) => Promise<InsiderEvent[]>;
  getSocialSignals: (symbols: string[]) => Promise<SocialSignal[]>;
};

export type MarketSnapshot = {
  candidates: RankedStockSignal[];
  quotes: StockQuote[];
  news: StockNews[];
  insiderEvents: InsiderEvent[];
  socialSignals: SocialSignal[];
  health: ProviderHealth[];
  mode: "live" | "fallback";
};

export type CandidateBuildInput = {
  quote: StockQuote;
  news: StockNews[];
  insiderEvents: InsiderEvent[];
  socialSignal: SocialSignal | null;
};

export type ProviderSignalCandidate = StockSignal;
