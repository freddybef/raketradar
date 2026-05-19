import type { SocialMention } from "@/lib/intelligence/social/socialTypes";

export interface VelocityChange {
  ticker: string;
  currentMentions: number;
  previousMentions: number;
  velocityChange: number;
  firstSpikeAfterSilence: boolean;
  exponentialGrowth: boolean;
  crossPlatformSpread: boolean;
  sources: string[];
}

export function calculateVelocityChange(
  current: SocialMention[],
  previous: SocialMention[]
): VelocityChange[] {
  const tickers = Array.from(
    new Set([...current, ...previous].map((mention) => mention.ticker.toUpperCase()))
  );

  return tickers.map((ticker) => {
    const currentItems = current.filter(
      (mention) => mention.ticker.toUpperCase() === ticker
    );
    const previousItems = previous.filter(
      (mention) => mention.ticker.toUpperCase() === ticker
    );
    const currentMentions = currentItems.reduce(
      (sum, mention) => sum + mention.mentions,
      0
    );
    const previousMentions = previousItems.reduce(
      (sum, mention) => sum + mention.mentions,
      0
    );
    const sources = Array.from(new Set(currentItems.map((mention) => mention.source)));
    const velocityChange =
      previousMentions > 0
        ? ((currentMentions - previousMentions) / previousMentions) * 100
        : currentMentions > 0
          ? 100
          : 0;

    return {
      ticker,
      currentMentions,
      previousMentions,
      velocityChange: Math.round(velocityChange),
      firstSpikeAfterSilence: previousMentions <= 5 && currentMentions >= 35,
      exponentialGrowth: previousMentions > 0 && currentMentions / previousMentions >= 3,
      crossPlatformSpread: sources.length >= 3,
      sources,
    };
  });
}
