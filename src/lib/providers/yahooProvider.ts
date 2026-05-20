import type { MarketDataProvider, ProviderHealth, StockQuote } from "./types";

type YahooQuote = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
  marketCap?: number;
  currency?: string;
  fullExchangeName?: string;
};

const now = () => new Date().toISOString();

function normalizeSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  if (upper.includes(".")) return upper;
  return `${upper}.ST`;
}

function normalizeExchange(exchange?: string): StockQuote["exchange"] {
  const value = (exchange ?? "").toLowerCase();
  if (value.includes("first")) return "First North";
  if (value.includes("stockholm") || value.includes("nasdaq")) {
    return "Nasdaq Stockholm";
  }
  return "Unknown";
}

function toQuote(item: YahooQuote): StockQuote {
  return {
    symbol: item.symbol ?? "UNKNOWN.ST",
    name: item.longName ?? item.shortName ?? item.symbol ?? "Okänt bolag",
    exchange: normalizeExchange(item.fullExchangeName),
    currency: item.currency ?? "SEK",
    price: item.regularMarketPrice ?? null,
    changePercent: item.regularMarketChangePercent ?? null,
    volume: item.regularMarketVolume ?? null,
    averageVolume: item.averageDailyVolume3Month ?? null,
    marketCap: item.marketCap ?? null,
    source: "yahooProvider",
    asOf: now(),
  };
}

export function getYahooProviderHealth(): ProviderHealth {
  return {
    name: "Yahoo adapter",
    status: "fallback",
    message: "Förberedd adapter; faller tillbaka om live request/CORS misslyckas",
    lastCheckedAt: now(),
  };
}

export async function getYahooQuotes(symbols: string[]): Promise<StockQuote[]> {
  const normalized = symbols.map(normalizeSymbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    normalized.join(",")
  )}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as {
      quoteResponse?: { result?: YahooQuote[] };
    };

    return (payload.quoteResponse?.result ?? []).map(toQuote);
  } catch {
    return [];
  }
}

export const yahooProvider: MarketDataProvider = {
  name: "yahooProvider",
  getHealth: getYahooProviderHealth,
  getQuotes: getYahooQuotes,
};
