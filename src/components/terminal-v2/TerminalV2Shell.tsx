"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface TradingCandidate {
  ticker: string;
  company: string;
  exchange: string;
  action: string;
  setupType: string;
  thesis: string;
  pros: string[];
  cons: string[];
  trigger: string;
  invalidation: string;
  continuation: number;
  risk: number;
  rvol: number;
  movePct: number;
  source: string;
  sourceBucket: string;
  changed?: string | null;
  personality?: string;
  whyNow?: string;
  needsNow?: string;
  catalystType?: string;
  catalystScore?: number;
  catalystSummary?: string;
}

interface CanonicalTradingSnapshot {
  timestamp: string;
  providerStatus: {
    status: string;
    scanned: number;
    liveHits: number;
  };
  candidates: TradingCandidate[];
  portfolioDecisions: Array<{
    ticker: string;
    decision: string;
    reason: string;
  }>;
  topFocus: TradingCandidate[];
  warnings: string[];
  marketQuality: {
    label: string;
  };
  whatChanged: Array<{
    ticker: string;
    changeType: string;
    reason: string;
  }>;
  marketPulse: {
    label: string;
    summary: string;
    drivers: string[];
  };
  catalystPulse: {
    narrative: string;
    dominantTypes: Array<{ type: string; count: number; score: number }>;
    cases: Array<{ ticker: string; catalystType: string; summary: string; score: number }>;
  };
  trackedUniverse: Array<{
    ticker: string;
    company?: string;
    status: "activeCandidate" | "trackedButNotActive" | "recentlyActive" | "unknown";
    source: string;
    summary: string;
    lastKnownState?: string | null;
    lastKnownScore?: number | null;
  }>;
  breadth: {
    hot: TradingCandidate[];
    watch: TradingCandidate[];
    stealth: TradingCandidate[];
    noChase: TradingCandidate[];
    recentlyActive: TradingCandidate[];
  };
}

function badgeClass(action: string) {
  if (action === "Agera") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (action === "Het men jaga inte") return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  if (action === "Hog risk") return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  if (action === "Undvik") return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
  return "border-sky-400/40 bg-sky-400/10 text-sky-200";
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function num(value: number, decimals = 1) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "0.0";
}

function transitionLabel(changeType: string) {
  const labels: Record<string, string> = {
    movedUp: "starkare",
    movedDown: "svagare",
    newEntrant: "nytt case",
    dropped: "tappade listan",
    stateChanged: "state ändrad",
    confidenceChanged: "confidence ändrad",
    riskChanged: "risk ändrad",
  };
  return labels[changeType] ?? changeType;
}

function catalystLabel(type?: string) {
  const labels: Record<string, string> = {
    earnings_breakout: "Rapport",
    insider_accumulation: "Insider",
    news_expansion: "Nyhetsdrivet",
    contract_award: "Order/avtal",
    sector_sympathy: "Sektorflöde",
    retail_momentum: "Retail momentum",
    short_squeeze: "Squeeze",
    turnaround: "Turnaround",
    stealth_accumulation: "Stealth",
    biotech_binary: "Biotech/medtech",
    unknown: "Okänd catalyst",
  };
  return labels[type ?? "unknown"] ?? type ?? "Okänd catalyst";
}

function trackedStatusLabel(status: string) {
  if (status === "activeCandidate") return "ACTIVE";
  if (status === "recentlyActive") return "RECENT";
  if (status === "trackedButNotActive") return "TRACKED";
  return "NO FRESH LIVE CONFIRMATION";
}

function trackedStatusClass(status: string) {
  if (status === "activeCandidate") return "border-emerald-500/40 text-emerald-200";
  if (status === "recentlyActive") return "border-cyan-500/40 text-cyan-200";
  if (status === "trackedButNotActive") return "border-zinc-600 text-zinc-300";
  return "border-amber-500/40 text-amber-200";
}

function CandidateDetails({ candidate }: { candidate: TradingCandidate }) {
  return (
    <details className="mt-2 rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
      <summary className="cursor-pointer text-zinc-200">För / emot / trigger</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">För</p>
          <ul className="space-y-1">
            {candidate.pros.length > 0 ? candidate.pros.map((item) => <li key={`${candidate.ticker}-pro-${item}`}>{item}</li>) : <li>Inga starka extra punkter.</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Emot</p>
          <ul className="space-y-1">
            {candidate.cons.length > 0 ? candidate.cons.map((item) => <li key={`${candidate.ticker}-con-${item}`}>{item}</li>) : <li>Inga tydliga motargument.</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Trigger</p>
          <p>{candidate.trigger}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Invalidation</p>
          <p>{candidate.invalidation}</p>
        </div>
      </div>
    </details>
  );
}

function EdgeRow({ candidate, onOpen }: { candidate: TradingCandidate; onOpen: (candidate: TradingCandidate) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(candidate)}
      className="w-full rounded border border-zinc-800 bg-zinc-950/80 p-3 text-left transition hover:border-cyan-800 hover:bg-zinc-900/80"
    >
      <div className="grid gap-3 md:grid-cols-[130px_1fr_90px_90px_110px] md:items-start">
        <div>
          <div className="text-base font-semibold text-zinc-50">{candidate.ticker}</div>
          <div className="text-xs text-zinc-500">{candidate.company}</div>
          <div className="text-[11px] text-zinc-600">{candidate.exchange}</div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(candidate.action)}`}>{candidate.action}</span>
            <span className="text-xs text-zinc-400">{candidate.setupType}</span>
            <span className="rounded border border-violet-800/70 bg-violet-950/30 px-2 py-0.5 text-[11px] text-violet-200">{catalystLabel(candidate.catalystType)}</span>
            <span className="text-[11px] text-zinc-600">{candidate.source}</span>
          </div>
          <p className="mt-2 text-sm leading-5 text-zinc-200">{candidate.thesis}</p>
          <p className="mt-1 text-xs text-zinc-500">Behöver nu: {candidate.needsNow ?? candidate.trigger}</p>
          {candidate.changed ? <p className="mt-1 text-xs text-cyan-200">Ändrat: {candidate.changed}</p> : null}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Cont</div>
          <div className="text-sm font-semibold text-zinc-100">{pct(candidate.continuation)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Risk</div>
          <div className="text-sm font-semibold text-zinc-100">{pct(candidate.risk)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Move / RVOL</div>
          <div className="text-sm font-semibold text-zinc-100">{num(candidate.movePct, 2)}% / {num(candidate.rvol, 2)}x</div>
        </div>
      </div>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-zinc-800 bg-zinc-950/70 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function MiniCase({ candidate, onOpen }: { candidate: TradingCandidate; onOpen: (candidate: TradingCandidate) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(candidate)}
      className="rounded border border-zinc-800 bg-zinc-950/70 p-3 text-left text-sm transition hover:border-cyan-800"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-zinc-100">{candidate.ticker}</span>
        <span className={`rounded border px-2 py-0.5 text-[10px] ${badgeClass(candidate.action)}`}>{candidate.action}</span>
      </div>
      <div className="mt-1 text-xs text-zinc-500">{candidate.setupType} · {num(candidate.movePct, 2)}% · {num(candidate.rvol, 2)}x</div>
      <div className="mt-1 text-[11px] text-violet-200">{catalystLabel(candidate.catalystType)} · {candidate.catalystScore ?? 0}/100</div>
      <p className="mt-2 line-clamp-2 text-zinc-300">{candidate.needsNow ?? candidate.thesis}</p>
    </button>
  );
}

function CaseDrawer({ candidate, onClose }: { candidate: TradingCandidate; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-3 md:p-6" onClick={onClose}>
      <div
        className="ml-auto h-full max-w-2xl overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-zinc-50">{candidate.ticker}</h2>
              <span className={`rounded border px-2 py-0.5 text-xs ${badgeClass(candidate.action)}`}>{candidate.action}</span>
              <span className="rounded border border-violet-800/70 bg-violet-950/30 px-2 py-0.5 text-xs text-violet-200">{catalystLabel(candidate.catalystType)}</span>
              <span className="text-sm text-zinc-500">{candidate.exchange}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">{candidate.company}</p>
            <p className="mt-3 text-base leading-6 text-zinc-100">{candidate.thesis}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-900">
            Stäng
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded border border-zinc-800 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Continuation</div>
            <div className="mt-1 text-xl font-semibold">{pct(candidate.continuation)}</div>
          </div>
          <div className="rounded border border-zinc-800 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Risk</div>
            <div className="mt-1 text-xl font-semibold">{pct(candidate.risk)}</div>
          </div>
          <div className="rounded border border-zinc-800 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Move</div>
            <div className="mt-1 text-xl font-semibold">{num(candidate.movePct, 2)}%</div>
          </div>
          <div className="rounded border border-zinc-800 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">RVOL</div>
            <div className="mt-1 text-xl font-semibold">{num(candidate.rvol, 2)}x</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded border border-violet-900/70 bg-violet-950/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300">Catalyst</p>
            <p className="mt-2 text-sm leading-6 text-zinc-100">{candidate.catalystSummary ?? "Ingen verifierad catalyst i snapshot."}</p>
            <p className="mt-2 text-xs text-zinc-500">Catalyst score: {candidate.catalystScore ?? 0}/100</p>
          </div>
          <div className="rounded border border-cyan-900/70 bg-cyan-950/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Why now</p>
            <p className="mt-2 text-sm leading-6 text-zinc-100">{candidate.whyNow ?? candidate.thesis}</p>
          </div>
          <div className="rounded border border-zinc-800 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Personality</p>
            <p className="mt-2 text-sm text-zinc-200">{candidate.personality ?? candidate.setupType}</p>
          </div>
          <CandidateDetails candidate={candidate} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-emerald-900/70 bg-emerald-950/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Vad behöver hända nu?</p>
              <p className="mt-2 text-sm text-zinc-100">{candidate.needsNow ?? candidate.trigger}</p>
            </div>
            <div className="rounded border border-rose-900/70 bg-rose-950/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Det som dödar caset</p>
              <p className="mt-2 text-sm text-zinc-100">{candidate.invalidation}</p>
            </div>
          </div>
          {candidate.changed ? (
            <div className="rounded border border-zinc-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Senaste ändring</p>
              <p className="mt-2 text-sm text-zinc-200">{candidate.changed}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TerminalV2Shell() {
  const [snapshot, setSnapshot] = useState<CanonicalTradingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("Vad ska jag fokusera på just nu?");
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [copilotMode, setCopilotMode] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState<TradingCandidate | null>(null);
  const [breadthTab, setBreadthTab] = useState<keyof CanonicalTradingSnapshot["breadth"]>("hot");

  async function loadSnapshot() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/terminal-v2/snapshot", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.details ?? payload.error ?? "Snapshot failed");
      setSnapshot(payload as CanonicalTradingSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Okänt fel");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/terminal-v2/snapshot", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.details ?? payload.error ?? "Snapshot failed");
        return payload as CanonicalTradingSnapshot;
      })
      .then((payload) => {
        if (!active) return;
        setSnapshot(payload);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Okänt fel");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function askCopilot() {
    if (!question.trim() || !snapshot) return;
    setCopilotLoading(true);
    setCopilotAnswer(null);
    setCopilotMode(null);
    try {
      const response = await fetch("/api/copilot-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, snapshot }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.details ?? payload.error ?? "Copilot failed");
      setCopilotAnswer(payload.answer);
      setCopilotMode(payload.mode === "ai_snapshot" ? "AI-svar från snapshot" : "Fallback-svar från snapshot");
    } catch (err) {
      setCopilotAnswer(`Copilot v2 fel: ${err instanceof Error ? err.message : "okänt fel"}`);
      setCopilotMode("Fallback-svar");
    } finally {
      setCopilotLoading(false);
    }
  }

  const riskCandidates = useMemo(
    () => snapshot?.candidates.filter((candidate) => candidate.action === "Het men jaga inte" || candidate.action === "Hog risk").slice(0, 5) ?? [],
    [snapshot],
  );
  const breadthItems = snapshot?.breadth[breadthTab] ?? [];

  if (loading && !snapshot) {
    return <main className="min-h-screen bg-black p-6 text-zinc-100">Bygger canonical trading snapshot...</main>;
  }

  if (error && !snapshot) {
    return (
      <main className="min-h-screen bg-black p-6 text-zinc-100">
        <div className="rounded border border-rose-800 bg-rose-950/40 p-4">Terminal v2 kunde inte laddas: {error}</div>
      </main>
    );
  }

  if (!snapshot) return null;

  return (
    <main className="min-h-screen bg-black p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-3 border-b border-zinc-800 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">RaketRadar Terminal v2</p>
            <h1 className="mt-1 text-2xl font-semibold">Canonical trading snapshot</h1>
            <p className="mt-1 text-sm text-zinc-500">
              One scan → one candidate list → one UI → one Copilot context.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-zinc-500">
              <div>{new Date(snapshot.timestamp).toLocaleString("sv-SE")}</div>
              <div>{snapshot.providerStatus.liveHits}/{snapshot.providerStatus.scanned} live hits · {snapshot.marketQuality.label}</div>
            </div>
            <button onClick={loadSnapshot} className="rounded border border-cyan-700 bg-cyan-950/50 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-900/50">
              Kör scan
            </button>
          </div>
        </header>

        <section className="rounded border border-cyan-900/70 bg-cyan-950/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Market pulse</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-50">{snapshot.marketPulse.label}</h2>
              <p className="mt-1 text-sm text-zinc-300">{snapshot.marketPulse.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {snapshot.marketPulse.drivers.map((driver) => (
                <span key={driver} className="rounded border border-cyan-800/70 bg-black/30 px-2 py-1 text-xs text-cyan-100">{driver}</span>
              ))}
            </div>
          </div>
        </section>

        <Section title="Why the market is moving">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-sm leading-6 text-zinc-200">{snapshot.catalystPulse.narrative}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {snapshot.catalystPulse.dominantTypes.length > 0 ? snapshot.catalystPulse.dominantTypes.map((item) => (
                  <span key={item.type} className="rounded border border-violet-800/70 bg-violet-950/30 px-2 py-1 text-xs text-violet-100">
                    {catalystLabel(item.type)} · {item.count} · {item.score}/100
                  </span>
                )) : (
                  <span className="text-sm text-zinc-500">Ingen tydlig catalyst-dominans.</span>
                )}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {snapshot.catalystPulse.cases.slice(0, 6).map((item) => (
                <div key={`catalyst-${item.ticker}-${item.catalystType}`} className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-100">{item.ticker}</span>
                    <span className="text-xs text-violet-200">{catalystLabel(item.catalystType)} · {item.score}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Dagens fokus">
          {snapshot.warnings.length > 0 ? (
            <div className="mb-3 space-y-1 text-xs text-amber-200">
              {snapshot.warnings.map((warning) => <div key={warning}>{warning}</div>)}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            {snapshot.topFocus.length > 0 ? snapshot.topFocus.slice(0, 3).map((candidate) => (
              <button type="button" onClick={() => setSelectedCase(candidate)} key={`focus-${candidate.ticker}`} className="rounded border border-zinc-800 bg-zinc-900/50 p-3 text-left hover:border-cyan-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{candidate.ticker}</span>
                  <span className={`rounded border px-2 py-0.5 text-[11px] ${badgeClass(candidate.action)}`}>{candidate.action}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-300">{candidate.thesis}</p>
                <p className="mt-2 text-xs text-zinc-500">Trigger: {candidate.trigger}</p>
              </button>
            )) : (
              <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-400">Inga verifierade fokuscase i senaste snapshot.</div>
            )}
          </div>
        </Section>

        <Section title="Live Edge Board">
          <div className="space-y-2">
            {snapshot.candidates.length > 0 ? snapshot.candidates.slice(0, 10).map((candidate) => (
              <EdgeRow key={`edge-${candidate.ticker}-${candidate.sourceBucket}`} candidate={candidate} onOpen={setSelectedCase} />
            )) : (
              <div className="rounded border border-zinc-800 p-4 text-sm text-zinc-400">Inga kandidater i canonical snapshot.</div>
            )}
          </div>
        </Section>

        <Section title="Market breadth">
          <div className="mb-3 flex flex-wrap gap-2">
            {([
              ["hot", "HOT"],
              ["watch", "WATCH"],
              ["stealth", "STEALTH"],
              ["noChase", "NO CHASE"],
              ["recentlyActive", "RECENTLY ACTIVE"],
            ] as Array<[keyof CanonicalTradingSnapshot["breadth"], string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setBreadthTab(key)}
                className={`rounded border px-3 py-1 text-xs ${breadthTab === key ? "border-cyan-600 bg-cyan-950/60 text-cyan-100" : "border-zinc-800 bg-black text-zinc-400"}`}
              >
                {label} ({snapshot.breadth[key].length})
              </button>
            ))}
          </div>
          {breadthItems.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {breadthItems.map((candidate) => (
                <MiniCase key={`breadth-${breadthTab}-${candidate.ticker}`} candidate={candidate} onOpen={setSelectedCase} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Inga case i denna bucket just nu.</p>
          )}
        </Section>

        <Section title="Tracked / Market Memory">
          {snapshot.trackedUniverse.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {snapshot.trackedUniverse.slice(0, 15).map((item) => (
                <div key={`tracked-${item.ticker}`} className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-zinc-100">{item.ticker}</div>
                      <div className="text-[11px] text-zinc-600">{item.company}</div>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-[10px] ${trackedStatusClass(item.status)}`}>{trackedStatusLabel(item.status)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-400">{item.summary}</p>
                  {item.lastKnownScore !== null && item.lastKnownScore !== undefined ? (
                    <p className="mt-2 text-[11px] text-zinc-600">Senast: {item.lastKnownState ?? "okänd"} · score {item.lastKnownScore}</p>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-600">Ingen färsk livebekräftelse</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Inga tracked tickers i snapshoten.</p>
          )}
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Portfolio decisions">
            {snapshot.portfolioDecisions.length > 0 ? snapshot.portfolioDecisions.map((decision) => (
              <div key={`portfolio-${decision.ticker}`} className="rounded border border-zinc-800 p-3 text-sm">
                <div className="font-semibold">{decision.ticker}: {decision.decision}</div>
                <div className="text-zinc-400">{decision.reason}</div>
              </div>
            )) : (
              <p className="text-sm text-zinc-400">Inga portföljbeslut i v2-snapshot ännu. Ingen fake portfolio-data visas.</p>
            )}
          </Section>

          <Section title="Risk / no chase">
            <div className="space-y-2">
              {riskCandidates.length > 0 ? riskCandidates.map((candidate) => (
                <div key={`risk-${candidate.ticker}`} className="rounded border border-amber-900/70 bg-amber-950/20 p-3 text-sm">
                  <div className="font-semibold text-amber-100">{candidate.ticker}: {candidate.action}</div>
                  <div className="mt-1 text-zinc-300">{candidate.thesis}</div>
                  <div className="mt-1 text-xs text-zinc-500">Re-entry kräver: {candidate.trigger}</div>
                </div>
              )) : (
                <p className="text-sm text-zinc-400">Inga tydliga no-chase movers i senaste snapshot.</p>
              )}
            </div>
          </Section>
        </div>

        <Section title="What changed">
          {snapshot.whatChanged.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {snapshot.whatChanged.slice(0, 6).map((change, index) => (
                <div key={`change-${change.ticker}-${change.changeType}-${index}`} className="rounded border border-zinc-800 p-3 text-sm">
                  <div className="font-semibold">{change.ticker}: {transitionLabel(change.changeType)}</div>
                  <div className="text-zinc-400">{change.reason}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Inga persistade rankingändringar hittades för senaste run.</p>
          )}
        </Section>

        <Section title="Copilot">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="rounded border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
              placeholder="Fråga om ett case i snapshot, t.ex. Vad tycker du om NEXAM?"
            />
            <button
              onClick={askCopilot}
              disabled={copilotLoading}
              className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              {copilotLoading ? "Svarar..." : "Fråga"}
            </button>
          </div>
          {copilotMode ? <div className="mt-3 text-xs uppercase tracking-[0.2em] text-cyan-300">{copilotMode}</div> : null}
          {copilotAnswer ? <pre className="mt-2 whitespace-pre-wrap rounded border border-zinc-800 bg-black p-3 text-sm leading-6 text-zinc-200">{copilotAnswer}</pre> : (
            <p className="mt-3 text-sm text-zinc-500">Copilot v2 läser endast samma canonical snapshot som Live Edge Board.</p>
          )}
        </Section>
      </div>
      {selectedCase ? <CaseDrawer candidate={selectedCase} onClose={() => setSelectedCase(null)} /> : null}
    </main>
  );
}
