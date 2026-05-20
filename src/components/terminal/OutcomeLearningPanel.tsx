import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { ComboPerformance, LearningReport, TerminalDebug } from "@/components/terminal/types";

function ComboList({ title, combos, tone }: { title: string; combos: ComboPerformance[]; tone: "good" | "risk" }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <div className="grid gap-2">
        {combos.length === 0 ? (
          <p className="text-sm text-zinc-500">Inväntar evaluerade outcomes.</p>
        ) : (
          combos.slice(0, 4).map((combo, index) => (
            <div key={`${combo.key}-${index}-${title}`} className="border border-zinc-800 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm text-zinc-200">{combo.key}</p>
                <SignalPill tone={tone}>{combo.winRate}%</SignalPill>
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                n {combo.sampleSize} · max {combo.avgMaxMovePct}% · fade {combo.avgFadePct}%
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function OutcomeLearningPanel({ learning, debug }: { learning: LearningReport | null; debug: TerminalDebug | null }) {
  const latest = debug?.outcomeCollector?.latestClassifiedOutcomes ?? [];
  const continued = latest.filter((item) => item.outcomeLabel === "CONTINUED" || item.outcomeLabel === "SQUEEZE" || item.outcomeLabel === "EXPLODED");
  const failed = latest.filter((item) => item.outcomeLabel === "FAILED" || item.outcomeLabel === "FADED" || item.outcomeLabel === "DEAD");
  const evaluated = learning?.recentOutcomeSummary.evaluatedSignals ?? 0;
  const isSmallSample = evaluated < 10;
  const bestKeys = new Set((learning?.bestTriggerCombos ?? []).filter((combo) => !isSmallSample || combo.sampleSize >= 2).map((combo) => combo.key));
  const bestCombos = (learning?.bestTriggerCombos ?? []).filter((combo) => !isSmallSample || combo.sampleSize >= 2);
  const worstCombos = (learning?.worstTriggerCombos ?? []).filter((combo) => (!isSmallSample || combo.sampleSize >= 2) && !bestKeys.has(combo.key));

  return (
    <TerminalPanel
      title="Vad systemet hittills lart sig"
      eyebrow="outcome learning"
      action={<div className="flex gap-2"><SignalPill tone={isSmallSample ? "warn" : "good"}>{isSmallSample ? "Preliminart" : "stabilare sample"}</SignalPill><SignalPill tone="neutral">eval {evaluated}</SignalPill></div>}
    >
      {!learning ? (
        <EmptyTerminalState title="Learning saknas" body="Outcome API svarade inte. Kontrollera /api/outcomes/learning." />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Pending" value={learning.recentOutcomeSummary.pendingSignals} />
            <Stat label="Evaluated" value={learning.recentOutcomeSummary.evaluatedSignals} />
            <Stat label="Continuation" value={learning.recentOutcomeSummary.continuation + continued.length} />
            <Stat label="False patterns" value={learning.falsePositivePatterns.length} />
          </div>
          {isSmallSample && (
            <p className="border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              Datamangden ar liten (n &lt; 10). Tolka winrate och fade-risk som preliminara signaler, inte facit.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComboList title="Best trigger combos" combos={bestCombos} tone="good" />
            <ComboList title="Worst trigger combos" combos={worstCombos} tone="risk" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MiniList
              title="Recent CONTINUED"
              empty="Inga klassade continuation ännu."
              items={continued.map((item) => `${item.ticker} ${item.horizon}: ${item.maxUpsidePercent}% / FT ${item.followThroughQuality}`)}
            />
            <MiniList
              title="Recent FAILED"
              empty="Inga failure outcomes i senaste collector-run."
              items={failed.map((item) => `${item.ticker} ${item.horizon}: ${item.outcomeLabel}`)}
            />
            <MiniList
              title="Insider quality"
              empty="Inväntar fler insider outcomes."
              items={(learning.insiderQualityRanking ?? []).slice(0, 4).map((item) => `${item.ticker}: ${item.insiderQualityScore ?? item.continuationRate}/100 · n ${item.sampleSize}`)}
            />
          </div>
        </div>
      )}
    </TerminalPanel>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-mono text-lg text-zinc-100">{value}</p>
    </div>
  );
}

function MiniList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <div className="grid gap-1 text-sm">
        {items.length === 0 ? <p className="text-zinc-500">{empty}</p> : items.map((item, index) => <p key={`${title}-${index}`} className="truncate text-zinc-300">{item}</p>)}
      </div>
    </div>
  );
}
