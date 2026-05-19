"use client";

import type { AutonomyStatusReport, OvernightSummaryReport } from "@/components/terminal/types";
import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";

export type AutonomyPreset = "off" | "market-open" | "intraday" | "evening" | "overnight";

const LABELS: Record<AutonomyPreset, string> = {
  off: "off",
  "market-open": "market-open / 1m",
  intraday: "intraday / 5m",
  evening: "evening / 15m",
  overnight: "overnight / 30m",
};

export function intervalForPreset(preset: AutonomyPreset) {
  if (preset === "market-open") return 60_000;
  if (preset === "intraday") return 5 * 60_000;
  if (preset === "evening") return 15 * 60_000;
  if (preset === "overnight") return 30 * 60_000;
  return null;
}

export function jobsForPreset(preset: AutonomyPreset) {
  if (preset === "overnight" || preset === "evening") return ["discovery", "warRoom", "agentLoop", "outcomes", "health"];
  return ["marketReaction", "discovery", "warRoom", "agentLoop", "health"];
}

export function AutonomyPanel({
  preset,
  onPresetChange,
  status,
  statusText,
  summary,
  onStart,
  onStop,
  onRunHarvest,
  onGenerateSummary,
}: {
  preset: AutonomyPreset;
  onPresetChange: (preset: AutonomyPreset) => void;
  status: AutonomyStatusReport | null;
  statusText: string;
  summary: OvernightSummaryReport | null;
  onStart: () => void;
  onStop: () => void;
  onRunHarvest: () => void;
  onGenerateSummary: () => void;
}) {
  const interval = status?.intervalMs ?? intervalForPreset(preset);
  const dbSession = status?.databaseSession;

  return (
    <TerminalPanel
      title="Autonomy / Overnight Learning"
      eyebrow="server runner"
      action={<SignalPill tone={status?.status === "running" ? "good" : status?.status === "error" ? "warn" : "neutral"}>{status?.status ?? "idle"}</SignalPill>}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Mini label="Mode" value={status?.mode ?? preset} />
          <Mini label="Interval" value={interval ? `${Math.round(interval / 1000)}s` : "-"} />
          <Mini label="Runs" value={String(status?.runCount ?? dbSession?.runCount ?? 0)} />
          <Mini label="Observations" value={String(status?.observationsSaved ?? dbSession?.observationsCount ?? 0)} />
          <Mini label="Last run" value={status?.lastRunAt ? new Date(status.lastRunAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) : "-"} />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["off", "market-open", "intraday", "evening", "overnight"] as AutonomyPreset[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onPresetChange(option)}
              className={`border px-3 py-2 text-xs ${preset === option ? "border-emerald-500/60 text-emerald-200" : "border-zinc-800 text-zinc-300"}`}
            >
              {LABELS[option]}
            </button>
          ))}
          <button type="button" onClick={onStart} className="border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200 hover:border-emerald-400">
            Start autonomy
          </button>
          <button type="button" onClick={onStop} className="border border-red-500/30 px-3 py-2 text-xs text-red-200 hover:border-red-400">
            Stop autonomy
          </button>
          <button type="button" onClick={onRunHarvest} className="border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-yellow-500/50">
            Run learning harvest now
          </button>
          <button type="button" onClick={onGenerateSummary} className="border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-emerald-500/50">
            Generate summary
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Server-side autonomy kor bara medan Next.js-processen ar igang i local dev. Den triggar data/agent-runnern, aldrig Copilot/OpenAI.
        </p>
        <p className="text-xs text-zinc-400">{statusText}</p>
        {status?.lastError ? <p className="text-xs text-red-300">{status.lastError}</p> : null}

        {summary ? (
          <div className="grid gap-2 md:grid-cols-3">
            <Mini label="Focus" value={summary.morningBrief.focus_now.map((item) => item.ticker).filter(Boolean).slice(0, 3).join(", ") || "-"} />
            <Mini label="Avoid" value={String(summary.morningBrief.avoid.length)} />
            <Mini label="Coverage" value={summary.morningBrief.data_quality.coverageRatio === null ? "-" : `${summary.morningBrief.data_quality.coverageRatio}%`} />
          </div>
        ) : (
          <EmptyTerminalState title="Ingen overnight-summary laddad" body="Klicka Generate summary efter en eller flera autonomy-runs." />
        )}

        {summary?.dataCoverageIssues?.length ? (
          <div className="border border-yellow-500/20 bg-yellow-950/10 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-yellow-300">Data quality warnings</p>
            <ul className="mt-2 grid gap-1 text-sm text-zinc-300">
              {summary.dataCoverageIssues.slice(0, 5).map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {dbSession ? (
          <div className="grid gap-2 md:grid-cols-4">
            <Mini label="DB session" value={dbSession.status} />
            <Mini label="Cases observed" value={String(dbSession.casesObserved)} />
            <Mini label="Provider gaps" value={String(dbSession.missingCoverage.length)} />
            <Mini label="Failed providers" value={String(dbSession.failedProviders.length)} />
          </div>
        ) : null}
      </div>
    </TerminalPanel>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-2">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="truncate font-mono text-sm text-zinc-200">{value}</p>
    </div>
  );
}
