import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { DecisionItem } from "@/components/terminal/decision";
import { dataQualityLabel } from "@/components/terminal/decision";
import type { LearningReport, TerminalDebug, TerminalWarRoom } from "@/components/terminal/types";

function toneFor(bucket: DecisionItem["bucket"]): "good" | "warn" | "risk" {
  if (bucket === "act") return "good";
  if (bucket === "avoid") return "risk";
  return "warn";
}

function latestCollector(debug: TerminalDebug | null) {
  if (!debug?.outcomeCollector?.lastRunAt) return "saknas";
  return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date(debug.outcomeCollector.lastRunAt));
}

export function DecisionSummary({
  decisions,
  warRoom,
  learning,
  debug,
}: {
  decisions: DecisionItem[];
  warRoom: TerminalWarRoom | null;
  learning: LearningReport | null;
  debug: TerminalDebug | null;
}) {
  const act = decisions.filter((item) => item.bucket === "act").length;
  const watch = decisions.filter((item) => item.bucket === "watch").length;
  const parabolic = decisions.filter((item) => item.bucket === "parabolic").length;
  const avoid = decisions.filter((item) => item.bucket === "avoid").length;
  const quality = dataQualityLabel(warRoom, learning);

  return (
    <section className="border border-zinc-800 bg-zinc-950/95 p-3">
      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
        <SummaryMetric label="Agera nu" value={act} tone={act > 0 ? "good" : "neutral"} />
        <SummaryMetric label="Bevaka" value={watch} tone="warn" />
        <SummaryMetric label="Het/no chase" value={parabolic} tone={parabolic > 0 ? "warn" : "neutral"} />
        <SummaryMetric label="Undvik" value={avoid} tone={avoid > 0 ? "risk" : "neutral"} />
        <SummaryMetric label="Datakvalitet" value={quality} tone={quality === "hog" ? "good" : quality === "medel" ? "warn" : "risk"} />
        <SummaryMetric label="Senaste collector" value={latestCollector(debug)} tone="neutral" />
      </div>
    </section>
  );
}

export function ActionBoard({ decisions, onSelect }: { decisions: DecisionItem[]; onSelect?: (item: DecisionItem) => void }) {
  const act = decisions.filter((item) => item.bucket === "act");
  const watch = decisions.filter((item) => item.bucket === "watch");
  const parabolic = decisions.filter((item) => item.bucket === "parabolic");
  const avoid = decisions.filter((item) => item.bucket === "avoid");

  return (
    <TerminalPanel title="Action Board" eyebrow="agera / bevaka / undvik">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <DecisionColumn
          title="AGERA NU"
          tone="good"
          emptyTitle="Inga rena agera-case just nu"
          emptyBody="Inga rena kop-case just nu. Basta laget ar att bevaka och vanta pa confirmation."
          items={act}
          onSelect={onSelect}
        />
        <DecisionColumn
          title="BEVAKA / VANTA PA BEKRAFTELSE"
          tone="warn"
          emptyTitle="Inget att bevaka"
          emptyBody="Inga accepterade case med edge som kraver bekraftelse just nu."
          items={watch}
          onSelect={onSelect}
        />
        <DecisionColumn
          title="ROR SIG KRAFTIGT - JAGA INTE"
          tone="warn"
          emptyTitle="Inga parabolic movers"
          emptyBody="Starka movers med for hog chase/fade-risk visas har som re-entry watch, inte som svaga avoid-case."
          items={parabolic}
          onSelect={onSelect}
        />
        <DecisionColumn
          title="UNDVIK / JAGA INTE"
          tone="risk"
          emptyTitle="Inga tydliga avoid-signaler"
          emptyBody="Rejected och svaga case hamnar har nar ticker identity eller edge-kvalitet inte haller."
          items={avoid}
          onSelect={onSelect}
        />
      </div>
    </TerminalPanel>
  );
}

function DecisionColumn({
  title,
  tone,
  items,
  emptyTitle,
  emptyBody,
  onSelect,
}: {
  title: string;
  tone: "good" | "warn" | "risk";
  items: DecisionItem[];
  emptyTitle: string;
  emptyBody: string;
  onSelect?: (item: DecisionItem) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-200">{title}</p>
        <SignalPill tone={tone}>{items.length}</SignalPill>
      </div>
      <div className="grid gap-2">
        {items.length === 0 ? (
          <EmptyTerminalState title={emptyTitle} body={emptyBody} />
        ) : (
          items.slice(0, 4).map((item, index) => <DecisionCard key={`${item.id}-${index}`} item={item} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function DecisionCard({ item, onSelect }: { item: DecisionItem; onSelect?: (item: DecisionItem) => void }) {
  return (
    <article
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect?.(item);
      }}
      className="cursor-pointer border border-zinc-800 bg-black/25 p-3 hover:border-emerald-500/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-zinc-100">
            {item.ticker} <span className="font-sans text-xs text-zinc-500">{item.exchange}</span>
          </p>
          {item.company && <p className="truncate text-xs text-zinc-500">{item.company}</p>}
        </div>
        <SignalPill tone={toneFor(item.bucket)}>{item.humanAction}</SignalPill>
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{item.reason}</p>
      {item.labels && item.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.labels.map((label) => (
            <SignalPill key={`${item.id}-${label}`} tone={label === "Discovery HOT" ? "good" : "warn"}>{label}</SignalPill>
          ))}
        </div>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-zinc-500">Detaljer</summary>
        <div className="mt-2 grid gap-1">
          {item.confirmation && <p className="text-xs text-yellow-100">Bekrafta: {item.confirmation}</p>}
          {item.invalidation && <p className="text-xs text-red-200">Invalideras av: {item.invalidation}</p>}
          {item.bucket === "parabolic" && (
            <p className="text-xs text-yellow-100">
              Re-entry: pullback haller VWAP + ny volymvag + hogre botten + spread ok + ingen snabb fade.
            </p>
          )}
        </div>
      </details>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-zinc-500">
        <span>Score {item.score}</span>
        <span>Conf {item.confidence}</span>
        <span>FP {item.falsePositiveRisk}%</span>
      </div>
      {item.technicalAction && <p className="mt-1 font-mono text-[11px] text-zinc-600">technical: {item.technicalAction}</p>}
    </article>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string | number; tone: "neutral" | "good" | "warn" | "risk" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-yellow-200" : tone === "risk" ? "text-red-300" : "text-zinc-100";
  return (
    <div className="border border-zinc-800 bg-black/25 px-3 py-2">
      <p className="text-zinc-500">{label}</p>
      <p className={`font-mono text-base ${color}`}>{value}</p>
    </div>
  );
}
