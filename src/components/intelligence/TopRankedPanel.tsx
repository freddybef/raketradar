import type { RankedStock } from "@/lib/intelligence/ranking/rankStocks";

export function TopRankedPanel({ stocks }: { stocks: RankedStock[] }) {
  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
      <p className="text-zinc-500 text-sm">Top Conviction</p>
      <div className="mt-4 grid gap-3">
        {stocks.slice(0, 5).map((stock, index) => (
          <div key={`${stock.ticker}-${stock.totalScore}-${index}`} className="grid grid-cols-[2rem_1fr_auto] gap-3 items-center">
            <p className="text-zinc-500">{index + 1}</p>
            <div>
              <p className="font-bold">{stock.ticker}</p>
              <p className="text-zinc-500 text-xs">{stock.reasons[0]}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-300">{stock.totalScore}</p>
              <p className="text-zinc-500 text-xs">conv {stock.conviction}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
