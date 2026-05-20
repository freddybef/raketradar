import type { SignalFeedItem } from "./intelligence/feed/buildSignalFeed";
import { calculateAlertPriority } from "./intelligence/alerts/priorityEngine";

export function selectHighConvictionAlerts(items: SignalFeedItem[]) {
  const seen = new Set<string>();

  return items
    .map((item) => ({ item, priority: calculateAlertPriority(item) }))
    .filter(({ item, priority }) => {
      const key = `${item.ticker}-${item.type}`;
      if (seen.has(key)) return false;
      seen.add(key);

      return (
        priority.priority === "HIGH" ||
        priority.priority === "EXTREME" ||
        item.tags.includes("confluence")
      );
    })
    .slice(0, 8);
}
