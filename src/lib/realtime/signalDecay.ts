import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";

export type SignalDecayState =
  | "strengthening"
  | "losing_edge"
  | "failed_breakout"
  | "crowding_increasing"
  | "late";

export interface SignalDecayResult {
  ticker: string;
  state: SignalDecayState;
  decayScore: number;
  reason: string;
}

export function evaluateSignalDecay(item: SignalFeedItem): SignalDecayResult {
  if (item.tags.includes("parabolisk")) {
    return {
      ticker: item.ticker,
      state: "late",
      decayScore: 76,
      reason: "Case börjar bli sent ute efter parabolisk signal.",
    };
  }

  if (item.tags.includes("pump-risk")) {
    return {
      ticker: item.ticker,
      state: "crowding_increasing",
      decayScore: 68,
      reason: "Crowding/social hype ökar utan lika stark fundamental bekräftelse.",
    };
  }

  if (item.score < 52) {
    return {
      ticker: item.ticker,
      state: "losing_edge",
      decayScore: 58,
      reason: "Signalstyrkan är under edge-tröskel.",
    };
  }

  return {
    ticker: item.ticker,
    state: "strengthening",
    decayScore: 18,
    reason: "Signal håller eller stärks relativt nuvarande feed.",
  };
}
