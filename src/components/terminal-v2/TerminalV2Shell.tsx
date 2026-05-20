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
  sourceUrl?: string;
  freshnessStatus?: "activeToday" | "premarketContext" | "afterClose" | "recentMemory" | "stale";
  dataAgeMinutes?: number;
  isActiveToday?: boolean;
  firstSeenAt?: string | null;
  lastConfirmedAt?: string | null;
  freshnessMinutes?: number;
  momentumAge?: number;
  confirmationCount?: number;
  lastExpansionAt?: string | null;
  decayScore?: number;
  staleReason?: string | null;
  signalQuality?: "FRESH_IGNITION" | "ACTIVE_CONTINUATION" | "EARLY_WATCH" | "STALLED" | "EXHAUSTED" | "DEAD" | "RECLAIM_SETUP";
  narrativeTriggerType?: string;
  narrativeStrength?: number;
  narrativeFreshness?: number;
  thematicTailwind?: number;
  repricingProbability?: number;
  marketAttentionShift?: number;
  hasFreshFundamentalCatalyst?: boolean;
  discoveryScore?: number;
  triggerVerificationState?: "VERIFIED" | "UNVERIFIED" | "PRICE_ONLY" | "THEMATIC";
}

interface CanonicalTradingSnapshot {
  timestamp: string;
  snapshotDate: string;
  marketSessionDate: string;
  generatedAt: string;
  dataAgeMinutes: number;
  isFreshForToday: boolean;
  marketSessionPhase: "preopen" | "open" | "after_close" | "closed";
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
  newsProviderStatus: {
    providerName: string;
    mode: "mock" | "manual" | "rss" | "api" | "disabled";
    isLive: boolean;
    isConfigured: boolean;
    lastFetchAt: string;
    error: string | null;
    headlineCount: number;
    feedHealth: Array<{
      url: string;
      source: string;
      health: "HEALTHY" | "STALE" | "ERROR" | "EMPTY";
      statusCode?: number;
      headlineCount: number;
      latestPublishedAt?: string;
      error?: string;
    }>;
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
    candidate?: TradingCandidate;
  }>;
  positionManagement: Array<{
    ticker: string;
    company?: string;
    state: string;
    decisionLabel?: string;
    decision: string;
    reason?: string;
    why: string;
    trigger: string;
    invalidation: string;
    risk?: number;
    whatChanged: string;
    confidenceTrend: "up" | "down" | "flat" | "unknown";
    confidence: number;
    sourceStatus?: "activeCandidate" | "recentlyActive" | "trackedButNotActive" | "unknown";
    suggestedAction?: "hold" | "trim" | "sell" | "wait" | "reentry_only" | "no_add";
    source: string;
  }>;
  priorityBoard: Array<{
    ticker: string;
    company?: string;
    priorityState: "MUST_ACT" | "WATCH_CLOSELY" | "REENTRY_WATCH" | "LOW_PRIORITY" | "DEAD" | "AVOID";
    headline: string;
    whyNow: string;
    action: string;
    urgencyScore: number;
    confidence: number;
    sourceStatus: "activeCandidate" | "recentlyActive" | "trackedButNotActive" | "unknown";
    freshnessStatus: "activeToday" | "premarketContext" | "afterClose" | "recentMemory" | "stale";
    signalQuality?: string;
    narrativeTriggerType?: string;
    narrativeStrength?: number;
    freshnessMinutes: number;
    lastConfirmedAt?: string | null;
    changedFrom?: string | null;
    changedAt?: string | null;
    expiresSoon: boolean;
    discoveryScore?: number;
    triggerVerificationState?: "VERIFIED" | "UNVERIFIED" | "PRICE_ONLY" | "THEMATIC";
  }>;
  newsTriggers: Array<{
    id: string;
    ticker: string | null;
    company: string | null;
    headline: string;
    source: string;
    publishedAt: string;
    url?: string;
    triggerType: string;
    triggerStrength: number;
    narrativeTriggerType: string;
    thematicTags: string[];
    isFreshToday: boolean;
    marketCapSensitivity: number;
    secondDerivativeScore: number;
    repricingPotential: number;
    triggerVerificationState: "VERIFIED" | "UNVERIFIED" | "PRICE_ONLY" | "THEMATIC";
    summary: string;
  }>;
  earlyRadar: Array<{
    ticker: string;
    company?: string | null;
    rank: number;
    radarReason: string;
    preOpenTrigger: string;
    narrativeTriggerType: string;
    triggerStrength: number;
    marketCapSensitivity: number;
    secondDerivativeScore: number;
    watchBeforeOpen: boolean;
    confirmationNeeded: string;
    invalidation: string;
    priorityScore: number;
    source: "newsTrigger" | "trackedMemory" | "candidate" | "hybrid";
    status: "PREOPEN_WATCH" | "OPEN_CONFIRMATION_NEEDED" | "ACTIVE_CONFIRMED" | "REJECTED";
    triggerVerificationState: "VERIFIED" | "UNVERIFIED" | "PRICE_ONLY" | "THEMATIC";
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

function positionStateClass(state: string) {
  if (["HOLD", "FIRST_PULLBACK_VALID"].includes(state)) return "border-emerald-500/40 text-emerald-200";
  if (["TRIM", "TIGHTEN_STOP", "NO_ADD", "REENTRY_WATCH"].includes(state)) return "border-amber-500/40 text-amber-200";
  return "border-rose-500/40 text-rose-200";
}

function trendSymbol(trend: string) {
  if (trend === "up") return "upp";
  if (trend === "down") return "ned";
  if (trend === "flat") return "flat";
  return "okänd";
}

function priorityStateClass(state: string) {
  if (state === "MUST_ACT") return "border-emerald-400/50 bg-emerald-950/30 text-emerald-100";
  if (state === "WATCH_CLOSELY" || state === "REENTRY_WATCH") return "border-cyan-400/40 bg-cyan-950/20 text-cyan-100";
  if (state === "AVOID") return "border-amber-400/50 bg-amber-950/30 text-amber-100";
  if (state === "DEAD") return "border-rose-500/50 bg-rose-950/25 text-rose-100";
  return "border-zinc-700 bg-zinc-950 text-zinc-300";
}

function priorityLabel(state: string) {
  const labels: Record<string, string> = {
    MUST_ACT: "Måste agera",
    WATCH_CLOSELY: "Bevaka nära",
    REENTRY_WATCH: "Re-entry",
    LOW_PRIORITY: "Låg prio",
    DEAD: "Dött",
    AVOID: "Undvik",
  };
  return labels[state] ?? state;
}

function freshnessLabel(status?: string) {
  const labels: Record<string, string> = {
    activeToday: "Active Today",
    premarketContext: "Pre-open context",
    afterClose: "After close",
    recentMemory: "Recently Active / Market Memory",
    stale: "Stale / Yesterday",
  };
  return labels[status ?? "stale"] ?? "Market Memory";
}

function signalFreshnessLabel(quality?: string) {
  if (quality === "FRESH_IGNITION") return "FRESH";
  if (quality === "ACTIVE_CONTINUATION" || quality === "RECLAIM_SETUP") return "ACTIVE";
  if (quality === "EXHAUSTED" || quality === "DEAD") return "DYING";
  if (quality === "STALLED") return "STALE";
  return "WATCH";
}

function ageMinutes(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))}m`;
}

function newsModeLabel(mode: string, isLive: boolean) {
  if (isLive && mode === "rss") return "RSS LIVE";
  if (isLive) return "LIVE";
  if (mode === "mock") return "MOCK - ej livefeed";
  if (mode === "manual") return "MANUAL - ej livefeed";
  if (mode === "disabled") return "DISABLED";
  if (mode === "rss") return "RSS ERROR";
  return mode.toUpperCase();
}

function verificationLabel(value?: string) {
  if (value === "VERIFIED") return "VERIFIED";
  if (value === "PRICE_ONLY") return "PRICE ONLY";
  if (value === "THEMATIC") return "THEMATIC";
  return "UNVERIFIED";
}

function verificationClass(value?: string) {
  if (value === "VERIFIED") return "border-emerald-700/60 bg-emerald-950/30 text-emerald-100";
  if (value === "THEMATIC") return "border-cyan-700/60 bg-cyan-950/30 text-cyan-100";
  if (value === "PRICE_ONLY") return "border-amber-700/60 bg-amber-950/30 text-amber-100";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function narrativeLabel(type?: string) {
  const labels: Record<string, string> = {
    REPORT_REPRICING: "Rapport-repricing",
    COMMERCIALIZATION_SHIFT: "Kommersialisering",
    SECOND_DERIVATIVE_THEME: "Second derivative",
    OBESITY_ADJACENCY: "Obesity adjacency",
    DEFENSE_ADJACENCY: "Försvar/cyber",
    DATACENTER_INFRA: "Datacenter infra",
    NEW_CONTRACT: "Nytt kontrakt",
    REGULATORY_TRIGGER: "Regulatoriskt",
    PROFITABILITY_INFLECTION: "Lönsamhetsvändning",
    FUNDING_SURVIVAL: "Finansiering/överlevnad",
    UNKNOWN: "Okänd story",
  };
  return labels[type ?? "UNKNOWN"] ?? type ?? "Okänd story";
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
      className="w-full cursor-pointer rounded border border-zinc-800 bg-zinc-950/80 p-3 text-left transition hover:border-cyan-800 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
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
      className="cursor-pointer rounded border border-zinc-800 bg-zinc-950/70 p-3 text-left text-sm transition hover:border-cyan-800 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
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

type PriorityItem = CanonicalTradingSnapshot["priorityBoard"][number];
type NewsTriggerItem = CanonicalTradingSnapshot["newsTriggers"][number];
type TrackedItem = CanonicalTradingSnapshot["trackedUniverse"][number];
type PositionItem = CanonicalTradingSnapshot["positionManagement"][number];
type EarlyRadarItem = CanonicalTradingSnapshot["earlyRadar"][number];
type SelectableItem = TradingCandidate | PriorityItem | NewsTriggerItem | TrackedItem | PositionItem | EarlyRadarItem;
type SelectedDetail =
  | { type: "candidate"; candidate: TradingCandidate }
  | { type: "news"; newsTrigger: NewsTriggerItem };

function candidateFromPriority(snapshot: CanonicalTradingSnapshot, item: PriorityItem): TradingCandidate {
  const candidate =
    snapshot.candidates.find((entry) => entry.ticker === item.ticker) ??
    Object.values(snapshot.breadth).flat().find((entry) => entry.ticker === item.ticker) ??
    snapshot.trackedUniverse.find((entry) => entry.ticker === item.ticker)?.candidate;
  if (candidate) return candidate;

  const position = snapshot.positionManagement.find((entry) => entry.ticker === item.ticker);
  const tracked = snapshot.trackedUniverse.find((entry) => entry.ticker === item.ticker);
  return {
    ticker: item.ticker,
    company: item.company ?? tracked?.company ?? item.ticker,
    exchange: "Market memory",
    action: item.priorityState === "AVOID" ? "Het men jaga inte" : item.priorityState === "DEAD" ? "Undvik" : "Bevaka",
    setupType: item.priorityState === "REENTRY_WATCH" ? "Re-entry watch" : item.priorityState === "DEAD" ? "Momentum dead" : "Tracked memory",
    thesis: item.headline,
    pros: [
      item.sourceStatus === "recentlyActive" ? "nyligen aktiv i snapshot memory" : null,
      position?.confidenceTrend === "up" ? "confidence trend upp" : null,
      item.changedFrom ? `ändrat från ${item.changedFrom}` : null,
    ].filter((entry): entry is string => Boolean(entry)),
    cons: [
      item.sourceStatus !== "activeCandidate" ? "saknar färsk aktiv kandidatstatus" : null,
      position?.risk !== undefined ? `risk ${position.risk}/100` : null,
    ].filter((entry): entry is string => Boolean(entry)),
    trigger: position?.trigger ?? "återkommer med färsk livebekräftelse eller ny urgency",
    invalidation: position?.invalidation ?? "fortsätter sakna momentum/volym i kommande scan",
    continuation: 0,
    risk: position?.risk ?? (item.priorityState === "AVOID" || item.priorityState === "DEAD" ? 75 : 50),
    rvol: 0,
    movePct: 0,
    source: `Priority Board / ${item.sourceStatus}`,
    sourceBucket: item.priorityState === "AVOID" ? "RISK" : item.priorityState === "DEAD" ? "SUPPRESSED" : "WATCH",
    changed: item.changedFrom ? `Ändrat från ${item.changedFrom}` : null,
    personality: item.priorityState === "REENTRY_WATCH" ? "Re-entry watch" : "Market memory",
    whyNow: item.whyNow,
    needsNow: position?.trigger ?? item.action,
    catalystType: "unknown",
    catalystScore: 0,
    catalystSummary: tracked?.summary ?? position?.reason ?? "Ingen verifierad färsk catalyst i snapshot.",
    freshnessStatus: item.freshnessStatus,
    dataAgeMinutes: 0,
    isActiveToday: false,
    firstSeenAt: null,
    lastConfirmedAt: item.lastConfirmedAt ?? null,
    freshnessMinutes: item.freshnessMinutes,
    momentumAge: item.freshnessMinutes,
    confirmationCount: 0,
    lastExpansionAt: null,
    decayScore: item.priorityState === "DEAD" ? 85 : item.priorityState === "AVOID" ? 65 : 50,
    staleReason: item.whyNow,
    signalQuality: item.signalQuality as TradingCandidate["signalQuality"],
    narrativeTriggerType: item.narrativeTriggerType,
    narrativeStrength: item.narrativeStrength,
    narrativeFreshness: 0,
    thematicTailwind: 0,
    repricingProbability: 0,
    marketAttentionShift: 0,
    hasFreshFundamentalCatalyst: false,
  };
}

function candidateFromNewsTrigger(snapshot: CanonicalTradingSnapshot, item: NewsTriggerItem): TradingCandidate {
  const ticker = item.ticker ?? item.company ?? "NEWS";
  const candidate =
    snapshot.candidates.find((entry) => entry.ticker === ticker) ??
    Object.values(snapshot.breadth).flat().find((entry) => entry.ticker === ticker) ??
    snapshot.trackedUniverse.find((entry) => entry.ticker === ticker)?.candidate;
  if (candidate) return candidate;
  return {
    ticker,
    company: item.company ?? ticker,
    exchange: "News Trigger Inbox",
    action: item.isFreshToday && item.repricingPotential >= 70 ? "Bevaka" : "Undvik",
    setupType: item.triggerType,
    thesis: `${item.headline} — ${item.summary}`,
    pros: [
      item.isFreshToday ? "färsk headline idag" : null,
      item.repricingPotential >= 65 ? `repricing ${item.repricingPotential}/100` : null,
      item.secondDerivativeScore >= 60 ? "second-derivative theme" : null,
    ].filter((entry): entry is string => Boolean(entry)),
    cons: [item.ticker ? null : "saknar resolved ticker", item.triggerType === "UNKNOWN" ? "oklar trigger" : null].filter((entry): entry is string => Boolean(entry)),
    trigger: "pris/volym måste bekräfta headline-triggern i live snapshot",
    invalidation: "ingen live reaction eller rubriken visar sig vara makro/brus",
    continuation: 0,
    risk: item.triggerType === "FUNDING" ? 75 : item.triggerType === "MACRO_NOISE" ? 70 : 50,
    rvol: 0,
    movePct: 0,
    source: `${item.source} / ${item.triggerType}`,
    sourceBucket: "WATCH",
    changed: null,
    personality: "News trigger",
    whyNow: item.summary,
    needsNow: "live reaction måste bekräfta repricing-storyn",
    catalystType: "news_expansion",
    catalystScore: item.triggerStrength,
    catalystSummary: item.headline,
    sourceUrl: item.url,
    freshnessStatus: item.isFreshToday ? "activeToday" : "recentMemory",
    dataAgeMinutes: 0,
    isActiveToday: item.isFreshToday,
    firstSeenAt: item.publishedAt,
    lastConfirmedAt: item.publishedAt,
    freshnessMinutes: 0,
    momentumAge: 0,
    confirmationCount: item.ticker ? 1 : 0,
    lastExpansionAt: null,
    decayScore: item.isFreshToday ? 15 : 55,
    staleReason: item.isFreshToday ? null : "headline är inte från dagens session",
    signalQuality: item.isFreshToday ? "EARLY_WATCH" : "STALLED",
    narrativeTriggerType: item.narrativeTriggerType,
    narrativeStrength: item.triggerStrength,
    narrativeFreshness: item.isFreshToday ? 90 : 25,
    thematicTailwind: item.secondDerivativeScore,
    repricingProbability: item.repricingPotential,
    marketAttentionShift: 0,
    hasFreshFundamentalCatalyst: item.isFreshToday && item.narrativeTriggerType !== "UNKNOWN",
  };
}

function candidateFromTracked(snapshot: CanonicalTradingSnapshot, item: TrackedItem): TradingCandidate {
  const candidate =
    item.candidate ??
    snapshot.candidates.find((entry) => entry.ticker === item.ticker) ??
    Object.values(snapshot.breadth).flat().find((entry) => entry.ticker === item.ticker);
  if (candidate) return candidate;
  const priority = snapshot.priorityBoard.find((entry) => entry.ticker === item.ticker);
  if (priority) return candidateFromPriority(snapshot, priority);
  const position = snapshot.positionManagement.find((entry) => entry.ticker === item.ticker);
  return {
    ticker: item.ticker,
    company: item.company ?? item.ticker,
    exchange: "Tracked / Market Memory",
    action: item.status === "activeCandidate" ? "Bevaka" : "Undvik",
    setupType: item.lastKnownState ?? "Tracked memory",
    thesis: item.summary,
    pros: [item.status === "recentlyActive" ? "nyligen aktiv" : null, item.lastKnownScore ? `senaste score ${item.lastKnownScore}` : null].filter((entry): entry is string => Boolean(entry)),
    cons: [item.status !== "activeCandidate" ? "saknar färsk aktiv kandidatstatus" : null].filter((entry): entry is string => Boolean(entry)),
    trigger: position?.trigger ?? "återkommer i Live Edge Board eller får ny news/volume confirmation",
    invalidation: position?.invalidation ?? "fortsätter sakna färsk livebekräftelse",
    continuation: 0,
    risk: position?.risk ?? 55,
    rvol: 0,
    movePct: 0,
    source: `Tracked universe / ${item.source}`,
    sourceBucket: "WATCH",
    changed: item.lastKnownState ? `Senast känd state: ${item.lastKnownState}` : null,
    personality: "Market memory",
    whyNow: item.summary,
    needsNow: position?.suggestedAction ?? "vänta på färsk bekräftelse",
    catalystType: "unknown",
    catalystScore: 0,
    catalystSummary: position?.reason ?? item.summary,
    freshnessStatus: item.status === "recentlyActive" ? "recentMemory" : "stale",
    dataAgeMinutes: 0,
    isActiveToday: false,
    firstSeenAt: null,
    lastConfirmedAt: null,
    freshnessMinutes: 24 * 60,
    momentumAge: 24 * 60,
    confirmationCount: 0,
    lastExpansionAt: null,
    decayScore: 60,
    staleReason: "tracked ticker utan färsk aktiv kandidat i snapshot",
    signalQuality: "STALLED",
    narrativeTriggerType: "UNKNOWN",
    narrativeStrength: 0,
    narrativeFreshness: 0,
    thematicTailwind: 0,
    repricingProbability: 0,
    marketAttentionShift: 0,
    hasFreshFundamentalCatalyst: false,
  };
}

function candidateFromPosition(snapshot: CanonicalTradingSnapshot, item: PositionItem): TradingCandidate {
  const candidate =
    snapshot.candidates.find((entry) => entry.ticker === item.ticker) ??
    Object.values(snapshot.breadth).flat().find((entry) => entry.ticker === item.ticker) ??
    snapshot.trackedUniverse.find((entry) => entry.ticker === item.ticker)?.candidate;
  if (candidate) return candidate;
  const priority = snapshot.priorityBoard.find((entry) => entry.ticker === item.ticker);
  if (priority) return candidateFromPriority(snapshot, priority);
  return {
    ticker: item.ticker,
    company: item.company ?? item.ticker,
    exchange: "Position Management",
    action: item.suggestedAction === "sell" || item.suggestedAction === "trim" ? "Het men jaga inte" : "Bevaka",
    setupType: item.state,
    thesis: item.decisionLabel ?? item.decision,
    pros: [item.confidenceTrend === "up" ? "confidence trend upp" : null].filter((entry): entry is string => Boolean(entry)),
    cons: [item.reason ?? item.why, `risk ${item.risk ?? "-"}/100`],
    trigger: item.trigger,
    invalidation: item.invalidation,
    continuation: 0,
    risk: item.risk ?? 55,
    rvol: 0,
    movePct: 0,
    source: `Position Management / ${item.sourceStatus ?? item.source}`,
    sourceBucket: item.suggestedAction === "sell" ? "RISK" : "WATCH",
    changed: item.whatChanged,
    personality: item.state,
    whyNow: item.reason ?? item.why,
    needsNow: item.suggestedAction ?? item.decision,
    catalystType: "unknown",
    catalystScore: 0,
    catalystSummary: item.reason ?? item.why,
    freshnessStatus: item.sourceStatus === "activeCandidate" ? "activeToday" : "recentMemory",
    dataAgeMinutes: 0,
    isActiveToday: item.sourceStatus === "activeCandidate",
    firstSeenAt: null,
    lastConfirmedAt: null,
    freshnessMinutes: 24 * 60,
    momentumAge: 24 * 60,
    confirmationCount: item.sourceStatus === "activeCandidate" ? 1 : 0,
    lastExpansionAt: null,
    decayScore: item.sourceStatus === "activeCandidate" ? 25 : 55,
    staleReason: item.sourceStatus === "activeCandidate" ? null : "position finns men saknar färsk aktiv kandidatstatus",
    signalQuality: item.sourceStatus === "activeCandidate" ? "EARLY_WATCH" : "STALLED",
    narrativeTriggerType: "UNKNOWN",
    narrativeStrength: 0,
    narrativeFreshness: 0,
    thematicTailwind: 0,
    repricingProbability: 0,
    marketAttentionShift: 0,
    hasFreshFundamentalCatalyst: false,
  };
}

function candidateFromEarlyRadar(snapshot: CanonicalTradingSnapshot, item: EarlyRadarItem): TradingCandidate {
  const candidate =
    snapshot.candidates.find((entry) => entry.ticker === item.ticker) ??
    Object.values(snapshot.breadth).flat().find((entry) => entry.ticker === item.ticker) ??
    snapshot.trackedUniverse.find((entry) => entry.ticker === item.ticker)?.candidate;
  if (candidate) return candidate;
  const trigger = snapshot.newsTriggers.find((entry) => entry.ticker?.toUpperCase() === item.ticker);
  if (trigger) return candidateFromNewsTrigger(snapshot, trigger);
  const tracked = snapshot.trackedUniverse.find((entry) => entry.ticker === item.ticker);
  if (tracked) return candidateFromTracked(snapshot, tracked);
  return {
    ticker: item.ticker,
    company: item.company ?? item.ticker,
    exchange: "Pre-open / Early Radar",
    action: item.status === "ACTIVE_CONFIRMED" ? "Bevaka" : item.status === "REJECTED" ? "Undvik" : "Bevaka",
    setupType: item.status,
    thesis: item.radarReason,
    pros: [`triggerstyrka ${item.triggerStrength}/100`, item.secondDerivativeScore >= 60 ? "second-derivative tailwind" : null].filter((entry): entry is string => Boolean(entry)),
    cons: [item.status !== "ACTIVE_CONFIRMED" ? "kräver öppningsbekräftelse" : null].filter((entry): entry is string => Boolean(entry)),
    trigger: item.confirmationNeeded,
    invalidation: item.invalidation,
    continuation: 0,
    risk: item.status === "REJECTED" ? 80 : 50,
    rvol: 0,
    movePct: 0,
    source: `Early Radar / ${item.source}`,
    sourceBucket: "WATCH",
    changed: null,
    personality: item.status,
    whyNow: item.radarReason,
    needsNow: item.confirmationNeeded,
    catalystType: "news_expansion",
    catalystScore: item.triggerStrength,
    catalystSummary: item.preOpenTrigger,
    freshnessStatus: "premarketContext",
    dataAgeMinutes: 0,
    isActiveToday: item.status === "ACTIVE_CONFIRMED",
    firstSeenAt: null,
    lastConfirmedAt: null,
    freshnessMinutes: 0,
    momentumAge: 0,
    confirmationCount: item.status === "ACTIVE_CONFIRMED" ? 2 : 1,
    lastExpansionAt: null,
    decayScore: item.status === "ACTIVE_CONFIRMED" ? 20 : 35,
    staleReason: null,
    signalQuality: item.status === "ACTIVE_CONFIRMED" ? "ACTIVE_CONTINUATION" : "EARLY_WATCH",
    narrativeTriggerType: item.narrativeTriggerType,
    narrativeStrength: item.triggerStrength,
    narrativeFreshness: 80,
    thematicTailwind: item.secondDerivativeScore,
    repricingProbability: item.priorityScore,
    marketAttentionShift: 0,
    hasFreshFundamentalCatalyst: item.source === "newsTrigger" || item.source === "hybrid",
  };
}

function matchedCandidateForNews(snapshot: CanonicalTradingSnapshot, item: NewsTriggerItem) {
  if (!item.ticker) return null;
  return (
    snapshot.candidates.find((entry) => entry.ticker === item.ticker) ??
    Object.values(snapshot.breadth).flat().find((entry) => entry.ticker === item.ticker) ??
    snapshot.trackedUniverse.find((entry) => entry.ticker === item.ticker)?.candidate ??
    null
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
            {candidate.sourceUrl ? (
              <a
                href={candidate.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded border border-violet-700/60 px-3 py-1 text-xs text-violet-100 hover:bg-violet-950/50"
              >
                Open source
              </a>
            ) : null}
          </div>
          <div className="rounded border border-cyan-900/70 bg-cyan-950/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Why now</p>
            <p className="mt-2 text-sm leading-6 text-zinc-100">{candidate.whyNow ?? candidate.thesis}</p>
          </div>
          <div className="rounded border border-zinc-800 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Personality</p>
            <p className="mt-2 text-sm text-zinc-200">{candidate.personality ?? candidate.setupType}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Signal: {signalFreshnessLabel(candidate.signalQuality)} · decay {candidate.decayScore ?? 0}/100 · confirmations {candidate.confirmationCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-violet-200">
              Story: {narrativeLabel(candidate.narrativeTriggerType)} · narrative {candidate.narrativeStrength ?? 0}/100 · repricing {candidate.repricingProbability ?? 0}/100
            </p>
            {candidate.staleReason ? <p className="mt-1 text-xs text-amber-200">{candidate.staleReason}</p> : null}
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

function NewsDetailDrawer({
  newsTrigger,
  matchedCandidate,
  onClose,
  onOpenMatchedCase,
}: {
  newsTrigger: NewsTriggerItem;
  matchedCandidate: TradingCandidate | null;
  onClose: () => void;
  onOpenMatchedCase: () => void;
}) {
  const confirmation = matchedCandidate?.trigger ?? "Pris/volym måste bekräfta rubriken i live snapshot; annars är detta bara headline-risk.";
  const unresolved = !newsTrigger.ticker;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-3 md:p-6" onClick={onClose}>
      <div
        className="ml-auto h-full max-w-2xl overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={unresolved ? "rounded border border-amber-800/70 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-100" : "rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300"}>
                {unresolved ? "Unresolved news signal" : `${newsTrigger.ticker}${newsTrigger.company ? ` / ${newsTrigger.company}` : ""}`}
              </span>
              <span className={`rounded border px-2 py-0.5 text-xs ${verificationClass(newsTrigger.triggerVerificationState)}`}>
                {verificationLabel(newsTrigger.triggerVerificationState)}
              </span>
              <span className="rounded border border-violet-800/70 bg-violet-950/30 px-2 py-0.5 text-xs text-violet-200">{newsTrigger.triggerType}</span>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-600">Raw news signal</p>
            <h2 className="mt-2 text-2xl font-semibold leading-8 text-zinc-50">{newsTrigger.headline}</h2>
            <p className="mt-2 text-sm text-zinc-500">
              {newsTrigger.source} · {new Date(newsTrigger.publishedAt).toLocaleString("sv-SE")} · {ageMinutes(newsTrigger.publishedAt)} gammal
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-900">
            Stäng
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Observed trigger</div>
            <div className="mt-1 text-base font-semibold text-zinc-200">{unresolved ? "Observational" : `${newsTrigger.triggerStrength}/100`}</div>
            <div className="mt-1 text-[11px] text-zinc-600">{unresolved ? `${newsTrigger.triggerStrength}/100 after entity validation` : "parsed headline strength"}</div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Repricing clue</div>
            <div className="mt-1 text-base font-semibold text-zinc-200">{unresolved ? "Not tradable yet" : `${newsTrigger.repricingPotential}/100`}</div>
            <div className="mt-1 text-[11px] text-zinc-600">{unresolved ? `${newsTrigger.repricingPotential}/100 signal only` : "requires market confirmation"}</div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">Age</div>
            <div className="mt-1 text-base font-semibold text-zinc-200">{ageMinutes(newsTrigger.publishedAt)}</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded border border-violet-900/70 bg-violet-950/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300">Trigger interpretation</p>
            <p className="mt-2 text-sm leading-6 text-zinc-100">{newsTrigger.summary}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {newsTrigger.source} · {new Date(newsTrigger.publishedAt).toLocaleString("sv-SE")} · {narrativeLabel(newsTrigger.narrativeTriggerType)}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-zinc-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Extracted entities / tickers</p>
              <p className={unresolved ? "mt-2 text-sm text-amber-100" : "mt-2 text-sm text-zinc-100"}>{newsTrigger.ticker ? `${newsTrigger.ticker}${newsTrigger.company ? ` / ${newsTrigger.company}` : ""}` : "No resolved ticker yet"}</p>
              <p className="mt-1 text-xs text-zinc-600">{unresolved ? "Needs entity resolution before it can enter case ranking." : "Resolved enough to link against candidate memory."}</p>
            </div>
            <div className="rounded border border-zinc-800 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Trigger reason</p>
              <p className="mt-2 text-sm text-zinc-100">{newsTrigger.triggerType} · {verificationLabel(newsTrigger.triggerVerificationState)}</p>
            </div>
          </div>
          <div className={unresolved ? "rounded border border-amber-900/70 bg-amber-950/20 p-4" : "rounded border border-emerald-900/70 bg-emerald-950/10 p-4"}>
            <p className={unresolved ? "text-xs uppercase tracking-[0.2em] text-amber-300" : "text-xs uppercase tracking-[0.2em] text-emerald-300"}>Tradability status</p>
            <p className="mt-2 text-sm leading-6 text-zinc-100">
              {unresolved
                ? "Interesting signal under investigation. Not a tradable case until ticker/entity and live reaction are confirmed."
                : matchedCandidate
                  ? "Linked to a candidate in the snapshot. Treat the case view as secondary confirmation."
                  : "Ticker resolved, but no active matched case yet. Needs live market confirmation."}
            </p>
          </div>
          <div className="rounded border border-cyan-900/70 bg-cyan-950/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">What would confirm this?</p>
            <p className="mt-2 text-sm leading-6 text-zinc-100">{confirmation}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {newsTrigger.url ? (
              <a
                href={newsTrigger.url}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-violet-700/60 px-3 py-1 text-xs text-violet-100 hover:bg-violet-950/50"
              >
                Open source
              </a>
            ) : null}
            {matchedCandidate ? (
              <button
                type="button"
                onClick={onOpenMatchedCase}
                className="rounded border border-cyan-700/60 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-950/50"
              >
                Open matched case
              </button>
            ) : null}
          </div>
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
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null);
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

  function openCandidate(candidate: TradingCandidate) {
    setSelectedDetail({ type: "candidate", candidate });
  }

  function openNews(newsTrigger: NewsTriggerItem) {
    setSelectedDetail({ type: "news", newsTrigger });
  }

  function openDetailForItem(item: SelectableItem) {
    if (!snapshot) return;
    if ("priorityState" in item) {
      openCandidate(candidateFromPriority(snapshot, item));
      return;
    }
    if ("headline" in item && "triggerType" in item) {
      openNews(item);
      return;
    }
    if ("radarReason" in item) {
      openCandidate(candidateFromEarlyRadar(snapshot, item));
      return;
    }
    if ("decision" in item && "whatChanged" in item) {
      openCandidate(candidateFromPosition(snapshot, item));
      return;
    }
    if ("summary" in item && "status" in item) {
      openCandidate(candidateFromTracked(snapshot, item));
      return;
    }
    openCandidate(item);
  }

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
              <div>Session {snapshot.marketSessionDate} · {snapshot.marketSessionPhase}</div>
              <div>{snapshot.providerStatus.liveHits}/{snapshot.providerStatus.scanned} live hits · {snapshot.marketQuality.label} · age {snapshot.dataAgeMinutes}m</div>
            </div>
            <button onClick={loadSnapshot} className="rounded border border-cyan-700 bg-cyan-950/50 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-900/50">
              Kör scan
            </button>
          </div>
        </header>

        {!snapshot.isFreshForToday ? (
          <div className="rounded border border-amber-700/60 bg-amber-950/30 p-3 text-sm text-amber-100">
            Varning: snapshoten är inte färsk för dagens live-session. Behandla kandidater som pre-open/after-close eller market memory tills ny same-day livebekräftelse finns.
          </div>
        ) : null}

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
              <button type="button" onClick={() => openDetailForItem(candidate)} key={`focus-${candidate.ticker}`} className="cursor-pointer rounded border border-zinc-800 bg-zinc-900/50 p-3 text-left transition hover:border-cyan-800 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500">
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

        <Section title="Priority Board">
          {snapshot.priorityBoard.length > 0 ? (
            <div className="space-y-2">
              {snapshot.priorityBoard.slice(0, 8).map((item) => (
                <button
                  key={`priority-${item.ticker}-${item.priorityState}`}
                  type="button"
                  onClick={() => openDetailForItem(item)}
                  className="grid w-full cursor-pointer gap-2 rounded border border-zinc-800 bg-zinc-950/70 p-3 text-left text-sm transition hover:border-cyan-800 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 md:grid-cols-[120px_130px_1fr_90px] md:items-center"
                >
                  <div>
                    <div className="font-semibold text-zinc-100">{item.ticker}</div>
                    <div className="text-[11px] text-zinc-600">{item.company}</div>
                  </div>
                  <span className={`w-fit rounded border px-2 py-0.5 text-[10px] font-semibold ${priorityStateClass(item.priorityState)}`}>
                    {priorityLabel(item.priorityState)}
                  </span>
                  <div>
                    <div className="text-zinc-200">{item.action}</div>
                    <div className="line-clamp-1 text-xs text-zinc-500">
                      <span className={`mr-1 rounded border px-1.5 py-0.5 text-[9px] ${verificationClass(item.triggerVerificationState)}`}>
                        {verificationLabel(item.triggerVerificationState)}
                      </span>
                      {signalFreshnessLabel(item.signalQuality)} · {narrativeLabel(item.narrativeTriggerType)} · discovery {item.discoveryScore ?? "-"} · {item.freshnessMinutes}m sedan bekräftelse
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div>{item.urgencyScore}/100</div>
                    <div>conf {item.confidence}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Priority Board saknar signaler i senaste snapshot.</p>
          )}
        </Section>

        <Section title="Pre-open / Early Radar">
          {snapshot.earlyRadar.length > 0 ? (
            <div className="space-y-2">
              {snapshot.earlyRadar.slice(0, 10).map((item) => (
                <button
                  key={`early-radar-${item.ticker}-${item.rank}`}
                  type="button"
                  onClick={() => openDetailForItem(item)}
                  className="grid w-full cursor-pointer gap-2 rounded border border-zinc-800 bg-zinc-950/70 p-3 text-left text-sm transition hover:border-violet-700 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 md:grid-cols-[70px_120px_1fr_1fr_80px] md:items-center"
                >
                  <div className="text-xs text-zinc-500">#{item.rank}</div>
                  <div>
                    <div className="font-semibold text-zinc-100">{item.ticker}</div>
                    <div className="text-[11px] text-zinc-600">{item.company}</div>
                  </div>
                  <div>
                    <div className="text-zinc-200">{narrativeLabel(item.narrativeTriggerType)}</div>
                    <div className="line-clamp-1 text-xs text-zinc-500">
                      <span className={`mr-1 rounded border px-1.5 py-0.5 text-[9px] ${verificationClass(item.triggerVerificationState)}`}>
                        {verificationLabel(item.triggerVerificationState)}
                      </span>
                      {item.preOpenTrigger}
                    </div>
                  </div>
                  <div className="line-clamp-2 text-xs text-zinc-400">{item.confirmationNeeded}</div>
                  <div className="text-xs text-zinc-500">{item.priorityScore}/100</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Inga pre-open radarcase i senaste snapshot. Gamla movers rankas inte utan ny trigger idag.</p>
          )}
        </Section>

        <Section title="News Trigger Inbox">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{snapshot.newsProviderStatus.providerName}</span>
            <span className={`rounded border px-2 py-0.5 ${snapshot.newsProviderStatus.isLive ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-100" : "border-amber-700/60 bg-amber-950/30 text-amber-100"}`}>
              {newsModeLabel(snapshot.newsProviderStatus.mode, snapshot.newsProviderStatus.isLive)}
            </span>
            <span>{snapshot.newsProviderStatus.headlineCount} headlines · {ageMinutes(snapshot.newsProviderStatus.lastFetchAt)} gammal</span>
            {!snapshot.newsProviderStatus.isConfigured ? <span className="text-amber-200">News provider not configured</span> : null}
            {snapshot.newsProviderStatus.error ? <span className="text-rose-300">Fel: {snapshot.newsProviderStatus.error}</span> : null}
          </div>
          {snapshot.newsProviderStatus.feedHealth?.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
              {snapshot.newsProviderStatus.feedHealth.slice(0, 4).map((feed) => (
                <span
                  key={`${feed.source}-${feed.health}-${feed.statusCode ?? "ok"}`}
                  className={`rounded border px-2 py-0.5 ${
                    feed.health === "HEALTHY"
                      ? "border-emerald-800 bg-emerald-950/20 text-emerald-200"
                      : feed.health === "STALE"
                        ? "border-amber-800 bg-amber-950/20 text-amber-200"
                        : feed.health === "EMPTY"
                          ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                          : "border-rose-800 bg-rose-950/20 text-rose-200"
                  }`}
                >
                  {feed.source}: {feed.health} · {feed.headlineCount} hits{feed.statusCode ? ` · ${feed.statusCode}` : ""}
                </span>
              ))}
            </div>
          ) : null}
          {snapshot.newsTriggers.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              {snapshot.newsTriggers.slice(0, 5).map((item) => (
                <button
                  key={`news-trigger-${item.id}`}
                  type="button"
                  onClick={() => openNews(item)}
                  className={`cursor-pointer rounded border border-zinc-800 bg-zinc-950/70 p-3 text-left text-sm transition hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 ${
                    item.ticker
                      ? "hover:border-violet-700 focus-visible:outline-violet-500"
                      : "text-zinc-400 hover:border-amber-700 focus-visible:outline-amber-500"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={item.ticker ? "font-semibold text-zinc-100" : "font-semibold text-zinc-500"}>{item.ticker ?? "NO TICKER"}</div>
                      <div className="text-[11px] text-zinc-600">{item.company ?? item.source}</div>
                    </div>
                    <span className={item.ticker ? "rounded border border-violet-700/60 bg-violet-950/30 px-2 py-0.5 text-[10px] text-violet-100" : "rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400"}>
                      {item.triggerType}
                    </span>
                  </div>
                  <p className={item.ticker ? "mt-2 line-clamp-2 text-xs leading-5 text-zinc-300" : "mt-2 line-clamp-2 text-xs leading-5 text-zinc-400"}>{item.headline}</p>
                  <p className={item.ticker ? "mt-2 text-[11px] text-zinc-500" : "mt-2 text-[11px] text-zinc-600"}>
                    <span className={`mr-1 rounded border px-1.5 py-0.5 text-[9px] ${verificationClass(item.triggerVerificationState)}`}>
                      {verificationLabel(item.triggerVerificationState)}
                    </span>
                    {item.source} · {ageMinutes(item.publishedAt)} · styrka {item.triggerStrength}/100 · repricing {item.repricingPotential}/100
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Inga manuella/news trigger-headlines i snapshoten. Lägg in via RAKETRADAR_NEWS_HEADLINES eller NEWS_TRIGGER_HEADLINES.</p>
          )}
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Active Today">
            {snapshot.candidates.filter((candidate) => candidate.isActiveToday).slice(0, 6).length > 0 ? (
              <div className="space-y-2">
                {snapshot.candidates.filter((candidate) => candidate.isActiveToday).slice(0, 6).map((candidate) => (
                  <MiniCase key={`active-today-${candidate.ticker}`} candidate={candidate} onOpen={openDetailForItem} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Inga färska same-day aktiva case just nu.</p>
            )}
          </Section>

          <Section title="Recently Active / Market Memory">
            {snapshot.priorityBoard.filter((item) => item.freshnessStatus !== "activeToday").slice(0, 6).length > 0 ? (
              <div className="space-y-2">
                {snapshot.priorityBoard.filter((item) => item.freshnessStatus !== "activeToday").slice(0, 6).map((item) => (
                  <button
                    key={`memory-${item.ticker}-${item.priorityState}`}
                    type="button"
                    onClick={() => openDetailForItem(item)}
                    className="w-full cursor-pointer rounded border border-zinc-800 bg-zinc-950/60 p-3 text-left text-sm transition hover:border-cyan-800 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-100">{item.ticker}</span>
                      <span className="text-xs text-zinc-500">{freshnessLabel(item.freshnessStatus)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{item.whyNow}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Ingen separat market memory att visa.</p>
            )}
          </Section>
        </div>

        <Section title="Live Edge Board">
          <div className="space-y-2">
            {snapshot.candidates.length > 0 ? snapshot.candidates.slice(0, 10).map((candidate) => (
              <EdgeRow key={`edge-${candidate.ticker}-${candidate.sourceBucket}`} candidate={candidate} onOpen={openDetailForItem} />
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
                <MiniCase key={`breadth-${breadthTab}-${candidate.ticker}`} candidate={candidate} onOpen={openDetailForItem} />
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
                <button
                  key={`tracked-${item.ticker}`}
                  type="button"
                  onClick={() => openDetailForItem(item)}
                  className="cursor-pointer rounded border border-zinc-800 bg-zinc-950/60 p-3 text-left text-sm transition hover:border-cyan-800 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
                >
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
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Inga tracked tickers i snapshoten.</p>
          )}
        </Section>

        <Section title="Position Management">
          {snapshot.positionManagement.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {snapshot.positionManagement.slice(0, 12).map((item) => (
                <button
                  key={`position-${item.ticker}`}
                  type="button"
                  onClick={() => openDetailForItem(item)}
                  className="cursor-pointer rounded border border-zinc-800 bg-zinc-950/60 p-3 text-left text-sm transition hover:border-cyan-800 hover:bg-zinc-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-zinc-100">{item.ticker}</div>
                      <div className="text-[11px] text-zinc-600">{item.company}</div>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-[10px] ${positionStateClass(item.state)}`}>{item.state}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-zinc-200">{item.decisionLabel ?? item.decision}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{item.reason ?? item.why}</p>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Trend: {trendSymbol(item.confidenceTrend)} · confidence {item.confidence} · risk {item.risk ?? "-"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">Nästa: {item.suggestedAction ?? "wait"} · {item.sourceStatus ?? item.source}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600">Ändrat: {item.whatChanged}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Inga position-management beslut i snapshoten.</p>
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
      {selectedDetail?.type === "candidate" ? (
        <CaseDrawer candidate={selectedDetail.candidate} onClose={() => setSelectedDetail(null)} />
      ) : null}
      {selectedDetail?.type === "news" ? (
        <NewsDetailDrawer
          newsTrigger={selectedDetail.newsTrigger}
          matchedCandidate={matchedCandidateForNews(snapshot, selectedDetail.newsTrigger)}
          onClose={() => setSelectedDetail(null)}
          onOpenMatchedCase={() => {
            const matchedCandidate = matchedCandidateForNews(snapshot, selectedDetail.newsTrigger);
            if (matchedCandidate) openCandidate(matchedCandidate);
          }}
        />
      ) : null}
    </main>
  );
}
