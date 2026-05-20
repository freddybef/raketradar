import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import type { CrowdingSignal } from "./crowdingDetector";

export function throttleAlerts(
  items: SignalFeedItem[],
  crowding: CrowdingSignal[],
  recentKeys: string[] = []
) {
  const recent = new Set(recentKeys);
  const crowdingMap = new Map(crowding.map((item) => [item.ticker, item]));
  const emitted = new Set<string>();

  return items.filter((item) => {
    const key = `${item.ticker}-${item.type}`;
    const crowded = crowdingMap.get(item.ticker)?.crowdingScore ?? 0;

    if (recent.has(key) || emitted.has(key)) return false;
    if (crowded >= 72) return false;
    if ((item.priority ?? "LOW") === "LOW") return false;
    if (item.tags.includes("parabolisk")) return false;

    emitted.add(key);
    return true;
  });
}
