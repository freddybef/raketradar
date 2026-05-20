import { resolveTickerIdentity, type MarketRegion } from "@/lib/market/tickerIdentity";
import type { SwedishEquityUniverseEntry } from "@/lib/market/swedishEquityUniverse";

export type IntradayContinuationLabel =
  | "EARLY_MOMENTUM"
  | "CONTINUATION"
  | "PULLBACK_VALID"
  | "REACCELERATION_WATCH"
  | "COOLING_BUT_VALID"
  | "FAILED_MOVE"
  | "EARLY_CONTINUATION"
  | "LATE_BREAKOUT"
  | "FAKE_SPIKE"
  | "PARABOLIC_RISK"
  | "STEALTH_STRENGTH"
  | "DEAD_BOUNCE";

export interface LiveMarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveMarketReaction {
  ticker: string;
  companyName: string;
  exchange: string;
  asOf: string;
  price: number;
  volume: number;
  intradayMomentum: number;
  relativeVolume: number;
  gapPercent: number;
  acceleration: number;
  volatilityExpansion: number;
  squeezeProbability: number;
  continuationProbability: number;
  fadeProbability: number;
  intradayStrengthScore: number;
  abnormalMoveScore: number;
  marketAggression: number;
  activeTraderAttention: number;
  label: IntradayContinuationLabel;
  flags: string[];
  reason: string;
}

export interface LiveMarketReactionProvider {
  name: string;
  getIntradaySnapshot(ticker: string, exchange: MarketRegion): Promise<LiveMarketBar[]>;
  getDailyBaseline(ticker: string, exchange: MarketRegion): Promise<LiveMarketBar[]>;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function pct(from: number, to: number) {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 10000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function classify(input: {
  momentum: number;
  rvol: number;
  acceleration: number;
  volatilityExpansion: number;
  fadeProbability: number;
  continuationProbability: number;
  marketAggression: number;
  closePosition: number;
  recentTrend: number;
  volumePersistence: number;
}): IntradayContinuationLabel {
  if (input.momentum < -6 && input.rvol >= 1.4 && input.continuationProbability < 42) return "FAILED_MOVE";
  if (input.fadeProbability >= 85 && input.momentum > 10 && input.continuationProbability < 62) return "PARABOLIC_RISK";
  if (input.momentum > 18 && input.acceleration > 7) return "PARABOLIC_RISK";
  if (input.momentum > 12 && input.fadeProbability >= 72 && input.continuationProbability >= 65) return "PARABOLIC_RISK";
  if (input.momentum >= 3 && input.momentum <= 15 && input.rvol >= 1.35 && input.continuationProbability >= 68 && input.fadeProbability < 68) return "EARLY_MOMENTUM";
  if (input.momentum >= 2 && input.continuationProbability >= 72 && input.marketAggression >= 50) return "CONTINUATION";
  if (input.momentum > 8 && input.fadeProbability >= 78 && input.continuationProbability < 58 && input.closePosition < 0.62) return "FAKE_SPIKE";
  if (input.momentum > 6 && input.rvol >= 2.1 && input.continuationProbability >= 60) return "LATE_BREAKOUT";
  if (input.momentum > 1 && input.fadeProbability >= 45 && input.fadeProbability < 72 && input.continuationProbability >= 58 && input.closePosition >= 0.55) return "PULLBACK_VALID";
  if (input.momentum > 0 && input.acceleration > 0.4 && input.rvol >= 1.2 && input.continuationProbability >= 56) return "REACCELERATION_WATCH";
  if (input.momentum > 0.5 && input.momentum < 6 && input.rvol >= 1.35 && input.fadeProbability < 55 && (input.volatilityExpansion < 70 || input.continuationProbability >= 62)) return "STEALTH_STRENGTH";
  if (input.momentum > -1 && input.continuationProbability >= 48 && (input.recentTrend >= -0.4 || input.volumePersistence >= 0.45)) return "COOLING_BUT_VALID";
  return "DEAD_BOUNCE";
}

export async function calculateLiveMarketReactions(input: {
  symbols: string[];
  provider: LiveMarketReactionProvider;
  universe?: SwedishEquityUniverseEntry[];
  includeQuiet?: boolean;
}): Promise<LiveMarketReaction[]> {
  const uniqueSymbols = [...new Set(input.symbols.map((symbol) => symbol.toUpperCase().trim()).filter(Boolean))];
  const universeByTicker = new Map((input.universe ?? []).map((entry) => [entry.ticker.toUpperCase(), entry]));
  async function processSymbol(symbol: string) {
      const universeEntry = universeByTicker.get(symbol);
      const validation = universeEntry ? null : resolveTickerIdentity({ ticker: symbol, source: "Yahoo Nordic live", swedishFirstMode: true });
      if (!universeEntry && !validation?.isDisplayable) return null;

      const exchange = (universeEntry?.exchange ?? validation?.identity.exchange) as MarketRegion;
      const ticker = universeEntry?.ticker ?? validation?.identity.ticker ?? symbol;
      const [intraday, daily] = await Promise.all([
        withTimeout(input.provider.getIntradaySnapshot(ticker, exchange), [], 10000),
        withTimeout(input.provider.getDailyBaseline(ticker, exchange), [], 10000),
      ]);
      if (daily.length < 2) return null;

      const hasIntraday = intraday.length >= 2;
      const first = hasIntraday ? intraday[0] : daily.at(-2);
      const latest = hasIntraday ? intraday.at(-1) : daily.at(-1);
      const previous = hasIntraday ? intraday.at(-2) : daily.at(-2);
      if (!first || !latest || !previous) return null;
      const previousClose = daily.at(-2)?.close ?? first.open;
      if (!latest || !previous) return null;

      const intradayVolume = hasIntraday ? intraday.reduce((sum, bar) => sum + (bar.volume ?? 0), 0) : (latest.volume ?? 0);
      const avgDailyVolume5 = average(daily.slice(-6, -1).map((bar) => bar.volume ?? 0));
      const avgDailyRange = average(daily.slice(-6, -1).map((bar) => Math.abs(pct(bar.open, bar.high))));
      const activeBars = hasIntraday ? intraday : [latest];
      const currentRange = Math.abs(pct(first.open, Math.max(...activeBars.map((bar) => bar.high))));
      const momentum = pct(first.open, latest.close);
      const gapPercent = pct(previousClose, first.open);
      const acceleration = pct(previous.close, latest.close);
      const rvol = avgDailyVolume5 > 0 ? intradayVolume / avgDailyVolume5 : 0;
      const volatilityExpansion = avgDailyRange > 0 ? (currentRange / avgDailyRange) * 100 : 0;
      const high = Math.max(...activeBars.map((bar) => bar.high));
      const low = Math.min(...activeBars.map((bar) => bar.low));
      const fadeFromHigh = pct(high, latest.close);
      const closesNearHigh = high > 0 ? latest.close / high : 0;
      const closePosition = high > low ? (latest.close - low) / (high - low) : closesNearHigh;
      const recentBars = activeBars.slice(-4);
      const recentTrend = recentBars.length >= 2 ? pct(recentBars[0].close, recentBars.at(-1)?.close ?? latest.close) : acceleration;
      const recentHighs = recentBars.map((bar) => bar.high);
      const recentLows = recentBars.map((bar) => bar.low);
      const higherLows = recentLows.length >= 3 && recentLows.at(-1)! >= recentLows[0] * 0.995;
      const lowerHighs = recentHighs.length >= 3 && recentHighs.at(-1)! < recentHighs[0] * 0.99;
      const avgRecentVolume = average(recentBars.map((bar) => bar.volume ?? 0));
      const avgEarlyVolume = average(activeBars.slice(0, Math.max(1, Math.min(4, activeBars.length))).map((bar) => bar.volume ?? 0));
      const volumePersistence = avgEarlyVolume > 0 ? avgRecentVolume / avgEarlyVolume : 0;
      const reclaimStrength = closePosition >= 0.62 ? 10 : closePosition >= 0.5 ? 4 : -8;
      const structureBonus = (higherLows ? 8 : 0) + (!lowerHighs ? 4 : -10) + (volumePersistence >= 0.45 ? 5 : -4);
      const expansionQuality = Math.max(0, momentum) >= 2 ? Math.min(18, Math.max(0, momentum) * 1.4 + Math.min(rvol, 4) * 2.2) : -Math.max(0, 2 - Math.max(0, momentum)) * 6;

      const continuationProbability = clamp(
        38 +
          momentum * 3.4 +
          Math.min(rvol, 5) * 6.5 +
          acceleration * 2.2 +
          recentTrend * 1.7 +
          reclaimStrength +
          structureBonus +
          expansionQuality -
          Math.max(0, -fadeFromHigh) * (closePosition >= 0.55 ? 1.2 : 2.6)
      );
      const fadeProbability = clamp(
        24 +
          Math.max(0, -fadeFromHigh) * (closePosition >= 0.55 ? 4.2 : 7.5) +
          Math.max(0, momentum - 18) * 2.4 +
          (lowerHighs && !higherLows ? 12 : 0) -
          Math.min(rvol, 4) * 4.2 -
          (continuationProbability >= 70 ? 10 : continuationProbability >= 60 ? 5 : 0)
      );
      const squeezeProbability = clamp(20 + Math.min(rvol, 6) * 8 + Math.max(0, momentum) * 2.8 + Math.max(0, gapPercent) * 1.2 + (Math.max(0, momentum) >= 2 ? 8 : 0));
      const intradayStrengthScore = clamp(continuationProbability * 0.48 + squeezeProbability * 0.18 + Math.max(0, momentum) * 3.0 + Math.min(rvol, 5) * 4.5 + reclaimStrength * 0.6);
      const abnormalMoveScore = clamp(Math.abs(momentum) * 4 + Math.min(rvol, 6) * 10 + Math.max(0, volatilityExpansion - 100) * 0.15);
      const marketAggression = clamp(intradayStrengthScore * 0.55 + abnormalMoveScore * 0.22 + Math.max(0, acceleration) * 4 + Math.max(0, momentum) * 0.7);
      const activeTraderAttention = clamp(Math.min(rvol, 6) * 12 + Math.max(0, momentum) * 3 + Math.max(0, acceleration) * 4);
      const label = classify({ momentum, rvol, acceleration, volatilityExpansion, fadeProbability, continuationProbability, marketAggression, closePosition, recentTrend, volumePersistence });
      const flags = [
        rvol >= 2 ? "unusual volume" : null,
        rvol >= 1.3 && momentum > 0 && momentum < 5 ? "stealth accumulation" : null,
        !hasIntraday ? "partial daily coverage" : null,
        momentum < -6 && rvol >= 2 ? "panic move" : null,
        squeezeProbability >= 70 ? "squeeze build-up" : null,
        continuationProbability >= 68 && momentum >= 2 ? "continuation quality" : null,
        label === "PULLBACK_VALID" ? "valid pullback" : null,
        label === "REACCELERATION_WATCH" ? "reacceleration watch" : null,
        fadeProbability >= 68 ? "fake-spike risk" : null,
      ].filter((flag): flag is string => Boolean(flag));

      return {
        ticker,
        companyName: universeEntry?.companyName ?? validation?.identity.companyName ?? ticker,
        exchange,
        asOf: latest.timestamp,
        price: latest.close,
        volume: Math.round(intradayVolume),
        intradayMomentum: Number(momentum.toFixed(2)),
        relativeVolume: Number(rvol.toFixed(2)),
        gapPercent: Number(gapPercent.toFixed(2)),
        acceleration: Number(acceleration.toFixed(2)),
        volatilityExpansion: clamp(volatilityExpansion),
        squeezeProbability,
        continuationProbability,
        fadeProbability,
        intradayStrengthScore,
        abnormalMoveScore,
        marketAggression,
        activeTraderAttention,
        label,
        flags,
        reason: `${label}: ${momentum.toFixed(1)}% ${hasIntraday ? "intraday" : "daily/partial"}, RVOL ${rvol.toFixed(1)}, continuation ${continuationProbability}%.`,
      } satisfies LiveMarketReaction;
  }

  const reactions = [];
  const batchSize = 8;
  for (let index = 0; index < uniqueSymbols.length; index += batchSize) {
    const batch = uniqueSymbols.slice(index, index + batchSize);
    reactions.push(...await Promise.all(batch.map((symbol) => processSymbol(symbol))));
  }

  const validReactions = reactions.filter((reaction): reaction is NonNullable<typeof reaction> => reaction !== null);
  const scopedReactions = input.includeQuiet
    ? validReactions
    : validReactions.filter((reaction) => reaction.abnormalMoveScore >= 35 || reaction.intradayStrengthScore >= 45 || reaction.relativeVolume >= 1.2);
  return scopedReactions.sort((a, b) => b.marketAggression - a.marketAggression);
}
