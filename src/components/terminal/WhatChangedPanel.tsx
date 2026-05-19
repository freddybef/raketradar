"use client";

import type { IntelligenceChangesReport } from "@/components/terminal/types";
import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";

function label(changeType: string) {
  const labels: Record<string, string> = {
    newEntrant: "Nytt case",
    movedUp: "Upp",
    movedDown: "Ner",
    dropped: "Droppad",
    stateChanged: "State ändrad",
    confidenceChanged: "Confidence",
    riskChanged: "Risk",
  };
  return labels[changeType] ?? changeType;
}

function tone(severity: string) {
  if (severity === "HIGH") return "risk" as const;
  if (severity === "MEDIUM") return "warn" as const;
  return "neutral" as const;
}

export function WhatChangedPanel({ changes }: { changes: IntelligenceChangesReport | null }) {
  const rows = changes?.changes ?? [];
  return (
    <TerminalPanel
      title="Vad har ändrats?"
      eyebrow="re-ranking"
      action={<SignalPill tone={changes?.latestRun?.status === "success" ? "good" : "warn"}>{changes?.latestRun?.status ?? "ingen run"}</SignalPill>}
    >
      <div className="grid gap-3">
        {changes?.latestRun && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Mini label="Senaste run" value={new Date(changes.latestRun.finishedAt ?? changes.latestRun.startedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} />
            <Mini label="Reason" value={changes.latestRun.reason} />
            <Mini label="Jobs" value={String(changes.latestRun.jobs.length)} />
            <Mini label="Latency" value={`${changes.latestRun.latencyMs}ms`} />
          </div>
        )}

        {changes?.persistence === "missing_supabase" && (
          <EmptyTerminalState title="Change memory saknas" body="Kör RUN_THIS_IN_SUPABASE.sql för att spara intelligence_runs, ranking_changes och snapshots." />
        )}

        {rows.length === 0 ? (
          <EmptyTerminalState title="Inga sparade förändringar än" body="Kör Run scan now för att skapa första re-ranking-diffen." />
        ) : (
          <div className="grid gap-2">
            {rows.slice(0, 12).map((change, index) => (
              <div key={`${change.ticker}-${change.changeType}-${index}`} className="border border-zinc-800 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-zinc-100">{change.ticker}</p>
                    <p className="mt-1 text-sm text-zinc-300">{change.reason}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {change.previousValue ?? "-"} → {change.currentValue ?? "-"}
                    </p>
                  </div>
                  <SignalPill tone={tone(change.severity)}>{label(change.changeType)}</SignalPill>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TerminalPanel>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-mono text-sm text-zinc-200">{value}</p>
    </div>
  );
}
