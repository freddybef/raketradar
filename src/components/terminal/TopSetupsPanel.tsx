import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import { decisionText, displayActionLabel, humanActionLabel, isActionableSetup, isDoNotChase, isParabolicNoChase } from "@/components/terminal/decision";
import type { TerminalSetup } from "@/components/terminal/types";

function actionTone(action: string): "good" | "warn" | "risk" | "neutral" {
  const normalized = action.toLowerCase();
  if (normalized.includes("high_risk")) return "warn";
  if (normalized.includes("avoid") || normalized.includes("ignore")) return "risk";
  if (normalized.includes("buy") || normalized.includes("add") || normalized.includes("prepare")) return "good";
  if (normalized.includes("watch")) return "warn";
  return "neutral";
}

function actionLabel(setup: TerminalSetup) {
  return displayActionLabel(setup);
}

export function TopSetupsPanel({ setups, onSelect }: { setups: TerminalSetup[]; onSelect?: (setup: TerminalSetup) => void }) {
  return (
    <TerminalPanel title="Top Setups Today" eyebrow="pre-open decisions">
      {setups.length === 0 ? (
        <EmptyTerminalState
          title="Ingen verifierad setup"
          body="När live feeds och ticker identity-gaten hittar godkända case visas de här. Terminalen visar bara verifierade signaler."
        />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-[6rem_10rem_5rem_10rem_5rem_1.4fr_8rem_6rem_6rem_6rem_6rem] gap-3 border-b border-zinc-800 pb-2 text-xs text-zinc-500">
              <span>Ticker</span>
              <span>Company</span>
              <span>Score</span>
              <span>Action</span>
              <span>Conf</span>
              <span>Beslut</span>
              <span>Catalyst</span>
              <span>Combo</span>
              <span>Winrate</span>
              <span>Cont</span>
              <span>Fade</span>
            </div>
            {setups.slice(0, 7).map((setup, index) => (
              <div
                key={`${setup.ticker}-${setup.trigger}-${setup.openingAction}-${index}`}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={() => onSelect?.(setup)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSelect?.(setup);
                }}
                className="grid cursor-pointer grid-cols-[6rem_10rem_5rem_10rem_5rem_1.4fr_8rem_6rem_6rem_6rem_6rem] gap-3 border-b border-zinc-900 py-3 text-sm hover:bg-emerald-500/5 last:border-b-0"
              >
                <div>
                  <p className="font-mono font-semibold text-zinc-100">{setup.ticker}</p>
                  <p className="text-[11px] text-zinc-500">{setup.exchange}</p>
                </div>
                <span className="truncate text-zinc-300">{setup.companyName}</span>
                <span className="font-mono text-emerald-300">{setup.preOpenScore}</span>
                <span>
                  <SignalPill tone={isParabolicNoChase(setup) ? "warn" : isDoNotChase(setup) ? "risk" : isActionableSetup(setup) ? "good" : actionTone(setup.openingAction)}>
                    {actionLabel(setup)}
                  </SignalPill>
                  <span className="mt-1 block text-[11px] text-zinc-500">{humanActionLabel(setup.openingAction)}</span>
                </span>
                <span className="font-mono text-zinc-200">{setup.confidence}</span>
                <span className="text-zinc-300" title={decisionText(setup)}>
                  {decisionText(setup)}
                </span>
                <span className="truncate text-zinc-400">{setup.catalyst || setup.trigger}</span>
                <span className="font-mono text-yellow-200">
                  {setup.tags.includes("Discovery HOT") ? "DISC HOT" : setup.tags.includes("Stealth mover") ? "STEALTH" : setup.triggerComboGrade}
                </span>
                <span className="font-mono text-zinc-300">{setup.historicalSetupWinrate}%</span>
                <span className="font-mono text-zinc-300">{setup.avgContinuation}</span>
                <div className="font-mono">
                  <span className={setup.avgFadeRisk >= 7 || setup.falsePositiveRisk >= 60 ? "text-red-300" : "text-zinc-300"}>
                    {setup.avgFadeRisk}%
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    ΔC {setup.adaptiveConfidenceDelta >= 0 ? "+" : ""}
                    {setup.adaptiveConfidenceDelta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </TerminalPanel>
  );
}
