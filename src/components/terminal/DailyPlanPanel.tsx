import { decisionText, isParabolicNoChase, type DecisionItem } from "@/components/terminal/decision";
import { SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { AutonomousDiscoveryReport, IntelligenceChangesReport, TerminalSetup, TerminalWarRoom } from "@/components/terminal/types";

function short(value?: string | null, fallback = "-") {
  if (!value) return fallback;
  return value.length > 96 ? `${value.slice(0, 93)}...` : value;
}

function rowTone(kind: "act" | "watch" | "parabolic" | "portfolio" | "change" | "data"): "good" | "warn" | "risk" | "neutral" {
  if (kind === "act") return "good";
  if (kind === "parabolic" || kind === "watch") return "warn";
  if (kind === "data") return "neutral";
  return "neutral";
}

export function DailyPlanPanel({
  setups,
  decisions,
  discovery,
  warRoom,
  changes,
}: {
  setups: TerminalSetup[];
  decisions: DecisionItem[];
  discovery: AutonomousDiscoveryReport | null;
  warRoom: TerminalWarRoom | null;
  changes: IntelligenceChangesReport | null;
}) {
  const act = decisions.find((item) => item.bucket === "act");
  const parabolic = decisions.find((item) => item.bucket === "parabolic") ?? setups.find((setup) => isParabolicNoChase(setup));
  const watch = decisions.find((item) => item.bucket === "watch");
  const primary = act ?? parabolic ?? watch ?? setups[0] ?? null;
  const latestChange = changes?.changes?.[0] ?? null;
  const provider = discovery?.providerStatus;
  const dataStatus = provider
    ? `${provider.status}: ${discovery?.liveHits ?? 0}/${discovery?.universeSize ?? 0} live, intraday ${provider.successfulIntradayBars ?? 0}`
    : warRoom?.feedStatus.message ?? "Providerstatus saknas";

  return (
    <TerminalPanel
      title="Dagens plan"
      eyebrow="kort beslutsyta"
      action={<SignalPill tone={provider?.status === "live" ? "good" : provider?.status === "fallback_cached" ? "warn" : "neutral"}>{provider?.status ?? warRoom?.feedStatus.status ?? "okant"}</SignalPill>}
    >
      <div className="grid gap-2">
        <PlanRow
          label="Primart fokus"
          tone={primary && "bucket" in primary && primary.bucket === "parabolic" ? "parabolic" : "act"}
          ticker={"ticker" in (primary ?? {}) ? primary?.ticker : "-"}
          action={primary ? ("humanAction" in primary ? primary.humanAction : primary.openingAction) : "Ingen ren signal"}
          why={primary ? ("reason" in primary ? primary.reason : decisionText(primary)) : "Vanta pa verifierad live-signal."}
          trigger={primary && "invalidation" in primary ? primary.invalidation : undefined}
        />
        <PlanRow
          label="Agera nu"
          tone="act"
          ticker={act?.ticker ?? "-"}
          action={act ? "Aktiv bevakning/orderberedskap" : "Inget rent agera-case"}
          why={act ? short(act.reason) : "Bra. Ingen anledning att forcera trade."}
          trigger={act?.invalidation ?? "Krav: volym, spread och forsta pullback haller."}
        />
        <PlanRow
          label="Het men jaga inte"
          tone="parabolic"
          ticker={parabolic?.ticker ?? "-"}
          action={parabolic ? "Re-entry only" : "Ingen parabolic watch"}
          why={parabolic ? short("reason" in parabolic ? parabolic.reason : decisionText(parabolic)) : "Inga viktiga no-chase movers just nu."}
          trigger="VWAP/pullback haller, ny volymvag, hogre botten, spread ok."
        />
        <PlanRow
          label="Bevaka"
          tone="watch"
          ticker={watch?.ticker ?? "-"}
          action={watch ? "Vanta bekraftelse" : "Ingen tydlig watch"}
          why={watch ? short(watch.reason) : "Watchlist ar lugn eller saknar edge."}
          trigger={watch?.confirmation ?? "Krav hogre low + volymbekraftelse."}
        />
        <PlanRow
          label="Trimma/salj/bevaka innehav"
          tone="portfolio"
          ticker="-"
          action="Se Portfolio decisions"
          why="Innehav bedoms separat mot live reaction, fade-risk och conviction."
          trigger="Hoj stop/trimma vid parabolic risk; oka inte utan confirmation."
        />
        <PlanRow
          label="Viktigaste andring"
          tone="change"
          ticker={latestChange?.ticker ?? "-"}
          action={latestChange?.changeType ?? "Ingen sparad diff"}
          why={short(latestChange?.reason, "Kor Run scan now for ny re-ranking-diff.")}
          trigger={latestChange ? `${latestChange.previousValue ?? "-"} -> ${latestChange.currentValue ?? "-"}` : undefined}
        />
        <PlanRow label="Datakvalitet" tone="data" ticker="DATA" action={dataStatus} why={provider?.message ?? warRoom?.feedStatus.message ?? "Ingen provider-varning."} />
      </div>
    </TerminalPanel>
  );
}

function PlanRow({
  label,
  tone,
  ticker,
  action,
  why,
  trigger,
}: {
  label: string;
  tone: "act" | "watch" | "parabolic" | "portfolio" | "change" | "data";
  ticker?: string;
  action: string;
  why: string;
  trigger?: string;
}) {
  return (
    <div className="grid gap-2 border border-zinc-800 bg-black/20 p-3 text-sm md:grid-cols-[10rem_7rem_12rem_1fr_1fr] md:items-center">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="font-mono font-semibold text-zinc-100">{ticker ?? "-"}</p>
      <SignalPill tone={rowTone(tone)}>{action}</SignalPill>
      <p className="text-zinc-300">{short(why)}</p>
      {trigger && <p className="text-xs text-zinc-500">Trigger/invalidation: {short(trigger)}</p>}
    </div>
  );
}
