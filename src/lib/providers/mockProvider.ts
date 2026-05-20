import type {
  AlternativeDataProvider,
  InsiderEvent,
  ProviderHealth,
  SocialSignal,
  StockQuote,
} from "./types";

const now = () => new Date().toISOString();

const mockQuotes: StockQuote[] = [
  {
    symbol: "NCC.ST",
    name: "NCC AB",
    exchange: "First North",
    currency: "SEK",
    price: 12.8,
    changePercent: 8.6,
    volume: 940000,
    averageVolume: 190000,
    marketCap: 380000000,
    source: "mockProvider",
    asOf: now(),
  },
  {
    symbol: "NANO.ST",
    name: "NanoMaterials Sweden",
    exchange: "First North",
    currency: "SEK",
    price: 4.42,
    changePercent: 5.1,
    volume: 520000,
    averageVolume: 160000,
    marketCap: 210000000,
    source: "mockProvider",
    asOf: now(),
  },
  {
    symbol: "MEDI.ST",
    name: "MediSignal AB",
    exchange: "Nasdaq Stockholm",
    currency: "SEK",
    price: 31.2,
    changePercent: 2.4,
    volume: 180000,
    averageVolume: 140000,
    marketCap: 1250000000,
    source: "mockProvider",
    asOf: now(),
  },
];

const mockInsiders: InsiderEvent[] = [
  {
    id: "mock-insider-ncc",
    symbol: "NCC.ST",
    insiderName: "Ledande befattningshavare",
    role: "Management",
    eventType: "buy",
    valueSek: 420000,
    publishedAt: now(),
    source: "mockProvider",
  },
  {
    id: "mock-insider-medi",
    symbol: "MEDI.ST",
    insiderName: "Styrelseledamot",
    role: "Board",
    eventType: "buy",
    valueSek: 120000,
    publishedAt: now(),
    source: "mockProvider",
  },
];

const mockSocial: SocialSignal[] = [
  {
    symbol: "NCC.ST",
    mentions: 184,
    sentiment: "positive",
    buzzScore: 82,
    source: "mockProvider",
    asOf: now(),
  },
  {
    symbol: "NANO.ST",
    mentions: 231,
    sentiment: "positive",
    buzzScore: 88,
    source: "mockProvider",
    asOf: now(),
  },
  {
    symbol: "MEDI.ST",
    mentions: 46,
    sentiment: "neutral",
    buzzScore: 52,
    source: "mockProvider",
    asOf: now(),
  },
];

export function getMockProviderHealth(): ProviderHealth {
  return {
    name: "Mock data",
    status: "healthy",
    message: "Mock provider finns endast för lokal utveckling och skapar inga War Room-case",
    lastCheckedAt: now(),
  };
}

export async function getMockQuotes(symbols: string[]) {
  const requested = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  return mockQuotes.filter((quote) => requested.size === 0 || requested.has(quote.symbol));
}

export async function getMockInsiderEvents(symbols: string[]) {
  const requested = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  return mockInsiders.filter((event) => requested.has(event.symbol));
}

export async function getMockSocialSignals(symbols: string[]) {
  const requested = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  return mockSocial.filter((signal) => requested.has(signal.symbol));
}

export const mockProvider: AlternativeDataProvider & {
  getQuotes: (symbols: string[]) => Promise<StockQuote[]>;
} = {
  name: "mockProvider",
  getHealth: getMockProviderHealth,
  getQuotes: getMockQuotes,
  getInsiderEvents: getMockInsiderEvents,
  getSocialSignals: getMockSocialSignals,
};
