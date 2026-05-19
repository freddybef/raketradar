import type { IntelligenceReport } from "@/lib/intelligence/mockData";

export function SocialMomentumPanel({ report }: { report: IntelligenceReport }) {
  const social = [...report.inputs].sort((a, b) => b.social.score - a.social.score);

  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
      <p className="text-zinc-500 text-sm">Social Momentum</p>
      <div className="mt-4 grid gap-3">
        {social.slice(0, 4).map((item, index) => (
          <div key={`${item.ticker}-${item.social.score}-${index}`}>
            <div className="flex justify-between text-sm">
              <span className="font-bold">{item.ticker}</span>
              <span className="text-zinc-500">
                velocity {item.social.velocityScore}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-green-300" style={{ width: `${item.social.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
