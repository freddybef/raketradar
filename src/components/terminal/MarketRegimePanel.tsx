import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";
import type { TerminalWarRoom } from "@/components/terminal/types";

function regimeTone(value?: string): "good" | "warn" | "risk" | "neutral" {
  if (value === "positive") return "good";
  if (value === "negative") return "risk";
  if (value === "neutral") return "warn";
  return "neutral";
}

export function MarketRegimePanel({ warRoom }: { warRoom: TerminalWarRoom | null }) {
  const regime = warRoom?.overnightRegime;
  const sectors = regime?.sectorMomentum ?? [];
  const squeezeStrength = Math.max(0, Math.min(100, Math.round(((regime?.alignmentScore ?? 50) + sectors.filter((item) => item.score >= 70).length * 8) / 1.2)));

  return (
    <TerminalPanel title="Market Regime" eyebrow="context before open" action={<SignalPill tone={regimeTone(regime?.nasdaqFutures)}>{regime?.nasdaqFutures ?? "unknown"}</SignalPill>}>
      {!regime ? (
        <EmptyTerminalState title="Regime saknas" body="Overnight context saknas i senaste War Room-svaret." />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <RegimeStat label="Overnight alignment" value={`${regime.alignmentScore}/100`} />
            <RegimeStat label="Risk mode" value={regime.nasdaqFutures === "negative" ? "risk-off" : regime.nasdaqFutures === "positive" ? "risk-on" : "neutral"} />
            <RegimeStat label="Themes" value={String(regime.activeThemes.length)} />
            <RegimeStat label="Squeeze env" value={`${squeezeStrength}/100`} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Active themes</p>
            <div className="flex flex-wrap gap-2">
              {regime.activeThemes.length === 0 ? <SignalPill>inga teman</SignalPill> : regime.activeThemes.map((theme, index) => <SignalPill key={`${theme}-${index}`} tone="good">{theme}</SignalPill>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Strongest sectors</p>
            <div className="grid gap-2">
              {sectors.length === 0 ? (
                <p className="text-sm text-zinc-500">Ingen sektorstyrka verifierad.</p>
              ) : (
                sectors.slice(0, 5).map((sector, index) => (
                  <div key={`${sector.sector}-${index}`} className="grid grid-cols-[1fr_5rem] gap-3 text-sm">
                    <span className="truncate text-zinc-300">{sector.sector}</span>
                    <span className="font-mono text-emerald-300">{sector.score}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </TerminalPanel>
  );
}

function RegimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-mono text-zinc-100">{value}</p>
    </div>
  );
}

