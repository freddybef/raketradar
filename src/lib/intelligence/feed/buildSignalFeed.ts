import type { IntelligenceReport } from "../mockData";
import { calculateAlertPriority, type AlertPriority } from "../alerts/priorityEngine";

export interface SignalFeedItem {
  id: string;
  type: "squeeze" | "insider" | "social" | "narrative" | "volume" | "momentum";
  ticker: string;
  title: string;
  description: string;
  score: number;
  confidence: number;
  timestamp: string;
  tags: string[];
  priority?: AlertPriority;
}

function nowMinus(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
}

function smallCapTags(marketCapSek?: number) {
  return marketCapSek && marketCapSek < 5000000000 ? ["småbolag"] : [];
}

function edgeBoostTags(input: IntelligenceReport["inputs"][number]) {
  const tags: string[] = [];
  const confluence =
    input.social.score >= 72 && input.squeeze.score >= 72 && input.unusualVolume >= 75;

  if (confluence) tags.push("confluence");
  if (input.social.velocityScore >= 75) tags.push("acceleration");
  if (input.marketCapSek && input.marketCapSek < 5000000000) tags.push("småbolag");
  if (input.social.score >= 88 && input.newsCatalyst < 60) tags.push("pump-risk");
  if (input.technicalMomentum >= 90 && input.squeeze.score >= 85) tags.push("parabolisk");
  if (input.insider.direction === "bullish" && input.unusualVolume >= 70) {
    tags.push("stealth accumulation");
  }

  return tags;
}

function withPriority(item: SignalFeedItem): SignalFeedItem {
  return { ...item, priority: calculateAlertPriority(item).priority };
}

export function buildSignalFeed(report: IntelligenceReport): SignalFeedItem[] {
  const items: SignalFeedItem[] = [];

  for (const input of report.inputs) {
    const commonTags = [...smallCapTags(input.marketCapSek), ...edgeBoostTags(input)];

    if (input.squeeze.score >= 65) {
      items.push({
        id: `${input.ticker}-squeeze`,
        type: "squeeze",
        ticker: input.ticker,
        title: "Squeeze-watch aktiverad",
        description: input.squeeze.triggeredFactors.join(", ") || "Flera squeeze-faktorer nära tröskel.",
        score: input.squeeze.score,
        confidence: input.squeeze.confidence,
        timestamp: nowMinus(4),
        tags: ["squeeze", ...commonTags],
      });
    }

    if (input.insider.score >= 62 || input.insider.score <= 42) {
      items.push({
        id: `${input.ticker}-insider`,
        type: "insider",
        ticker: input.ticker,
        title:
          input.insider.direction === "bullish"
            ? "Insiderackumulering"
            : "Insiderflöde pressar caset",
        description: input.insider.reasons.slice(0, 2).join(", "),
        score: input.insider.score,
        confidence: input.insider.strength,
        timestamp: nowMinus(11),
        tags: ["insider", ...commonTags],
      });
    }

    if (input.social.unusualActivity) {
      items.push({
        id: `${input.ticker}-social`,
        type: "social",
        ticker: input.ticker,
        title: "Social acceleration över baseline",
        description: `${input.social.sources.join(", ")} driver heat ${input.social.score}/100.`,
        score: input.social.score,
        confidence: input.social.velocityScore,
        timestamp: nowMinus(16),
        tags: ["social", ...commonTags],
      });
    }

    if (input.narrative.emergingNarrative) {
      items.push({
        id: `${input.ticker}-narrative`,
        type: "narrative",
        ticker: input.ticker,
        title: `Emerging narrative: ${input.narrative.primaryNarrative}`,
        description: `Narrativstyrka ${input.narrative.narrativeStrength}/100 och trend ${input.narrative.trendDirection}.`,
        score: input.narrative.narrativeStrength,
        confidence: input.social.velocityScore,
        timestamp: nowMinus(22),
        tags: ["narrativ", ...commonTags],
      });
    }

    if (input.unusualVolume >= 70) {
      items.push({
        id: `${input.ticker}-volume`,
        type: "volume",
        ticker: input.ticker,
        title: "Repeat volume expansion",
        description: "Volymexpansion sammanfaller med småbolagssetup och rankingedge.",
        score: input.unusualVolume,
        confidence: input.relativeStrength,
        timestamp: nowMinus(27),
        tags: ["volym", ...commonTags],
      });
    }

    if (input.technicalMomentum >= 72) {
      items.push({
        id: `${input.ticker}-momentum`,
        type: "momentum",
        ticker: input.ticker,
        title: "Momentumförstärkning",
        description: "Relativ styrka och tekniskt momentum pekar på aktiv repricing.",
        score: input.technicalMomentum,
        confidence: input.relativeStrength,
        timestamp: nowMinus(35),
        tags: ["momentum", ...commonTags],
      });
    }
  }

  return items
    .map(withPriority)
    .sort((a, b) => {
      const priorityRank: Record<AlertPriority, number> = {
        EXTREME: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      const priorityDelta =
        priorityRank[b.priority ?? "LOW"] - priorityRank[a.priority ?? "LOW"];

      if (priorityDelta !== 0) return priorityDelta;
      return b.score + b.confidence - (a.score + a.confidence);
    });
}
