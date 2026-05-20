import type { InsiderSignal } from "../insider/insiderTypes";
import type { NarrativeResult } from "../narrative/narrativeEngine";
import type { SocialSnapshot } from "../social/socialTypes";
import type { SqueezeResult } from "../squeeze/squeezeDetector";

export interface RankingInput {
  ticker: string;
  marketCapSek?: number;
  technicalMomentum: number;
  unusualVolume: number;
  relativeStrength: number;
  newsCatalyst: number;
  social: SocialSnapshot;
  insider: InsiderSignal;
  narrative: NarrativeResult;
  squeeze: SqueezeResult;
}

export interface RankedStock {
  ticker: string;
  totalScore: number;
  conviction: number;
  reasons: string[];
  risks: string[];
  tags: string[];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function rankStock(input: RankingInput): RankedStock {
  const isSmallCap = Boolean(input.marketCapSek && input.marketCapSek < 1500000000);
  const explosiveStack =
    input.technicalMomentum >= 70 &&
    input.social.score >= 70 &&
    input.squeeze.score >= 70;
  const largeCapDrag = input.marketCapSek && input.marketCapSek > 25000000000 ? 8 : 0;
  const smallCapBoost = isSmallCap && (explosiveStack || input.unusualVolume >= 75) ? 9 : 0;
  const stackBoost = explosiveStack ? 13 : 0;
  const score = clamp(
    input.technicalMomentum * 0.17 +
      input.insider.score * 0.14 +
      input.social.score * 0.17 +
      input.narrative.narrativeStrength * 0.13 +
      input.squeeze.score * 0.15 +
      input.newsCatalyst * 0.12 +
      input.unusualVolume * 0.07 +
      input.relativeStrength * 0.05 +
      smallCapBoost +
      stackBoost -
      largeCapDrag
  );
  const reasons = [
    input.social.unusualActivity ? "Ovanlig social aktivitet" : null,
    input.insider.direction === "bullish" ? "Bullish insiderbild" : null,
    input.squeeze.score >= 70 ? "Squeeze-potential över tröskel" : null,
    input.narrative.emergingNarrative ? `Emerging narrative: ${input.narrative.primaryNarrative}` : null,
    input.newsCatalyst >= 72 ? "Stark nyhetskatalysator" : null,
    explosiveStack ? "Momentum + social + squeeze sammanfaller" : null,
  ].filter((item): item is string => Boolean(item));
  const risks = [
    input.insider.direction === "bearish" ? "Insiderförsäljningar pressar caset" : null,
    input.squeeze.confidence < 55 ? "Squeeze-signalen har låg confidence" : null,
    input.social.sentimentScore < 45 ? "Social sentiment är svagt" : null,
    isSmallCap ? "Småbolagsrisk: spread, likviditet och snabb reversal" : null,
  ].filter((item): item is string => Boolean(item));
  const tags = [
    isSmallCap ? "småbolag" : "large/mid",
    input.narrative.primaryNarrative !== "none" ? input.narrative.primaryNarrative : null,
    input.squeeze.score >= 70 ? "squeeze" : null,
    input.social.score >= 75 ? "social heat" : null,
    input.insider.direction === "bullish" ? "insider accumulation" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ticker: input.ticker,
    totalScore: score,
    conviction: clamp((score + input.squeeze.confidence + input.social.velocityScore) / 3),
    reasons: reasons.length > 0 ? reasons : ["Ingen enskild edge dominerar, men helhetsrankingen är positiv"],
    risks: risks.length > 0 ? risks : ["Ingen större modellrisk flaggad i mocklagret"],
    tags,
  };
}

export function rankStocks(inputs: RankingInput[]) {
  return inputs.map(rankStock).sort((a, b) => b.totalScore - a.totalScore);
}
