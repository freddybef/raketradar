import type { InsiderEvent } from "./insider/insiderTypes";
import { calculateInsiderSignal } from "./insider/insiderScore";
import { detectNarratives } from "./narrative/narrativeEngine";
import { rankStocks, type RankedStock, type RankingInput } from "./ranking/rankStocks";
import { buildSocialSnapshots } from "./social/socialSignals";
import type { SocialBaseline, SocialMention } from "./social/socialTypes";
import { detectSqueezePotential } from "./squeeze/squeezeDetector";

export interface IntelligenceReport {
  topRanked: RankedStock[];
  strongestNarratives: Array<{ ticker: string; narrative: string; strength: number }>;
  unusualActivity: Array<{ ticker: string; socialScore: number; reason: string }>;
  highestSqueezeScore: { ticker: string; score: number; factors: string[] };
  strongestInsiderAccumulation: { ticker: string; score: number; reasons: string[] };
  inputs: RankingInput[];
}

const now = new Date().toISOString();

const socialMentions: SocialMention[] = [
  { ticker: "NCC", source: "x", mentions: 180, sentiment: 0.62, velocity: 92, timestamp: now },
  { ticker: "NCC", source: "placera", mentions: 94, sentiment: 0.44, velocity: 55, timestamp: now },
  { ticker: "NCC", source: "reddit", mentions: 41, sentiment: 0.5, velocity: 31, timestamp: now },
  { ticker: "NANO", source: "discord", mentions: 260, sentiment: 0.34, velocity: 130, timestamp: now },
  { ticker: "NANO", source: "flashback", mentions: 83, sentiment: 0.12, velocity: 70, timestamp: now },
  { ticker: "MEDI", source: "placera", mentions: 76, sentiment: 0.58, velocity: 44, timestamp: now },
  { ticker: "MEDI", source: "x", mentions: 51, sentiment: 0.46, velocity: 28, timestamp: now },
];

const baselines: SocialBaseline[] = [
  { ticker: "NCC", averageMentions: 70, averageVelocity: 24 },
  { ticker: "NANO", averageMentions: 85, averageVelocity: 36 },
  { ticker: "MEDI", averageMentions: 55, averageVelocity: 18 },
];

const insiderEvents: InsiderEvent[] = [
  { ticker: "NCC", insiderName: "Anna Berg", role: "VD", type: "buy", valueSek: 640000, date: now },
  { ticker: "NCC", insiderName: "CFO", role: "CFO", type: "buy", valueSek: 210000, date: now },
  { ticker: "NANO", insiderName: "Styrelseledamot", role: "Board", type: "sell", valueSek: 150000, date: now },
  { ticker: "MEDI", insiderName: "Ordförande", role: "Chair", type: "buy", valueSek: 320000, date: now },
];

const marketCaps: Record<string, number> = {
  NCC: 380000000,
  NANO: 210000000,
  MEDI: 1250000000,
};

const newsByTicker = {
  NCC: [
    { title: "NCC får order från europeisk infrastrukturkund", rawText: "order avtal infrastruktur" },
  ],
  NANO: [
    { title: "NanoMaterials rusar efter social squeeze och batterimetall-narrativ", rawText: "squeeze momentum batteri metaller meme" },
  ],
  MEDI: [
    { title: "MediSignal visar positiva fas II studieresultat och inleder turnaround", rawText: "fas ii studieresultat biotech turnaround klinisk studie" },
  ],
};

export function buildMockIntelligenceReport(): IntelligenceReport {
  const socialSnapshots = buildSocialSnapshots(socialMentions, baselines);
  const inputs = socialSnapshots.map((social) => {
    const ticker = social.ticker;
    const insider = calculateInsiderSignal(ticker, insiderEvents, marketCaps[ticker]);
    const narrative = detectNarratives(newsByTicker[ticker as keyof typeof newsByTicker] ?? [], social);
    const squeeze = detectSqueezePotential({
      ticker,
      floatSharesMillions: ticker === "NANO" ? 16 : ticker === "NCC" ? 24 : 58,
      volumeRatio: ticker === "NCC" ? 4.9 : ticker === "NANO" ? 5.6 : 2.1,
      atrExpansion: ticker === "NANO" ? 2.4 : 1.7,
      verticalAcceleration: ticker === "NANO" ? 8 : ticker === "NCC" ? 6 : 3,
      gapUpPercent: ticker === "NANO" ? 7.8 : ticker === "NCC" ? 5.2 : 2.1,
      socialVelocityScore: social.velocityScore,
    });

    return {
      ticker,
      marketCapSek: marketCaps[ticker],
      technicalMomentum: ticker === "NANO" ? 86 : ticker === "NCC" ? 78 : 64,
      unusualVolume: ticker === "NANO" ? 91 : ticker === "NCC" ? 86 : 58,
      relativeStrength: ticker === "NANO" ? 82 : ticker === "NCC" ? 74 : 62,
      newsCatalyst: ticker === "MEDI" ? 88 : ticker === "NCC" ? 84 : 69,
      social,
      insider,
      narrative,
      squeeze,
    };
  });
  const topRanked = rankStocks(inputs);
  const strongestNarratives = inputs
    .map((input) => ({
      ticker: input.ticker,
      narrative: input.narrative.primaryNarrative,
      strength: input.narrative.narrativeStrength,
    }))
    .sort((a, b) => b.strength - a.strength);
  const unusualActivity = inputs
    .filter((input) => input.social.unusualActivity)
    .map((input) => ({
      ticker: input.ticker,
      socialScore: input.social.score,
      reason: input.social.narrativeShift ? "Narrativskifte och multipla plattformar" : "Spike över baseline",
    }));
  const squeezeLeader = [...inputs].sort((a, b) => b.squeeze.score - a.squeeze.score)[0];
  const insiderLeader = [...inputs].sort((a, b) => b.insider.score - a.insider.score)[0];

  return {
    topRanked,
    strongestNarratives,
    unusualActivity,
    highestSqueezeScore: {
      ticker: squeezeLeader.ticker,
      score: squeezeLeader.squeeze.score,
      factors: squeezeLeader.squeeze.triggeredFactors,
    },
    strongestInsiderAccumulation: {
      ticker: insiderLeader.ticker,
      score: insiderLeader.insider.score,
      reasons: insiderLeader.insider.reasons,
    },
    inputs,
  };
}
