import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";

export interface LatencyLanes {
  fastLane: SignalFeedItem[];
  slowLane: string[];
}

export function splitLatencyLanes(feed: SignalFeedItem[]): LatencyLanes {
  return {
    fastLane: feed.filter((item) =>
      ["squeeze", "insider", "momentum", "volume"].includes(item.type)
    ),
    slowLane: [
      "AI summaries",
      "Analog reasoning",
      "Historical comparison",
      "Trade review synthesis",
    ],
  };
}
