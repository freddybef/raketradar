import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";

export interface SignalTimelineItem {
  ticker: string;
  label: string;
  value: string;
  timestamp: string;
}

export function buildSignalTimeline(stock: RankedStock, feed: SignalFeedItem[]) {
  const items: SignalTimelineItem[] = feed
    .filter((item) => item.ticker === stock.ticker)
    .map((item) => ({
      ticker: stock.ticker,
      label: item.type,
      value: `${item.title} (${item.score}/100)`,
      timestamp: item.timestamp,
    }));

  items.push({
    ticker: stock.ticker,
    label: "edge",
    value: `Edge ${stock.totalScore}/100, conviction ${stock.conviction}/100`,
    timestamp: new Date().toISOString(),
  });

  return items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
