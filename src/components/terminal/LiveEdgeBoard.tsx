import type { DecisionItem } from "@/components/terminal/decision";
import { buildCaseSummary } from "@/components/terminal/caseSummary";
import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { IntelligenceChangesReport, TerminalSetup } from "@/components/terminal/types";

function changeFor(ticker: string, changes: IntelligenceChangesReport | null) {
  const change = changes?.changes?.find((item) => item.ticker === ticker);
  if (!change) return "-";
  if (change.changeType === "newEntrant") return "Ny";
  if (change.changeType === "movedUp") return "Upp";
  if (change.changeType === "movedDown") return "Ner";
  if (change.changeType === "riskChanged") return "Risk";
  if (change.changeType === "stateChanged") return "State";
  return change.changeType;
}

function tone(summary: ReturnType<typeof buildCaseSummary>): "good" | "warn" | "risk" | "neutral" {
  if (summary.action === "Agera") return "good";
  if (summary.action === "Het men jaga inte") return "warn";
  if (summary.action === "Undvik" || summary.risk === "Hog") return "risk";
  return "neutral";
}

export function LiveEdgeBoard({
  setups,
  decisions,
  changes,
  onSelect,
}: {
  setups: TerminalSetup[];
  decisions: DecisionItem[];
  changes: IntelligenceChangesReport | null;
  onSelect?: (setup: TerminalSetup) => void;
}) {
  const avoidTickers = new Set(decisions.filter((item) => item.source === "rejected").map((item) => item.ticker));
  const rows = setups
    .filter((setup) => !avoidTickers.has(setup.ticker))
    .slice(0, 10);

  return (
    <TerminalPanel title="Live Edge Board" eyebrow="case-first cockpit">
      {rows.length === 0 ? (
        <EmptyTerminalState title="Inga verifierade case just nu" body="Systemet visar hellre tomt än fel ticker eller mockdata." />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[6rem_11rem_7rem_7rem_11rem_1fr_7rem] gap-3 border-b border-zinc-800 pb-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <span>Ticker</span>
              <span>Edge/setup</span>
              <span>Cont</span>
              <span>Risk</span>
              <span>Action</span>
              <span>Varfor</span>
              <span>Andrat</span>
            </div>
            {rows.map((setup, index) => (
              (() => {
                const summary = buildCaseSummary(setup);
                return (
              <button
                key={`${setup.ticker}-${setup.trigger}-${index}-edge-board`}
                type="button"
                onClick={() => onSelect?.(setup)}
                className="grid w-full grid-cols-[6rem_11rem_7rem_7rem_11rem_1fr_7rem] gap-3 border-b border-zinc-900 py-3 text-left text-sm hover:bg-emerald-500/5 last:border-b-0"
              >
                <span>
                  <span className="block font-mono font-semibold text-zinc-100">{setup.ticker}</span>
                  <span className="block text-[11px] text-zinc-600">{setup.exchange}</span>
                </span>
                <span className="text-zinc-300">{summary.edge}</span>
                <span className="font-mono text-zinc-100">{summary.live?.continuation ?? setup.avgContinuation}%</span>
                <span><SignalPill tone={summary.risk === "Hog" ? "risk" : summary.risk === "Medium" ? "warn" : "neutral"}>{summary.risk}</SignalPill></span>
                <span><SignalPill tone={tone(summary)}>{summary.action}</SignalPill></span>
                <span className="truncate text-zinc-400" title={summary.why}>{summary.why}</span>
                <span className="font-mono text-xs text-zinc-500">{changeFor(setup.ticker, changes)}</span>
              </button>
                );
              })()
            ))}
          </div>
        </div>
      )}
    </TerminalPanel>
  );
}
