import type { MarketRegion } from "@/lib/market/tickerIdentity";
import type { LatestMarketPrice, MarketBar, OutcomeMarketDataProvider } from "@/lib/providers/marketDataProvider";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        regularMarketPrice?: number;
        regularMarketTime?: number;
      };
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function yahooSymbolCandidates(ticker: string, exchange: MarketRegion) {
  const aliases: Record<string, string[]> = {
    AAC: ["AAC"],
    ACCON: ["AAC"],
    ADVE: ["ADVE"],
    ADVBOX: ["ADVBOX"],
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
    GOMX: ["GOMX.CO", "GOMX"],
    HEXATRONIC: ["HTRO"],
    IRLAB: ["IRLAB-A", "IRLAB"],
    "IRLAB A": ["IRLAB-A", "IRLAB"],
    KAV: ["KAV"],
    KVIX: ["KVIX", "KVIX.NGM"],
    LOGISTEA: ["LOGI-B", "LOGI-A", "LOGISTEA"],
    MANGOLD: ["MANG"],
    MOFAST: ["MOFAST"],
    MVIR: ["MNTC", "MVIR-B", "MVIR"],
    "MVIR B": ["MNTC", "MVIR-B", "MVIR"],
    NORDNET: ["SAVE"],
    NORDREST: ["NREST"],
    REJL: ["REJL-B", "REJL"],
    "REJL B": ["REJL-B", "REJL"],
    SBB: ["SBB-B", "SBB-D", "SBB"],
    "SBB B": ["SBB-B", "SBB"],
    SHT: ["SHT-B", "SHT"],
    SIVE: ["SIVE"],
    TRUE: ["TRUE-B", "TRUE"],
    "TRUE B": ["TRUE-B", "TRUE"],
    VPLAY: ["VPLAY-B", "VPLAY"],
    "VPLAY B": ["VPLAY-B", "VPLAY"],
    YUBICO: ["YUBICO"],
  };
  const normalized = ticker.toUpperCase().replace(/\.(ST|SS|OL|HE|CO|NGM)$/i, "").trim();
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

  const explicit = rawCandidates.filter((candidate) => candidate.includes("."));
  const withoutExplicit = rawCandidates.filter((candidate) => !candidate.includes("."));
  if (exchange === "Oslo") return unique([...explicit, ...withoutExplicit.map((candidate) => `${candidate}.OL`)]);
  if (exchange === "Finland") return unique([...explicit, ...withoutExplicit.map((candidate) => `${candidate}.HE`)]);
  if (exchange === "Danmark") return unique([...explicit, ...withoutExplicit.map((candidate) => `${candidate}.CO`)]);

  return unique([...explicit, ...withoutExplicit.flatMap((candidate) => [`${candidate}.ST`, `${candidate}.SS`])]).slice(0, 10);
}

function epoch(value: string) {
  return Math.floor(new Date(value).getTime() / 1000);
}

function toBars(payload: YahooChartResponse): MarketBar[] {
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

async function fetchYahooBars(symbol: string, from: string, to: string, interval: "5m" | "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${epoch(from)}&period2=${epoch(to)}&interval=${interval}&includePrePost=false`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return [];
  return toBars((await response.json()) as YahooChartResponse);
}

async function fetchChart(ticker: string, exchange: MarketRegion, from: string, to: string, interval: "5m" | "1d") {
  for (const symbol of yahooSymbolCandidates(ticker, exchange)) {
    try {
      const bars = await fetchYahooBars(symbol, from, to, interval);
      if (bars.length > 0) return bars;
    } catch {
      // Try next alias/suffix candidate. Outcome collection should prefer partial coverage over hard failure.
    }
  }
  return [];
}

export const yahooMarketDataProvider: OutcomeMarketDataProvider = {
  name: "Yahoo chart",
  getIntradayBars: (ticker, exchange, from, to) => fetchChart(ticker, exchange, from, to, "5m"),
  getDailyBars: (ticker, exchange, from, to) => fetchChart(ticker, exchange, from, to, "1d"),
  async getLatestPrice(ticker, exchange): Promise<LatestMarketPrice | null> {
    const to = new Date();
    const from = new Date(to.getTime() - 3 * 24 * 60 * 60 * 1000);
    const bars = await fetchChart(ticker, exchange, from.toISOString(), to.toISOString(), "1d");
    const latest = bars.at(-1);
    if (!latest) return null;

    return {
      ticker,
      exchange,
      price: latest.close,
      timestamp: latest.timestamp,
    };
  },
};
