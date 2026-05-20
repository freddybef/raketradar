import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";

export interface MarketBlindspot {
  ticker: string;
  score: number;
  blindspots: string[];
  summary: string;
}

export function detectMarketBlindspot(input: RankingInput): MarketBlindspot {
  const blindspots = [
    input.insider.direction === "bullish" && input.social.score < 65
      ? "Insider buying utan bred social buzz"
      : null,
    input.narrative.narrativeStrength >= 55 && !input.narrative.emergingNarrative
      ? "Narrativ som precis börjar vakna"
      : null,
    input.newsCatalyst >= 75 && input.social.score < 75
      ? "Undervärderat catalyst cluster"
      : null,
    input.marketCapSek && input.marketCapSek < 1500000000 && input.squeeze.score >= 60
      ? "Asymmetrisk småbolagssetup före retail"
      : null,
    input.social.score < 45 && input.unusualVolume >= 58
      ? "Volym före uppmärksamhet"
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ticker: input.ticker,
    score: Math.min(100, 30 + blindspots.length * 16),
    blindspots,
    summary:
      blindspots.length > 0
        ? `Marknaden kan missa: ${blindspots.join(", ")}.`
        : "Ingen tydlig blindspot ännu.",
  };
}
