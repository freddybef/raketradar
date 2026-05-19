import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";

export interface CrowdingSignal {
  ticker: string;
  crowdedMomentum: boolean;
  lateSocialInflow: boolean;
  euphoricParticipation: boolean;
  parabolicAttention: boolean;
  crowdedNarrative: boolean;
  crowdingScore: number;
  evidence: string[];
}

export function detectCrowding(
  stock: RankedStock,
  feedItems: SignalFeedItem[],
  crowdedNarratives: string[] = []
): CrowdingSignal {
  const socialItems = feedItems.filter((item) => item.type === "social");
  const momentumItems = feedItems.filter((item) => item.type === "momentum");
  const crowdedMomentum = stock.tags.includes("social heat") && momentumItems.length > 0;
  const lateSocialInflow = socialItems.some((item) => item.score >= 88);
  const euphoricParticipation = stock.conviction >= 88 && stock.tags.includes("social heat");
  const parabolicAttention = feedItems.some((item) => item.tags.includes("parabolisk"));
  const crowdedNarrative = stock.tags.some((tag) => crowdedNarratives.includes(tag));
  const evidence = [
    crowdedMomentum ? "Crowded momentum" : null,
    lateSocialInflow ? "Sent socialt inflöde" : null,
    euphoricParticipation ? "Euforisk participation" : null,
    parabolicAttention ? "Parabolisk attention" : null,
    crowdedNarrative ? "Crowded narrative" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ticker: stock.ticker,
    crowdedMomentum,
    lateSocialInflow,
    euphoricParticipation,
    parabolicAttention,
    crowdedNarrative,
    crowdingScore: Math.min(100, evidence.length * 22),
    evidence,
  };
}
