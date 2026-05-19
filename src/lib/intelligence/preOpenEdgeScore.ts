import type { InsiderEvent } from "@/lib/intelligence/insider/insiderTypes";
import type { PreOpenClassification } from "@/lib/intelligence/preOpenClassifier";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import type { WarRoomOutcomeRow } from "@/lib/intelligence/morningWarRoom";

export interface PreOpenEdgeInput {
  ticker: string;
  classification?: PreOpenClassification;
  insiderEvents: InsiderEvent[];
  signalFeed: SignalFeedItem[];
  outcomes: WarRoomOutcomeRow[];
  rankedScore: number;
  tags: string[];
}

export interface PreOpenEdgeScore {
  totalScore: number;
  breakdown: {
    newsStrength: number;
    insiderSupport: number;
    smallCapProfile: number;
    historicalHitrate: number;
    openingSqueezePotential: number;
    fakeSpikeRisk: number;
    crowding: number;
    priorMove: number;
    liquidityRisk: number;
  };
  reasons: string[];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function historicalHitrate(ticker: string, outcomes: WarRoomOutcomeRow[]) {
  const scoped = outcomes.filter((row) => row.ticker === ticker && row.followThroughQuality !== null);
  if (scoped.length === 0) return 50;
  const wins = scoped.filter((row) => (row.followThroughQuality ?? 0) >= 60 || (row.maxUpsidePercent ?? 0) >= 8);
  return clamp((wins.length / scoped.length) * 100);
}

export function calculatePreOpenEdgeScore(input: PreOpenEdgeInput): PreOpenEdgeScore {
  const normalizedTags = input.tags.map((tag) => tag.toLowerCase());
  const buyValue = input.insiderEvents
    .filter((event) => event.type === "buy")
    .reduce((sum, event) => sum + event.valueSek, 0);
  const insiderSupport = clamp(input.insiderEvents.length * 12 + buyValue / 250000);
  const newsStrength = input.classification?.catalystStrength ?? 35;
  const hasSmallCapSignal = normalizedTags.some((tag) =>
    ["smallcap", "småbolag", "smaabolag", "low float", "låg float", "ignored sector"].includes(tag)
  );
  const hasStealthSignal = normalizedTags.some((tag) =>
    tag.includes("stealth") || tag.includes("accumulation") || tag.includes("squeeze")
  );
  const smallCapProfile = clamp(
    (hasSmallCapSignal || input.ticker.length <= 6 ? 64 : 38) +
      (hasStealthSignal ? 10 : 0) +
      (insiderSupport >= 55 ? 8 : 0)
  );
  const openingSqueezePotential = clamp(
    Math.max(...input.signalFeed.filter((item) => item.type === "squeeze").map((item) => item.score), 35) +
      (hasStealthSignal ? 6 : 0) +
      (smallCapProfile >= 70 ? 5 : 0)
  );
  const priorMove = clamp(
    Math.max(...input.signalFeed.filter((item) => item.type === "momentum").map((item) => item.score), 35)
  );
  const crowding = input.signalFeed.some((item) => item.tags.includes("pump-risk") || item.tags.includes("parabolisk"))
    ? 82
    : input.signalFeed.some((item) => item.type === "social" && item.score >= 80)
      ? 62
      : 34;
  const liquidityRisk = smallCapProfile >= 60 ? 58 : 36;
  const fakeSpikeRisk = clamp((input.classification?.fakeSpikeRisk ?? 35) + crowding * 0.28 + (priorMove >= 82 ? 12 : 0));
  const hitrate = historicalHitrate(input.ticker, input.outcomes);

  const totalScore = clamp(
    newsStrength * 0.24 +
      insiderSupport * 0.16 +
      smallCapProfile * 0.08 +
      hitrate * 0.15 +
      openingSqueezePotential * 0.14 +
      input.rankedScore * 0.13 -
      fakeSpikeRisk * 0.13 -
      crowding * 0.06 -
      liquidityRisk * 0.04 -
      (priorMove >= 86 ? 8 : 0)
  );

  return {
    totalScore,
    breakdown: {
      newsStrength,
      insiderSupport,
      smallCapProfile,
      historicalHitrate: hitrate,
      openingSqueezePotential,
      fakeSpikeRisk,
      crowding,
      priorMove,
      liquidityRisk,
    },
    reasons: [
      newsStrength >= 70 ? "stark svensk PM-trigger" : null,
      insiderSupport >= 55 ? "FI-insiderstöd" : null,
      smallCapProfile >= 70 ? "smallcap/low-float profil får pre-open boost" : null,
      openingSqueezePotential >= 70 ? "opening squeeze-potential" : null,
      hitrate >= 65 ? "historisk hitrate stödjer setupen" : null,
      fakeSpikeRisk >= 70 ? "fake-spike-risk drar ned score" : null,
      priorMove >= 86 ? "tidigare rörelse gör chase farligt" : null,
    ].filter((reason): reason is string => Boolean(reason)),
  };
}
