"use client";

import type { AgentLoopReport } from "@/components/terminal/types";
import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";

function toneFor(severity: string) {
  if (severity === "EXTREME" || severity === "HIGH") return "risk" as const;
  if (severity === "MEDIUM") return "warn" as const;
  return "neutral" as const;
}

export function AgentAlertsPanel({ agent }: { agent: AgentLoopReport | null }) {
  const alerts = agent?.alerts ?? [];
  const stateCounts = (agent?.cases ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.state] = (acc[item.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <TerminalPanel
      title="Agent Alerts"
      eyebrow="state machine"
      action={<SignalPill tone={agent?.persistence === "active" ? "good" : "warn"}>{agent?.sessionMode ?? "offline"}</SignalPill>}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(stateCounts).map(([state, count]) => (
            <SignalPill key={state} tone={state.includes("RISK") || state === "REJECTED" ? "risk" : state.includes("HIGH") ? "good" : "neutral"}>
              {state}: {count}
            </SignalPill>
          ))}
        </div>

        {alerts.length === 0 ? (
          <EmptyTerminalState title="Inga agentlarm just nu" body="State machine ser inga nya uppgraderingar, fade-varningar eller parabolic-risklarm." />
        ) : (
          <div className="grid gap-2">
            {alerts.slice(0, 8).map((alert, index) => (
              <div key={`${alert.id}-${alert.ticker}-${index}`} className="border border-zinc-800 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-zinc-100">{alert.ticker}</p>
                    <p className="mt-1 text-sm text-zinc-300">{alert.message}</p>
                  </div>
                  <SignalPill tone={toneFor(alert.severity)}>{alert.alertType}</SignalPill>
                </div>
              </div>
            ))}
          </div>
        )}

        {agent?.persistence === "missing_supabase" && (
          <EmptyTerminalState title="Agent memory saknar Supabase" body="Kör SQL-migrationen och sätt SUPABASE_SERVICE_ROLE_KEY för att spara state changes, alerts och feedback." />
        )}
      </div>
    </TerminalPanel>
  );
}
