import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { TerminalRejectedCandidate, TerminalWarRoom } from "@/components/terminal/types";

function reasonTone(reason: string): "risk" | "warn" | "neutral" {
  if (/unresolved|conflict|confidence|collision|non_swedish/i.test(reason)) return "risk";
  if (/score|risk|ignore|chase/i.test(reason)) return "warn";
  return "neutral";
}

export function WarRoomLivePanel({ warRoom, onRejectedSelect }: { warRoom: TerminalWarRoom | null; onRejectedSelect?: (item: TerminalRejectedCandidate) => void }) {
  const accepted = warRoom?.topPreOpenSetups ?? [];
  const rejected = warRoom?.rejectedCandidates ?? [];

  return (
    <TerminalPanel
      title="War Room Live"
      eyebrow="accepted / rejected"
      action={<SignalPill tone={warRoom?.feedStatus.status === "healthy" ? "good" : "warn"}>{warRoom?.feedStatus.status ?? "loading"}</SignalPill>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-300">Accepted</p>
            <span className="font-mono text-xs text-zinc-500">{accepted.length}</span>
          </div>
          <div className="grid gap-2">
            {accepted.length === 0 ? (
              <EmptyTerminalState title="Inga accepterade case" body="Bättre tomt än fel ticker. Live-data saknar verifierade setups just nu." />
            ) : (
              accepted.map((item, index) => (
                <div key={`${item.ticker}-${item.trigger}-${index}-accepted-live`} className="border border-zinc-800 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono font-semibold">{item.ticker}</p>
                      <p className="text-xs text-zinc-500">{item.companyName}</p>
                    </div>
                    <SignalPill tone={item.risk >= 70 ? "risk" : "good"}>{item.preOpenScore}/100</SignalPill>
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">{item.whyNow}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <SignalPill>{item.exchange}</SignalPill>
                    <SignalPill>ticker {item.tickerConfidence}</SignalPill>
                    <SignalPill tone={item.falsePositiveRisk >= 60 ? "risk" : "neutral"}>FP {item.falsePositiveRisk}%</SignalPill>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-red-300">Rejected</p>
            <span className="font-mono text-xs text-zinc-500">{rejected.length}</span>
          </div>
          <div className="grid gap-2">
            {rejected.length === 0 ? (
              <EmptyTerminalState title="Inga rejection events" body="Ticker identity-gaten har inget att rapportera i senaste körningen." />
            ) : (
              rejected.slice(0, 8).map((item, index) => {
                const reason = item.rejectedBecause[0] ?? "unknown";
                return (
                  <div
                    key={`${item.ticker}-${reason}-${index}-rejected-live`}
                    role={onRejectedSelect ? "button" : undefined}
                    tabIndex={onRejectedSelect ? 0 : undefined}
                    onClick={() => onRejectedSelect?.(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onRejectedSelect?.(item);
                    }}
                    className="cursor-pointer border border-zinc-800 bg-black/20 p-3 hover:border-red-500/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono font-semibold">{item.ticker}</p>
                        <p className="text-xs text-zinc-500">{item.trigger}</p>
                      </div>
                      <SignalPill tone={reasonTone(reason)}>{reason}</SignalPill>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                      <span>Confidence {item.tickerValidation?.identity.sourceConfidence ?? 0}/100</span>
                      <span>Exchange {item.tickerValidation?.identity.exchange ?? "unknown"}</span>
                      <span className="col-span-2 truncate">{item.rejectedBecause.join(" · ")}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </TerminalPanel>
  );
}
