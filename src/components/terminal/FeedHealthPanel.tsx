import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { TerminalDebug, TerminalWarRoom } from "@/components/terminal/types";

function time(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FeedHealthPanel({ warRoom, debug }: { warRoom: TerminalWarRoom | null; debug: TerminalDebug | null }) {
  const sources = warRoom?.sourceHealth ?? debug?.newsFeed?.sourceHealth ?? [];
  const dedupe = warRoom?.dedupeStats ?? debug?.newsFeed?.dedupeStats;
  const providerRuns = debug?.providerRuns ?? [];
  const collector = debug?.outcomeCollector;
  const dedupeRate = dedupe && dedupe.fetched > 0 ? Math.round((dedupe.duplicateCount / dedupe.fetched) * 100) : 0;

  return (
    <TerminalPanel
      title="Feed Health"
      eyebrow="freshness / parsing / dedupe"
      action={<SignalPill tone={warRoom?.feedStatus.status === "healthy" ? "good" : "warn"}>{warRoom?.feedStatus.message ?? "loading"}</SignalPill>}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <HealthStat label="Accepted" value={String(dedupe?.accepted ?? warRoom?.feedStatus.acceptedNews ?? 0)} />
          <HealthStat label="Rejected" value={String(dedupe?.rejected ?? warRoom?.feedStatus.rejectedNews ?? 0)} />
          <HealthStat label="Parse fails" value={String(dedupe?.parseErrors ?? 0)} />
          <HealthStat label="Dedupe" value={`${dedupeRate}%`} />
          <HealthStat label="Collector" value={collector?.status ?? "not_run"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Sources</p>
            <div className="grid gap-2">
              {sources.length === 0 ? (
                <EmptyTerminalState title="Inga source health events" body="Feed-källor saknas eller har inte loggat status ännu." />
              ) : (
                sources.slice(0, 6).map((source, index) => (
                  <div key={`${source.source}-${source.status}-${index}`} className="grid grid-cols-[1fr_5rem_5rem_5rem] gap-2 border border-zinc-800 bg-black/20 p-2 text-xs">
                    <span className="truncate text-zinc-300">{source.source}</span>
                    <span className="font-mono text-zinc-400">{source.latencyMs}ms</span>
                    <span className="font-mono text-emerald-300">{source.accepted}/{source.rejected}</span>
                    <span className="font-mono text-yellow-200">{source.parseErrors}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Recent provider runs</p>
            <div className="grid gap-2">
              {providerRuns.slice(0, 7).map((run, index) => (
                <div key={`${run.id}-${index}`} className="grid grid-cols-[1fr_5rem_4rem] gap-2 border border-zinc-800 bg-black/20 p-2 text-xs">
                  <span className="truncate text-zinc-300">{run.provider}</span>
                  <span className={run.status === "success" ? "text-emerald-300" : "text-yellow-200"}>{run.status}</span>
                  <span className="text-zinc-500">{time(run.createdAt)}</span>
                </div>
              ))}
              {providerRuns.length === 0 && <p className="text-sm text-zinc-500">Inga provider runs loggade.</p>}
            </div>
          </div>
        </div>
      </div>
    </TerminalPanel>
  );
}

function HealthStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-mono text-zinc-100 truncate">{value}</p>
    </div>
  );
}

