import { fetchLatestInsiderEvents } from "@/lib/providers/insider/fiInsiderProvider";
import { fetchRedditMentions } from "@/lib/providers/social/redditProvider";
import { getProviderNews } from "@/lib/providers/newsProvider";
import { getYahooQuotes } from "@/lib/providers/yahooProvider";
import { runProviderRequest } from "./providerClient";

export async function fetchLiveProviderBundle(tickers: string[]) {
  const [insider, news, market, reddit] = await Promise.all([
    runProviderRequest("fi-insider", {
      name: "Finansinspektionen insiderfeed",
      minIntervalMs: 120000,
      cacheTtlMs: 300000,
      retries: 1,
    }, () => fetchLatestInsiderEvents({ limit: 80 })),
    runProviderRequest("mfn-cision-news", {
      name: "MFN/Cision news adapter",
      cacheTtlMs: 180000,
      retries: 1,
    }, () => getProviderNews(tickers.map((ticker) => `${ticker}.ST`))),
    runProviderRequest("market-data", {
      name: "Svensk market data",
      cacheTtlMs: 30000,
      retries: 1,
    }, () => getYahooQuotes(tickers.map((ticker) => `${ticker}.ST`))),
    runProviderRequest("reddit-velocity", {
      name: "Reddit/X velocity",
      cacheTtlMs: 120000,
      retries: 1,
    }, () => fetchRedditMentions(tickers)),
  ]);

  return {
    insiderEvents: insider.data ?? [],
    news: news.data ?? [],
    marketQuotes: market.data ?? [],
    socialMentions: reddit.data ?? [],
    health: [insider.health, news.health, market.health, reddit.health],
  };
}
