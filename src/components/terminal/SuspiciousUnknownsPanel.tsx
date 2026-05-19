"use client";

import type { SuspiciousUnknownsReport } from "@/components/terminal/types";
import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";

export function SuspiciousUnknownsPanel({ report }: { report: SuspiciousUnknownsReport | null }) {
  const candidates = report?.candidates ?? [];
  return (
    <TerminalPanel
      title="Suspicious Unknowns"
      eyebrow="coverage intelligence"
      action={<SignalPill tone={candidates.length ? "warn" : "neutral"}>{candidates.length}</SignalPill>}
    >
      {candidates.length === 0 ? (
        <EmptyTerminalState title="Inga suspicious unknowns just nu" body="Coverage gaps visas här när användarfrågor, feedback eller learning tyder på möjlig false negative-risk." />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {candidates.slice(0, 8).map((item) => (
            <div key={`${item.ticker}-${item.suspicionLevel}`} className="border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-zinc-100">{item.ticker}</p>
                  <p className="text-xs text-zinc-500">{item.inferredSector ?? "sector okänd"} / {item.inferredMarket ?? "market okänd"}</p>
                </div>
                <SignalPill tone={item.suspicionLevel === "likely_hidden_runner" ? "warn" : "neutral"}>{item.suspicionLevel}</SignalPill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Mini label="suspicion" value={item.unknownScore} />
                <Mini label="false negative" value={item.falseNegativeRisk} />
                <Mini label="coverage" value={item.coverageLevel} />
                <Mini label="mentions" value={item.repeatedMentions} />
              </div>
              <p className="mt-3 text-xs text-zinc-400">{item.reasoning.slice(0, 2).join(" / ")}</p>
              {item.possiblePeers.length ? (
                <p className="mt-2 font-mono text-[11px] text-zinc-500">peers: {item.possiblePeers.join(", ")}</p>
              ) : null}
              <p className="mt-2 text-[11px] text-yellow-300">Inte köp-signal. Kräver coverage expansion/verifiering.</p>
            </div>
          ))}
        </div>
      )}
    </TerminalPanel>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-zinc-900 bg-black/30 p-2">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="font-mono text-sm text-zinc-200">{value}</p>
    </div>
  );
}
