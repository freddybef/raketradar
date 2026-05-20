import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { AutonomousDiscoveryCandidate, AutonomousDiscoveryReport, MissedMover } from "@/components/terminal/types";

function candidateTone(candidate: AutonomousDiscoveryCandidate): "good" | "warn" | "risk" | "neutral" {
  if (candidate.labels.includes("fake-spike risk") || candidate.reaction.label === "PARABOLIC_RISK") return "risk";
  if (candidate.autonomousDiscoveryScore >= 65) return "good";
  if (candidate.autonomousDiscoveryScore >= 45) return "warn";
  return "neutral";
}

export function AutonomousDiscoveryPanel({
  discovery,
  onSelect,
  manualTickers = "",
  onManualTickersChange,
  onRescan,
}: {
  discovery: AutonomousDiscoveryReport | null;
  onSelect?: (candidate: AutonomousDiscoveryCandidate) => void;
  manualTickers?: string;
  onManualTickersChange?: (value: string) => void;
  onRescan?: () => void;
}) {
  const candidates = discovery?.candidates ?? [];

  return (
    <div className="grid gap-5">
      <TerminalPanel
        title="Autonomous Discovery"
        eyebrow="independent market scan"
        action={<SignalPill tone={candidates.length > 0 ? "good" : "neutral"}>{discovery?.liveHits ?? 0}/{discovery?.universeSize ?? 0} live hits</SignalPill>}
      >
        {!discovery || candidates.length === 0 ? (
          <EmptyTerminalState title="Inga autonoma movers" body="Discovery scannar svensk equity-universe utan portfölj eller watchlist-bias, men hittade ingen verifierad live-rörelse just nu." />
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
              <Diag label="Scanned" value={discovery.scannedCount} />
              <Diag label="Live hits" value={discovery.liveHits} />
              <Diag label="Missing data" value={discovery.missingDataCount} />
              <Diag label="HOT" value={discovery.bucketCounts.HOT} />
              <Diag label="PARABOLIC" value={discovery.bucketCounts.PARABOLIC_WATCH} />
              <Diag label="RISK" value={discovery.bucketCounts.RISK} />
            </div>
            {discovery.providerStatus && (
              <details className="border border-zinc-800 bg-black/25 p-3 text-xs text-zinc-400">
                <summary className="cursor-pointer">
                  Provider: {discovery.providerStatus.status} - {discovery.providerStatus.message}
                </summary>
                <div className="flex flex-wrap items-center gap-2">
                  <SignalPill tone={discovery.providerStatus.status === "live" ? "good" : discovery.providerStatus.status === "fallback_cached" ? "warn" : "risk"}>
                    {discovery.providerStatus.status}
                  </SignalPill>
                  <span>{discovery.providerStatus.message}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-zinc-500">
                  senaste lyckade: {discovery.providerStatus.latestGoodScanAt ? new Date(discovery.providerStatus.latestGoodScanAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) : "saknas"} ·
                  attempts {discovery.providerStatus.attemptedSymbols} · intraday {discovery.providerStatus.successfulIntradayBars ?? 0} · daily {discovery.providerStatus.successfulDailyBars ?? 0} · timeouts {discovery.providerStatus.timeoutCount} · partial {discovery.providerStatus.partialResults}
                </p>
              </details>
            )}
            <div className="grid gap-2 border border-zinc-800 bg-black/20 p-3 md:grid-cols-[1fr_auto]">
              <input
                value={manualTickers}
                onChange={(event) => onManualTickersChange?.(event.target.value)}
                placeholder="Lagg till tickers manuellt, t.ex. KVIX, SHT, KAV"
                className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
              />
              <button type="button" onClick={onRescan} className="border border-emerald-500/30 px-3 py-2 text-sm text-emerald-200">
                Scan manual + universe
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <DiscoveryBucket title="Hot movers" items={discovery.hotMovers} onSelect={onSelect} />
              <DiscoveryBucket title="Watch movers" items={discovery.watchMovers} onSelect={onSelect} />
              <DiscoveryBucket title="Stealth movers" items={discovery.stealthMovers} onSelect={onSelect} />
              <DiscoveryBucket title="Het men farlig / jaga inte" items={discovery.highRiskParabolicMovers} onSelect={onSelect} />
              <DiscoveryBucket title="Suppressed movers" items={discovery.suppressedMovers} onSelect={onSelect} />
              <CoverageBucket discovery={discovery} />
            </div>
          </div>
        )}
      </TerminalPanel>

      <TerminalPanel title="Missed Movers" eyebrow="why not ranked higher">
        {!discovery || discovery.missedMovers.length === 0 ? (
          <EmptyTerminalState title="Inga missade movers just nu" body="Systemet hittade ingen stor verifierad mover som föll utanför rankingen." />
        ) : (
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {discovery.missedMovers.slice(0, 8).map((item, index) => (
              <MissedMoverCard key={`${item.ticker}-${item.reason}-${index}-missed`} item={item} />
            ))}
          </div>
        )}
      </TerminalPanel>
    </div>
  );
}

function Diag({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-2">
      <p className="text-zinc-500">{label}</p>
      <p className="font-mono text-zinc-100">{value}</p>
    </div>
  );
}

function CoverageBucket({ discovery }: { discovery: AutonomousDiscoveryReport }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Coverage / missing data</p>
      <div className="grid gap-2">
        {discovery.coverageByExchange.map((item) => (
          <div key={`${item.exchange}-coverage`} className="text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-2">
              <span>{item.exchange}</span>
              <span className="font-mono">{item.coveragePercent}%</span>
            </div>
            <p className="text-xs text-zinc-500">
              {item.liveHits}/{item.total} live · {item.missing} saknar data
            </p>
          </div>
        ))}
      </div>
      {discovery.suppressedByReason.length > 0 && (
        <div className="mt-3 border-t border-zinc-900 pt-2">
          {discovery.suppressedByReason.slice(0, 4).map((item) => (
            <p key={`${item.reason}-suppressed`} className="text-xs text-zinc-500">
              {item.reason}: {item.count}
            </p>
          ))}
        </div>
      )}
      {discovery.missingTickers.length > 0 && (
        <div className="mt-3 border-t border-zinc-900 pt-2">
          <p className="mb-1 text-xs uppercase tracking-[0.12em] text-zinc-500">Saknar prisdata</p>
          <div className="max-h-40 overflow-auto pr-1">
            {discovery.missingTickers.slice(0, 80).map((item) => (
              <p key={`${item.exchange}-${item.ticker}-missing`} className="font-mono text-[11px] text-zinc-500">
                {item.ticker} · {item.exchange} · {item.reason}
              </p>
            ))}
          </div>
        </div>
      )}
      {(discovery.aliasDebug?.length ?? 0) > 0 && (
        <details className="mt-3 border-t border-zinc-900 pt-2">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-zinc-500">Yahoo/provider alias debug</summary>
          <div className="max-h-56 overflow-auto pr-1">
            {discovery.aliasDebug?.slice(0, 100).map((item) => {
              const attempts = item.attemptedSymbols
                .slice(0, 8)
                .map((attempt) => `${attempt.symbol}:${attempt.success ? "ok" : "fail"}:${attempt.bars}`)
                .join(" -> ");
              return (
                <p key={`${item.exchange}-${item.ticker}-alias-debug`} className="font-mono text-[11px] text-zinc-500">
                  {item.ticker} -&gt; {attempts || "no attempts"} -&gt; {item.workingAlias ?? "no alias"}
                </p>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function DiscoveryBucket({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: AutonomousDiscoveryCandidate[];
  onSelect?: (candidate: AutonomousDiscoveryCandidate) => void;
}) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Ingen signal.</p>
      ) : (
        <div className="grid gap-2">
          {items.map((item, index) => (
            <article
              key={`${title}-${item.ticker}-${item.reaction.asOf}-${index}`}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={() => onSelect?.(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSelect?.(item);
              }}
              className="cursor-pointer border-b border-zinc-900 pb-2 hover:bg-emerald-500/5 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-zinc-100">{item.ticker}</p>
                  <p className="text-xs text-zinc-500">
                    {item.companyName} · {item.exchange} · {item.bucket}
                  </p>
                </div>
                <SignalPill tone={candidateTone(item)}>{item.autonomousDiscoveryScore}</SignalPill>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{item.whyDiscovered.join(" · ")}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.sourceTags.map((tag) => (
                  <SignalPill key={`${item.ticker}-${tag}`} tone="neutral">{tag}</SignalPill>
                ))}
                {item.labels.slice(0, 3).map((label) => (
                  <SignalPill key={`${item.ticker}-${label}`} tone={label.includes("fake") ? "risk" : "warn"}>{label}</SignalPill>
                ))}
              </div>
              {item.whyNotRankedHigher.length > 0 && <p className="mt-2 text-xs text-zinc-500">Why not higher: {item.whyNotRankedHigher.join(", ")}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MissedMoverCard({ item }: { item: MissedMover }) {
  return (
    <article className="border border-zinc-800 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-zinc-100">{item.ticker}</p>
          <p className="text-xs text-zinc-500">{item.companyName}</p>
        </div>
        <SignalPill tone="warn">{item.reason}</SignalPill>
      </div>
      <p className="mt-2 text-sm text-zinc-300">
        {item.movePercent}% move · RVOL {item.relativeVolume}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{item.detail}</p>
    </article>
  );
}
