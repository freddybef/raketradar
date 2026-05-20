import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import { intelligenceEventBus } from "./eventBus";

export interface SignalStreamState {
  items: SignalFeedItem[];
  lastEventAt: string | null;
}

export function streamSignalItems(items: SignalFeedItem[]) {
  for (const item of items) {
    intelligenceEventBus.publish("signal:new", item);
  }

  intelligenceEventBus.publish("stream:heartbeat", {
    count: items.length,
  });
}

export function createSignalStreamState(items: SignalFeedItem[]): SignalStreamState {
  return {
    items,
    lastEventAt: items[0]?.timestamp ?? null,
  };
}
