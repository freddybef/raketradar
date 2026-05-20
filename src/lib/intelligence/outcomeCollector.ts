import {
  getPendingSignalOutcomeRows,
  saveProviderRun,
  updateSignalOutcomeMarketResult,
} from "@/lib/db/intelligenceRepository";
import {
  classifyOutcomeFromMarketData,
  type OutcomeLabel,
  type SignalOutcomeHorizon,
} from "@/lib/intelligence/outcomeTracker";
import { resolveTickerIdentity } from "@/lib/market/tickerIdentity";
import type { MarketBar, OutcomeMarketDataProvider } from "@/lib/providers/marketDataProvider";
import { yahooMarketDataProvider } from "@/lib/providers/yahooMarketDataProvider";

export interface OutcomeCollectorSummary {
  startedAt: string;
  finishedAt: string;
  provider: string;
  processed: number;
  updated: number;
  stillPending: number;
  dead: number;
  errors: string[];
  missingMarketData: Array<{ ticker: string; horizon: string; reason: string }>;
  blockedIdentity: Array<{ ticker: string; horizon: string; reasons: string[] }>;
  latestClassified: Array<{
    signalId: string;
    ticker: string;
    horizon: string;
    outcomeLabel: OutcomeLabel;
    followThroughQuality: number;
    maxUpsidePercent: number;
  }>;
}

const HORIZON_MS: Record<string, number> = {
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "60m": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "5d": 5 * 24 * 60 * 60 * 1000,
  close: 8 * 60 * 60 * 1000,
  next_day_open: 24 * 60 * 60 * 1000,
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function isIntraday(horizon: string) {
  return ["5m", "15m", "30m", "60m"].includes(horizon);
}

function isMatured(triggeredAt: string, horizon: string) {
  const wait = HORIZON_MS[horizon] ?? HORIZON_MS["1d"];
  return Date.now() >= new Date(triggeredAt).getTime() + wait;
}

function windowFor(triggeredAt: string, horizon: string) {
  const from = new Date(triggeredAt);
  const to = new Date(from.getTime() + (HORIZON_MS[horizon] ?? HORIZON_MS["1d"]));
  const paddedTo = new Date(to.getTime() + (isIntraday(horizon) ? 10 * 60 * 1000 : 24 * 60 * 60 * 1000));
  return { from: from.toISOString(), to: paddedTo.toISOString() };
}

function quality(input: {
  maxUpsidePercent: number;
  maxDrawdownPercent: number;
  closeReturnPercent: number;
}) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        input.closeReturnPercent * 9 +
          input.maxUpsidePercent * 3 -
          Math.abs(Math.min(0, input.maxDrawdownPercent)) * 5 -
          Math.max(0, input.maxUpsidePercent - input.closeReturnPercent) * 4 +
          45
      )
    )
  );
}

function calculateOutcome(bars: MarketBar[], horizon: string, fallbackEntryPrice: number) {
  const first = bars[0];
  const last = bars.at(-1);
  if (!first || !last) return null;

  const entry = fallbackEntryPrice > 0 ? fallbackEntryPrice : first.open;
  if (entry <= 0) return null;

  const high = Math.max(...bars.map((bar) => bar.high));
  const low = Math.min(...bars.map((bar) => bar.low));
  const volume = bars.reduce((sum, bar) => sum + bar.volume, 0);
  const maxUpsidePercent = round(((high - entry) / entry) * 100);
  const maxDrawdownPercent = round(((low - entry) / entry) * 100);
  const closeReturnPercent = round(((last.close - entry) / entry) * 100);
  const followThroughQuality = quality({
    maxUpsidePercent,
    maxDrawdownPercent,
    closeReturnPercent,
  });
  const outcomeLabel = classifyOutcomeFromMarketData({
    horizon,
    maxUpsidePercent,
    maxDrawdownPercent,
    closeReturnPercent,
    followThroughQuality,
    volumeExpansion: null,
    hadMarketData: true,
  });

  return {
    observedPrice: last.close,
    openPrice: first.open,
    highPrice: high,
    lowPrice: low,
    closePrice: last.close,
    volume,
    maxUpsidePercent,
    maxDrawdownPercent,
    closeReturnPercent,
    followThroughQuality,
    outcomeLabel,
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown; details?: unknown; code?: unknown };
    return [candidate.message, candidate.details, candidate.code].filter(Boolean).map(String).join(" ");
  }
  return String(error);
}

function rawPayloadObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function collectPendingOutcomes(
  input: { limit?: number; provider?: OutcomeMarketDataProvider } = {}
): Promise<OutcomeCollectorSummary> {
  const provider = input.provider ?? yahooMarketDataProvider;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const rows = await getPendingSignalOutcomeRows(input.limit ?? 80);
  const summary: OutcomeCollectorSummary = {
    startedAt,
    finishedAt: startedAt,
    provider: provider.name,
    processed: 0,
    updated: 0,
    stillPending: 0,
    dead: 0,
    errors: [],
    missingMarketData: [],
    blockedIdentity: [],
    latestClassified: [],
  };

  for (const row of rows) {
    summary.processed += 1;
    const identity = resolveTickerIdentity({ ticker: row.ticker, source: "outcome collector", swedishFirstMode: true });
    if (!identity.isDisplayable) {
      summary.blockedIdentity.push({ ticker: row.ticker, horizon: row.horizon, reasons: identity.rejectionReasons });
      continue;
    }

    if (!isMatured(row.triggeredAt, row.horizon)) {
      summary.stillPending += 1;
      continue;
    }

    try {
      const { from, to } = windowFor(row.triggeredAt, row.horizon);
      const bars = isIntraday(row.horizon)
        ? await provider.getIntradayBars(row.ticker, identity.identity.exchange, from, to)
        : await provider.getDailyBars(row.ticker, identity.identity.exchange, from, to);
      const outcome = calculateOutcome(bars, row.horizon, row.entryPrice);

      if (!outcome) {
        summary.missingMarketData.push({ ticker: row.ticker, horizon: row.horizon, reason: "provider_returned_no_bars" });
        await updateSignalOutcomeMarketResult({
          signalId: row.signalId,
          horizon: row.horizon,
          observedPrice: null,
          openPrice: null,
          highPrice: null,
          lowPrice: null,
          closePrice: null,
          volume: null,
          maxUpsidePercent: null,
          maxDrawdownPercent: null,
          closeReturnPercent: null,
          followThroughQuality: null,
          outcomeLabel: "DEAD",
          outcomeStatus: "missing_market_data",
          rawPayload: { ...rawPayloadObject(row.rawPayload), collector: { provider: provider.name, from, to, status: "missing_market_data" } },
        });
        summary.dead += 1;
        continue;
      }

      await updateSignalOutcomeMarketResult({
        signalId: row.signalId,
        horizon: row.horizon,
        ...outcome,
        outcomeStatus: "evaluated",
        rawPayload: {
          ...rawPayloadObject(row.rawPayload),
          collector: {
            provider: provider.name,
            from,
            to,
            bars: bars.length,
            status: "evaluated",
          },
        },
      });
      summary.updated += 1;
      summary.latestClassified.push({
        signalId: row.signalId,
        ticker: row.ticker,
        horizon: row.horizon as SignalOutcomeHorizon,
        outcomeLabel: outcome.outcomeLabel,
        followThroughQuality: outcome.followThroughQuality,
        maxUpsidePercent: outcome.maxUpsidePercent,
      });
    } catch (error) {
      summary.errors.push(`${row.ticker} ${row.horizon}: ${errorMessage(error)}`);
    }
  }

  summary.finishedAt = new Date().toISOString();
  await saveProviderRun({
    provider: "outcome_collector",
    status: summary.errors.length > 0 ? "error" : summary.updated > 0 ? "success" : summary.missingMarketData.length > 0 ? "empty" : "skipped",
    startedAt,
    finishedAt: summary.finishedAt,
    latencyMs: Date.now() - startedMs,
    fetchedCount: summary.processed,
    savedCount: summary.updated,
    errorMessage: summary.errors.join("\n") || undefined,
    rawPayload: summary,
  }).catch(() => undefined);

  return summary;
}
