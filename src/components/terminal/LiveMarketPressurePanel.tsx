import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { LiveMarketReaction, TerminalSetup } from "@/components/terminal/types";

function collectReactions(setups: TerminalSetup[]) {
  const map = new Map<string, LiveMarketReaction>();
  setups.forEach((setup) => {
    if (setup.liveMarketReaction) map.set(setup.liveMarketReaction.ticker, setup.liveMarketReaction);
  });
  return [...map.values()].sort((a, b) => b.marketAggression - a.marketAggression);
}

function tone(label: string): "good" | "warn" | "risk" | "neutral" {
  if (label === "EARLY_CONTINUATION" || label === "EARLY_MOMENTUM" || label === "CONTINUATION" || label === "STEALTH_STRENGTH") return "good";
  if (label === "FAKE_SPIKE" || label === "PARABOLIC_RISK") return "risk";
  if (label === "LATE_BREAKOUT" || label === "PULLBACK_VALID" || label === "REACCELERATION_WATCH") return "warn";
  return "neutral";
}

function label(label: string) {
  if (label === "EARLY_MOMENTUM" || label === "EARLY_CONTINUATION") return "Momentum lever";
  if (label === "CONTINUATION") return "Continuation";
  if (label === "PULLBACK_VALID") return "Vanta trigger";
  if (label === "REACCELERATION_WATCH") return "Reacceleration";
  if (label === "PARABOLIC_RISK") return "No chase";
  if (label === "FAKE_SPIKE") return "Hog risk";
  if (label === "STEALTH_STRENGTH") return "Stealth";
  return "Bevaka";
}

export function LiveMarketPressurePanel({ setups }: { setups: TerminalSetup[] }) {
  const reactions = collectReactions(setups);
  const momentumLeaders = [...reactions]
    .filter((item) => item.fadeProbability < 70)
    .sort((a, b) => b.marketAggression + b.continuationProbability - (a.marketAggression + a.continuationProbability))
    .slice(0, 6);
  const noChase = [...reactions]
    .filter((item) => item.fadeProbability >= 70 || item.label === "PARABOLIC_RISK" || item.label === "FAKE_SPIKE")
    .sort((a, b) => b.fadeProbability - a.fadeProbability)
    .slice(0, 6);

  return (
    <TerminalPanel title="Momentum Leaders" eyebrow="merged live movers">
      {reactions.length === 0 ? (
        <EmptyTerminalState title="Ingen live market pressure" body="Yahoo Nordic returnerade inga verifierade svenska live-rörelser just nu." />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <PressureBucket title="Momentum Leaders" items={momentumLeaders} metric={(item) => `${item.intradayMomentum}% / RVOL ${item.relativeVolume} / ${item.continuationProbability}% cont`} />
          <PressureBucket title="High Risk / No Chase" items={noChase} metric={(item) => `${item.intradayMomentum}% move / ${item.fadeProbability}% fade`} />
        </div>
      )}
    </TerminalPanel>
  );
}

function PressureBucket({
  title,
  items,
  metric,
}: {
  title: string;
  items: LiveMarketReaction[];
  metric: (item: LiveMarketReaction) => string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Ingen signal.</p>
      ) : (
        <div className="grid gap-2">
          {items.map((item, index) => (
            <div key={`${title}-${item.ticker}-${item.asOf}-${index}`} className="border-b border-zinc-900 pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-zinc-100">{item.ticker}</p>
                  <p className="text-xs text-zinc-500">{item.companyName}</p>
                </div>
                <SignalPill tone={tone(item.label)}>{label(item.label)}</SignalPill>
              </div>
              <p className="mt-1 text-sm text-zinc-300">{metric(item)}</p>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-zinc-500">Detaljer</summary>
                <p className="mt-1 text-xs text-zinc-500">{item.reason}</p>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
