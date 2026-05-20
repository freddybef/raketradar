import type { AutonomousDiscoveryCandidate, AutonomousDiscoveryResult, DiscoveryBucket } from "@/lib/intelligence/autonomousDiscovery";
import { runAutonomousDiscoveryScan } from "@/lib/intelligence/autonomousDiscovery";
import { getLatestCaseStateSnapshots, getLatestRunChanges, type RankingChange, type RunnerCaseSnapshot } from "@/lib/db/runnerRepository";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";

export type TradingAction = "Agera" | "Bevaka" | "Het men jaga inte" | "Hog risk" | "Undvik";
export type FreshnessStatus = "activeToday" | "premarketContext" | "afterClose" | "recentMemory" | "stale";
export type SignalQuality = "FRESH_IGNITION" | "ACTIVE_CONTINUATION" | "EARLY_WATCH" | "STALLED" | "EXHAUSTED" | "DEAD" | "RECLAIM_SETUP";
export type NarrativeTriggerType =
  | "REPORT_REPRICING"
  | "COMMERCIALIZATION_SHIFT"
  | "SECOND_DERIVATIVE_THEME"
  | "OBESITY_ADJACENCY"
  | "DEFENSE_ADJACENCY"
  | "DATACENTER_INFRA"
  | "NEW_CONTRACT"
  | "REGULATORY_TRIGGER"
  | "PROFITABILITY_INFLECTION"
  | "FUNDING_SURVIVAL"
  | "UNKNOWN";

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
  freshnessStatus: FreshnessStatus;
  dataAgeMinutes: number;
  isActiveToday: boolean;
  firstSeenAt: string | null;
  lastConfirmedAt: string | null;
  freshnessMinutes: number;
  momentumAge: number;
  confirmationCount: number;
  lastExpansionAt: string | null;
  decayScore: number;
  staleReason: string | null;
  signalQuality: SignalQuality;
  narrativeTriggerType: NarrativeTriggerType;
  narrativeStrength: number;
  narrativeFreshness: number;
  thematicTailwind: number;
  repricingProbability: number;
  marketAttentionShift: number;
  hasFreshFundamentalCatalyst: boolean;
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

export type PositionManagementState =
  | "HOLD"
  | "TRIM"
  | "NO_ADD"
  | "REENTRY_WATCH"
  | "MOMENTUM_DEAD"
  | "TIGHTEN_STOP"
  | "FAILED_CONTINUATION"
  | "FIRST_PULLBACK_VALID"
  | "EXIT_RISK";

export type PositionSuggestedAction = "hold" | "trim" | "sell" | "wait" | "reentry_only" | "no_add";

export interface PositionManagementDecision {
  ticker: string;
  company?: string;
  state: PositionManagementState;
  decisionLabel: string;
  decision: string;
  reason: string;
  why: string;
  trigger: string;
  invalidation: string;
  risk: number;
  whatChanged: string;
  confidenceTrend: "up" | "down" | "flat" | "unknown";
  confidence: number;
  sourceStatus: TrackedTickerStatus;
  suggestedAction: PositionSuggestedAction;
  source: "active_candidate" | "tracked_memory" | "recently_active";
}

export type PriorityState = "MUST_ACT" | "WATCH_CLOSELY" | "REENTRY_WATCH" | "LOW_PRIORITY" | "DEAD" | "AVOID";

export interface PriorityItem {
  ticker: string;
  company?: string;
  priorityState: PriorityState;
  headline: string;
  whyNow: string;
  action: string;
  urgencyScore: number;
  confidence: number;
  sourceStatus: TrackedTickerStatus;
  freshnessStatus: FreshnessStatus;
  signalQuality?: SignalQuality;
  narrativeTriggerType?: NarrativeTriggerType;
  narrativeStrength?: number;
  freshnessMinutes: number;
  lastConfirmedAt?: string | null;
  changedFrom?: string | null;
  changedAt?: string | null;
  expiresSoon: boolean;
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
  snapshotDate: string;
  marketSessionDate: string;
  generatedAt: string;
  dataAgeMinutes: number;
  isFreshForToday: boolean;
  marketSessionPhase: "preopen" | "open" | "after_close" | "closed";
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
  positionManagement: PositionManagementDecision[];
  priorityBoard: PriorityItem[];
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

function stockholmParts(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function stockholmWeekday(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Stockholm", weekday: "short" }).format(date);
  return weekday;
}

function marketSessionPhase(date: Date): CanonicalTradingSnapshot["marketSessionPhase"] {
  const weekday = stockholmWeekday(date);
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const { minutes } = stockholmParts(date);
  if (minutes < 9 * 60) return "preopen";
  if (minutes <= 17 * 60 + 30) return "open";
  return "after_close";
}

function minutesAge(now: Date, then?: Date | null) {
  if (!then || Number.isNaN(then.getTime())) return 24 * 60;
  return Math.max(0, Math.round((now.getTime() - then.getTime()) / 60_000));
}

function buildSnapshotFreshness(now: Date, dataTimestamp?: Date | null) {
  const parts = stockholmParts(now);
  const generatedAt = now.toISOString();
  const dataAgeMinutes = minutesAge(now, dataTimestamp);
  const dataDate = dataTimestamp ? stockholmParts(dataTimestamp).dateKey : null;
  const phase = marketSessionPhase(now);
  const isSameSessionDate = dataDate === parts.dateKey;
  const isFreshForToday = phase === "open"
    ? isSameSessionDate && dataAgeMinutes <= 30
    : isSameSessionDate && dataAgeMinutes <= 120;
  return {
    snapshotDate: parts.dateKey,
    marketSessionDate: parts.dateKey,
    generatedAt,
    dataAgeMinutes,
    isFreshForToday,
    marketSessionPhase: phase,
  };
}

function candidateFreshness(asOf: string | undefined, snapshot: ReturnType<typeof buildSnapshotFreshness>): {
  freshnessStatus: FreshnessStatus;
  dataAgeMinutes: number;
  isActiveToday: boolean;
} {
  const date = asOf ? new Date(asOf) : null;
  const age = minutesAge(new Date(snapshot.generatedAt), date);
  const candidateDate = date ? stockholmParts(date).dateKey : null;
  const sameSession = candidateDate === snapshot.marketSessionDate;
  if (sameSession && snapshot.marketSessionPhase === "open" && age <= 30) {
    return { freshnessStatus: "activeToday", dataAgeMinutes: age, isActiveToday: true };
  }
  if (sameSession && snapshot.marketSessionPhase === "after_close") {
    return { freshnessStatus: "afterClose", dataAgeMinutes: age, isActiveToday: false };
  }
  if (sameSession && snapshot.marketSessionPhase === "preopen") {
    return { freshnessStatus: "premarketContext", dataAgeMinutes: age, isActiveToday: false };
  }
  if (snapshot.marketSessionPhase === "preopen" && age <= 18 * 60) {
    return { freshnessStatus: "premarketContext", dataAgeMinutes: age, isActiveToday: false };
  }
  return { freshnessStatus: age <= 48 * 60 ? "recentMemory" : "stale", dataAgeMinutes: age, isActiveToday: false };
}

function assessSignalQuality(input: {
  candidate: AutonomousDiscoveryCandidate;
  freshness: ReturnType<typeof candidateFreshness>;
  catalystScore: number;
}): {
  firstSeenAt: string | null;
  lastConfirmedAt: string | null;
  freshnessMinutes: number;
  momentumAge: number;
  confirmationCount: number;
  lastExpansionAt: string | null;
  decayScore: number;
  staleReason: string | null;
  signalQuality: SignalQuality;
} {
  const { candidate, freshness, catalystScore } = input;
  const reaction = candidate.reaction;
  const hasExpansion = reaction.intradayMomentum >= 2.5;
  const hasFreshIgnition = reaction.intradayMomentum >= 3 && reaction.relativeVolume >= 1.4 && reaction.acceleration > 0;
  const hasPersistentRvol = reaction.relativeVolume >= 1.5;
  const hasContinuation = reaction.continuationProbability >= 65;
  const hasAggression = reaction.marketAggression >= 55 || reaction.acceleration >= 1;
  const hasReclaim = reaction.label === "PULLBACK_VALID" || reaction.label === "REACCELERATION_WATCH";
  const hasFreshNarrative = catalystScore >= 70 && freshness.isActiveToday;
  const confirmationCount = [hasExpansion, hasPersistentRvol, hasContinuation, hasAggression, hasReclaim, hasFreshNarrative].filter(Boolean).length;
  let decayScore = 0;
  if (!freshness.isActiveToday) decayScore += 55;
  if (freshness.dataAgeMinutes > 20) decayScore += Math.min(28, Math.floor((freshness.dataAgeMinutes - 20) / 10) * 5);
  if (reaction.fadeProbability >= 70) decayScore += 18;
  if (reaction.label === "DEAD_BOUNCE" || reaction.label === "FAILED_MOVE") decayScore += 28;
  if (reaction.relativeVolume < 1.15) decayScore += 12;
  if (reaction.continuationProbability < 50) decayScore += 16;
  if (hasFreshNarrative) decayScore -= 10;
  if (hasFreshIgnition || (hasContinuation && hasPersistentRvol)) decayScore -= 12;
  decayScore = Math.max(0, Math.min(100, Math.round(decayScore)));
  const staleReason =
    !freshness.isActiveToday
      ? `${freshness.freshnessStatus}: saknar färsk same-day livebekräftelse`
      : reaction.label === "DEAD_BOUNCE" || reaction.label === "FAILED_MOVE"
        ? "momentum/continuation har dött efter tidigare spike"
        : reaction.fadeProbability >= 75
          ? "fade-risk dominerar färsk expansion"
          : confirmationCount < 2
            ? "saknar tillräckligt många färska confirmations"
            : null;
  const signalQuality: SignalQuality =
    decayScore >= 82 || (!freshness.isActiveToday && freshness.freshnessStatus === "stale")
      ? "DEAD"
      : reaction.fadeProbability >= 80 && reaction.intradayMomentum > 8
        ? "EXHAUSTED"
        : decayScore >= 55
          ? "STALLED"
          : hasFreshIgnition && confirmationCount >= 3
            ? "FRESH_IGNITION"
            : hasContinuation && hasPersistentRvol && hasAggression
              ? "ACTIVE_CONTINUATION"
              : hasReclaim
                ? "RECLAIM_SETUP"
                : confirmationCount >= 2
                  ? "EARLY_WATCH"
                  : "STALLED";
  const lastConfirmedAt = confirmationCount >= 2 ? reaction.asOf : null;
  return {
    firstSeenAt: reaction.asOf,
    lastConfirmedAt,
    freshnessMinutes: freshness.dataAgeMinutes,
    momentumAge: freshness.dataAgeMinutes,
    confirmationCount,
    lastExpansionAt: hasExpansion ? reaction.asOf : null,
    decayScore,
    staleReason,
    signalQuality,
  };
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

function narrativeText(candidate: AutonomousDiscoveryCandidate) {
  return [
    candidate.ticker,
    candidate.companyName,
    candidate.exchange,
    candidate.sector,
    candidate.marketCapBucket,
    candidate.liquidityBucket,
    ...candidate.labels,
    ...candidate.whyDiscovered,
    ...candidate.whyNotRankedHigher,
    ...candidate.reaction.flags,
    candidate.reaction.reason,
    candidate.reaction.label,
  ].join(" ").toLowerCase();
}

function classifyNarrativeTrigger(
  candidate: AutonomousDiscoveryCandidate,
  catalyst: { type: CatalystType; score: number; summary: string },
  freshness: ReturnType<typeof candidateFreshness>,
): {
  narrativeTriggerType: NarrativeTriggerType;
  narrativeStrength: number;
  narrativeFreshness: number;
  thematicTailwind: number;
  repricingProbability: number;
  marketAttentionShift: number;
  hasFreshFundamentalCatalyst: boolean;
} {
  const text = narrativeText(candidate);
  const reaction = candidate.reaction;
  const isSmallMid = /small|micro|nano|first north|spotlight|ngm|nordic sme/i.test(`${candidate.marketCapBucket} ${candidate.exchange}`);
  const dormantWakeup =
    reaction.intradayMomentum >= 2.5 &&
    reaction.relativeVolume >= 1.5 &&
    reaction.activeTraderAttention >= 45 &&
    reaction.fadeProbability < 72;
  const trigger: NarrativeTriggerType =
    /rapport|earnings|q[1-4]|omsättning|vinst|ebit|guidance|omvänd vinstvarning/.test(text)
      ? "REPORT_REPRICING"
      : /kommersialisering|commerciali[sz]ation|lansering|försäljning|sales ramp|produktion|scale-up|scal[e]?up|go-to-market|nanologica/.test(text)
        ? "COMMERCIALIZATION_SHIFT"
        : /glp|obesity|fetma|diabetes|novo|eli lilly|semaglutid|wegovy|ozempic|läkemedel/.test(text)
          ? "OBESITY_ADJACENCY"
          : /försvar|defense|nato|drön|drone|cyber|säkerhet|security/.test(text)
            ? "DEFENSE_ADJACENCY"
            : /datacenter|data center|ai infra|server|kraft|power|cooling|semiconductor|chip/.test(text)
              ? "DATACENTER_INFRA"
              : /order|kontrakt|avtal|ramavtal|contract|customer|kund/.test(text)
                ? "NEW_CONTRACT"
                : /fda|ce|myndighet|approval|godkänn|regulator|clinical|studie|fas /.test(text)
                  ? "REGULATORY_TRIGGER"
                  : /lönsamhet|profitability|break-even|marginal|cash flow|kassaflöde/.test(text)
                    ? "PROFITABILITY_INFLECTION"
                    : /finansiering|funding|emission|riktad emission|lånefacilitet|survival|överlevnad/.test(text)
                      ? "FUNDING_SURVIVAL"
                      : /ai|battery|batteri|uranium|uran|medtech|biotech|turnaround|restructuring|supply chain|logistik/.test(text)
                        ? "SECOND_DERIVATIVE_THEME"
                        : "UNKNOWN";
  const hasFreshFundamentalCatalyst =
    trigger !== "UNKNOWN" &&
    trigger !== "SECOND_DERIVATIVE_THEME" &&
    freshness.freshnessStatus !== "stale" &&
    freshness.freshnessStatus !== "recentMemory";
  const thematicTailwind =
    trigger === "OBESITY_ADJACENCY" || trigger === "DEFENSE_ADJACENCY" || trigger === "DATACENTER_INFRA" || trigger === "SECOND_DERIVATIVE_THEME"
      ? 72
      : trigger === "UNKNOWN"
        ? 25
        : 55;
  const narrativeFreshness = freshness.isActiveToday
    ? Math.max(35, 100 - freshness.dataAgeMinutes * 2)
    : freshness.freshnessStatus === "premarketContext" || freshness.freshnessStatus === "afterClose"
      ? 58
      : 20;
  const marketAttentionShift = Math.max(
    0,
    Math.min(100, Math.round(reaction.activeTraderAttention * 0.45 + reaction.relativeVolume * 16 + Math.max(0, reaction.acceleration) * 3)),
  );
  const repricingProbability = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        reaction.continuationProbability * 0.28 +
          reaction.abnormalMoveScore * 0.18 +
          marketAttentionShift * 0.18 +
          (hasFreshFundamentalCatalyst ? 18 : 0) +
          (isSmallMid ? 8 : 0) +
          (dormantWakeup ? 10 : 0) -
          (reaction.fadeProbability >= 75 ? 16 : 0),
      ),
    ),
  );
  const narrativeStrength = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (trigger === "UNKNOWN" ? 15 : 38) +
          catalyst.score * 0.22 +
          narrativeFreshness * 0.18 +
          thematicTailwind * 0.18 +
          repricingProbability * 0.2 +
          (dormantWakeup ? 8 : 0),
      ),
    ),
  );
  return {
    narrativeTriggerType: trigger,
    narrativeStrength,
    narrativeFreshness,
    thematicTailwind,
    repricingProbability,
    marketAttentionShift,
    hasFreshFundamentalCatalyst,
  };
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

function toTradingCandidate(
  candidate: AutonomousDiscoveryCandidate,
  change: string | undefined,
  snapshotFreshness: ReturnType<typeof buildSnapshotFreshness>,
): TradingCandidate | null {
  if (candidate.ticker.toUpperCase() === "BIOX") return null;
  if (candidate.bucket === "SUPPRESSED" && candidate.autonomousDiscoveryScore < 45) return null;
  const setupType = setupTypeFor(candidate);
  const catalyst = classifyCatalyst(candidate);
  const catalystScore = catalystWeight(candidate, catalyst);
  const freshness = candidateFreshness(candidate.reaction.asOf, snapshotFreshness);
  const narrative = classifyNarrativeTrigger(candidate, { ...catalyst, score: catalystScore }, freshness);
  const signalQuality = assessSignalQuality({ candidate, freshness, catalystScore });
  const rawAction = actionFor(candidate);
  const action: TradingAction =
    !freshness.isActiveToday
      ? freshness.freshnessStatus === "premarketContext" || freshness.freshnessStatus === "afterClose"
        ? "Bevaka"
        : "Undvik"
      : signalQuality.signalQuality === "DEAD" || signalQuality.signalQuality === "EXHAUSTED"
        ? "Undvik"
        : signalQuality.signalQuality === "STALLED" && rawAction === "Agera"
          ? "Bevaka"
          : signalQuality.confirmationCount < 2 && rawAction === "Agera"
            ? "Bevaka"
            : rawAction;
  const narrativeBoost =
    narrative.hasFreshFundamentalCatalyst && freshness.isActiveToday
      ? Math.round(narrative.narrativeStrength * 0.12 + narrative.repricingProbability * 0.08)
      : narrative.narrativeTriggerType !== "UNKNOWN" && freshness.freshnessStatus === "premarketContext"
        ? Math.round(narrative.narrativeStrength * 0.08)
        : 0;
  return {
    ticker: candidate.ticker,
    company: candidate.companyName,
    exchange: candidate.exchange,
    action,
    setupType,
    thesis: narrative.narrativeTriggerType !== "UNKNOWN" && narrative.narrativeStrength >= 55
      ? `${narrative.narrativeTriggerType.replaceAll("_", " ").toLowerCase()}: ${thesisFor(candidate, setupType, { ...catalyst, score: catalystScore })}`
      : thesisFor(candidate, setupType, { ...catalyst, score: catalystScore }),
    pros: prosFor(candidate),
    cons: consFor(candidate),
    trigger: triggerFor(candidate, setupType),
    invalidation: invalidationFor(candidate, setupType),
    continuation: candidate.reaction.continuationProbability,
    risk: riskScore(candidate),
    rvol: candidate.reaction.relativeVolume,
    movePct: candidate.reaction.intradayMomentum,
    score: Math.min(100, candidate.autonomousDiscoveryScore + narrativeBoost),
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
    freshnessStatus: freshness.freshnessStatus,
    dataAgeMinutes: freshness.dataAgeMinutes,
    isActiveToday: freshness.isActiveToday,
    ...signalQuality,
    ...narrative,
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
    freshnessStatus: "recentMemory",
    dataAgeMinutes: 24 * 60,
    isActiveToday: false,
    firstSeenAt: null,
    lastConfirmedAt: null,
    freshnessMinutes: 24 * 60,
    momentumAge: 24 * 60,
    confirmationCount: 0,
    lastExpansionAt: null,
    decayScore: 70,
    staleReason: "persisted memory utan färsk livebekräftelse",
    signalQuality: "STALLED",
    narrativeTriggerType: "UNKNOWN",
    narrativeStrength: 10,
    narrativeFreshness: 10,
    thematicTailwind: 0,
    repricingProbability: 0,
    marketAttentionShift: 0,
    hasFreshFundamentalCatalyst: false,
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

function buildFreshnessWarnings(snapshot: ReturnType<typeof buildSnapshotFreshness>) {
  const warnings = [];
  if (!snapshot.isFreshForToday) {
    warnings.push(`Snapshoten är inte färsk för dagens session (${snapshot.marketSessionDate}). Dataålder: ${snapshot.dataAgeMinutes} min.`);
  }
  if (snapshot.marketSessionPhase === "preopen") warnings.push("Pre-open: tidigare close/market memory får bara ses som kontext, inte dagens aktiva signal.");
  if (snapshot.marketSessionPhase === "after_close") warnings.push("After close: signaler är stängnings-/eftermarknadskontext, inte intraday-action.");
  if (snapshot.marketSessionPhase === "closed") warnings.push("Börsen är stängd: inga tickers ska behandlas som live opportunities utan ny scan.");
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

function confidenceTrend(current: number | null | undefined, previous: number | null | undefined): PositionManagementDecision["confidenceTrend"] {
  if (current === null || current === undefined || previous === null || previous === undefined) return "unknown";
  if (current >= previous + 7) return "up";
  if (current <= previous - 7) return "down";
  return "flat";
}

function positionStateFor(item: TrackedTicker): PositionManagementState {
  const candidate = item.candidate;
  if (!candidate) {
    if (item.status === "recentlyActive") return "REENTRY_WATCH";
    if ((item.lastKnownScore ?? 0) >= 55 || item.lastKnownState) return "MOMENTUM_DEAD";
    return "NO_ADD";
  }
  if (candidate.risk >= 85 && candidate.continuation < 50) return "EXIT_RISK";
  if (candidate.sourceBucket === "RISK" && candidate.continuation < 45) return "EXIT_RISK";
  if (candidate.sourceBucket === "PARABOLIC_WATCH" || candidate.action === "Het men jaga inte") return "TRIM";
  if (candidate.sourceBucket === "RISK" || candidate.risk >= 70) return "TIGHTEN_STOP";
  if (candidate.continuation < 45 && candidate.rvol < 1.2) return "MOMENTUM_DEAD";
  if (candidate.continuation < 55 && candidate.movePct < 0) return "FAILED_CONTINUATION";
  if (candidate.setupType === "Pullback valid" || (candidate.risk >= 45 && candidate.risk < 65 && candidate.continuation >= 60)) return "FIRST_PULLBACK_VALID";
  if (candidate.sourceBucket === "STEALTH" || candidate.action === "Bevaka") return "NO_ADD";
  return "HOLD";
}

function positionDecisionLabel(state: PositionManagementState) {
  const labels: Record<PositionManagementState, string> = {
    HOLD: "Håll vinnaren",
    TRIM: "Trimma risk",
    NO_ADD: "Ingen add",
    REENTRY_WATCH: "Re-entry watch",
    MOMENTUM_DEAD: "Momentum dött",
    TIGHTEN_STOP: "Tajta stop",
    FAILED_CONTINUATION: "Misslyckad continuation",
    FIRST_PULLBACK_VALID: "Första pullback valid",
    EXIT_RISK: "Exit-risk",
  };
  return labels[state];
}

function suggestedActionFor(state: PositionManagementState, item: TrackedTicker): PositionSuggestedAction {
  if (state === "HOLD" || state === "FIRST_PULLBACK_VALID") return "hold";
  if (state === "TRIM" || state === "TIGHTEN_STOP") return "trim";
  if (state === "EXIT_RISK") return "sell";
  if (state === "REENTRY_WATCH") return "reentry_only";
  if (state === "NO_ADD") return item.status === "trackedButNotActive" && !item.candidate ? "wait" : "no_add";
  return "wait";
}

function positionRiskFor(item: TrackedTicker, state: PositionManagementState) {
  if (item.candidate) return Math.round(item.candidate.risk);
  if (state === "EXIT_RISK" || state === "MOMENTUM_DEAD" || state === "FAILED_CONTINUATION") return 75;
  if (state === "REENTRY_WATCH" || state === "NO_ADD") return 55;
  return 45;
}

function buildPositionManagement(input: {
  trackedUniverse: TrackedTicker[];
  previousSnapshots: RunnerCaseSnapshot[];
  changes: Array<RankingChange & { createdAt?: string }>;
}): PositionManagementDecision[] {
  const previousByTicker = new Map(input.previousSnapshots.map((snapshot) => [snapshot.ticker, snapshot]));
  const interesting = input.trackedUniverse.filter((item) =>
    DEFAULT_TRACKED_TICKERS.includes(item.ticker) ||
    item.status === "activeCandidate" ||
    item.status === "recentlyActive"
  );
  return interesting.slice(0, 18).map((item) => {
    const candidate = item.candidate;
    const previous = previousByTicker.get(item.ticker);
    const state = positionStateFor(item);
    const trend = confidenceTrend(candidate?.confidence ?? item.lastKnownConfidence, previous?.confidence);
    const change = input.changes.find((entry) => entry.ticker === item.ticker)?.reason;
    const decisionText: Record<PositionManagementState, string> = {
      HOLD: "Håll/bevaka så länge triggern lever.",
      TRIM: "Ta ned risk eller undvik ny add efter stark rörelse.",
      NO_ADD: "Ingen add ännu. Vänta på bättre bekräftelse.",
      REENTRY_WATCH: "Bevaka re-entry, inte chase.",
      MOMENTUM_DEAD: "Momentum saknar färsk bekräftelse.",
      TIGHTEN_STOP: "Höj disciplinen och tajta risk.",
      FAILED_CONTINUATION: "Continuation har inte bevisat sig.",
      FIRST_PULLBACK_VALID: "Första pullbacken kan vara valid om volymen håller.",
      EXIT_RISK: "Exit-risk: skydda kapital om nästa scan inte snabbt förbättras.",
    };
    const trigger = candidate?.needsNow ?? (state === "REENTRY_WATCH" ? "ny volymvåg efter kontrollerad pullback" : "återkommer med färsk livebekräftelse");
    const invalidation = candidate?.invalidation ?? "fortsätter sakna momentum/volym i nästa scan";
    const why = candidate
      ? `${candidate.personality}: continuation ${candidate.continuation}%, risk ${candidate.risk}%, RVOL ${round(candidate.rvol, 2)}x.`
      : item.summary;
    const risk = positionRiskFor(item, state);
    const whatChanged = change
      ?? (previous
        ? `Senast känt state ${previous.state}, score ${previous.score}, confidence ${previous.confidence}.`
        : "Ingen tidigare state i snapshot memory.");
    return {
      ticker: item.ticker,
      company: item.company,
      state,
      decisionLabel: positionDecisionLabel(state),
      decision: decisionText[state],
      reason: why,
      why,
      trigger,
      invalidation,
      risk,
      whatChanged,
      confidenceTrend: trend,
      confidence: Math.round(candidate?.confidence ?? item.lastKnownConfidence ?? 0),
      sourceStatus: item.status,
      suggestedAction: suggestedActionFor(state, item),
      source: item.status === "activeCandidate" ? "active_candidate" : item.status === "recentlyActive" ? "recently_active" : "tracked_memory",
    };
  });
}

function priorityStateFor(input: {
  candidate?: TradingCandidate;
  position?: PositionManagementDecision;
  tracked: TrackedTicker;
}): PriorityState {
  const { candidate, position, tracked } = input;
  if (candidate) {
    if (candidate.signalQuality === "DEAD") return "DEAD";
    if (candidate.signalQuality === "EXHAUSTED") return "AVOID";
    if (candidate.signalQuality === "STALLED" && candidate.decayScore >= 55) return "LOW_PRIORITY";
    if (!candidate.isActiveToday) {
      if (candidate.freshnessStatus === "premarketContext" || candidate.freshnessStatus === "afterClose") return "REENTRY_WATCH";
      if (candidate.freshnessStatus === "recentMemory" && (candidate.continuation < 45 || candidate.rvol < 1.2)) return "DEAD";
      return "LOW_PRIORITY";
    }
    const majorAcceleration =
      candidate.action === "Agera" &&
      candidate.continuation >= 70 &&
      candidate.rvol >= 1.5 &&
      candidate.risk < 70 &&
      candidate.decayScore < 35 &&
      candidate.confirmationCount >= 3 &&
      candidate.sourceBucket !== "PARABOLIC_WATCH";
    if (majorAcceleration) return "MUST_ACT";
    if (
      candidate.hasFreshFundamentalCatalyst &&
      candidate.narrativeStrength >= 72 &&
      candidate.repricingProbability >= 58 &&
      candidate.decayScore < 45 &&
      candidate.risk < 75
    ) return "WATCH_CLOSELY";
    if (candidate.sourceBucket === "PARABOLIC_WATCH" || candidate.action === "Het men jaga inte" || candidate.risk >= 80) return "AVOID";
    if (candidate.continuation >= 68 && candidate.risk < 68) return "WATCH_CLOSELY";
    if (candidate.sourceBucket === "STEALTH" || candidate.setupType === "Pullback valid") return "REENTRY_WATCH";
    if (candidate.continuation < 40 && candidate.rvol < 1.15) return "DEAD";
    return "LOW_PRIORITY";
  }
  if (position?.state === "EXIT_RISK" || position?.state === "TRIM" || position?.state === "TIGHTEN_STOP") return "AVOID";
  if (position?.state === "REENTRY_WATCH" || tracked.status === "recentlyActive") return "REENTRY_WATCH";
  if (position?.state === "MOMENTUM_DEAD" || position?.state === "FAILED_CONTINUATION") return "DEAD";
  return "LOW_PRIORITY";
}

function priorityHeadline(state: PriorityState, item: TrackedTicker, candidate?: TradingCandidate) {
  const label = candidate?.personality ?? candidate?.setupType ?? item.lastKnownState ?? "Market memory";
  const freshness = candidate?.isActiveToday
    ? "ACTIVE_TODAY"
    : candidate?.freshnessStatus === "premarketContext"
      ? "PREOPEN_CONTEXT"
      : candidate?.freshnessStatus === "afterClose"
        ? "AFTER_CLOSE"
        : "RECENT/YESTERDAY";
  const labels: Record<PriorityState, string> = {
    MUST_ACT: `${item.ticker}: materiell acceleration nu`,
    WATCH_CLOSELY: `${item.ticker}: stark continuation`,
    REENTRY_WATCH: `${item.ticker}: re-entry/reclaim-bevakning`,
    LOW_PRIORITY: `${item.ticker}: låg prioritet just nu`,
    DEAD: `${item.ticker}: momentum dött`,
    AVOID: `${item.ticker}: hög risk / jaga inte`,
  };
  return candidate ? `${labels[state]} (${label} · ${freshness})` : `${labels[state]} (RECENT/YESTERDAY)`;
}

function priorityAction(state: PriorityState, position?: PositionManagementDecision, candidate?: TradingCandidate) {
  if (position?.decisionLabel) return position.decisionLabel;
  const actions: Record<PriorityState, string> = {
    MUST_ACT: "Agera aktivt: bevaka trigger/orderberedskap",
    WATCH_CLOSELY: "Bevaka nära",
    REENTRY_WATCH: "Vänta reclaim/re-entry",
    LOW_PRIORITY: "Ignorera tills ny signal",
    DEAD: "Avprioritera",
    AVOID: "Jaga inte",
  };
  if (state === "REENTRY_WATCH" && candidate?.needsNow) return candidate.needsNow;
  return actions[state];
}

function priorityWhy(state: PriorityState, item: TrackedTicker, position?: PositionManagementDecision, candidate?: TradingCandidate) {
  if (candidate) {
    if (!candidate.isActiveToday) {
      return `${candidate.ticker} är ${candidate.freshnessStatus}. Ingen MUST_ACT utan färsk same-day livebekräftelse. ${candidate.needsNow}`;
    }
    if (candidate.staleReason) return candidate.staleReason;
    if (candidate.narrativeTriggerType !== "UNKNOWN" && candidate.narrativeStrength >= 55) {
      return `WHY NOW: ${candidate.narrativeTriggerType}. Narrative ${candidate.narrativeStrength}/100, repricing ${candidate.repricingProbability}/100. ${candidate.catalystSummary}`;
    }
    if (state === "MUST_ACT") return `${candidate.continuation}% continuation, ${round(candidate.rvol, 2)}x RVOL och acceptabel fade-risk.`;
    if (state === "AVOID") return candidate.needsNow ?? "Rörelsen är viktig men för het/chase-risk just nu.";
    if (state === "WATCH_CLOSELY") return candidate.whyNow ?? candidate.thesis;
    if (state === "REENTRY_WATCH") return candidate.needsNow ?? candidate.trigger;
    if (state === "DEAD") return "Continuation och volym har tappat för mycket för aktiv prioritet.";
    return "Finns i snapshoten men saknar tillräcklig urgency jämfört med starkare case.";
  }
  return position?.reason ?? item.summary;
}

function priorityUrgency(state: PriorityState, position?: PositionManagementDecision, candidate?: TradingCandidate) {
  const base: Record<PriorityState, number> = {
    MUST_ACT: 92,
    WATCH_CLOSELY: 78,
    REENTRY_WATCH: 62,
    AVOID: 58,
    DEAD: 34,
    LOW_PRIORITY: 25,
  };
  const candidateBoost = candidate
    ? Math.min(12, Math.max(0, candidate.continuation - 65) / 2) + Math.min(8, Math.max(0, candidate.rvol - 1.5) * 4)
    : 0;
  const trendBoost = position?.confidenceTrend === "up" ? 5 : position?.confidenceTrend === "down" ? -6 : 0;
  return Math.max(0, Math.min(100, Math.round(base[state] + candidateBoost + trendBoost)));
}

function buildPriorityBoard(input: {
  trackedUniverse: TrackedTicker[];
  positionManagement: PositionManagementDecision[];
  changes: Array<RankingChange & { createdAt?: string }>;
}): PriorityItem[] {
  const positionByTicker = new Map(input.positionManagement.map((item) => [item.ticker, item]));
  const changeByTicker = new Map(input.changes.map((item) => [item.ticker, item]));
  const important = input.trackedUniverse.filter((item) => {
    const position = positionByTicker.get(item.ticker);
    return item.status !== "trackedButNotActive" || Boolean(position) || DEFAULT_TRACKED_TICKERS.includes(item.ticker);
  });
  return important
    .map((item) => {
      const candidate = item.candidate;
      const position = positionByTicker.get(item.ticker);
      const change = changeByTicker.get(item.ticker);
      const priorityState = priorityStateFor({ candidate, position, tracked: item });
      const confidence = Math.round(candidate?.confidence ?? position?.confidence ?? item.lastKnownConfidence ?? 0);
      const narrativeBoost = candidate?.hasFreshFundamentalCatalyst
        ? Math.round((candidate.narrativeStrength + candidate.repricingProbability) * 0.12)
        : candidate?.narrativeTriggerType !== "UNKNOWN"
          ? Math.round((candidate?.narrativeStrength ?? 0) * 0.05)
          : 0;
      const urgencyScore = Math.max(0, Math.min(100, priorityUrgency(priorityState, position, candidate) + narrativeBoost - Math.round((candidate?.decayScore ?? 0) * 0.55)));
      return {
        ticker: item.ticker,
        company: item.company,
        priorityState,
        headline: priorityHeadline(priorityState, item, candidate),
        whyNow: priorityWhy(priorityState, item, position, candidate),
        action: priorityAction(priorityState, position, candidate),
        urgencyScore,
        confidence,
        sourceStatus: item.status,
        freshnessStatus: candidate?.freshnessStatus ?? (item.status === "recentlyActive" ? "recentMemory" : "stale"),
        signalQuality: candidate?.signalQuality,
        narrativeTriggerType: candidate?.narrativeTriggerType,
        narrativeStrength: candidate?.narrativeStrength,
        freshnessMinutes: candidate?.freshnessMinutes ?? 24 * 60,
        lastConfirmedAt: candidate?.lastConfirmedAt ?? null,
        changedFrom: change?.changeType ?? position?.state ?? item.lastKnownState ?? null,
        changedAt: change?.createdAt ?? null,
        expiresSoon: priorityState === "MUST_ACT" || priorityState === "WATCH_CLOSELY" || priorityState === "AVOID",
      } satisfies PriorityItem;
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore || b.confidence - a.confidence || a.ticker.localeCompare(b.ticker))
    .slice(0, 18);
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
  const now = new Date();
  const dataTimestamp = discovery?.generatedAt ? new Date(discovery.generatedAt) : null;
  const snapshotFreshness = buildSnapshotFreshness(now, dataTimestamp);
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
          .map((candidate) => toTradingCandidate(candidate, changeByTicker.get(candidate.ticker), snapshotFreshness))
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
    .filter((candidate) =>
      (candidate.isActiveToday || candidate.freshnessStatus === "afterClose" || candidate.freshnessStatus === "premarketContext") &&
      (candidate.action === "Agera" || candidate.action === "Het men jaga inte" || candidate.action === "Bevaka")
    )
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
  const positionManagement = buildPositionManagement({
    trackedUniverse,
    previousSnapshots: persistedSnapshots,
    changes: changesResult?.changes ?? [],
  });
  const priorityBoard = buildPriorityBoard({
    trackedUniverse,
    positionManagement,
    changes: changesResult?.changes ?? [],
  });

  return {
    timestamp: snapshotFreshness.generatedAt,
    snapshotDate: snapshotFreshness.snapshotDate,
    marketSessionDate: snapshotFreshness.marketSessionDate,
    generatedAt: snapshotFreshness.generatedAt,
    dataAgeMinutes: snapshotFreshness.dataAgeMinutes,
    isFreshForToday: snapshotFreshness.isFreshForToday,
    marketSessionPhase: snapshotFreshness.marketSessionPhase,
    providerStatus: {
      name: yahooLiveMarketReactionProvider.name,
      status: discovery ? discovery.liveHits === 0 ? "offline" : coverage < 60 ? "partial" : "live" : "degraded",
      scanned: discovery?.scannedCount ?? 0,
      liveHits: discovery?.liveHits ?? 0,
      missing: discovery?.missingDataCount ?? 0,
      coveragePercent: coverage,
      generatedAt: discovery?.generatedAt ?? snapshotFreshness.generatedAt,
    },
    candidates,
    portfolioDecisions: [],
    topFocus: focus,
    warnings: [
      ...(discovery ? buildWarnings(discovery) : ["Live scan timeout. Visar endast senaste persistade discovery-case utan mockdata."]),
      ...buildFreshnessWarnings(snapshotFreshness),
    ],
    marketQuality: computedMarketQuality,
    whatChanged: (changesResult?.changes ?? []).slice(0, 8),
    marketPulse: buildMarketPulse(candidates, computedMarketQuality),
    catalystPulse: buildCatalystPulse(candidates),
    trackedUniverse,
    positionManagement,
    priorityBoard,
    breadth,
  };
}
