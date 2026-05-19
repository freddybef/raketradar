import { calculateSocialScore } from "./socialScore";
import type { SocialBaseline, SocialMention, SocialSnapshot } from "./socialTypes";

export function groupSocialMentionsByTicker(mentions: SocialMention[]) {
  return mentions.reduce<Record<string, SocialMention[]>>((groups, mention) => {
    const ticker = mention.ticker.toUpperCase();
    groups[ticker] = [...(groups[ticker] ?? []), { ...mention, ticker }];
    return groups;
  }, {});
}

export function buildSocialSnapshots(
  mentions: SocialMention[],
  baselines: SocialBaseline[] = []
): SocialSnapshot[] {
  const grouped = groupSocialMentionsByTicker(mentions);
  const baselineMap = new Map(
    baselines.map((baseline) => [baseline.ticker.toUpperCase(), baseline])
  );

  return Object.entries(grouped)
    .map(([ticker, items]) => calculateSocialScore(items, baselineMap.get(ticker)))
    .sort((a, b) => b.score - a.score);
}
