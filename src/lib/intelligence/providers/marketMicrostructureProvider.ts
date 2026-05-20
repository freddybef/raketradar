import type { SqueezeMetrics } from "../squeeze/squeezeDetector";

export interface MarketMicrostructureProvider {
  name: string;
  fetchSqueezeMetrics: (tickers: string[]) => Promise<SqueezeMetrics[]>;
}
