import { calculateInsiderSignal } from "@/lib/intelligence/insider/insiderScore";
import type { InsiderEvent } from "@/lib/intelligence/insider/insiderTypes";
import type { IntelligenceReport } from "@/lib/intelligence/mockData";
import { detectNarratives } from "@/lib/intelligence/narrative/narrativeEngine";
import { rankStocks, type RankingInput } from "@/lib/intelligence/ranking/rankStocks";
import type { StockNews } from "@/lib/providers/types";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueTickers(events: InsiderEvent[], news: StockNews[]) {
  return [
    ...new Set([
      ...events.map((event) => event.ticker.toUpperCase()),
      ...news.flatMap((item) => item.tickers.map((ticker) => ticker.toUpperCase())),
    ]),
  ].filter(Boolean);
}

function buildSocialFallback(ticker: string, eventCount: number, newsCount: number) {
  const velocityScore = clamp(eventCount * 14 + newsCount * 10 + 28);

  return {
    ticker,
    score: clamp(30 + velocityScore * 0.45),
    velocityScore,
    sentimentScore: 52,
    unusualActivity: eventCount + newsCount >= 2,
    narrativeShift: newsCount >= 2,
    sources: newsCount > 0 ? ["news"] : ["insider"],
  };
}

function newsCatalystScore(news: StockNews[]) {
  if (news.length === 0) return 35;

  const triggerScore = news.flatMap((item) => item.triggers).reduce((sum, trigger) => {
    const directionMultiplier =
      trigger.direction === "bullish" ? 1 : trigger.direction === "bearish" ? -0.7 : 0.35;
    return sum + trigger.impactScore * directionMultiplier;
  }, 0);

  return clamp(45 + triggerScore / Math.max(1, news.length));
}

function squeezeFallback(insider: ReturnType<typeof calculateInsiderSignal>, newsCount: number) {
  const score = clamp(35 + insider.strength * 0.35 + newsCount * 8);

  return {
    score,
    triggeredFactors: [
      insider.direction === "bullish" ? "insider accumulation" : null,
      newsCount >= 2 ? "news acceleration" : null,
      insider.buyValueSek >= 250000 ? "stealth accumulation" : null,
    ].filter((item): item is string => Boolean(item)),
    confidence: clamp(45 + insider.strength * 0.4),
  };
}

export function buildLiveIntelligenceReport(input: {
  insiderEvents: InsiderEvent[];
  news: StockNews[];
}): IntelligenceReport | null {
  const tickers = uniqueTickers(input.insiderEvents, input.news);
  if (tickers.length === 0) return null;

  const inputs: RankingInput[] = tickers.map((ticker) => {
    const tickerEvents = input.insiderEvents.filter((event) => event.ticker === ticker);
    const tickerNews = input.news.filter((item) => item.tickers.includes(ticker));
    const insider = calculateInsiderSignal(ticker, input.insiderEvents);
    const social = buildSocialFallback(ticker, tickerEvents.length, tickerNews.length);
    const narrative = detectNarratives(
      tickerNews.map((item) => ({ title: item.title, rawText: item.rawText })),
      social
    );
    const catalyst = newsCatalystScore(tickerNews);
    const positiveFlow = insider.direction === "bullish";

    return {
      ticker,
      technicalMomentum: clamp(45 + insider.strength * 0.25 + catalyst * 0.15),
      unusualVolume: clamp(42 + tickerEvents.length * 12 + tickerNews.length * 7),
      relativeStrength: clamp(44 + insider.strength * 0.2 + tickerNews.length * 6),
      newsCatalyst: catalyst,
      social,
      insider,
      narrative,
      squeeze: squeezeFallback(insider, tickerNews.length),
      marketCapSek: positiveFlow && insider.buyValueSek > 0 ? undefined : undefined,
    };
  });

  const topRanked = rankStocks(inputs);
  const strongestNarratives = inputs
    .map((item) => ({
      ticker: item.ticker,
      narrative: item.narrative.primaryNarrative,
      strength: item.narrative.narrativeStrength,
    }))
    .sort((a, b) => b.strength - a.strength);
  const unusualActivity = inputs
    .filter((item) => item.social.unusualActivity || item.unusualVolume >= 65)
    .map((item) => ({
      ticker: item.ticker,
      socialScore: item.social.score,
      reason: item.social.narrativeShift ? "Nyhetsacceleration" : "Insiderflöde över normalnivå",
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
