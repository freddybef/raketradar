import type { SignalFeedItem } from "@/lib/intelligence/feed/buildSignalFeed";
import { SignalFeedCard } from "./SignalFeedCard";

export function SignalFeed({ items }: { items: SignalFeedItem[] }) {
  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <p className="text-zinc-500 text-sm">Live Signal Feed</p>
          <h2 className="text-2xl font-bold">Något håller på att hända</h2>
        </div>
        <span className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm">
          {items.length} events
        </span>
      </div>
      <div className="mt-3">
        {items.slice(0, 10).map((item) => (
          <SignalFeedCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
