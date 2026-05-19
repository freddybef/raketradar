import type { AutonomousDiscoveryCandidate, AutonomousDiscoveryResult, DiscoveryBucket } from "@/lib/intelligence/autonomousDiscovery";
import { runAutonomousDiscoveryScan } from "@/lib/intelligence/autonomousDiscovery";
import { getLatestCaseStateSnapshots, getLatestRunChanges, type RankingChange, type RunnerCaseSnapshot } from "@/lib/db/runnerRepository";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";

export type TradingAction = "Agera" | "Bevaka" | "Het men jaga inte" | "Hog risk" | "Undvik";

export interface TradingCandidate {
  ticker: string;
  company: string;
  exchange: string;
  action: TradingAction;
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
  score: number;
  confidence: number;
  source: string;
  sourceBucket: DiscoveryBucket;
  changed?: string | null;
  asOf?: string;
  personality: string;
  whyNow: string;
  needsNow: string;
  catalystType: CatalystType;
  catalystScore: number;
  catalystSummary: string;
}

export type CatalystType =
  | "earnings_breakout"
  | "insider_accumulation"
  | "news_expansion"
  | "contract_award"
  | "sector_sympathy"
  | "retail_momentum"
  | "short_squeeze"
  | "turnaround"
  | "stealth_accumulation"
  | "biotech_binary"
  | "unknown";

export interface PortfolioDecision {
  ticker: string;
  decision: string;
  reason: string;
  risk: string;
}

export type TrackedTickerStatus = "activeCandidate" | "trackedButNotActive" | "recentlyActive" | "unknown";

export interface TrackedTicker {
  ticker: string;
  company?: string;
  status: TrackedTickerStatus;
  source: "active_candidate" | "recently_active" | "persisted_case_state" | "manual_watch" | "portfolio";
  summary: string;
  lastKnownState?: string | null;
  lastKnownScore?: number | null;
  lastKnownConfidence?: number | null;
  candidate?: TradingCandidate;
}

export interface ProviderStatus {
  name: string;
  status: "live" | "partial" | "degraded" | "offline";
  scanned: number;
  liveHits: number;
  missing: number;
  coveragePercent: number;
  generatedAt: string;
}

export interface MarketQuality {
  label: "stark" | "ok" | "svag" | "degraded";
  coveragePercent: number;
  liveHits: number;
  scannedCount: number;
  bucketCounts: Record<DiscoveryBucket, number>;
}

export interface CanonicalTradingSnapshot {
  timestamp: string;
  providerStatus: ProviderStatus;
  candidates: TradingCandidate[];
  portfolioDecisions: PortfolioDecision[];
  topFocus: TradingCandidate[];
  warnings: string[];
  marketQuality: MarketQuality;
  whatChanged: Array<RankingChange & { createdAt?: string }>;
  marketPulse: {
    label: "market aggressive" | "mixed" | "defensive" | "thin liquidity" | "crowded momentum" | "stealth rotation";
    summary: string;
    drivers: string[];
  };
  catalystPulse: {
    narrative: string;
    dominantTypes: Array<{ type: CatalystType; count: number; score: number }>;
    cases: Array<{ ticker: string; catalystType: CatalystType; summary: string; score: number }>;
  };
  trackedUniverse: TrackedTicker[];
  breadth: {
    hot: TradingCandidate[];
    watch: TradingCandidate[];
    stealth: TradingCandidate[];
    noChase: TradingCandidate[];
    recentlyActive: TradingCandidate[];
  };
}

const SNAPSHOT_SCAN_TIMEOUT_MS = 18_000;
const DEFAULT_TRACKED_TICKERS = ["KVIX", "SHT", "NEXAM", "YUBICO", "EPIS B"];

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function coveragePercent(result: AutonomousDiscoveryResult) {
  return result.scannedCount > 0 ? Math.round((result.liveHits / result.scannedCount) * 100) : 0;
}

function marketQuality(result: AutonomousDiscoveryResult): MarketQuality["label"] {
  const coverage = coveragePercent(result);
  if (coverage < 35 || result.liveHits === 0) return "degraded";
  if ((result.bucketCounts.HOT + result.bucketCounts.PARABOLIC_WATCH) >= 4 && coverage >= 65) return "stark";
  if (coverage >= 60) return "ok";
  return "svag";
}

function actionFor(candidate: AutonomousDiscoveryCandidate): TradingAction {
  const reaction = candidate.reaction;
  if (candidate.bucket === "PARABOLIC_WATCH") return "Het men jaga inte";
  if (candidate.bucket === "RISK") return "Hog risk";
  if (
    candidate.bucket === "HOT" &&
    candidate.autonomousDiscoveryScore >= 70 &&
    reaction.continuationProbability >= 68 &&
    reaction.fadeProbability < 72
  ) return "Agera";
  if (candidate.bucket === "SUPPRESSED") return "Undvik";
  return "Bevaka";
}

function setupTypeFor(candidate: AutonomousDiscoveryCandidate) {
  const label = candidate.reaction.label;
  if (candidate.bucket === "PARABOLIC_WATCH" || label === "PARABOLIC_RISK") return "Parabolic re-entry";
  if (label === "EARLY_MOMENTUM") return "Early momentum";
  if (label === "CONTINUATION" || label === "EARLY_CONTINUATION") return "Continuation";
  if (label === "PULLBACK_VALID") return "Pullback valid";
  if (label === "REACCELERATION_WATCH") return "Reacceleration";
  if (label === "STEALTH_STRENGTH" || candidate.bucket === "STEALTH") return "Stealth accumulation";
  if (candidate.reaction.squeezeProbability >= 72) return "Squeeze candidate";
  if (label === "FAKE_SPIKE") return "Retail chase risk";
  if (label === "DEAD_BOUNCE" || label === "FAILED_MOVE") return "Weak bounce";
  return candidate.bucket === "HOT" ? "Momentum leader" : "Watch setup";
}

function personalityFor(setupType: string) {
  const personalities: Record<string, string> = {
    "Early momentum": "Tidigt momentum",
    Continuation: "Momentum-ledare",
    "Stealth accumulation": "Stealth/ackumulation",
    "Parabolic re-entry": "Het men farlig",
    "Squeeze candidate": "Squeeze-kandidat",
    "Pullback valid": "Konstruktiv pullback",
    Reacceleration: "Reacceleration",
    "Retail chase risk": "Crowded/chase-risk",
    "Weak bounce": "Svag studs",
    "Momentum leader": "Momentum-ledare",
    "Watch setup": "Bevakningscase",
  };
  return personalities[setupType] ?? setupType;
}

function riskScore(candidate: AutonomousDiscoveryCandidate) {
  return Math.max(candidate.reaction.fadeProbability, candidate.sourceWeights.fakeSpikePenalty * 2, candidate.sourceWeights.liquidityPenalty * 4);
}

function sectorText(candidate: AutonomousDiscoveryCandidate) {
  return `${candidate.sector} ${candidate.companyName} ${candidate.ticker}`.toLowerCase();
}

function classifyCatalyst(candidate: AutonomousDiscoveryCandidate): { type: CatalystType; score: number; summary: string } {
  const text = [
    sectorText(candidate),
    ...candidate.labels,
    ...candidate.whyDiscovered,
    ...candidate.reaction.flags,
    candidate.reaction.label,
  ].join(" ").toLowerCase();
  const reaction = candidate.reaction;
  if (/insider|vd-köp|ceo|management buy/.test(text)) {
    return { type: "insider_accumulation", score: 82, summary: "Insider-/ägarsignal stärker caset om priset bekräftar." };
  }
  if (/rapport|earnings|vinst|omsättning|q[1-4]/.test(text)) {
    const score = reaction.continuationProbability >= 65 ? 78 : 58;
    return { type: "earnings_breakout", score, summary: "Rapport/utfall verkar vara möjlig prisdrivare med continuation-fokus." };
  }
  if (/order|kontrakt|contract|avtal|ramavtal/.test(text)) {
    return { type: "contract_award", score: 76, summary: "Order/avtal-liknande catalyst; nästa steg kräver volymbekräftelse." };
  }
  if (/biotech|medtech|pharma|fda|ce|studie|clinical|medicin/.test(text)) {
    const score = reaction.fadeProbability >= 60 ? 62 : 74;
    return { type: "biotech_binary", score, summary: "Binärt biotech/medtech-flöde: hög optionalitet men också hög fade-risk." };
  }
  if (candidate.bucket === "STEALTH" || reaction.flags.includes("stealth accumulation")) {
    return { type: "stealth_accumulation", score: 68, summary: "Tidigt volymavvikande case utan fullt crowding-tryck ännu." };
  }
  if (reaction.squeezeProbability >= 72 && reaction.relativeVolume >= 1.5) {
    return { type: "short_squeeze", score: reaction.fadeProbability >= 65 ? 64 : 78, summary: "Squeeze-liknande setup där volym och pris trycker samtidigt." };
  }
  if (reaction.intradayMomentum >= 12 || candidate.bucket === "PARABOLIC_WATCH" || candidate.bucket === "RISK") {
    return { type: "retail_momentum", score: reaction.fadeProbability >= 65 ? 52 : 70, summary: "Retail/momentum-flöde. Viktigt case, men chase-risken styr beslutet." };
  }
  if (/defense|försvar|cyber|ai|datacenter|uran|battery|metals/.test(text)) {
    return { type: "sector_sympathy", score: 62, summary: "Sektor-/temaflöde kan ge sympathy-bud snarare än bolagsspecifik catalyst." };
  }
  if (/turnaround|restructuring|rekonstruktion|strategisk/.test(text)) {
    return { type: "turnaround", score: 58, summary: "Turnaround-karaktär: intressant om marknaden börjar prisa om risken." };
  }
  if (reaction.marketAggression >= 60 || reaction.continuationProbability >= 72) {
    return { type: "news_expansion", score: 55, summary: "Priset beter sig som om en catalyst prissätts, men källan är inte verifierad i snapshot." };
  }
  return { type: "unknown", score: 35, summary: "Ingen verifierad catalyst i snapshot. Bedöm caset främst som price-action tills mer data finns." };
}

function catalystWeight(candidate: AutonomousDiscoveryCandidate, catalyst: { type: CatalystType; score: number }) {
  let score = catalyst.score;
  if (candidate.reaction.continuationProbability >= 70) score += 6;
  if (candidate.reaction.relativeVolume >= 2) score += 5;
  if (candidate.reaction.fadeProbability >= 70) score -= 12;
  if (candidate.reaction.label === "DEAD_BOUNCE" || candidate.reaction.label === "FAILED_MOVE") score -= 14;
  if (candidate.bucket === "PARABOLIC_WATCH") score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function thesisFor(candidate: AutonomousDiscoveryCandidate, setupType: string, catalyst: { type: CatalystType; score: number; summary: string }) {
  const reaction = candidate.reaction;
  const move = `${round(reaction.intradayMomentum, 2)}%`;
  const rvol = `${round(reaction.relativeVolume, 2)}x RVOL`;
  if (catalyst.type === "earnings_breakout") return `Rapportdrivet momentum: ${move} med ${rvol} och stark continuation. Marknaden verkar prisa om snarare än bara studsa.`;
  if (catalyst.type === "insider_accumulation") return `Insiderstöd bakom rörelsen. Caset lever om marknaden bekräftar signalen med fortsatt volym.`;
  if (catalyst.type === "contract_award") return `Order/avtals-catalyst: rörelsen är relevant om köpare fortsätter betala upp efter första nyhetsvågen.`;
  if (catalyst.type === "biotech_binary") return `Biotech/medtech-binäritet: hög optionalitet och hög risk. Behandla som momentum med hård invalidation.`;
  if (catalyst.type === "short_squeeze") return `Squeeze-liknande momentum: ${move} med ${rvol}. Intressant om pressen håller efter första pullback.`;
  if (catalyst.type === "retail_momentum") return `Retail/momentum-flöde: marknaden jagar redan caset. Viktigt att bevaka, men edge sitter i re-entry och disciplin.`;
  if (catalyst.type === "sector_sympathy") return `Sympathy/tema-flöde: caset rör sig med sektorintresse snarare än en helt verifierad egen catalyst.`;
  if (catalyst.type === "turnaround") return `Turnaround-liknande rörelse: marknaden börjar möjligen omvärdera risk, men behöver fortsatt bekräftelse.`;
  if (setupType === "Early momentum") {
    return `Tidigt momentum: ${move} med ${rvol}. Intressant för aktiv bevakning om volymen fortsätter och första pullbacken köps.`;
  }
  if (setupType === "Continuation") {
    return `Continuation-ledare: köpare håller trycket efter expansion. Edge finns så länge rörelsen inte tappar tempo.`;
  }
  if (setupType === "Stealth accumulation") {
    return `Stealth: volymen sticker ut innan priset har sprungit färdigt. Värt att bevaka för första tydliga expansionen.`;
  }
  if (setupType === "Parabolic re-entry") {
    return `Het men farlig: stark rörelse med chase-risk. Inte köp i fart, men viktig för pullback/re-entry om strukturen håller.`;
  }
  if (setupType === "Squeeze candidate") {
    return `Squeeze-profil: pris, volym och trader-intresse rör sig samtidigt. Nästa volymvåg avgör om caset lever vidare.`;
  }
  if (setupType === "Pullback valid") {
    return `Konstruktiv pullback: momentum har inte dött, men caset kräver reclaim och ny volym innan det blir renare.`;
  }
  if (setupType === "Reacceleration") {
    return `Reacceleration: caset försöker vakna igen efter paus. Fokus är om köparna orkar trycka igenom nästa nivå.`;
  }
  if (setupType === "Retail chase risk") {
    return `Crowded rörelse: data visar aktivitet men kvaliteten är osäker. Bara relevant om fake-spike-risken faller.`;
  }
  return `${setupType}: ${move} med ${rvol} och ${reaction.continuationProbability}% continuation.`;
}

function whyNowFor(candidate: AutonomousDiscoveryCandidate, setupType: string, catalyst: { type: CatalystType; score: number; summary: string }) {
  const reaction = candidate.reaction;
  if (catalyst.type !== "unknown") return catalyst.summary;
  if (setupType === "Parabolic re-entry") return "Marknaden är redan där, men rörelsen är för het för chase. Edge sitter i re-entry, inte i FOMO.";
  if (setupType === "Stealth accumulation") return "Volymen har börjat avvika innan priset blivit uppenbart för alla. Det är exakt typen av case som kan vakna snabbt.";
  if (reaction.marketAggression >= 65) return "Köpare attackerar aktivt just nu, med både volym och continuation bakom rörelsen.";
  if (reaction.continuationProbability >= 75) return "Continuation-kvaliteten är starkare än den råa prisrörelsen antyder.";
  if (reaction.relativeVolume >= 2) return "Volymen är tydligt onormal mot baseline, så caset förtjänar bevakning även utan perfekt catalyst.";
  return "Caset är aktivt i senaste breda scan, men behöver mer bekräftelse innan det blir huvudfokus.";
}

function needsNowFor(candidate: AutonomousDiscoveryCandidate, setupType: string) {
  if (setupType === "Parabolic re-entry") return "Vänta in kontrollerad pullback, högre botten och ny volymvåg.";
  if (setupType === "Stealth accumulation") return "Pris måste börja följa volymen utan att spread/fade ökar.";
  if (candidate.reaction.fadeProbability >= 60) return "Fade-risk måste sjunka eller reclaim måste bekräftas.";
  if (candidate.reaction.relativeVolume < 1.5) return "Behöver starkare RVOL för att gå från bevakning till aktivt fokus.";
  return "Håll första pullbacken och fortsätt trycka med volym.";
}

function prosFor(candidate: AutonomousDiscoveryCandidate) {
  const reaction = candidate.reaction;
  return [
    reaction.relativeVolume >= 1.5 ? `RVOL ${round(reaction.relativeVolume, 2)}` : null,
    reaction.intradayMomentum >= 2 ? `${round(reaction.intradayMomentum, 2)}% prisexpansion` : null,
    reaction.continuationProbability >= 65 ? `${reaction.continuationProbability}% continuation` : null,
    reaction.marketAggression >= 55 ? "marknaden attackerar aktivt" : null,
    reaction.squeezeProbability >= 70 ? "squeeze-build" : null,
    candidate.bucket === "STEALTH" ? "tidig/stealth-volym" : null,
    candidate.sourceTags.includes("Found autonomously") ? "hittad autonomt" : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);
}

function consFor(candidate: AutonomousDiscoveryCandidate) {
  const reaction = candidate.reaction;
  return [
    reaction.fadeProbability >= 55 ? `${reaction.fadeProbability}% fade-risk` : null,
    reaction.relativeVolume < 1.2 ? "svag RVOL-bekräftelse" : null,
    candidate.liquidityBucket === "thin" ? "tunn likviditet" : null,
    candidate.whyNotRankedHigher.some((reason) => /news|catalyst/i.test(reason)) ? "saknar tydlig nyhetsbekräftelse" : null,
    candidate.suppressionReasons.length > 0 ? candidate.suppressionReasons[0] : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);
}

function triggerFor(candidate: AutonomousDiscoveryCandidate, setupType: string) {
  if (setupType === "Parabolic re-entry") return "kontrollerad pullback, ny volymvåg och högre botten";
  if (setupType === "Stealth accumulation") return "pris börjar följa volymen utan att fade-risk ökar";
  if (setupType === "Pullback valid") return "reclaim av intraday-range med stigande volym";
  return "håller första pullbacken och volymen fortsätter";
}

function invalidationFor(candidate: AutonomousDiscoveryCandidate, setupType: string) {
  if (setupType === "Parabolic re-entry") return "snabb fade, wide spread eller misslyckad reclaim";
  if (candidate.reaction.fadeProbability >= 70) return "fade-risk bekräftas och köparna släpper nivån";
  return "volymen dör eller rörelsen tappar intraday-struktur";
}

function candidateSource(candidate: AutonomousDiscoveryCandidate) {
  const tags = candidate.sourceTags.join(", ");
  return tags ? `${tags} / ${candidate.bucket}` : `Autonomous discovery / ${candidate.bucket}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function toTradingCandidate(candidate: AutonomousDiscoveryCandidate, change?: string): TradingCandidate | null {
  if (candidate.ticker.toUpperCase() === "BIOX") return null;
  if (candidate.bucket === "SUPPRESSED" && candidate.autonomousDiscoveryScore < 45) return null;
  const setupType = setupTypeFor(candidate);
  const catalyst = classifyCatalyst(candidate);
  const catalystScore = catalystWeight(candidate, catalyst);
  return {
    ticker: candidate.ticker,
    company: candidate.companyName,
    exchange: candidate.exchange,
    action: actionFor(candidate),
    setupType,
    thesis: thesisFor(candidate, setupType, { ...catalyst, score: catalystScore }),
    pros: prosFor(candidate),
    cons: consFor(candidate),
    trigger: triggerFor(candidate, setupType),
    invalidation: invalidationFor(candidate, setupType),
    continuation: candidate.reaction.continuationProbability,
    risk: riskScore(candidate),
    rvol: candidate.reaction.relativeVolume,
    movePct: candidate.reaction.intradayMomentum,
    score: candidate.autonomousDiscoveryScore,
    confidence: candidate.discoveryConfidence,
    source: candidateSource(candidate),
    sourceBucket: candidate.bucket,
    changed: change ?? null,
    asOf: candidate.reaction.asOf,
    personality: personalityFor(setupType),
    whyNow: whyNowFor(candidate, setupType, { ...catalyst, score: catalystScore }),
    needsNow: needsNowFor(candidate, setupType),
    catalystType: catalyst.type,
    catalystScore,
    catalystSummary: catalyst.summary,
  };
}

function numberFromPayload(payload: Record<string, unknown>, key: string, fallback = 0) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toPersistedCandidate(snapshot: RunnerCaseSnapshot, change?: string): TradingCandidate | null {
  if (snapshot.ticker.toUpperCase() === "BIOX") return null;
  const rawRoot = snapshot.rawPayload as { raw?: { live?: Record<string, unknown> } } | null;
  const live = rawRoot?.raw?.live ?? {};
  const movePct = numberFromPayload(live, "intradayMomentum");
  const rvol = numberFromPayload(live, "relativeVolume");
  const continuation = numberFromPayload(live, "continuationProbability");
  const fade = numberFromPayload(live, "fadeProbability", snapshot.risk);
  const label = String(live.label ?? snapshot.state ?? "WATCH");
  const sourceBucket: DiscoveryBucket =
    movePct > 20 && continuation >= 65 && fade >= 55
      ? "PARABOLIC_WATCH"
      : snapshot.score >= 70 && continuation >= 65
        ? "HOT"
        : rvol >= 1.35 && movePct > 0
          ? "STEALTH"
          : fade >= 70
            ? "RISK"
            : "WATCH";
  const action: TradingAction =
    sourceBucket === "PARABOLIC_WATCH"
      ? "Het men jaga inte"
      : sourceBucket === "RISK"
        ? "Hog risk"
        : sourceBucket === "HOT"
          ? "Agera"
          : "Bevaka";
  const setupType =
    sourceBucket === "PARABOLIC_WATCH"
      ? "Parabolic re-entry"
      : label === "EARLY_MOMENTUM"
        ? "Early momentum"
        : label === "CONTINUATION"
          ? "Continuation"
          : sourceBucket === "STEALTH"
            ? "Stealth accumulation"
            : "Watch setup";
  return {
    ticker: snapshot.ticker,
    company: snapshot.ticker,
    exchange: "",
    action,
    setupType,
    thesis: `Momentumet var nyligen aktivt: ${round(movePct, 2)}% move, ${round(rvol, 2)}x RVOL och ${round(continuation)}% continuation. Det lever bara om färsk volym bekräftar igen.`,
    pros: [
      rvol >= 1.5 ? `RVOL ${round(rvol, 2)}` : null,
      movePct >= 2 ? `${round(movePct, 2)}% prisexpansion` : null,
      continuation >= 65 ? `${round(continuation)}% continuation` : null,
    ].filter((item): item is string => Boolean(item)),
    cons: ["aggressionen är inte längre bekräftad live", fade >= 55 ? `${round(fade)}% fade-risk` : null].filter((item): item is string => Boolean(item)),
    trigger: sourceBucket === "PARABOLIC_WATCH" ? "ny volymvåg efter kontrollerad pullback" : "färsk live-scan bekräftar samma setup",
    invalidation: "ny live-scan tappar kandidat eller volymen dör",
    continuation,
    risk: fade,
    rvol,
    movePct,
    score: snapshot.score,
    confidence: snapshot.confidence,
    source: `Persisted case-state / ${sourceBucket}`,
    sourceBucket,
    changed: change ?? null,
    personality: personalityFor(setupType),
    whyNow: "Momentumet var nyligen på tavlan, men senaste livebekräftelsen är svagare. Behandla som re-check, inte som blankt köp-case.",
    needsNow: sourceBucket === "PARABOLIC_WATCH" ? "Färsk live-scan måste bekräfta re-entry-läge." : "Ny live-scan måste bekräfta att momentum fortfarande lever.",
    catalystType: "unknown",
    catalystScore: 30,
    catalystSummary: "Ingen tydlig färsk catalyst i tavlan; caset kräver ny volym/aggression för att bli relevant igen.",
  };
}

function sortCandidates(a: TradingCandidate, b: TradingCandidate) {
  const order: Record<TradingAction, number> = {
    Agera: 0,
    "Het men jaga inte": 1,
    Bevaka: 2,
    "Hog risk": 3,
    Undvik: 4,
  };
  return order[a.action] - order[b.action] || b.score - a.score || b.continuation - a.continuation;
}

function buildWarnings(result: AutonomousDiscoveryResult) {
  const warnings = [];
  const coverage = coveragePercent(result);
  if (result.liveHits === 0) warnings.push("Live discovery saknar träffar just nu. Inga kandidater fabriceras.");
  if (coverage < 60) warnings.push(`Provider coverage är låg: ${coverage}% (${result.liveHits}/${result.scannedCount}).`);
  if (result.bucketCounts.PARABOLIC_WATCH + result.bucketCounts.RISK > result.bucketCounts.HOT + result.bucketCounts.STEALTH) {
    warnings.push("Marknaden har fler chase/risk-movers än rena early setups.");
  }
  return warnings;
}

function uniqByTicker(candidates: TradingCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.ticker)) return false;
    seen.add(candidate.ticker);
    return true;
  });
}

function buildRecentlyActive(candidates: TradingCandidate[], snapshots: RunnerCaseSnapshot[], changes: Array<RankingChange & { createdAt?: string }>) {
  const current = new Set(candidates.map((candidate) => candidate.ticker));
  return uniqByTicker(
    snapshots
      .filter((snapshot) => snapshot.source === "discovery" && !current.has(snapshot.ticker) && snapshot.ticker.toUpperCase() !== "BIOX")
      .filter((snapshot) => snapshot.score >= 55 || snapshot.state === "HIGH_CONVICTION" || snapshot.state === "EARLY_CONTINUATION")
      .map((snapshot) => {
        const reason = changes.find((change) => change.ticker === snapshot.ticker)?.reason;
        return toPersistedCandidate(snapshot, reason ?? "Nyligen aktivt, men inte i senaste topplista.");
      })
      .filter((candidate): candidate is TradingCandidate => Boolean(candidate)),
  ).slice(0, 8);
}

function trackedSummary(candidate: TradingCandidate) {
  if (candidate.action === "Het men jaga inte") return `${candidate.ticker} är aktiv men no-chase: ${candidate.needsNow}`;
  if (candidate.sourceBucket === "STEALTH") return `${candidate.ticker} är aktiv som stealth/early watch: ${candidate.needsNow}`;
  return `${candidate.ticker} är aktiv i senaste tavlan: ${candidate.action}, ${candidate.personality}.`;
}

function buildTrackedUniverse(input: {
  candidates: TradingCandidate[];
  recentlyActive: TradingCandidate[];
  snapshots: RunnerCaseSnapshot[];
}): TrackedTicker[] {
  const tracked = new Map<string, TrackedTicker>();
  for (const candidate of input.candidates) {
    tracked.set(candidate.ticker, {
      ticker: candidate.ticker,
      company: candidate.company,
      status: "activeCandidate",
      source: "active_candidate",
      summary: trackedSummary(candidate),
      lastKnownState: candidate.sourceBucket,
      lastKnownScore: candidate.score,
      lastKnownConfidence: candidate.confidence,
      candidate,
    });
  }
  for (const candidate of input.recentlyActive) {
    if (tracked.has(candidate.ticker)) continue;
    tracked.set(candidate.ticker, {
      ticker: candidate.ticker,
      company: candidate.company,
      status: "recentlyActive",
      source: "recently_active",
      summary: `${candidate.ticker} var nyligen aktiv men är inte toppkandidat just nu. ${candidate.needsNow}`,
      lastKnownState: candidate.sourceBucket,
      lastKnownScore: candidate.score,
      lastKnownConfidence: candidate.confidence,
      candidate,
    });
  }
  for (const snapshot of input.snapshots) {
    if (snapshot.ticker.toUpperCase() === "BIOX" || tracked.has(snapshot.ticker) || snapshot.source !== "discovery") continue;
    tracked.set(snapshot.ticker, {
      ticker: snapshot.ticker,
      company: snapshot.ticker,
      status: "trackedButNotActive",
      source: "persisted_case_state",
      summary: `${snapshot.ticker} finns i market memory men är inte aktiv toppkandidat i senaste scan.`,
      lastKnownState: snapshot.state,
      lastKnownScore: snapshot.score,
      lastKnownConfidence: snapshot.confidence,
    });
  }
  for (const ticker of DEFAULT_TRACKED_TICKERS) {
    if (tracked.has(ticker)) continue;
    tracked.set(ticker, {
      ticker,
      company: ticker,
      status: "trackedButNotActive",
      source: "manual_watch",
      summary: `${ticker} är manuellt tracked, men saknar färsk livebekräftelse i senaste snapshot.`,
      lastKnownState: null,
      lastKnownScore: null,
      lastKnownConfidence: null,
    });
  }
  const order: Record<TrackedTickerStatus, number> = {
    activeCandidate: 0,
    recentlyActive: 1,
    trackedButNotActive: 2,
    unknown: 3,
  };
  return [...tracked.values()]
    .sort((a, b) => order[a.status] - order[b.status] || a.ticker.localeCompare(b.ticker))
    .slice(0, 80);
}

function buildMarketPulse(candidates: TradingCandidate[], quality: MarketQuality): CanonicalTradingSnapshot["marketPulse"] {
  const hot = candidates.filter((candidate) => candidate.sourceBucket === "HOT").length;
  const stealth = candidates.filter((candidate) => candidate.sourceBucket === "STEALTH").length;
  const noChase = candidates.filter((candidate) => candidate.action === "Het men jaga inte" || candidate.action === "Hog risk").length;
  const avgRvol = candidates.length > 0 ? candidates.reduce((sum, candidate) => sum + candidate.rvol, 0) / candidates.length : 0;
  const avgContinuation = candidates.length > 0 ? candidates.reduce((sum, candidate) => sum + candidate.continuation, 0) / candidates.length : 0;
  const drivers = [
    `${hot} HOT`,
    `${stealth} stealth`,
    `${noChase} no-chase/risk`,
    `${Math.round(avgContinuation)}% snitt-continuation`,
    `${round(avgRvol, 2)}x snitt-RVOL`,
  ];
  if (quality.coveragePercent < 55) {
    return { label: "thin liquidity", summary: "Datatäckningen är för låg för bred attack. Kör selektivt och kräv bekräftelse.", drivers };
  }
  if (noChase >= hot + stealth && noChase >= 3) {
    return { label: "crowded momentum", summary: "Många movers är redan heta. Fokus bör ligga på re-entry och att inte jaga.", drivers };
  }
  if (hot >= 3 && avgContinuation >= 65) {
    return { label: "market aggressive", summary: "Marknaden attackerar flera svenska case samtidigt. Momentum finns, men filtrera chase-risk.", drivers };
  }
  if (stealth >= hot && stealth >= 2) {
    return { label: "stealth rotation", summary: "Flera case visar volym före tydlig prisexplosion. Bra miljö för tidig bevakning.", drivers };
  }
  if (hot === 0 && stealth === 0) {
    return { label: "defensive", summary: "Få rena momentumcase. Vänta på bättre bekräftelse och undvik att tvinga trades.", drivers };
  }
  return { label: "mixed", summary: "Blandat flöde: några aktiva case, men kvaliteten varierar mellan momentum och risk.", drivers };
}

function buildCatalystPulse(candidates: TradingCandidate[]): CanonicalTradingSnapshot["catalystPulse"] {
  const scored = candidates.filter((candidate) => candidate.catalystType !== "unknown" || candidate.catalystScore >= 45);
  const counts = new Map<CatalystType, { count: number; score: number }>();
  for (const candidate of scored) {
    const current = counts.get(candidate.catalystType) ?? { count: 0, score: 0 };
    current.count += 1;
    current.score += candidate.catalystScore;
    counts.set(candidate.catalystType, current);
  }
  const dominantTypes = [...counts.entries()]
    .map(([type, value]) => ({ type, count: value.count, score: Math.round(value.score / value.count) }))
    .sort((a, b) => b.count * b.score - a.count * a.score)
    .slice(0, 4);
  const top = dominantTypes[0];
  const narrative = top
    ? top.type === "retail_momentum"
      ? "Retail/momentum-flöde dominerar. Viktigt att skilja aktivt momentum från chase."
      : top.type === "stealth_accumulation"
        ? "Stealth-volym syns i flera case. Marknaden kan rotera innan rubrikerna kommer."
        : top.type === "short_squeeze"
          ? "Squeeze-profiler är aktiva. Bevakning ja, chase nej."
          : top.type === "biotech_binary"
            ? "Biotech/medtech har binär momentumkaraktär. Hög optionalitet, hög risk."
            : `${top.type.replaceAll("_", " ")} driver flera case i dagens snapshot.`
    : "Ingen tydlig catalyst-dominans. Price action styr tills nyheter/insiders bekräftar.";
  return {
    narrative,
    dominantTypes,
    cases: candidates
      .filter((candidate) => candidate.catalystType !== "unknown")
      .sort((a, b) => b.catalystScore - a.catalystScore)
      .slice(0, 8)
      .map((candidate) => ({
        ticker: candidate.ticker,
        catalystType: candidate.catalystType,
        summary: candidate.catalystSummary,
        score: candidate.catalystScore,
      })),
  };
}

export async function buildCanonicalTradingSnapshot(): Promise<CanonicalTradingSnapshot> {
  const [discovery, changesResult] = await Promise.all([
    withTimeout(runAutonomousDiscoveryScan({ provider: yahooLiveMarketReactionProvider }), SNAPSHOT_SCAN_TIMEOUT_MS),
    getLatestRunChanges().catch(() => null),
  ]);
  const changeByTicker = new Map<string, string>();
  for (const change of changesResult?.changes ?? []) {
    if (!changeByTicker.has(change.ticker)) changeByTicker.set(change.ticker, change.reason);
  }
  const persistedSnapshotsPromise = getLatestCaseStateSnapshots(80).catch(() => [] as RunnerCaseSnapshot[]);
  const candidates = discovery
    ? (() => {
        const allDiscovery = [
          ...discovery.hotMovers,
          ...discovery.stealthMovers,
          ...discovery.watchMovers,
          ...discovery.highRiskParabolicMovers,
          ...discovery.candidates,
        ];
        const seen = new Set<string>();
        return allDiscovery
          .filter((candidate) => {
            if (seen.has(candidate.ticker)) return false;
            seen.add(candidate.ticker);
            return true;
          })
          .map((candidate) => toTradingCandidate(candidate, changeByTicker.get(candidate.ticker)))
          .filter((candidate): candidate is TradingCandidate => Boolean(candidate))
          .sort(sortCandidates)
          .slice(0, 18);
      })()
    : (await persistedSnapshotsPromise)
        .filter((snapshot) => snapshot.source === "discovery")
        .map((snapshot) => toPersistedCandidate(snapshot, changeByTicker.get(snapshot.ticker)))
        .filter((candidate): candidate is TradingCandidate => Boolean(candidate))
        .sort(sortCandidates)
        .slice(0, 18);
  const focus = candidates
    .filter((candidate) => candidate.action === "Agera" || candidate.action === "Het men jaga inte" || candidate.action === "Bevaka")
    .slice(0, 5);
  const coverage = discovery ? coveragePercent(discovery) : 0;
  const bucketCounts = discovery
    ? discovery.bucketCounts
    : {
        HOT: candidates.filter((candidate) => candidate.sourceBucket === "HOT").length,
        WATCH: candidates.filter((candidate) => candidate.sourceBucket === "WATCH").length,
        STEALTH: candidates.filter((candidate) => candidate.sourceBucket === "STEALTH").length,
        PARABOLIC_WATCH: candidates.filter((candidate) => candidate.sourceBucket === "PARABOLIC_WATCH").length,
        RISK: candidates.filter((candidate) => candidate.sourceBucket === "RISK").length,
        SUPPRESSED: candidates.filter((candidate) => candidate.sourceBucket === "SUPPRESSED").length,
      };
  const computedMarketQuality: MarketQuality = {
    label: discovery ? marketQuality(discovery) : "degraded",
    coveragePercent: coverage,
    liveHits: discovery?.liveHits ?? 0,
    scannedCount: discovery?.scannedCount ?? 0,
    bucketCounts,
  };
  const persistedSnapshots = await persistedSnapshotsPromise;
  const recentlyActive = buildRecentlyActive(candidates, persistedSnapshots, changesResult?.changes ?? []);
  const breadth = {
    hot: candidates.filter((candidate) => candidate.sourceBucket === "HOT").slice(0, 8),
    watch: candidates.filter((candidate) => candidate.sourceBucket === "WATCH").slice(0, 10),
    stealth: candidates.filter((candidate) => candidate.sourceBucket === "STEALTH").slice(0, 8),
    noChase: candidates.filter((candidate) => candidate.sourceBucket === "PARABOLIC_WATCH" || candidate.sourceBucket === "RISK" || candidate.action === "Het men jaga inte").slice(0, 8),
    recentlyActive,
  };
  const trackedUniverse = buildTrackedUniverse({ candidates, recentlyActive, snapshots: persistedSnapshots });

  return {
    timestamp: new Date().toISOString(),
    providerStatus: {
      name: yahooLiveMarketReactionProvider.name,
      status: discovery ? discovery.liveHits === 0 ? "offline" : coverage < 60 ? "partial" : "live" : "degraded",
      scanned: discovery?.scannedCount ?? 0,
      liveHits: discovery?.liveHits ?? 0,
      missing: discovery?.missingDataCount ?? 0,
      coveragePercent: coverage,
      generatedAt: discovery?.generatedAt ?? new Date().toISOString(),
    },
    candidates,
    portfolioDecisions: [],
    topFocus: focus,
    warnings: discovery ? buildWarnings(discovery) : ["Live scan timeout. Visar endast senaste persistade discovery-case utan mockdata."],
    marketQuality: computedMarketQuality,
    whatChanged: (changesResult?.changes ?? []).slice(0, 8),
    marketPulse: buildMarketPulse(candidates, computedMarketQuality),
    catalystPulse: buildCatalystPulse(candidates),
    trackedUniverse,
    breadth,
  };
}
