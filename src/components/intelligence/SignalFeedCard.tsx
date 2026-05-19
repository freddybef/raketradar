import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";

function priorityStyle(priority: SignalFeedItem["priority"]) {
  if (priority === "EXTREME") return "text-red-200 border-red-500/30 bg-red-500/15";
  if (priority === "HIGH") return "text-orange-200 border-orange-500/30 bg-orange-500/15";
  if (priority === "MEDIUM") return "text-yellow-200 border-yellow-500/30 bg-yellow-500/15";
  return "text-zinc-300 border-zinc-700 bg-zinc-900";
}

export function SignalFeedCard({ item }: { item: SignalFeedItem }) {
  return (
    <div className="grid grid-cols-[5rem_1fr_auto] gap-3 border-b border-zinc-800 py-3 last:border-b-0">
      <div>
        <p className="font-bold">{item.ticker}</p>
        <p className="text-zinc-500 text-xs">{item.type}</p>
      </div>
      <div>
        <p className="text-zinc-100 font-semibold">{item.title}</p>
        <p className="text-zinc-500 text-sm mt-1">{item.description}</p>
        <div className="mt-2 flex gap-2 flex-wrap">
          {item.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-zinc-500 text-xs">
              #{tag}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right">
        <span
          className={`border px-2 py-1 rounded-full text-xs ${priorityStyle(
            item.priority
          )}`}
        >
          {item.priority}
        </span>
        <p className="text-zinc-200 font-bold mt-2">{item.score}</p>
        <p className="text-zinc-500 text-xs">conf {item.confidence}</p>
      </div>
    </div>
  );
}
