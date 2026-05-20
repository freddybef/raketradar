import { rankSignal, type RankedStockSignal, type SignalEngineInput, type StockSignal } from "../signals";
import { aggregateTriggerImpact } from "../triggerExtraction";
import { mockProvider } from "./mockProvider";
import { newsProvider } from "./newsProvider";
import type {
  CandidateBuildInput,
  InsiderEvent,
  MarketSnapshot,
  ProviderHealth,
  StockNews,
  StockQuote,
} from "./types";
import { yahooProvider } from "./yahooProvider";

const DEFAULT_SWEDISH_SMALL_CAPS = ["NCC.ST", "NANO.ST", "MEDI.ST"];

function now() {
  return new Date().toISOString();
}

function cleanTicker(symbol: string) {
  return symbol.replace(".ST", "").toUpperCase();
}

function scoreNewsImpact(news: StockNews[]) {
  if (news.length === 0) return 35;

  const impacts = news.map((item) =>
    aggregateTriggerImpact(item.triggers, item.publishedAt)
  );
  const bullish = impacts.filter((impact) => impact.direction === "bullish");
  const bearish = impacts.filter((impact) => impact.direction === "bearish");
  const impactScore =
    impacts.reduce((total, impact) => total + impact.impactScore, 0) /
    impacts.length;
  const directionPenalty = bearish.length * 16;
  const directionBoost = bullish.length * 5;

  return Math.max(
    0,
    Math.min(100, Math.round(impactScore + directionBoost - directionPenalty))
  );
}

function scoreInsiders(events: InsiderEvent[]) {
  if (events.length === 0) return 42;
  const buyValue = events
    .filter((event) => event.eventType === "buy")
    .reduce((total, event) => total + (event.valueSek ?? 0), 0);
  const sellCount = events.filter((event) => event.eventType === "sell").length;
  return Math.max(15, Math.min(92, 56 + buyValue / 25000 - sellCount * 18));
}

function inferFloatSharesMillions(quote: StockQuote) {
  if (!quote.marketCap || !quote.price) return 45;
  return Math.max(8, Math.min(180, quote.marketCap / quote.price / 1000000));
}

function inferTurnoverMillionsSek(quote: StockQuote) {
  if (!quote.volume || !quote.price) return 0.8;
  return (quote.volume * quote.price) / 1000000;
}

function actionFromScore(score: number) {
  if (score >= 86) return "STARK BEVAKNING";
  if (score >= 74) return "BEVAKA";
  if (score >= 62) return "AVVAKTA";
  return "LÅG EDGE";
}

function buildCandidateSignal(input: CandidateBuildInput): StockSignal {
  const ticker = cleanTicker(input.quote.symbol);
  const headline = input.news[0]?.title;
  const triggerLabels = input.news.flatMap((item) => item.detectedTriggers);
  const social = input.socialSignal;
  const change = input.quote.changePercent ?? 0;
  const volumeRatio =
    input.quote.volume && input.quote.averageVolume
      ? input.quote.volume / input.quote.averageVolume
      : 1;
  const starterScore = Math.max(
    35,
    Math.min(92, 50 + change * 2.2 + volumeRatio * 6 + input.news.length * 5)
  );

  return {
    id: `snapshot-${ticker.toLowerCase()}`,
    ticker,
    company_name: input.quote.name,
    market: input.quote.exchange,
    score: Math.round(starterScore),
    signal_type: triggerLabels.length > 0 ? triggerLabels.slice(0, 2).join(" + ") : headline ? "Market snapshot + news" : "Market snapshot",
    action: actionFromScore(starterScore),
    confidence: Math.round(Math.min(94, starterScore + 4)),
    time_horizon: "1-4 veckor",
    trigger_source: headline ?? social?.source ?? input.quote.source,
    risk_level: input.quote.averageVolume && input.quote.averageVolume < 150000 ? "Hög" : "Medel",
    description: headline
      ? `${headline}. Prisrörelse ${change.toFixed(1)}% och volymratio ${volumeRatio.toFixed(1)}x.`
      : `Prisrörelse ${change.toFixed(1)}% och volymratio ${volumeRatio.toFixed(1)}x utan aktiverad live news-källa.`,
    ai_reason:
      "Provider registry kombinerar quote, news, insider och social feed innan signal engine rankar caset.",
    source_url: input.news[0]?.url ?? null,
    detected_at: now(),
    created_at: now(),
  };
}

function buildEngineInput(input: CandidateBuildInput): SignalEngineInput {
  const quote = input.quote;
  const volumeRatio =
    quote.volume && quote.averageVolume ? quote.volume / quote.averageVolume : 1.1;

  return {
    signal: buildCandidateSignal(input),
    volumeRatio,
    insiderActivityScore: scoreInsiders(input.insiderEvents),
    newsImpactScore: scoreNewsImpact(input.news),
    socialBuzzScore: input.socialSignal?.buzzScore ?? 38,
    floatSharesMillions: inferFloatSharesMillions(quote),
    turnoverMillionsSek: inferTurnoverMillionsSek(quote),
    momentumPercent: quote.changePercent ?? 0,
  };
}

function buildProviderHealth(
  name: string,
  status: ProviderHealth["status"],
  message: string
): ProviderHealth {
  return { name, status, message, lastCheckedAt: now() };
}

export function getStaticProviderHealth(): ProviderHealth[] {
  return [
    mockProvider.getHealth(),
    yahooProvider.getHealth(),
    newsProvider.getHealth(),
    buildProviderHealth("Supabase", "healthy", "Session och RLS används för personlig data"),
    buildProviderHealth("AI layer", "fallback", "AI summary körs lokalt från edge engine tills serverlager finns"),
  ];
}

export async function fetchMarketSnapshot(
  symbols = DEFAULT_SWEDISH_SMALL_CAPS
): Promise<MarketSnapshot> {
  const health: ProviderHealth[] = [];
  const yahooQuotes = await yahooProvider.getQuotes(symbols);
  const quotes =
    yahooQuotes.length > 0 ? yahooQuotes : await mockProvider.getQuotes(symbols);
  const mode = yahooQuotes.length > 0 ? "live" : "fallback";

  health.push(
    mockProvider.getHealth(),
    {
      ...yahooProvider.getHealth(),
      status: yahooQuotes.length > 0 ? "healthy" : "fallback",
      message:
        yahooQuotes.length > 0
          ? "Live quote-data hämtad"
          : "Live data ej aktiverad eller request misslyckades",
    },
    newsProvider.getHealth()
  );

  const [news, insiderEvents, socialSignals] = await Promise.all([
    newsProvider.getNews(symbols),
    mockProvider.getInsiderEvents(symbols),
    mockProvider.getSocialSignals(symbols),
  ]);

  const candidates: RankedStockSignal[] = quotes
    .map((quote) => {
      const ticker = cleanTicker(quote.symbol);
      const quoteNews = news.filter((item) => item.tickers.includes(ticker));
      const quoteInsiders = insiderEvents.filter(
        (event) => cleanTicker(event.symbol) === ticker
      );
      const socialSignal =
        socialSignals.find((signal) => cleanTicker(signal.symbol) === ticker) ??
        null;

      return rankSignal(
        buildEngineInput({
          quote,
          news: quoteNews,
          insiderEvents: quoteInsiders,
          socialSignal,
        })
      );
    })
    .sort((a, b) => b.raket_score - a.raket_score);

  health.push(
    buildProviderHealth("Supabase", "healthy", "Personlig data läses via Supabase RLS"),
    buildProviderHealth("AI layer", "fallback", "Kör på lokal explainability utan extern modell")
  );

  return {
    candidates,
    quotes,
    news,
    insiderEvents,
    socialSignals,
    health,
    mode,
  };
}
