import type { MarketRegion } from "@/lib/market/tickerIdentity";
import type { LiveMarketBar, LiveMarketReactionProvider } from "@/lib/intelligence/liveMarketReaction";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export interface YahooAliasAttempt {
  symbol: string;
  success: boolean;
  bars: number;
  range: "1d" | "1mo";
  interval: "5m" | "1d";
}

export interface YahooAliasDebugEntry {
  ticker: string;
  exchange: string;
  attemptedSymbols: YahooAliasAttempt[];
  workingAlias: string | null;
  lastError: string | null;
}

const aliasDebug = new Map<string, YahooAliasDebugEntry>();

function debugKey(ticker: string, exchange: MarketRegion) {
  return `${exchange}:${ticker.toUpperCase()}`;
}

export function resetYahooAliasDebug() {
  aliasDebug.clear();
}

export function getYahooAliasDebugSnapshot() {
  return [...aliasDebug.values()].map((entry) => ({
    ...entry,
    attemptedSymbols: [...entry.attemptedSymbols],
  }));
}

function recordAliasAttempt(input: {
  ticker: string;
  exchange: MarketRegion;
  symbol: string;
  success: boolean;
  bars: number;
  range: "1d" | "1mo";
  interval: "5m" | "1d";
  error?: string | null;
}) {
  const key = debugKey(input.ticker, input.exchange);
  const current = aliasDebug.get(key) ?? {
    ticker: input.ticker,
    exchange: input.exchange,
    attemptedSymbols: [],
    workingAlias: null,
    lastError: null,
  };
  current.attemptedSymbols.push({
    symbol: input.symbol,
    success: input.success,
    bars: input.bars,
    range: input.range,
    interval: input.interval,
  });
  if (input.success && input.range === "1d" && input.interval === "5m" && !current.workingAlias) current.workingAlias = input.symbol;
  if (input.error) current.lastError = input.error;
  aliasDebug.set(key, current);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function yahooSymbolCandidates(ticker: string, exchange: MarketRegion) {
  const aliases: Record<string, string[]> = {
    ACCON: ["AAC"],
    ADVE: ["ADVBOX"],
    ACRI: ["ACRI-A", "ACRI"],
    "ACRI A": ["ACRI-A", "ACRI"],
    BIOA: ["BIOA-B", "BIOA"],
    CELLINK: ["BICO"],
    "CI B": ["CINT", "CI-B"],
    ELECTROLUX: ["ELUX-B", "ELUX-A"],
    EPIS: ["EPIS-B", "EPIS"],
    "EPIS B": ["EPIS-B", "EPIS"],
    FING: ["FING-B", "FING"],
    "FING B": ["FING-B", "FING"],
    GIGSEK: ["GIG", "GIGSEK"],
    HEXATRONIC: ["HTRO"],
    IRLAB: ["IRLAB-A", "IRLAB"],
    "IRLAB A": ["IRLAB-A", "IRLAB"],
    KAV: ["KAV"],
    KVIX: ["KVIX"],
    LOGISTEA: ["LOGI-B", "LOGI-A", "LOGISTEA"],
    MANGOLD: ["MANG"],
    MVIR: ["MNTC", "MVIR-B", "MVIR"],
    "MVIR B": ["MNTC", "MVIR-B", "MVIR"],
    NORDNET: ["SAVE"],
    NORDREST: ["NREST"],
    REJL: ["REJL-B", "REJL"],
    "REJL B": ["REJL-B", "REJL"],
    SBB: ["SBB-B", "SBB-D", "SBB"],
    "SBB B": ["SBB-B", "SBB"],
    SHT: ["SHT"],
    TRUE: ["TRUE-B", "TRUE"],
    "TRUE B": ["TRUE-B", "TRUE"],
    VPLAY: ["VPLAY-B", "VPLAY"],
    "VPLAY B": ["VPLAY-B", "VPLAY"],
    YUBICO: ["YUBICO"],
  };
  const normalized = ticker.toUpperCase().replace(/\.(ST|SS|OL|HE|CO)$/i, "").trim();
  const dashed = normalized.replace(/\s+/g, "-");
  const compact = normalized.replace(/\s+/g, "");
  const classMatch = normalized.match(/^(.+)\s([AB])$/);
  const base = classMatch?.[1] ?? normalized;
  const classLetter = classMatch?.[2];
  const withoutSuffix = base.replace(/\s+/g, "-");
  const rawCandidates = unique([
    ...(aliases[normalized] ?? []),
    dashed,
    compact,
    classLetter ? `${withoutSuffix}-${classLetter}` : "",
    classLetter ? withoutSuffix : "",
    `${dashed}-B`,
    `${dashed}-A`,
  ]);

  if (exchange === "Oslo") return rawCandidates.map((candidate) => `${candidate}.OL`);
  if (exchange === "Finland") return rawCandidates.map((candidate) => `${candidate}.HE`);
  if (exchange === "Danmark") return rawCandidates.map((candidate) => `${candidate}.CO`);

  return unique(rawCandidates.flatMap((candidate) => [`${candidate}.ST`, `${candidate}.SS`])).slice(0, 8);
}

async function fetchYahooBars(symbol: string, range: "1d" | "1mo", interval: "5m" | "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(3500) });
  if (!response.ok) return [];
  return toBars((await response.json()) as YahooChartResponse);
}

async function fetchChart(ticker: string, exchange: MarketRegion, range: "1d" | "1mo", interval: "5m" | "1d") {
  const symbols = yahooSymbolCandidates(ticker, exchange);
  let lastError: string | null = null;
  for (const symbol of symbols) {
    try {
      const bars = await fetchYahooBars(symbol, range, interval);
      recordAliasAttempt({ ticker, exchange, symbol, success: bars.length > 0, bars: bars.length, range, interval });
      if (bars.length > 0) return bars;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown fetch error";
      recordAliasAttempt({ ticker, exchange, symbol, success: false, bars: 0, range, interval, error: lastError });
    }
  }
  if (symbols.length === 0) {
    recordAliasAttempt({ ticker, exchange, symbol: ticker, success: false, bars: 0, range, interval, error: lastError ?? "no symbol candidates" });
  }
  return [];
}

/*
function yahooSymbol(ticker: string, exchange: MarketRegion) {
  const aliases: Record<string, string> = {
    ELECTROLUX: "ELUX-B",
    HEXATRONIC: "HTRO",
    LOGISTEA: "LOGI-B",
    MANGOLD: "MANG",
    NORDNET: "SAVE",
    NORDREST: "NREST",
    XSPRAY: "XSPRAY",
    CAMX: "CAMX",
    HNSA: "HNSA",
    MILDEF: "MILDEF",
    YUBICO: "YUBICO",
    ACCON: "AAC",
    ADVE: "ADVBOX",
    SHT: "SHT",
    CELLINK: "BICO",
    KAV: "KAV",
    KVIX: "KVIX",
  };
  const clean = ticker.toUpperCase().replace(/\.(ST|SS|OL|HE|CO)$/i, "").replace(/\s+/g, "-");
  const aliased = aliases[ticker.toUpperCase()] ?? clean;
  if (exchange === "Oslo") return `${clean}.OL`;
  if (exchange === "Finland") return `${clean}.HE`;
  if (exchange === "Danmark") return `${clean}.CO`;
  return `${aliased}.ST`;
}
*/

function toBars(payload: YahooChartResponse): LiveMarketBar[] {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];

  return timestamps.flatMap((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    if (open === null || high === null || low === null || close === null || open === undefined || high === undefined || low === undefined || close === undefined) {
      return [];
    }
    return {
      timestamp: new Date(timestamp * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: quote.volume?.[index] ?? 0,
    };
  });
}

export const yahooLiveMarketReactionProvider: LiveMarketReactionProvider = {
  name: "Yahoo Nordic live reaction",
  getIntradaySnapshot: (ticker, exchange) => fetchChart(ticker, exchange, "1d", "5m"),
  getDailyBaseline: (ticker, exchange) => fetchChart(ticker, exchange, "1mo", "1d"),
};
