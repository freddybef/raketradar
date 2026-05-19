import type { InsiderSignal } from "@/lib/intelligence/insider/insiderTypes";

export function InsiderSignalBadge({ insider }: { insider: InsiderSignal }) {
  const color =
    insider.direction === "bullish"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
      : insider.direction === "bearish"
        ? "border-red-500/30 bg-red-500/15 text-red-200"
        : "border-zinc-800 bg-zinc-950 text-zinc-300";

  return (
    <div className={`border rounded-xl px-3 py-2 ${color}`}>
      <p className="text-xs opacity-80">Insider</p>
      <p className="font-bold">{insider.score}/100</p>
    </div>
  );
}
