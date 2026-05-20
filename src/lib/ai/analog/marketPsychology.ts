import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";

export type MarketPsychologyPhase =
  | "disbelief phase"
  | "early awareness"
  | "momentum ignition"
  | "euphoric stage"
  | "exhaustion";

export interface MarketPsychology {
  ticker: string;
  phase: MarketPsychologyPhase;
  explanation: string;
}

export function detectMarketPsychology(input: RankingInput): MarketPsychology {
  const social = input.social.score;
  const sentiment = input.social.sentimentScore;
  const volume = input.unusualVolume;
  const momentum = input.technicalMomentum;

  if (social >= 88 && sentiment >= 75 && momentum >= 86) {
    return {
      ticker: input.ticker,
      phase: "euphoric stage",
      explanation: "Social heat, sentiment och momentum är redan mycket höga.",
    };
  }

  if (volume >= 82 && momentum >= 76 && social >= 70) {
    return {
      ticker: input.ticker,
      phase: "momentum ignition",
      explanation: "Volym och pris börjar bekräfta social acceleration.",
    };
  }

  if (social >= 45 && input.narrative.narrativeStrength >= 55) {
    return {
      ticker: input.ticker,
      phase: "early awareness",
      explanation: "Marknaden börjar prata om caset men det är inte euforiskt.",
    };
  }

  if (social < 45 && input.insider.direction === "bullish") {
    return {
      ticker: input.ticker,
      phase: "disbelief phase",
      explanation: "Insider/edge finns men bred uppmärksamhet saknas ännu.",
    };
  }

  return {
    ticker: input.ticker,
    phase: "exhaustion",
    explanation: "Signalerna saknar tidig asymmetri eller är redan sena.",
  };
}
