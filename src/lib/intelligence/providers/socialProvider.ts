import type { SocialMention } from "../social/socialTypes";

export interface SocialProvider {
  name: string;
  sources: SocialMention["source"][];
  fetchMentions: (tickers: string[]) => Promise<SocialMention[]>;
}
