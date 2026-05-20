export interface InsiderEvent {
  ticker: string;
  insiderName: string;
  role: string;
  type: "buy" | "sell";
  valueSek: number;
  date: string;
}

export interface InsiderSignal {
  ticker: string;
  score: number;
  direction: "bullish" | "bearish" | "neutral";
  strength: number;
  reasons: string[];
  buyValueSek: number;
  sellValueSek: number;
}
