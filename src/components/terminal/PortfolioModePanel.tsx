import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import { isDoNotChase } from "@/components/terminal/decision";
import type { LearningReport, TerminalDebug, TerminalSetup } from "@/components/terminal/types";

function stateFor(setup: TerminalSetup) {
  if (isDoNotChase(setup)) return "jaga inte";
  if (setup.adaptiveConfidenceDelta >= 10 || setup.confidence >= 70) return "starkande innehav";
  if (setup.falsePositiveRisk >= 60 || setup.avgFadeRisk >= 8) return "svagare innehav";
  return "ingen atgard";
}

function continuationProbability(setup: TerminalSetup, learning: LearningReport | null) {
  const combo = learning?.bestTriggerCombos.find((item) => setup.tags.some((tag) => item.key.includes(tag.toLowerCase()))) ?? learning?.bestTriggerCombos[0];
  return Math.max(0, Math.min(100, Math.round(setup.confidence * 0.45 + setup.historicalSetupWinrate * 0.25 + (combo?.winRate ?? 50) * 0.3)));
}

export function PortfolioModePanel({
  setups,
  learning,
  debug,
}: {
  setups: TerminalSetup[];
  learning: LearningReport | null;
  debug: TerminalDebug | null;
}) {
  const missingMarket = debug?.outcomeCollector?.missingMarketDataByTicker ?? [];

  return (
    <TerminalPanel title="Portfolio Mode" eyebrow="holdings / watchlist awareness">
      {setups.length === 0 ? (
        <EmptyTerminalState title="Ingen watchlist-signal" body="Inga verifierade kandidater finns att koppla mot portföljläge just nu." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[6rem_8rem_10rem_7rem_8rem_1fr_8rem_7rem] gap-3 border-b border-zinc-800 pb-2 text-xs text-zinc-500">
              <span>Ticker</span>
              <span>Conviction</span>
              <span>Beslut</span>
              <span>Insider</span>
              <span>News</span>
              <span>Risk</span>
              <span>Do not chase</span>
              <span>Cont prob</span>
            </div>
            {setups.map((setup, index) => {
              const state = stateFor(setup);
              const missing = missingMarket.find((item) => item.ticker === setup.ticker);
              const doNotChase = isDoNotChase(setup);
              const tone = state === "starkande innehav" ? "good" : state === "svagare innehav" || state === "jaga inte" ? "risk" : "warn";

              return (
                <div key={`${setup.ticker}-${setup.trigger}-${index}-portfolio`} className="grid grid-cols-[6rem_8rem_10rem_7rem_8rem_1fr_8rem_7rem] gap-3 border-b border-zinc-900 py-3 text-sm last:border-b-0">
                  <span className="font-mono font-semibold">{setup.ticker}</span>
                  <span className="font-mono text-emerald-300">{setup.confidence}</span>
                  <span>
                    <SignalPill tone={tone}>{state}</SignalPill>
                  </span>
                  <span className={setup.tags.includes("insider") ? "text-emerald-300" : "text-zinc-500"}>{setup.tags.includes("insider") ? "aktiv" : "svag"}</span>
                  <span className="truncate text-zinc-300">{setup.catalyst || setup.trigger}</span>
                  <span className="truncate text-zinc-400">
                    risk {setup.risk}/100 · FP {setup.falsePositiveRisk}%{missing ? ` · saknar ${missing.horizons.join("/")}` : ""}
                  </span>
                  <span>
                    <SignalPill tone={doNotChase ? "risk" : "neutral"}>{doNotChase ? "JA" : "NEJ"}</SignalPill>
                  </span>
                  <span className="font-mono text-zinc-200">{continuationProbability(setup, learning)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </TerminalPanel>
  );
}
