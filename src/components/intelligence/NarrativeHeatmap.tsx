import type { IntelligenceReport } from "@/lib/intelligence/mockData";

export function NarrativeHeatmap({
  narratives,
}: {
  narratives: IntelligenceReport["strongestNarratives"];
}) {
  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
      <p className="text-zinc-500 text-sm">Emerging Narratives</p>
      <div className="mt-4 grid gap-3">
        {narratives.slice(0, 5).map((item) => (
          <div key={`${item.ticker}-${item.narrative}`}>
            <div className="flex justify-between text-sm">
              <span>{item.ticker} · {item.narrative}</span>
              <span className="text-zinc-500">{item.strength}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-cyan-300" style={{ width: `${item.strength}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
