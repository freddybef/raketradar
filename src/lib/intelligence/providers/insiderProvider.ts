import type { InsiderEvent } from "../insider/insiderTypes";

export interface InsiderProvider {
  name: string;
  fetchInsiderEvents: (tickers: string[]) => Promise<InsiderEvent[]>;
}
