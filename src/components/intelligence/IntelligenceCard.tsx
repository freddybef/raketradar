import type { RankingInput } from "@/lib/intelligence/ranking/rankStocks";
import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";
import { InsiderSignalBadge } from "./InsiderSignalBadge";
import { NarrativeTag } from "./NarrativeTag";
import { SocialHeatMeter } from "./SocialHeatMeter";
import { SqueezeBadge } from "./SqueezeBadge";

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-300";
  if (score >= 72) return "text-lime-300";
  if (score >= 58) return "text-yellow-300";
  return "text-zinc-300";
}

export function IntelligenceCard({
  stock,
  input,
}: {
  stock: RankedStock;
  input: RankingInput;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-3xl font-bold">{stock.ticker}</h3>
            <NarrativeTag narrative={input.narrative} />
          </div>
          <p className="text-zinc-400 mt-2">
            Hedgefond-terminal: social, insider, squeeze och narrativ i samma ranking.
          </p>
        </div>
        <div className="text-right">
          <p className={`text-4xl font-bold ${scoreColor(stock.totalScore)}`}>
            {stock.totalScore}
          </p>
          <p className="text-zinc-500 text-sm">Intelligence score</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <SocialHeatMeter social={input.social} />
        <SqueezeBadge squeeze={input.squeeze} />
        <InsiderSignalBadge insider={input.insider} />
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-zinc-500 text-sm mb-2">Edge-skäl</p>
          <div className="grid gap-2">
            {stock.reasons.slice(0, 4).map((reason) => (
              <p key={reason} className="text-zinc-200 text-sm">
                {reason}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-zinc-500 text-sm mb-2">Risker</p>
          <div className="grid gap-2">
            {stock.risks.slice(0, 4).map((risk) => (
              <p key={risk} className="text-zinc-400 text-sm">
                {risk}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2 flex-wrap">
        {stock.tags.map((tag) => (
          <span
            key={tag}
            className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
