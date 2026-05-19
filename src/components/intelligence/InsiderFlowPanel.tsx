import type { IntelligenceReport } from "@/lib/intelligence/mockData";

export function InsiderFlowPanel({ report }: { report: IntelligenceReport }) {
  const insiders = [...report.inputs].sort((a, b) => b.insider.score - a.insider.score);

  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
      <p className="text-zinc-500 text-sm">Insider Accumulation</p>
      <div className="mt-4 grid gap-3">
        {insiders.slice(0, 4).map((item, index) => (
          <div key={`${item.ticker}-${item.insider.score}-${index}`} className="flex justify-between gap-4">
            <div>
              <p className="font-bold">{item.ticker}</p>
              <p className="text-zinc-500 text-xs">{item.insider.reasons[0]}</p>
            </div>
            <p className="text-emerald-300 font-bold">{item.insider.score}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
