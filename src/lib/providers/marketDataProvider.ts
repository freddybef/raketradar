import type { MarketRegion } from "@/lib/market/tickerIdentity";

export interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LatestMarketPrice {
  ticker: string;
  exchange: MarketRegion;
  price: number;
  timestamp: string;
}

export interface OutcomeMarketDataProvider {
  name: string;
  getIntradayBars: (ticker: string, exchange: MarketRegion, from: string, to: string) => Promise<MarketBar[]>;
  getDailyBars: (ticker: string, exchange: MarketRegion, from: string, to: string) => Promise<MarketBar[]>;
  getLatestPrice: (ticker: string, exchange: MarketRegion) => Promise<LatestMarketPrice | null>;
}

