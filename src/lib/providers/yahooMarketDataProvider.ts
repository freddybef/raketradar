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

function yahooSymbol(ticker: string, exchange: MarketRegion) {
  const clean = ticker.toUpperCase().replace(/\.(ST|SS|OL|HE|CO)$/i, "");
  if (exchange === "Oslo") return `${clean}.OL`;
  if (exchange === "Finland") return `${clean}.HE`;
  if (exchange === "Danmark") return `${clean}.CO`;
  return `${clean}.ST`;
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

async function fetchChart(ticker: string, exchange: MarketRegion, from: string, to: string, interval: "5m" | "1d") {
  const symbol = yahooSymbol(ticker, exchange);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${epoch(from)}&period2=${epoch(to)}&interval=${interval}&includePrePost=false`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) return [];
  return toBars((await response.json()) as YahooChartResponse);
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

