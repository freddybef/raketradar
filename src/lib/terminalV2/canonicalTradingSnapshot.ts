import type { AutonomousDiscoveryCandidate, AutonomousDiscoveryResult, DiscoveryBucket } from "@/lib/intelligence/autonomousDiscovery";
import { runAutonomousDiscoveryScan } from "@/lib/intelligence/autonomousDiscovery";
import { getLatestCaseStateSnapshots, getLatestRunChanges, type RankingChange, type RunnerCaseSnapshot } from "@/lib/db/runnerRepository";
import { getSwedishEquityUniverse } from "@/lib/market/swedishEquityUniverse";
import { fetchLatestNewsHeadlinesWithFallback, type FeedHealthEntry } from "@/lib/newsIngestion";
import { parseNewsTriggers, type NewsTrigger, type TriggerVerificationState } from "@/lib/newsTriggerParsing";
import { yahooLiveMarketReactionProvider } from "@/lib/providers/liveMarketReactionProvider";

export type TradingAction = "Agera" | "Bevaka" | "Het men jaga inte" | "Hog risk" | "Undvik";
export type FreshnessStatus = "activeToday" | "premarketContext" | "afterClose" | "recentMemory" | "stale";
export type SignalQuality = "FRESH_IGNITION" | "ACTIVE_CONTINUATION" | "EARLY_WATCH" | "STALLED" | "EXHAUSTED" | "DEAD" | "RECLAIM_SETUP";
export type RepricingPhase = "DEAD" | "AWAKENING" | "REPRICING" | "CROWDED" | "EXHAUSTION";
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
  dayChangePct: number;
  intradayMomentumPct: number;
  score: number;
  confidence: number;
  source: string;
  sourceBucket: DiscoveryBucket;
  finalState: DiscoveryBucket;
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
  repricingPhase: RepricingPhase;
  narrativeTriggerType: NarrativeTriggerType;
  narrativeStrength: number;
  narrativeFreshness: number;
  thematicTailwind: number;
  repricingProbability: number;
  marketAttentionShift: number;
  hasFreshFundamentalCatalyst: boolean;
  discoveryScore: number;
  triggerVerificationState: TriggerVerificationState;
  newsTriggerType: string | null;
  newsAgeHours: number | null;
  catalystBoostApplied: boolean;
}

export type CatalystType =
  | "earnings_breakout"
  | "insider_accumulation"
  | "news_expansion"
  | "contract_award"
  | "regulatory_catalyst"
  | "study_result"
  | "bid_event"
  | "financing"
  | "guidance_change"
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
  liveDataStatus: "fresh" | "partial" | "missing" | "memory_only";
  liveDataMissingReason?: string | null;
  attemptedSymbols?: string[];
  workingAlias?: string | null;
  livePrice?: number | null;
  liveVolume?: number | null;
  liveRvol?: number | null;
  liveDayChangePct?: number | null;
  liveIntradayMomentumPct?: number | null;
  liveAsOf?: string | null;
  providerAttempts?: Array<{
    symbol: string;
    range: "1d" | "1mo";
    interval: "5m" | "1d";
    statusCode: number | null;
    error: string | null;
    hasQuote: boolean;
    hasVolume: boolean;
    bars: number;
  }>;
  quoteStatus?: "present" | "missing";
  volumeStatus?: "present" | "missing";
  rvolStatus?: "available" | "missing_daily_baseline" | "missing_volume" | "missing_quote";
}

export interface LiveCoverageAuditItem {
  ticker: string;
  company?: string;
  liveDataStatus: "fresh" | "partial" | "missing" | "memory_only" | "not_tracked";
  providerSymbol: string | null;
  fetchStatus: "success" | "partial" | "failed" | "not_attempted";
  quoteStatus: "present" | "missing" | "unknown";
  volumeStatus: "present" | "missing" | "unknown";
  rvolStatus: "available" | "missing_daily_baseline" | "missing_volume" | "missing_quote" | "unknown";
  price: number | null;
  volume: number | null;
  rvol: number | null;
  dayChangePct: number | null;
  intradayMomentumPct: number | null;
  asOf: string | null;
  attemptedSymbols: string[];
  lastError: string | null;
  statusCodes: Array<number | null>;
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
  discoveryScore?: number;
  triggerVerificationState?: TriggerVerificationState;
}

export interface EarlyRadarItem {
  ticker: string;
  company?: string | null;
  rank: number;
  radarReason: string;
  preOpenTrigger: string;
  narrativeTriggerType: NarrativeTriggerType;
  triggerStrength: number;
  marketCapSensitivity: number;
  secondDerivativeScore: number;
  watchBeforeOpen: boolean;
  confirmationNeeded: string;
  invalidation: string;
  priorityScore: number;
  source: "newsTrigger" | "trackedMemory" | "candidate" | "hybrid";
  status: "PREOPEN_WATCH" | "OPEN_CONFIRMATION_NEEDED" | "ACTIVE_CONFIRMED" | "REJECTED";
  triggerVerificationState: TriggerVerificationState;
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
  newsProviderStatus: {
    providerName: string;
    mode: "mock" | "manual" | "rss" | "api" | "disabled";
    isLive: boolean;
    isConfigured: boolean;
    lastFetchAt: string;
    error: string | null;
    headlineCount: number;
    feedHealth: FeedHealthEntry[];
  };
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
  liveCoverageAudit: LiveCoverageAuditItem[];
  positionManagement: PositionManagementDecision[];
  priorityBoard: PriorityItem[];
  newsTriggers: NewsTrigger[];
  catalystRankingDebug: Array<{
    ticker: string;
    triggerType: string | null;
    verified: boolean;
    newsAgeHours: number | null;
    catalystBoostApplied: boolean;
    finalState: DiscoveryBucket;
  }>;
  earlyRadar: EarlyRadarItem[];
  breadth: {
    hot: TradingCandidate[];
    watch: TradingCandidate[];
    stealth: TradingCandidate[];
    noChase: TradingCandidate[];
    recentlyActive: TradingCandidate[];
  };
}

const SNAPSHOT_SCAN_TIMEOUT_MS = 18_000;
const DEFAULT_TRACKED_TICKERS = ["KVIX", "SHT", "NEXAM", "YUBICO", "EPIS B", "GOMX", "MILDEF", "SIVE", "AAC", "CLAV"];
const LIVE_COVERAGE_AUDIT_TICKERS = ["SHT", "SIVE", "AAC", "KVIX", "YUBICO", "MILDEF"];
const UNIVERSE_BY_TICKER = new Map(getSwedishEquityUniverse().map((entry) => [entry.ticker.trim().toUpperCase(), entry]));

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function tickerKey(ticker: string) {
  return ticker.trim().toUpperCase();
}

function newsAgeHours(publishedAt: string, now = new Date()) {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 3_600_000);
}

function isActionableCatalystType(triggerType: string) {
  return [
    "ORDER_CONTRACT",
    "FDA",
    "STUDY_RESULT",
    "BID",
    "EMISSION",
    "FINANCING",
    "FUNDING",
    "GUIDANCE",
    "PROFIT_WARNING",
    "REGULATORY",
  ].includes(triggerType);
}

function hasHighConfidenceNewsMatch(candidate: AutonomousDiscoveryCandidate, trigger: NewsTrigger) {
  if (!trigger.ticker || tickerKey(trigger.ticker) !== tickerKey(candidate.ticker)) return false;
  const headline = trigger.headline.toLowerCase();
  const company = (trigger.company ?? candidate.companyName).toLowerCase();
  const companyStem = company
    .replace(/\bab\b/g, "")
    .replace(/\bgroup\b/g, "")
    .replace(/\bholding\b/g, "")
    .replace(/\(publ\)/g, "")
    .split(/\s+/)
    .find((part) => part.length >= 4);
  const tickerStem = tickerKey(candidate.ticker).replace(/\s[AB]$/, "").toLowerCase();
  return headline.includes(tickerStem) || (companyStem ? headline.includes(companyStem) : Boolean(trigger.company));
}

function hasActionableVerifiedCatalyst(candidate: AutonomousDiscoveryCandidate, trigger?: NewsTrigger) {
  if (!trigger) return false;
  const age = newsAgeHours(trigger.publishedAt);
  return trigger.triggerVerificationState === "VERIFIED" &&
    trigger.isFreshToday &&
    age !== null &&
    age < 6 &&
    isActionableCatalystType(trigger.triggerType) &&
    hasHighConfidenceNewsMatch(candidate, trigger);
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
  const hasPersistentRvol = reaction.relativeVolume >= 1.55;
  const hasParticipation = hasPersistentRvol && reaction.activeTraderAttention >= 40 && reaction.marketAggression >= 45;
  const hasFreshIgnition = reaction.intradayMomentum >= 3 && hasParticipation && reaction.acceleration > 0;
  const hasContinuation = reaction.continuationProbability >= 65 && hasParticipation;
  const hasAggression = hasParticipation && (reaction.marketAggression >= 55 || reaction.acceleration >= 1);
  const hasReclaim = reaction.label === "PULLBACK_VALID" || reaction.label === "REACCELERATION_WATCH";
  const hasFreshNarrative = catalystScore >= 70 && freshness.isActiveToday;
  const confirmationCount = [hasExpansion, hasPersistentRvol, hasParticipation, hasContinuation, hasAggression, hasReclaim, hasFreshNarrative].filter(Boolean).length;
  let decayScore = 0;
  if (!freshness.isActiveToday) decayScore += 55;
  if (freshness.dataAgeMinutes > 20) decayScore += Math.min(28, Math.floor((freshness.dataAgeMinutes - 20) / 10) * 5);
  if (reaction.fadeProbability >= 70) decayScore += 18;
  if (reaction.label === "DEAD_BOUNCE" || reaction.label === "FAILED_MOVE") decayScore += 28;
  if (reaction.relativeVolume < 1.15) decayScore += 28;
  else if (reaction.relativeVolume < 1.35) decayScore += 16;
  if (reaction.activeTraderAttention < 35 || reaction.marketAggression < 35) decayScore += 10;
  if (reaction.continuationProbability < 50) decayScore += 16;
  if (hasFreshNarrative) decayScore -= 10;
  if (hasFreshIgnition || (hasContinuation && hasParticipation)) decayScore -= 12;
  decayScore = Math.max(0, Math.min(100, Math.round(decayScore)));
  const staleReason =
    !freshness.isActiveToday
      ? `${freshness.freshnessStatus}: saknar färsk same-day livebekräftelse`
      : reaction.label === "DEAD_BOUNCE" || reaction.label === "FAILED_MOVE"
        ? "momentum/continuation har dött efter tidigare spike"
        : reaction.relativeVolume < 1.15
          ? "prisrörelsen saknar deltagande: RVOL är för låg för continuation-ledare"
        : reaction.activeTraderAttention < 35 || reaction.marketAggression < 35
          ? "svag participation/aggression bakom rörelsen"
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
            : hasContinuation && hasParticipation && hasAggression
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

export interface RepricingPhaseInput {
  dayChangePct: number;
  intradayMomentumPct: number;
  rvol: number;
  continuation: number;
  risk: number;
  isActiveToday: boolean;
  freshnessStatus: FreshnessStatus;
  signalQuality?: SignalQuality;
  hasFreshFundamentalCatalyst?: boolean;
  triggerVerificationState?: TriggerVerificationState;
  sourceBucket?: DiscoveryBucket;
  recentlyActive?: boolean;
}

export function classifyRepricingPhase(input: RepricingPhaseInput): RepricingPhase {
  const move = Math.max(input.dayChangePct, input.intradayMomentumPct);
  const hasSessionContext =
    input.isActiveToday || input.freshnessStatus === "premarketContext" || input.freshnessStatus === "afterClose";
  const verifiedOrNarrative = input.hasFreshFundamentalCatalyst || input.triggerVerificationState === "THEMATIC";
  const constructiveSignal =
    input.signalQuality === "FRESH_IGNITION" ||
    input.signalQuality === "ACTIVE_CONTINUATION" ||
    input.signalQuality === "RECLAIM_SETUP" ||
    input.signalQuality === "EARLY_WATCH";

  if (input.signalQuality === "DEAD" || input.freshnessStatus === "stale") return "DEAD";
  if (!hasSessionContext && !input.recentlyActive) return "DEAD";
  if (input.freshnessStatus === "recentMemory" && input.rvol < 1.5) return "DEAD";

  if (input.signalQuality === "EXHAUSTED") return "EXHAUSTION";
  if (move >= 3 && input.rvol < 1.2) return "EXHAUSTION";
  if (input.continuation < 45 && input.risk >= 65) return "EXHAUSTION";
  if (move >= 12 && input.risk >= 72 && input.continuation < 62) return "EXHAUSTION";

  if (
    input.isActiveToday &&
    input.continuation >= 70 &&
    input.rvol >= 1.55 &&
    input.risk <= 72 &&
    (constructiveSignal || verifiedOrNarrative)
  ) {
    return "REPRICING";
  }

  if (
    input.isActiveToday &&
    move >= 2 &&
    input.rvol >= 1.35 &&
    input.continuation >= 55 &&
    input.risk < 75 &&
    input.sourceBucket !== "RISK" &&
    input.sourceBucket !== "PARABOLIC_WATCH"
  ) {
    return "AWAKENING";
  }

  if (
    input.sourceBucket === "RISK" ||
    input.sourceBucket === "PARABOLIC_WATCH" ||
    (move >= 15 && (input.risk >= 60 || input.continuation < 65))
  ) {
    return "CROWDED";
  }

  if (input.continuation < 50 || input.risk >= 78 || input.rvol < 1.15) return "EXHAUSTION";
  if (hasSessionContext && input.rvol >= 1.2 && input.continuation >= 50) return "AWAKENING";
  return "DEAD";
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

function catalystSetupType(trigger: NewsTrigger) {
  const triggerType = trigger.triggerType as string;
  if (triggerType === "ORDER_CONTRACT") return "Nytt kontrakt";
  if (triggerType === "FDA" || triggerType === "REGULATORY") return "Regulatorisk trigger";
  if (triggerType === "STUDY_RESULT") return "Studieresultat";
  if (triggerType === "BID") return "Bud/M&A";
  if (triggerType === "EMISSION" || triggerType === "FINANCING" || triggerType === "FUNDING") return "Finansiering";
  if (triggerType === "GUIDANCE") return "Guidance";
  if (triggerType === "PROFIT_WARNING") return "Vinstvarning";
  return "Verifierad catalyst";
}

function setupTypeFor(candidate: AutonomousDiscoveryCandidate, newsTrigger?: NewsTrigger) {
  if (newsTrigger && hasActionableVerifiedCatalyst(candidate, newsTrigger)) return catalystSetupType(newsTrigger);
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
    "Nytt kontrakt": "ORDER_CONTRACT",
    "Regulatorisk trigger": "FDA/regulatorisk",
    Studieresultat: "Studieresultat",
    "Bud/M&A": "Bud/M&A",
    Finansiering: "Finansiering",
    Guidance: "Guidance",
    Vinstvarning: "Vinstvarning",
    "Verifierad catalyst": "Verifierad catalyst",
  };
  return personalities[setupType] ?? setupType;
}

function riskScore(candidate: AutonomousDiscoveryCandidate) {
  return Math.max(candidate.reaction.fadeProbability, candidate.sourceWeights.fakeSpikePenalty * 2, candidate.sourceWeights.liquidityPenalty * 4);
}

function entityNarrativeText(candidate: AutonomousDiscoveryCandidate) {
  return `${candidate.ticker} ${candidate.companyName} ${candidate.sector}`.toLowerCase();
}

function classifyCatalyst(candidate: AutonomousDiscoveryCandidate, newsTrigger?: NewsTrigger): { type: CatalystType; score: number; summary: string } {
  if (newsTrigger && hasActionableVerifiedCatalyst(candidate, newsTrigger)) {
    const triggerType = newsTrigger.triggerType as string;
    if (triggerType === "ORDER_CONTRACT") {
      return { type: "contract_award", score: 88, summary: "Verifierad order/kontrakt-trigger: konkret intakts- eller valideringsrepricing." };
    }
    if (triggerType === "FDA" || triggerType === "REGULATORY") {
      return { type: "regulatory_catalyst", score: 86, summary: "Verifierad regulatorisk catalyst som kan flytta sannolikhetsbilden." };
    }
    if (triggerType === "STUDY_RESULT") {
      return { type: "study_result", score: 86, summary: "Verifierat studieresultat: binar men fundamental repricing-trigger." };
    }
    if (triggerType === "BID") {
      return { type: "bid_event", score: 90, summary: "Verifierad bud-/M&A-trigger. Ny prisankare styr mer an sektorflode." };
    }
    if (triggerType === "EMISSION" || triggerType === "FINANCING" || triggerType === "FUNDING") {
      return { type: "financing", score: 72, summary: "Verifierad finansiering/emission. Kan minska overlevnadsrisk men kraver riskkontroll." };
    }
    if (triggerType === "GUIDANCE") {
      return { type: "guidance_change", score: 84, summary: "Verifierad guidanceforandring som kan tvinga omvardering." };
    }
    if (triggerType === "PROFIT_WARNING") {
      return { type: "guidance_change", score: 68, summary: "Verifierad vinstvarning: stor repricing mojlig men riskprofilen ar hog." };
    }
  }
  const entityText = entityNarrativeText(candidate);
  const flowText = [
    ...candidate.labels,
    ...candidate.whyDiscovered,
    ...candidate.reaction.flags,
    candidate.reaction.label,
  ].join(" ").toLowerCase();
  const text = `${entityText} ${flowText}`;
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
  const sectorHasBiotechIdentity = /biotech|pharma|medtech/.test(candidate.sector.toLowerCase());
  const entityHasStrongBiotechIdentity = /biotech|pharma|medtech|therapeutics|medical|diagnostics|life science|lifescience/.test(entityText);
  const flowHasClinicalOrRegulatoryTrigger = /fda|clinical|study|trial|phase|ce mark|ce-märk|approval|drug|therapy/.test(flowText);
  if ((sectorHasBiotechIdentity || entityHasStrongBiotechIdentity) && flowHasClinicalOrRegulatoryTrigger) {
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
  if (/defense|försvar|cyber|ai|datacenter|uran|battery|metals/.test(entityText)) {
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
  newsTrigger?: NewsTrigger,
): {
  narrativeTriggerType: NarrativeTriggerType;
  narrativeStrength: number;
  narrativeFreshness: number;
  thematicTailwind: number;
  repricingProbability: number;
  marketAttentionShift: number;
  hasFreshFundamentalCatalyst: boolean;
} {
  if (newsTrigger) {
    const actionableVerifiedCatalyst = hasActionableVerifiedCatalyst(candidate, newsTrigger);
    return {
      narrativeTriggerType: newsTrigger.narrativeTriggerType as NarrativeTriggerType,
      narrativeStrength: Math.max(35, Math.min(100, Math.round(newsTrigger.triggerStrength * 0.45 + newsTrigger.repricingPotential * 0.45 + (newsTrigger.isFreshToday ? 8 : -12)))),
      narrativeFreshness: newsTrigger.isFreshToday ? 92 : 28,
      thematicTailwind: Math.max(20, newsTrigger.secondDerivativeScore),
      repricingProbability: newsTrigger.repricingPotential,
      marketAttentionShift: Math.max(35, Math.round(candidate.reaction.activeTraderAttention * 0.55 + newsTrigger.triggerStrength * 0.25)),
      hasFreshFundamentalCatalyst: actionableVerifiedCatalyst,
    };
  }
  const flowText = narrativeText(candidate);
  const entityText = entityNarrativeText(candidate);
  const reaction = candidate.reaction;
  const isSmallMid = /small|micro|nano|first north|spotlight|ngm|nordic sme/i.test(`${candidate.marketCapBucket} ${candidate.exchange}`);
  const hasRealRegulatorySignal = /fda|510\(k\)|ce-märkning|ce mark|mdr|approval|godkänn|clinical|klinisk|studie|fas\s/.test(flowText);
  const isLifeScienceEntity = /biotech|medtech|pharma|medical|therapeutic|diagnostic|surgery|surgical/.test(entityText);
  const dormantWakeup =
    reaction.intradayMomentum >= 2.5 &&
    reaction.relativeVolume >= 1.5 &&
    reaction.activeTraderAttention >= 45 &&
    reaction.fadeProbability < 72;
  const trigger: NarrativeTriggerType =
    /rapport|earnings|q[1-4]|omsättning|vinst|ebit|guidance|omvänd vinstvarning/.test(flowText)
      ? "REPORT_REPRICING"
      : /kommersialisering|commerciali[sz]ation|lansering|försäljning|sales ramp|produktion|scale-up|scal[e]?up|go-to-market|nanologica/.test(flowText)
        ? "COMMERCIALIZATION_SHIFT"
        : /glp|obesity|fetma|diabetes|novo|eli lilly|semaglutid|wegovy|ozempic|läkemedel/.test(entityText)
          ? "OBESITY_ADJACENCY"
          : /försvar|defense|nato|drön|drone|cyber|säkerhet|security/.test(entityText)
            ? "DEFENSE_ADJACENCY"
            : /datacenter|data center|ai infra|server|kraft|power|cooling|semiconductor|chip/.test(entityText)
              ? "DATACENTER_INFRA"
              : /order|kontrakt|avtal|ramavtal|contract|customer|kund/.test(flowText)
                ? "NEW_CONTRACT"
                : hasRealRegulatorySignal && isLifeScienceEntity
                  ? "REGULATORY_TRIGGER"
                  : /lönsamhet|profitability|break-even|marginal|cash flow|kassaflöde/.test(flowText)
                    ? "PROFITABILITY_INFLECTION"
                    : /finansiering|funding|emission|riktad emission|lånefacilitet|survival|överlevnad/.test(flowText)
                      ? "FUNDING_SURVIVAL"
                      : /ai|battery|batteri|uranium|uran|turnaround|restructuring|supply chain|logistik/.test(entityText)
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
  if (
    (candidate.bucket === "STEALTH" || candidate.reaction.label === "STEALTH_STRENGTH") &&
    candidate.reaction.relativeVolume >= 1.45 &&
    candidate.reaction.intradayMomentum < 4 &&
    candidate.reaction.activeTraderAttention < 65
  ) score += 8;
  if (candidate.reaction.fadeProbability >= 70) score -= 12;
  if (candidate.reaction.label === "DEAD_BOUNCE" || candidate.reaction.label === "FAILED_MOVE") score -= 14;
  if (candidate.bucket === "PARABOLIC_WATCH") score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function thesisFor(
  candidate: AutonomousDiscoveryCandidate,
  setupType: string,
  catalyst: { type: CatalystType; score: number; summary: string },
  continuation: number,
) {
  const reaction = candidate.reaction;
  const move = `${round(reaction.intradayMomentum, 2)}%`;
  const rvol = `${round(reaction.relativeVolume, 2)}x RVOL`;
  if (reaction.relativeVolume < 1.15 && reaction.intradayMomentum >= 3) return `Move utan brett deltagande: ${move}, ${rvol}. Vänta volym/aggression.`;
  if (catalyst.type === "earnings_breakout") return `Rapport/repricing: ${move}, ${rvol}. Kräver fortsatt participation.`;
  if (catalyst.type === "insider_accumulation") return `Insiderstöd + live test. Behöver volymbekräftelse.`;
  if (catalyst.type === "contract_award") return `Order/avtal: bevaka om köpare betalar upp efter första vågen.`;
  if (catalyst.type === "regulatory_catalyst") return `Regulatorisk trigger: ${move}, ${rvol}. Repricing galler fore sektorflode.`;
  if (catalyst.type === "study_result") return `Studieresultat: fundamental trigger med binar risk. Bekrafta struktur.`;
  if (catalyst.type === "bid_event") return `Bud/M&A: ny prisankare. Likviditet och spread styr execution.`;
  if (catalyst.type === "financing") return `Finansiering/emission: riskbilden reprisas, men utspadning maste respekteras.`;
  if (catalyst.type === "guidance_change") return `Guidance/vinstvarning: verifierad omvardering, inte sektorflode.`;
  if (catalyst.type === "biotech_binary") return `Binärt case: optionalitet hög, fade-risk styr.`;
  if (catalyst.type === "short_squeeze") return `Squeezeprofil: ${move}, ${rvol}. Nästa volymvåg avgör.`;
  if (catalyst.type === "retail_momentum") return `Crowded momentum. Re-entry före chase.`;
  if (catalyst.type === "sector_sympathy") return `Sympathy flow. Kräver egen volymstruktur.`;
  if (catalyst.type === "turnaround") return `Turnaround watch. Repricing kräver fortsatt struktur.`;
  if (setupType === "Early momentum") {
    return `Early expansion: ${move}, ${rvol}. Bevaka första köpta pullback.`;
  }
  if (setupType === "Continuation") {
    return `Continuation: ${move}, ${rvol}. Måste hålla participation.`;
  }
  if (setupType === "Stealth accumulation") {
    return `Stealth: RVOL före större prisexpansion. Tidig expansion-watch.`;
  }
  if (setupType === "Parabolic re-entry") {
    return `Het/no chase. Endast pullback/re-entry om strukturen håller.`;
  }
  if (setupType === "Squeeze candidate") {
    return `Squeeze: pris + RVOL + attention. Vänta nästa våg.`;
  }
  if (setupType === "Pullback valid") {
    return `Pullback valid. Reclaim + ny volym krävs.`;
  }
  if (setupType === "Reacceleration") {
    return `Reacceleration efter paus. Nästa nivå avgör.`;
  }
  if (setupType === "Retail chase risk") {
    return `Crowded/oklar kvalitet. Kräver lägre fake-spike-risk.`;
  }
  return `${setupType}: ${move}, ${rvol}, continuation ${continuation}%.`;
}

function whyNowFor(candidate: AutonomousDiscoveryCandidate, setupType: string, catalyst: { type: CatalystType; score: number; summary: string }) {
  const reaction = candidate.reaction;
  if (catalyst.type !== "unknown") return catalyst.summary;
  if (reaction.relativeVolume < 1.15 && reaction.intradayMomentum >= 3) return "Move finns, men participation saknas.";
  if (setupType === "Parabolic re-entry") return "För långt gången för chase; bara re-entry.";
  if (setupType === "Stealth accumulation") return "RVOL vaknar före crowding/prisexpansion.";
  if (reaction.marketAggression >= 65) return "Aggression + volym trycker samtidigt.";
  if (reaction.continuationProbability >= 75 && reaction.relativeVolume >= 1.55) return "Struktur + participation stödjer continuation.";
  if (reaction.relativeVolume >= 2) return "RVOL avviker tydligt; invänta struktur.";
  return "Aktiv i scan, men behöver mer signalstyrka.";
}

function needsNowFor(candidate: AutonomousDiscoveryCandidate, setupType: string) {
  if (setupType === "Parabolic re-entry") return "Vänta in kontrollerad pullback, högre botten och ny volymvåg.";
  if (setupType === "Stealth accumulation") return "Pris måste börja följa volymen utan att spread/fade ökar.";
  if (candidate.reaction.fadeProbability >= 60) return "Fade-risk måste sjunka eller reclaim måste bekräftas.";
  if (candidate.reaction.relativeVolume < 1.5) return "Behöver starkare RVOL för att gå från bevakning till aktivt fokus.";
  return "Håll första pullbacken och fortsätt trycka med volym.";
}

function prosFor(candidate: AutonomousDiscoveryCandidate, continuation: number) {
  const reaction = candidate.reaction;
  return [
    reaction.relativeVolume >= 1.5 ? `RVOL ${round(reaction.relativeVolume, 2)}` : null,
    reaction.intradayMomentum >= 2 ? `${round(reaction.intradayMomentum, 2)}% prisexpansion` : null,
    continuation >= 65 && reaction.relativeVolume >= 1.45 ? `${continuation}% continuation med deltagande` : null,
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
    reaction.continuationProbability >= 70 && reaction.relativeVolume < 1.35 ? "continuation saknar volymdeltagande" : null,
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

function verificationForCandidate(
  candidate: AutonomousDiscoveryCandidate,
  narrative: ReturnType<typeof classifyNarrativeTrigger>,
  newsTrigger?: NewsTrigger,
): TriggerVerificationState {
  if (newsTrigger) return newsTrigger.triggerVerificationState;
  if (narrative.hasFreshFundamentalCatalyst) return "VERIFIED";
  if (narrative.narrativeTriggerType !== "UNKNOWN" && narrative.thematicTailwind >= 60) return "THEMATIC";
  if (candidate.reaction.relativeVolume >= 2.8 && candidate.reaction.intradayMomentum >= 4) return "UNVERIFIED";
  return "PRICE_ONLY";
}

function discoveryScoreFor(input: {
  candidate: AutonomousDiscoveryCandidate;
  freshness: ReturnType<typeof candidateFreshness>;
  narrative: ReturnType<typeof classifyNarrativeTrigger>;
  signalQuality: ReturnType<typeof assessSignalQuality>;
  triggerVerificationState: TriggerVerificationState;
  hasLiveNewsTrigger: boolean;
}) {
  const { candidate, freshness, narrative, signalQuality, triggerVerificationState, hasLiveNewsTrigger } = input;
  const verificationBoost: Record<TriggerVerificationState, number> = {
    VERIFIED: hasLiveNewsTrigger ? 22 : 4,
    THEMATIC: 6,
    UNVERIFIED: 3,
    PRICE_ONLY: candidate.reaction.relativeVolume >= 3 ? 0 : -16,
  };
  const openingAnomaly =
    candidate.reaction.relativeVolume >= 1.5 && candidate.reaction.intradayMomentum >= 1.5
      ? 10
      : candidate.reaction.relativeVolume < 1.2
        ? -10
        : 0;
  const stealthRepricingBoost =
    (candidate.bucket === "STEALTH" || candidate.reaction.label === "STEALTH_STRENGTH") &&
    candidate.reaction.relativeVolume >= 1.45 &&
    candidate.reaction.intradayMomentum < 4 &&
    candidate.reaction.fadeProbability < 62 &&
    candidate.reaction.activeTraderAttention < 68
      ? 14
      : 0;
  const sympathyEarlyBoost =
    narrative.narrativeTriggerType !== "UNKNOWN" &&
    narrative.narrativeTriggerType !== "SECOND_DERIVATIVE_THEME" &&
    candidate.reaction.relativeVolume >= 1.35 &&
    candidate.reaction.intradayMomentum < 5
      ? 7
      : 0;
  const weakParticipationPenalty =
    candidate.reaction.relativeVolume < 1.15
      ? 18
      : candidate.reaction.relativeVolume < 1.35 || candidate.reaction.activeTraderAttention < 35
        ? 10
        : 0;
  const stalePenalty =
    !freshness.isActiveToday
      ? 22
      : signalQuality.decayScore >= 55
        ? 16
        : signalQuality.signalQuality === "STALLED"
          ? 10
          : 0;
  return Math.max(0, Math.min(100, Math.round(
    narrative.narrativeStrength * 0.28 +
      narrative.repricingProbability * 0.28 +
      narrative.thematicTailwind * 0.14 +
      narrative.marketAttentionShift * 0.12 +
      candidate.autonomousDiscoveryScore * 0.18 +
      verificationBoost[triggerVerificationState] +
      (hasLiveNewsTrigger ? 10 : 0) +
      openingAnomaly +
      stealthRepricingBoost +
      sympathyEarlyBoost -
      weakParticipationPenalty -
      stalePenalty,
  )));
}

function normalizeContinuation(
  candidate: AutonomousDiscoveryCandidate,
  rawContinuation: number,
  context: {
    freshness: ReturnType<typeof candidateFreshness>;
    confirmationCount: number;
    triggerVerificationState: TriggerVerificationState;
    narrativeTriggerType: NarrativeTriggerType;
    catalystType: CatalystType;
    repricingPhase: RepricingPhase;
    risk: number;
    catalystBoostApplied: boolean;
  },
) {
  const verifiedOrThematic =
    context.triggerVerificationState === "VERIFIED" ||
    context.triggerVerificationState === "THEMATIC" ||
    context.catalystBoostApplied;
  const eliteContinuation =
    verifiedOrThematic &&
    context.freshness.isActiveToday &&
    context.confirmationCount >= 4 &&
    candidate.reaction.relativeVolume >= 2 &&
    candidate.reaction.activeTraderAttention >= 60 &&
    context.risk < 45;
  let cap = eliteContinuation ? 100 : 92;

  if (
    context.repricingPhase === "REPRICING" &&
    verifiedOrThematic &&
    context.confirmationCount >= 3 &&
    candidate.reaction.relativeVolume >= 1.55 &&
    context.risk < 65
  ) {
    cap = Math.min(cap, 92);
  } else {
    cap = Math.min(cap, 88);
  }

  if (context.triggerVerificationState === "PRICE_ONLY" && context.narrativeTriggerType === "UNKNOWN") cap = Math.min(cap, 72);
  if (context.catalystType === "short_squeeze" && !verifiedOrThematic) cap = Math.min(cap, 76);
  if (context.confirmationCount < 3) cap = Math.min(cap, 74);
  if (candidate.reaction.activeTraderAttention < 48) cap = Math.min(cap, 76);
  if (candidate.reaction.relativeVolume < 1.55) cap = Math.min(cap, 70);
  if ((candidate.bucket === "PARABOLIC_WATCH" || candidate.bucket === "RISK") && !verifiedOrThematic) cap = Math.min(cap, 68);
  if (!context.freshness.isActiveToday && context.freshness.freshnessStatus !== "premarketContext" && context.freshness.freshnessStatus !== "afterClose") {
    cap = Math.min(cap, 62);
  }
  if (context.repricingPhase === "EXHAUSTION") cap = Math.min(cap, 58);
  if (context.repricingPhase === "DEAD") cap = Math.min(cap, 45);
  if (context.risk >= 75) cap = Math.min(cap, 68);
  else if (context.risk >= 65) cap = Math.min(cap, 76);

  return Math.max(0, Math.min(100, Math.round(Math.min(rawContinuation, cap))));
}

function toTradingCandidate(
  candidate: AutonomousDiscoveryCandidate,
  change: string | undefined,
  snapshotFreshness: ReturnType<typeof buildSnapshotFreshness>,
  newsByTicker: Map<string, NewsTrigger>,
): TradingCandidate | null {
  if (candidate.ticker.toUpperCase() === "BIOX") return null;
  if (candidate.bucket === "SUPPRESSED" && candidate.autonomousDiscoveryScore < 45) return null;
  const freshness = candidateFreshness(candidate.reaction.asOf, snapshotFreshness);
  const newsTrigger = newsByTicker.get(candidate.ticker.toUpperCase());
  const catalystBoostApplied = hasActionableVerifiedCatalyst(candidate, newsTrigger);
  const triggerAgeHours = newsTrigger ? newsAgeHours(newsTrigger.publishedAt) : null;
  const setupType = setupTypeFor(candidate, catalystBoostApplied ? newsTrigger : undefined);
  const catalyst = classifyCatalyst(candidate, catalystBoostApplied ? newsTrigger : undefined);
  const catalystScore = catalystWeight(candidate, catalyst);
  const narrative = classifyNarrativeTrigger(candidate, { ...catalyst, score: catalystScore }, freshness, newsTrigger);
  const signalQuality = assessSignalQuality({ candidate, freshness, catalystScore });
  const triggerVerificationState = verificationForCandidate(candidate, narrative, newsTrigger);
  const discoveryScore = discoveryScoreFor({
    candidate,
    freshness,
    narrative,
    signalQuality,
    triggerVerificationState,
    hasLiveNewsTrigger: catalystBoostApplied,
  });
  const risk = riskScore(candidate);
  const rawAction = actionFor(candidate);
  const narrativeBoost =
    catalystBoostApplied && freshness.isActiveToday
      ? Math.round(narrative.narrativeStrength * 0.12 + narrative.repricingProbability * 0.08)
      : narrative.narrativeTriggerType !== "UNKNOWN" && freshness.freshnessStatus === "premarketContext"
        ? Math.round(narrative.narrativeStrength * 0.08)
        : 0;
  const priceOnlyPenalty = triggerVerificationState === "PRICE_ONLY" && candidate.reaction.relativeVolume < 2.4 ? 10 : 0;
  const rawContinuation =
    candidate.reaction.relativeVolume < 1.15
      ? Math.min(candidate.reaction.continuationProbability, 45)
      : candidate.reaction.relativeVolume < 1.35 || candidate.reaction.activeTraderAttention < 35 || candidate.reaction.marketAggression < 35
        ? Math.min(candidate.reaction.continuationProbability, 58)
        : candidate.reaction.continuationProbability;
  const boostedContinuation = Math.min(100, rawContinuation + (catalystBoostApplied ? 8 : 0));
  const provisionalRepricingPhase = classifyRepricingPhase({
    dayChangePct: candidate.reaction.dayChangePct,
    intradayMomentumPct: candidate.reaction.intradayMomentumPct ?? candidate.reaction.intradayMomentum,
    rvol: candidate.reaction.relativeVolume,
    continuation: boostedContinuation,
    risk,
    isActiveToday: freshness.isActiveToday,
    freshnessStatus: freshness.freshnessStatus,
    signalQuality: signalQuality.signalQuality,
    hasFreshFundamentalCatalyst: narrative.hasFreshFundamentalCatalyst,
    triggerVerificationState,
    sourceBucket: candidate.bucket,
    recentlyActive: Boolean(change),
  });
  const normalizedContinuation = normalizeContinuation(candidate, boostedContinuation, {
    freshness,
    confirmationCount: signalQuality.confirmationCount,
    triggerVerificationState,
    narrativeTriggerType: narrative.narrativeTriggerType,
    catalystType: catalyst.type,
    repricingPhase: provisionalRepricingPhase,
    risk,
    catalystBoostApplied,
  });
  const repricingPhase = classifyRepricingPhase({
    dayChangePct: candidate.reaction.dayChangePct,
    intradayMomentumPct: candidate.reaction.intradayMomentumPct ?? candidate.reaction.intradayMomentum,
    rvol: candidate.reaction.relativeVolume,
    continuation: normalizedContinuation,
    risk,
    isActiveToday: freshness.isActiveToday,
    freshnessStatus: freshness.freshnessStatus,
    signalQuality: signalQuality.signalQuality,
    hasFreshFundamentalCatalyst: narrative.hasFreshFundamentalCatalyst,
    triggerVerificationState,
    sourceBucket: candidate.bucket,
    recentlyActive: Boolean(change),
  });
  const action: TradingAction =
    !freshness.isActiveToday
      ? freshness.freshnessStatus === "premarketContext" || freshness.freshnessStatus === "afterClose"
        ? "Bevaka"
        : "Undvik"
      : repricingPhase === "DEAD" || repricingPhase === "EXHAUSTION"
        ? "Undvik"
        : repricingPhase === "REPRICING" && rawAction === "Het men jaga inte"
          ? candidate.autonomousDiscoveryScore >= 70 && normalizedContinuation >= 75 && risk <= 62
            ? "Agera"
            : "Bevaka"
        : repricingPhase === "CROWDED" && rawAction === "Agera"
          ? "Het men jaga inte"
          : signalQuality.signalQuality === "DEAD" || signalQuality.signalQuality === "EXHAUSTED"
            ? "Undvik"
            : signalQuality.signalQuality === "STALLED" && rawAction === "Agera"
              ? "Bevaka"
              : signalQuality.confirmationCount < 2 && rawAction === "Agera"
                ? "Bevaka"
                : rawAction;
  const finalState: DiscoveryBucket =
    freshness.freshnessStatus === "afterClose" &&
    !catalystBoostApplied &&
    triggerVerificationState === "PRICE_ONLY" &&
    candidate.bucket === "HOT"
      ? "WATCH"
      : candidate.bucket;
  const catalystStateBoost = catalystBoostApplied ? 10 : 0;
  return {
    ticker: candidate.ticker,
    company: candidate.companyName,
    exchange: candidate.exchange,
    action,
    setupType,
    thesis: newsTrigger
      ? `${newsTrigger.triggerType}: ${newsTrigger.summary} ${thesisFor(candidate, setupType, { ...catalyst, score: catalystScore }, normalizedContinuation)}`
      : narrative.narrativeTriggerType !== "UNKNOWN" && narrative.narrativeStrength >= 55
      ? `${narrative.narrativeTriggerType.replaceAll("_", " ").toLowerCase()}: ${thesisFor(candidate, setupType, { ...catalyst, score: catalystScore }, normalizedContinuation)}`
      : thesisFor(candidate, setupType, { ...catalyst, score: catalystScore }, normalizedContinuation),
    pros: prosFor(candidate, normalizedContinuation),
    cons: consFor(candidate),
    trigger: triggerFor(candidate, setupType),
    invalidation: invalidationFor(candidate, setupType),
    continuation: normalizedContinuation,
    risk,
    rvol: candidate.reaction.relativeVolume,
    movePct: candidate.reaction.intradayMomentumPct ?? candidate.reaction.intradayMomentum,
    dayChangePct: candidate.reaction.dayChangePct,
    intradayMomentumPct: candidate.reaction.intradayMomentumPct ?? candidate.reaction.intradayMomentum,
    score: Math.max(0, Math.min(100, Math.max(candidate.autonomousDiscoveryScore + narrativeBoost + catalystStateBoost, discoveryScore) - priceOnlyPenalty)),
    confidence: candidate.discoveryConfidence,
    source: candidateSource(candidate),
    sourceBucket: finalState,
    finalState,
    changed: change ?? null,
    asOf: candidate.reaction.asOf,
    personality: personalityFor(setupType),
    whyNow: whyNowFor(candidate, setupType, { ...catalyst, score: catalystScore }),
    needsNow: needsNowFor(candidate, setupType),
    catalystType: catalyst.type,
    catalystScore,
    catalystSummary: newsTrigger ? `${newsTrigger.headline} — ${newsTrigger.summary}` : catalyst.summary,
    freshnessStatus: freshness.freshnessStatus,
    dataAgeMinutes: freshness.dataAgeMinutes,
    isActiveToday: freshness.isActiveToday,
    ...signalQuality,
    repricingPhase,
    ...narrative,
    discoveryScore,
    triggerVerificationState,
    newsTriggerType: newsTrigger?.triggerType ?? null,
    newsAgeHours: triggerAgeHours === null ? null : round(triggerAgeHours, 2),
    catalystBoostApplied,
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
  const movePct = numberFromPayload(live, "intradayMomentumPct", numberFromPayload(live, "intradayMomentum"));
  const dayChangePct = numberFromPayload(live, "dayChangePct", movePct);
  const rvol = numberFromPayload(live, "relativeVolume");
  const continuation = numberFromPayload(live, "continuationProbability");
  const fade = numberFromPayload(live, "fadeProbability", snapshot.risk);
  const label = String(live.label ?? snapshot.state ?? "WATCH");
  const confirmedAt = snapshot.createdAt ?? null;
  const age = confirmedAt ? minutesAge(new Date(), new Date(confirmedAt)) : 24 * 60;
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
  const repricingPhase = classifyRepricingPhase({
    dayChangePct,
    intradayMomentumPct: movePct,
    rvol,
    continuation,
    risk: fade,
    isActiveToday: false,
    freshnessStatus: "recentMemory",
    signalQuality: "STALLED",
    sourceBucket,
    recentlyActive: Boolean(change),
  });
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
    dayChangePct,
    intradayMomentumPct: movePct,
    score: snapshot.score,
    confidence: snapshot.confidence,
    source: `Persisted case-state / ${sourceBucket}`,
    sourceBucket,
    finalState: sourceBucket,
    changed: change ?? null,
    personality: personalityFor(setupType),
    whyNow: "Momentumet var nyligen på tavlan, men senaste livebekräftelsen är svagare. Behandla som re-check, inte som blankt köp-case.",
    needsNow: sourceBucket === "PARABOLIC_WATCH" ? "Färsk live-scan måste bekräfta re-entry-läge." : "Ny live-scan måste bekräfta att momentum fortfarande lever.",
    catalystType: "unknown",
    catalystScore: 30,
    catalystSummary: "Ingen tydlig färsk catalyst i tavlan; caset kräver ny volym/aggression för att bli relevant igen.",
    freshnessStatus: "recentMemory",
    dataAgeMinutes: age,
    isActiveToday: false,
    firstSeenAt: null,
    lastConfirmedAt: confirmedAt,
    freshnessMinutes: age,
    momentumAge: age,
    confirmationCount: 0,
    lastExpansionAt: null,
    decayScore: 70,
    staleReason: "persisted memory utan färsk livebekräftelse",
    signalQuality: "STALLED",
    repricingPhase,
    narrativeTriggerType: "UNKNOWN",
    narrativeStrength: 10,
    narrativeFreshness: 10,
    thematicTailwind: 0,
    repricingProbability: 0,
    marketAttentionShift: 0,
    hasFreshFundamentalCatalyst: false,
    discoveryScore: Math.max(0, Math.min(45, Math.round(snapshot.score * 0.45))),
    triggerVerificationState: "PRICE_ONLY",
    newsTriggerType: null,
    newsAgeHours: null,
    catalystBoostApplied: false,
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
  return convictionScore(b) - convictionScore(a) ||
    order[a.action] - order[b.action] ||
    b.score - a.score ||
    effectiveContinuationFor(b) - effectiveContinuationFor(a);
}

function continuationQualityScore(candidate: TradingCandidate) {
  const verifiedQuality =
    candidate.triggerVerificationState === "VERIFIED" ||
    candidate.triggerVerificationState === "THEMATIC" ||
    candidate.catalystBoostApplied;

  const structure =
    Math.min(28, Math.max(0, candidate.continuation - 55) * 0.8) +
    Math.min(18, Math.max(0, candidate.confirmationCount - 2) * 6) +
    Math.min(18, Math.max(0, candidate.marketAttentionShift - 45) * 0.35);

  const catalyst = verifiedQuality ? 18 : candidate.narrativeTriggerType !== "UNKNOWN" ? 8 : 0;

  const squeezePenalty =
    candidate.catalystType === "short_squeeze" &&
    candidate.triggerVerificationState === "PRICE_ONLY" &&
    candidate.narrativeTriggerType === "UNKNOWN"
      ? 18
      : 0;

  const afterClosePenalty = candidate.freshnessStatus === "afterClose" && !verifiedQuality ? 8 : 0;
  const fadePenalty = Math.max(0, candidate.risk - 45) * 0.45 + candidate.decayScore * 0.25;

  return Math.max(0, Math.min(100, Math.round(structure + catalyst - squeezePenalty - afterClosePenalty - fadePenalty)));
}

function isLowQualitySqueeze(candidate: TradingCandidate) {
  return candidate.catalystType === "short_squeeze" &&
    candidate.triggerVerificationState === "PRICE_ONLY" &&
    candidate.narrativeTriggerType === "UNKNOWN" &&
    continuationQualityScore(candidate) < 60;
}

function continuationDecayScore(candidate: TradingCandidate) {
  const riskDecay =
    candidate.risk > 75 ? 28 :
      candidate.risk > 65 ? 22 :
        candidate.risk > 55 ? 14 :
          0;
  const rvolDecay =
    candidate.rvol < 1.25 ? 26 :
      candidate.rvol < 1.55 ? 14 :
        0;
  const confirmationDecay = candidate.confirmationCount < 2 ? 18 : candidate.confirmationCount < 3 ? 10 : 0;
  const attentionDecay = candidate.marketAttentionShift < 35 ? 18 : candidate.marketAttentionShift < 48 ? 10 : 0;
  const exhaustionDecay: Record<RepricingPhase, number> = {
    REPRICING: 0,
    AWAKENING: 2,
    CROWDED: 16,
    EXHAUSTION: 30,
    DEAD: 36,
  };
  const phaseDecay = exhaustionDecay[candidate.repricingPhase];
  const signalDecay =
    candidate.signalQuality === "DEAD" ? 32 :
      candidate.signalQuality === "EXHAUSTED" ? 28 :
        candidate.signalQuality === "STALLED" ? 16 :
          0;
  const priceOnlyDecay =
    candidate.triggerVerificationState === "PRICE_ONLY" && candidate.narrativeTriggerType === "UNKNOWN"
      ? 16
      : 0;
  const squeezeDecay =
    candidate.catalystType === "short_squeeze" &&
    candidate.triggerVerificationState !== "VERIFIED" &&
    candidate.triggerVerificationState !== "THEMATIC"
      ? 14
      : 0;
  const staleDecay =
    !candidate.isActiveToday
      ? candidate.freshnessStatus === "recentMemory" ? 24 :
        candidate.freshnessStatus === "stale" ? 34 :
          12
      : 0;
  const parabolicDecay =
    candidate.sourceBucket === "PARABOLIC_WATCH" ||
    candidate.sourceBucket === "RISK" ||
    candidate.movePct >= 18 ||
    candidate.dayChangePct >= 22 ||
    candidate.intradayMomentumPct >= 18
      ? candidate.risk > 55 || candidate.repricingPhase !== "REPRICING" ? 14 : 6
      : 0;
  const liquidityDecay = candidate.rvol < 1.55 && candidate.marketAttentionShift < 48 ? 8 : 0;

  return Math.max(0, Math.min(100, Math.round(
    riskDecay +
      rvolDecay +
      confirmationDecay +
      attentionDecay +
      phaseDecay +
      signalDecay +
      priceOnlyDecay +
      squeezeDecay +
      staleDecay +
      parabolicDecay +
      liquidityDecay +
      candidate.decayScore * 0.18,
  )));
}

function effectiveContinuationFor(candidate: TradingCandidate) {
  return Math.max(0, Math.min(100, Math.round(candidate.continuation - continuationDecayScore(candidate))));
}

function convictionScore(candidate: TradingCandidate) {
  const effectiveContinuation = effectiveContinuationFor(candidate);
  const freshnessBoost =
    candidate.isActiveToday
      ? 18
      : candidate.freshnessStatus === "premarketContext" || candidate.freshnessStatus === "afterClose"
        ? 3
        : candidate.freshnessStatus === "recentMemory"
          ? -28
          : -44;

  const qualityBoost: Record<SignalQuality, number> = {
    FRESH_IGNITION: 24,
    ACTIVE_CONTINUATION: 22,
    RECLAIM_SETUP: 10,
    EARLY_WATCH: 4,
    STALLED: -18,
    EXHAUSTED: -30,
    DEAD: -42,
  };

  const verificationBoost: Record<TriggerVerificationState, number> = {
    VERIFIED: candidate.catalystBoostApplied ? 16 : 2,
    THEMATIC: 4,
    UNVERIFIED: -4,
    PRICE_ONLY: candidate.rvol >= 2.8 && effectiveContinuation >= 75 ? -2 : -14,
  };

  const phaseBoost: Record<RepricingPhase, number> = {
    REPRICING: 16,
    AWAKENING: 8,
    CROWDED: -10,
    EXHAUSTION: -24,
    DEAD: -36,
  };

  const participation =
    Math.min(20, Math.max(0, candidate.rvol - 1.25) * 12) +
    Math.min(16, Math.max(0, candidate.marketAttentionShift - 45) * 0.22);

  const structure =
    Math.min(22, Math.max(0, effectiveContinuation - 55) * 0.75) +
    Math.min(12, Math.max(0, candidate.confirmationCount - 2) * 5);

  const continuationQuality = continuationQualityScore(candidate);
  const squeezeQualityPenalty = isLowQualitySqueeze(candidate) ? 20 : 0;

  return Math.round(
    candidate.score * 0.35 +
      candidate.discoveryScore * 0.22 +
      freshnessBoost +
      qualityBoost[candidate.signalQuality] +
      phaseBoost[candidate.repricingPhase] +
      verificationBoost[candidate.triggerVerificationState] +
      participation +
      structure +
      continuationQuality * 0.18 +
      effectiveContinuation * 0.1 -
      squeezeQualityPenalty -
      candidate.risk * 0.22 -
      candidate.decayScore * 0.42,
  );
}
function isTopSetup(candidate: TradingCandidate) {
  const effectiveContinuation = effectiveContinuationFor(candidate);
  const continuationDecay = continuationDecayScore(candidate);
  const strongSignal = candidate.signalQuality === "FRESH_IGNITION" || candidate.signalQuality === "ACTIVE_CONTINUATION";
  const realTrigger =
    candidate.triggerVerificationState === "VERIFIED" ||
    candidate.triggerVerificationState === "THEMATIC" ||
    (candidate.triggerVerificationState === "PRICE_ONLY" && candidate.rvol >= 2.8 && effectiveContinuation >= 78);
  return candidate.isActiveToday &&
    candidate.action === "Agera" &&
    candidate.repricingPhase === "REPRICING" &&
    strongSignal &&
    effectiveContinuation >= 68 &&
    continuationDecay <= 18 &&
    candidate.rvol >= 1.55 &&
    candidate.risk <= 65 &&
    candidate.decayScore <= 32 &&
    candidate.confirmationCount >= 3 &&
    candidate.marketAttentionShift >= 48 &&
    realTrigger &&
continuationQualityScore(candidate) >= 60 &&
!isLowQualitySqueeze(candidate) &&
convictionScore(candidate) >= 72;
}

function isWatchlistSetup(candidate: TradingCandidate) {
  const effectiveContinuation = effectiveContinuationFor(candidate);
  if (isTopSetup(candidate)) return false;
  if (candidate.action === "Undvik" || candidate.action === "Hog risk") return false;
  if (candidate.repricingPhase === "DEAD" || candidate.repricingPhase === "EXHAUSTION") return false;
  if (candidate.signalQuality === "DEAD" || candidate.signalQuality === "EXHAUSTED") return false;
  if (candidate.decayScore >= 65) return false;
  if (!candidate.isActiveToday && candidate.freshnessStatus !== "premarketContext" && candidate.freshnessStatus !== "afterClose") return false;
  return candidate.sourceBucket === "STEALTH" ||
    candidate.repricingPhase === "AWAKENING" ||
    candidate.repricingPhase === "REPRICING" ||
    candidate.signalQuality === "RECLAIM_SETUP" ||
    candidate.signalQuality === "EARLY_WATCH" ||
    (effectiveContinuation >= 52 && candidate.rvol >= 1.25 && candidate.risk < 78);
}

function isDeadMoney(candidate: TradingCandidate) {
  const effectiveContinuation = effectiveContinuationFor(candidate);
  return candidate.action === "Undvik" ||
    candidate.repricingPhase === "DEAD" ||
    candidate.repricingPhase === "EXHAUSTION" ||
    candidate.signalQuality === "DEAD" ||
    candidate.signalQuality === "EXHAUSTED" ||
    candidate.decayScore >= 70 ||
    (!candidate.isActiveToday && candidate.freshnessStatus !== "premarketContext" && candidate.freshnessStatus !== "afterClose") ||
    (effectiveContinuation < 35 && candidate.rvol < 1.2) ||
    (candidate.triggerVerificationState === "PRICE_ONLY" && candidate.narrativeTriggerType === "UNKNOWN" && candidate.rvol < 1.35);
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
    const key = tickerKey(candidate.ticker);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildRecentlyActive(candidates: TradingCandidate[], snapshots: RunnerCaseSnapshot[], changes: Array<RankingChange & { createdAt?: string }>) {
  const current = new Set(candidates.map((candidate) => tickerKey(candidate.ticker)));
  return uniqByTicker(
    snapshots
      .filter((snapshot) => snapshot.source === "discovery" && !current.has(tickerKey(snapshot.ticker)) && tickerKey(snapshot.ticker) !== "BIOX")
      .filter((snapshot) => snapshot.score >= 55 || snapshot.state === "HIGH_CONVICTION" || snapshot.state === "EARLY_CONTINUATION")
      .map((snapshot) => {
        const reason = changes.find((change) => tickerKey(change.ticker) === tickerKey(snapshot.ticker))?.reason;
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
  discovery?: AutonomousDiscoveryResult | null;
}): TrackedTicker[] {
  const tracked = new Map<string, TrackedTicker>();
  const missingByTicker = new Map((input.discovery?.missingTickers ?? []).map((item) => [tickerKey(item.ticker), item]));
  const aliasByTicker = new Map((input.discovery?.aliasDebug ?? []).map((item) => [tickerKey(item.ticker), item]));
  const reactionByTicker = new Map((input.discovery?.liveReactions ?? []).map((reaction) => [tickerKey(reaction.ticker), reaction]));
  function liveMeta(ticker: string, candidate?: TradingCandidate) {
    const key = tickerKey(ticker);
    const missing = missingByTicker.get(key);
    const alias = aliasByTicker.get(key);
    const reaction = reactionByTicker.get(key);
    if (reaction) {
      return {
        liveDataStatus: "fresh" as const,
        liveDataMissingReason: null,
        attemptedSymbols: alias?.attemptedSymbols.map((attempt) => attempt.symbol),
        workingAlias: alias?.workingAlias ?? null,
        livePrice: reaction.price,
        liveVolume: reaction.volume,
        liveRvol: reaction.relativeVolume,
        liveDayChangePct: reaction.dayChangePct,
        liveIntradayMomentumPct: reaction.intradayMomentumPct ?? reaction.intradayMomentum,
        liveAsOf: reaction.asOf,
        providerAttempts: alias?.attemptedSymbols,
        quoteStatus: alias?.attemptedSymbols.some((attempt) => attempt.hasQuote) ? "present" as const : "missing" as const,
        volumeStatus: alias?.attemptedSymbols.some((attempt) => attempt.hasVolume) ? "present" as const : "missing" as const,
        rvolStatus: reaction.relativeVolume > 0 ? "available" as const : "missing_volume" as const,
      };
    }
    if (missing) {
      return {
        liveDataStatus: "missing" as const,
        liveDataMissingReason: missing.detail,
        attemptedSymbols: missing.attemptedSymbols,
        workingAlias: alias?.workingAlias ?? null,
        livePrice: null,
        liveVolume: null,
        liveRvol: null,
        liveDayChangePct: null,
        liveIntradayMomentumPct: null,
        liveAsOf: null,
        providerAttempts: missing.providerAttempts,
        quoteStatus: missing.quoteStatus,
        volumeStatus: missing.volumeStatus,
        rvolStatus: missing.rvolStatus,
      };
    }
    if (candidate) {
      return {
        liveDataStatus: "partial" as const,
        liveDataMissingReason: "Finns i snapshot memory/recent list men saknar färsk same-day candidate-bekräftelse.",
        attemptedSymbols: alias?.attemptedSymbols.map((attempt) => attempt.symbol),
        workingAlias: alias?.workingAlias ?? null,
        livePrice: null,
        liveVolume: null,
        liveRvol: null,
        liveDayChangePct: candidate.dayChangePct ?? null,
        liveIntradayMomentumPct: candidate.intradayMomentumPct ?? candidate.movePct ?? null,
        liveAsOf: null,
        providerAttempts: alias?.attemptedSymbols,
        quoteStatus: alias?.attemptedSymbols.some((attempt) => attempt.hasQuote) ? "present" as const : undefined,
        volumeStatus: alias?.attemptedSymbols.some((attempt) => attempt.hasVolume) ? "present" as const : undefined,
        rvolStatus: candidate.rvol > 0 ? "available" as const : undefined,
      };
    }
    return {
      liveDataStatus: "memory_only" as const,
      liveDataMissingReason: "Manuellt tracked/market memory. Ingen färsk providerträff i senaste scan.",
      attemptedSymbols: alias?.attemptedSymbols.map((attempt) => attempt.symbol),
      workingAlias: alias?.workingAlias ?? null,
      livePrice: null,
      liveVolume: null,
      liveRvol: null,
      liveDayChangePct: null,
      liveIntradayMomentumPct: null,
      liveAsOf: null,
      providerAttempts: alias?.attemptedSymbols,
      quoteStatus: alias?.attemptedSymbols.some((attempt) => attempt.hasQuote) ? "present" as const : undefined,
      volumeStatus: alias?.attemptedSymbols.some((attempt) => attempt.hasVolume) ? "present" as const : undefined,
      rvolStatus: alias?.attemptedSymbols.some((attempt) => attempt.hasVolume) ? "available" as const : undefined,
    };
  }
  for (const candidate of input.candidates) {
    const live = liveMeta(candidate.ticker, candidate);
    tracked.set(tickerKey(candidate.ticker), {
      ticker: candidate.ticker,
      company: candidate.company,
      status: "activeCandidate",
      source: "active_candidate",
      summary: trackedSummary(candidate),
      lastKnownState: candidate.sourceBucket,
      lastKnownScore: candidate.score,
      lastKnownConfidence: candidate.confidence,
      candidate,
      ...live,
    });
  }
  for (const candidate of input.recentlyActive) {
    const key = tickerKey(candidate.ticker);
    if (tracked.has(key)) continue;
    const live = liveMeta(candidate.ticker, candidate);
    tracked.set(key, {
      ticker: candidate.ticker,
      company: candidate.company,
      status: "recentlyActive",
      source: "recently_active",
      summary: `${candidate.ticker} var nyligen aktiv men är inte toppkandidat just nu. ${candidate.needsNow}`,
      lastKnownState: candidate.sourceBucket,
      lastKnownScore: candidate.score,
      lastKnownConfidence: candidate.confidence,
      candidate,
      ...live,
    });
  }
  for (const snapshot of input.snapshots) {
    const key = tickerKey(snapshot.ticker);
    if (key === "BIOX" || tracked.has(key) || snapshot.source !== "discovery") continue;
    const identity = UNIVERSE_BY_TICKER.get(key);
    const live = liveMeta(snapshot.ticker);
    tracked.set(key, {
      ticker: key,
      company: identity?.companyName ?? key,
      status: "trackedButNotActive",
      source: "persisted_case_state",
      summary: `${snapshot.ticker} finns i market memory men är inte aktiv toppkandidat i senaste scan.`,
      lastKnownState: snapshot.state,
      lastKnownScore: snapshot.score,
      lastKnownConfidence: snapshot.confidence,
      ...live,
    });
  }
  for (const ticker of DEFAULT_TRACKED_TICKERS) {
    const key = tickerKey(ticker);
    if (tracked.has(key)) continue;
    const identity = UNIVERSE_BY_TICKER.get(key);
    const live = liveMeta(ticker);
    tracked.set(key, {
      ticker: key,
      company: identity?.companyName ?? key,
      status: "trackedButNotActive",
      source: "manual_watch",
      summary: `${key} är manuellt tracked som ${identity?.companyName ?? "Nordic market memory"}, men saknar färsk livebekräftelse i senaste snapshot.`,
      lastKnownState: null,
      lastKnownScore: null,
      lastKnownConfidence: null,
      ...live,
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

function buildLiveCoverageAudit(trackedUniverse: TrackedTicker[]): LiveCoverageAuditItem[] {
  const trackedByTicker = new Map(trackedUniverse.map((item) => [tickerKey(item.ticker), item]));
  return LIVE_COVERAGE_AUDIT_TICKERS.map((ticker) => {
    const item = trackedByTicker.get(tickerKey(ticker));
    const attempts = item?.providerAttempts ?? [];
    const successfulAttempt = attempts.find((attempt) => attempt.hasQuote && attempt.hasVolume && attempt.bars > 0);
    const partialAttempt = attempts.find((attempt) => attempt.hasQuote || attempt.hasVolume || attempt.bars > 0);
    const lastFailedAttempt = [...attempts].reverse().find((attempt) => attempt.error || attempt.statusCode);
    const fetchStatus: LiveCoverageAuditItem["fetchStatus"] =
      item?.liveDataStatus === "fresh" && successfulAttempt
        ? "success"
        : attempts.length === 0
          ? "not_attempted"
          : partialAttempt
            ? "partial"
            : "failed";
    return {
      ticker,
      company: item?.company ?? UNIVERSE_BY_TICKER.get(tickerKey(ticker))?.companyName,
      liveDataStatus: item?.liveDataStatus ?? "not_tracked",
      providerSymbol: item?.workingAlias ?? successfulAttempt?.symbol ?? partialAttempt?.symbol ?? null,
      fetchStatus,
      quoteStatus: item?.quoteStatus ?? (attempts.length > 0 ? "missing" : "unknown"),
      volumeStatus: item?.volumeStatus ?? (attempts.length > 0 ? "missing" : "unknown"),
      rvolStatus: item?.rvolStatus ?? (attempts.length > 0 ? "missing_quote" : "unknown"),
      price: item?.livePrice ?? null,
      volume: item?.liveVolume ?? null,
      rvol: item?.liveRvol ?? null,
      dayChangePct: item?.liveDayChangePct ?? null,
      intradayMomentumPct: item?.liveIntradayMomentumPct ?? null,
      asOf: item?.liveAsOf ?? null,
      attemptedSymbols: item?.attemptedSymbols ?? [],
      lastError: lastFailedAttempt?.error ?? item?.liveDataMissingReason ?? null,
      statusCodes: attempts.map((attempt) => attempt.statusCode),
    };
  });
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
  const effectiveContinuation = effectiveContinuationFor(candidate);
  if (candidate.risk >= 85 && effectiveContinuation < 50) return "EXIT_RISK";
  if (candidate.sourceBucket === "RISK" && effectiveContinuation < 45) return "EXIT_RISK";
  if (candidate.sourceBucket === "PARABOLIC_WATCH" || candidate.action === "Het men jaga inte") return "TRIM";
  if (candidate.sourceBucket === "RISK" || candidate.risk >= 70) return "TIGHTEN_STOP";
  if (effectiveContinuation < 45 && candidate.rvol < 1.2) return "MOMENTUM_DEAD";
  if (effectiveContinuation < 55 && candidate.movePct < 0) return "FAILED_CONTINUATION";
  if (candidate.setupType === "Pullback valid" || (candidate.risk >= 45 && candidate.risk < 65 && effectiveContinuation >= 60)) return "FIRST_PULLBACK_VALID";
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

function hasTrackedContinuity(item: TrackedTicker) {
  return item.status === "activeCandidate" ||
    item.status === "recentlyActive" ||
    Boolean(item.candidate) ||
    (item.lastKnownScore !== null && item.lastKnownScore !== undefined) ||
    (item.lastKnownState !== null && item.lastKnownState !== undefined);
}

function buildPositionManagement(input: {
  trackedUniverse: TrackedTicker[];
  previousSnapshots: RunnerCaseSnapshot[];
  changes: Array<RankingChange & { createdAt?: string }>;
}): PositionManagementDecision[] {
  const previousByTicker = new Map(input.previousSnapshots.map((snapshot) => [tickerKey(snapshot.ticker), snapshot]));
  const interesting = input.trackedUniverse.filter(hasTrackedContinuity);
  return interesting.slice(0, 18).map((item) => {
    const candidate = item.candidate;
    const previous = previousByTicker.get(tickerKey(item.ticker));
    const state = positionStateFor(item);
    const trend = confidenceTrend(candidate?.confidence ?? item.lastKnownConfidence, previous?.confidence);
    const change = input.changes.find((entry) => tickerKey(entry.ticker) === tickerKey(item.ticker))?.reason;
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
        : item.lastKnownState || (item.lastKnownScore !== null && item.lastKnownScore !== undefined)
          ? `Senast känt state ${item.lastKnownState ?? "okänd"}, score ${item.lastKnownScore ?? "-"}, confidence ${item.lastKnownConfidence ?? "-"}.`
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
    const effectiveContinuation = effectiveContinuationFor(candidate);
    if (candidate.signalQuality === "DEAD") return "DEAD";
    if (candidate.signalQuality === "EXHAUSTED") return "AVOID";
    if (candidate.signalQuality === "STALLED" && candidate.decayScore >= 55) return "LOW_PRIORITY";
    if (!candidate.isActiveToday) {
      if (candidate.freshnessStatus === "premarketContext" || candidate.freshnessStatus === "afterClose") return "REENTRY_WATCH";
      if (candidate.freshnessStatus === "recentMemory" && (effectiveContinuation < 45 || candidate.rvol < 1.2)) return "DEAD";
      return "LOW_PRIORITY";
    }
    if (
      candidate.triggerVerificationState === "PRICE_ONLY" &&
      candidate.narrativeTriggerType === "UNKNOWN" &&
      candidate.rvol < 2.8 &&
      effectiveContinuation < 78
    ) return "LOW_PRIORITY";
    const majorAcceleration =
      candidate.action === "Agera" &&
      effectiveContinuation >= 70 &&
      candidate.rvol >= 1.5 &&
      candidate.risk < 70 &&
      candidate.decayScore < 35 &&
      candidate.confirmationCount >= 3 &&
      candidate.sourceBucket !== "PARABOLIC_WATCH";
    if (majorAcceleration) return "MUST_ACT";
    if (
      candidate.triggerVerificationState === "VERIFIED" &&
      candidate.discoveryScore >= 72 &&
      candidate.repricingProbability >= 58 &&
      candidate.risk < 78 &&
      candidate.decayScore < 45
    ) return effectiveContinuation >= 62 || candidate.rvol >= 1.35 ? "WATCH_CLOSELY" : "REENTRY_WATCH";
    if (
      candidate.hasFreshFundamentalCatalyst &&
      candidate.narrativeStrength >= 72 &&
      candidate.repricingProbability >= 58 &&
      candidate.decayScore < 45 &&
      candidate.risk < 75
    ) return "WATCH_CLOSELY";
    if (candidate.sourceBucket === "PARABOLIC_WATCH" || candidate.action === "Het men jaga inte" || candidate.risk >= 80) return "AVOID";
    if (effectiveContinuation >= 68 && candidate.risk < 68) return "WATCH_CLOSELY";
    if (candidate.sourceBucket === "STEALTH" || candidate.setupType === "Pullback valid") return "REENTRY_WATCH";
    if (effectiveContinuation < 40 && candidate.rvol < 1.15) return "DEAD";
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
    if (candidate.triggerVerificationState === "PRICE_ONLY" && candidate.narrativeTriggerType === "UNKNOWN" && candidate.rvol < 2.8) {
      return `Okänd story/PRICE ONLY. Behöver starkare RVOL eller verifierad trigger innan den prioriteras högre. Discovery ${candidate.discoveryScore}/100.`;
    }
    if (candidate.triggerVerificationState === "VERIFIED" && candidate.discoveryScore >= 70) {
      return `Verifierad discovery/repricing: ${candidate.narrativeTriggerType}. Discovery ${candidate.discoveryScore}/100. ${candidate.catalystSummary}`;
    }
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
    ? Math.min(12, Math.max(0, effectiveContinuationFor(candidate) - 65) / 2) + Math.min(8, Math.max(0, candidate.rvol - 1.5) * 4)
    : 0;
  const discoveryBoost = candidate
    ? Math.round(candidate.discoveryScore * 0.18) +
      (candidate.triggerVerificationState === "VERIFIED"
        ? 10
        : candidate.triggerVerificationState === "THEMATIC"
          ? 5
          : candidate.triggerVerificationState === "PRICE_ONLY" && candidate.rvol < 2.8
            ? -12
            : 0)
    : 0;
  const trendBoost = position?.confidenceTrend === "up" ? 5 : position?.confidenceTrend === "down" ? -6 : 0;
  return Math.max(0, Math.min(100, Math.round(base[state] + candidateBoost + discoveryBoost + trendBoost)));
}

function buildPriorityBoard(input: {
  trackedUniverse: TrackedTicker[];
  positionManagement: PositionManagementDecision[];
  changes: Array<RankingChange & { createdAt?: string }>;
}): PriorityItem[] {
  const positionByTicker = new Map(input.positionManagement.map((item) => [tickerKey(item.ticker), item]));
  const changeByTicker = new Map(input.changes.map((item) => [tickerKey(item.ticker), item]));
  const important = input.trackedUniverse.filter((item) => {
    const position = positionByTicker.get(tickerKey(item.ticker));
    return item.status !== "trackedButNotActive" ||
      hasTrackedContinuity(item) ||
      Boolean(position && position.source !== "tracked_memory");
  });
  return important
    .map((item) => {
      const candidate = item.candidate;
      const position = positionByTicker.get(tickerKey(item.ticker));
      const change = changeByTicker.get(tickerKey(item.ticker));
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
        discoveryScore: candidate?.discoveryScore,
        triggerVerificationState: candidate?.triggerVerificationState,
        freshnessMinutes: candidate?.freshnessMinutes ?? 24 * 60,
        lastConfirmedAt: candidate?.lastConfirmedAt ?? null,
        changedFrom: change?.changeType ?? position?.state ?? item.lastKnownState ?? null,
        changedAt: change?.createdAt ?? null,
        expiresSoon: priorityState === "MUST_ACT" || priorityState === "WATCH_CLOSELY" || priorityState === "AVOID",
      } satisfies PriorityItem;
    })
    .filter((item) => {
      if (item.priorityState === "LOW_PRIORITY") return false;
      if (item.priorityState === "MUST_ACT" || item.priorityState === "WATCH_CLOSELY") return item.urgencyScore >= 60;
      if (item.priorityState === "REENTRY_WATCH") {
        return item.freshnessStatus === "activeToday" ||
          item.freshnessStatus === "premarketContext" ||
          item.triggerVerificationState === "VERIFIED" ||
          item.urgencyScore >= 58;
      }
      if (item.priorityState === "AVOID") return item.sourceStatus === "activeCandidate" || item.urgencyScore >= 58;
      if (item.priorityState === "DEAD") return item.sourceStatus === "activeCandidate" && item.urgencyScore >= 35;
      return false;
    })
    .sort((a, b) => b.urgencyScore - a.urgencyScore || b.confidence - a.confidence || a.ticker.localeCompare(b.ticker))
    .slice(0, 10);
}

function buildEarlyRadar(input: {
  newsTriggers: NewsTrigger[];
  candidates: TradingCandidate[];
  trackedUniverse: TrackedTicker[];
  snapshotFreshness: ReturnType<typeof buildSnapshotFreshness>;
  newsIsLive: boolean;
}): EarlyRadarItem[] {
  const candidateByTicker = new Map(input.candidates.map((item) => [tickerKey(item.ticker), item]));
  const items = new Map<string, EarlyRadarItem>();
  for (const trigger of input.newsTriggers) {
    if (!trigger.ticker || trigger.narrativeTriggerType === "UNKNOWN" || trigger.triggerType === "MACRO_NOISE") continue;
    const ticker = tickerKey(trigger.ticker);
    const candidate = candidateByTicker.get(ticker);
    const isFreshTrigger = trigger.isFreshToday;
    const priorityScore = Math.max(0, Math.min(100, Math.round(
      trigger.triggerStrength * 0.34 +
        trigger.repricingPotential * 0.32 +
        trigger.marketCapSensitivity * 0.18 +
        trigger.secondDerivativeScore * 0.12 +
        (candidate?.isActiveToday ? 8 : 0) -
        (!isFreshTrigger ? 30 : 0) -
        (!input.newsIsLive ? 8 : 0),
    )));
    items.set(ticker, {
      ticker,
      company: trigger.company,
      rank: 0,
      radarReason: trigger.summary,
      preOpenTrigger: trigger.headline,
      narrativeTriggerType: trigger.narrativeTriggerType as NarrativeTriggerType,
      triggerStrength: trigger.triggerStrength,
      marketCapSensitivity: trigger.marketCapSensitivity,
      secondDerivativeScore: trigger.secondDerivativeScore,
      watchBeforeOpen: isFreshTrigger && priorityScore >= 55,
      confirmationNeeded: candidate?.isActiveToday
        ? "bekräfta att live move håller första pullbacken"
        : "öppningsvolym, spreadkontroll och första higher low",
      invalidation: "ingen öppningsvolym eller headline får ingen prisreaktion",
      priorityScore,
      source: candidate ? "hybrid" : "newsTrigger",
      status: candidate?.isActiveToday
        ? "ACTIVE_CONFIRMED"
        : isFreshTrigger
          ? "PREOPEN_WATCH"
          : "OPEN_CONFIRMATION_NEEDED",
      triggerVerificationState: trigger.triggerVerificationState,
    });
  }
  for (const candidate of input.candidates) {
    if (!candidate.isActiveToday && candidate.freshnessStatus !== "premarketContext") continue;
    if (candidate.narrativeTriggerType === "UNKNOWN" || candidate.narrativeStrength < 58) continue;
    const key = tickerKey(candidate.ticker);
    const existing = items.get(key);
    const priorityScore = Math.max(existing?.priorityScore ?? 0, Math.round(
      candidate.narrativeStrength * 0.36 +
        candidate.repricingProbability * 0.28 +
        candidate.thematicTailwind * 0.16 +
        candidate.marketAttentionShift * 0.12 -
        candidate.decayScore * 0.2,
    ));
    items.set(key, {
      ticker: candidate.ticker,
      company: candidate.company,
      rank: 0,
      radarReason: candidate.whyNow,
      preOpenTrigger: candidate.catalystSummary,
      narrativeTriggerType: candidate.narrativeTriggerType,
      triggerStrength: Math.max(candidate.catalystScore, candidate.narrativeStrength),
      marketCapSensitivity: 55,
      secondDerivativeScore: candidate.thematicTailwind,
      watchBeforeOpen: input.snapshotFreshness.marketSessionPhase === "preopen" || candidate.freshnessStatus === "premarketContext",
      confirmationNeeded: candidate.needsNow,
      invalidation: candidate.invalidation,
      priorityScore,
      source: existing ? "hybrid" : "candidate",
      status: candidate.isActiveToday ? "ACTIVE_CONFIRMED" : "OPEN_CONFIRMATION_NEEDED",
      triggerVerificationState: candidate.triggerVerificationState,
    });
  }
  for (const tracked of input.trackedUniverse) {
    const key = tickerKey(tracked.ticker);
    if (items.has(key) || tracked.status === "activeCandidate") continue;
    const hasFreshTrigger = input.newsTriggers.some((trigger) => trigger.ticker && tickerKey(trigger.ticker) === key && trigger.isFreshToday);
    if (!hasFreshTrigger) continue;
    items.set(key, {
      ticker: key,
      company: tracked.company,
      rank: 0,
      radarReason: tracked.summary,
      preOpenTrigger: "fresh trigger i newsTriggers",
      narrativeTriggerType: "UNKNOWN",
      triggerStrength: 45,
      marketCapSensitivity: 50,
      secondDerivativeScore: 20,
      watchBeforeOpen: true,
      confirmationNeeded: "måste dyka upp i live scan vid öppning",
      invalidation: "ingen live reaction vid öppning",
      priorityScore: 48,
      source: "trackedMemory",
      status: "OPEN_CONFIRMATION_NEEDED",
      triggerVerificationState: "UNVERIFIED",
    });
  }
  return [...items.values()]
    .filter((item) => item.status !== "REJECTED" && item.priorityScore >= 40)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.triggerStrength - a.triggerStrength)
    .slice(0, 10)
    .map((item, index) => ({ ...item, rank: index + 1 }));
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
  const newsFallback = {
    providerName: "news ingestion unavailable",
    mode: "disabled" as const,
    isLive: false,
    isConfigured: false,
    lastFetchAt: new Date().toISOString(),
    error: "news ingestion timed out or failed",
    headlineCount: 0,
    feedHealth: [],
    generatedAt: new Date().toISOString(),
    headlines: [],
  };
  const [discovery, changesResult, newsIngestion] = await Promise.all([
    withTimeout(runAutonomousDiscoveryScan({ provider: yahooLiveMarketReactionProvider }), SNAPSHOT_SCAN_TIMEOUT_MS),
    withTimeout(getLatestRunChanges().catch(() => null), 6_000),
    withTimeout(fetchLatestNewsHeadlinesWithFallback().catch(() => newsFallback), 6_000),
  ]);
  const safeNewsIngestion = newsIngestion ?? newsFallback;
  const now = new Date();
  const dataTimestamp = discovery?.generatedAt ? new Date(discovery.generatedAt) : null;
  const snapshotFreshness = buildSnapshotFreshness(now, dataTimestamp);
  const newsTriggers = parseNewsTriggers(safeNewsIngestion.headlines).slice(0, 25);
  const newsByTicker = new Map(
    newsTriggers
      .filter((trigger) => safeNewsIngestion.isLive && trigger.isFreshToday && trigger.ticker)
      .map((trigger) => [tickerKey(trigger.ticker!), trigger]),
  );
  const changeByTicker = new Map<string, string>();
  for (const change of changesResult?.changes ?? []) {
    const key = tickerKey(change.ticker);
    if (!changeByTicker.has(key)) changeByTicker.set(key, change.reason);
  }
  const persistedSnapshotsPromise = withTimeout(getLatestCaseStateSnapshots(80).catch(() => [] as RunnerCaseSnapshot[]), 6_000);
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
            const key = tickerKey(candidate.ticker);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((candidate) => toTradingCandidate(candidate, changeByTicker.get(tickerKey(candidate.ticker)), snapshotFreshness, newsByTicker))
          .filter((candidate): candidate is TradingCandidate => Boolean(candidate))
          .sort(sortCandidates)
          .slice(0, 18);
      })()
    : ((await persistedSnapshotsPromise) ?? [])
        .filter((snapshot) => snapshot.source === "discovery")
        .map((snapshot) => toPersistedCandidate(snapshot, changeByTicker.get(tickerKey(snapshot.ticker))))
        .filter((candidate): candidate is TradingCandidate => Boolean(candidate))
        .sort(sortCandidates)
        .slice(0, 18);
  const focus = candidates
    .filter(isTopSetup)
    .sort((a, b) => convictionScore(b) - convictionScore(a))
    .slice(0, 3);
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
  const persistedSnapshots = (await persistedSnapshotsPromise) ?? [];
  const recentlyActive = buildRecentlyActive(candidates, persistedSnapshots, changesResult?.changes ?? []);
  const breadth = {
    hot: candidates.filter(isTopSetup).slice(0, 3),
    watch: candidates.filter(isWatchlistSetup).slice(0, 8),
    stealth: candidates.filter((candidate) => isWatchlistSetup(candidate) && candidate.sourceBucket === "STEALTH").slice(0, 6),
    noChase: candidates.filter(isDeadMoney).slice(0, 8),
    recentlyActive: recentlyActive.filter(isDeadMoney).slice(0, 6),
  };
  const trackedUniverse = buildTrackedUniverse({ candidates, recentlyActive, snapshots: persistedSnapshots, discovery });
  const liveCoverageAudit = buildLiveCoverageAudit(trackedUniverse);
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
  const earlyRadar = buildEarlyRadar({
    newsTriggers,
    candidates,
    trackedUniverse,
    snapshotFreshness,
    newsIsLive: safeNewsIngestion.isLive,
  });
  const catalystRankingDebug = candidates
    .filter((candidate) => candidate.newsTriggerType || candidate.catalystBoostApplied || candidate.triggerVerificationState !== "PRICE_ONLY")
    .map((candidate) => ({
      ticker: candidate.ticker,
      triggerType: candidate.newsTriggerType,
      verified: candidate.triggerVerificationState === "VERIFIED",
      newsAgeHours: candidate.newsAgeHours,
      catalystBoostApplied: candidate.catalystBoostApplied,
      finalState: candidate.finalState,
    }));

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
      ...(!safeNewsIngestion.isLive ? ["News Trigger Inbox använder MOCK/MANUAL eller disabled fallback, inte live Avanza/Finwire/MFN/Cision."] : []),
      ...(!safeNewsIngestion.isConfigured ? ["News provider not configured: lägg NEWS_RSS_FEEDS för riktig RSS live-ingestion."] : []),
      ...(safeNewsIngestion.error ? [`News provider issue: ${safeNewsIngestion.error}`] : []),
    ],
    marketQuality: computedMarketQuality,
    newsProviderStatus: {
      providerName: safeNewsIngestion.providerName,
      mode: safeNewsIngestion.mode,
      isLive: safeNewsIngestion.isLive,
      isConfigured: safeNewsIngestion.isConfigured,
      lastFetchAt: safeNewsIngestion.lastFetchAt,
      error: safeNewsIngestion.error,
      headlineCount: safeNewsIngestion.headlineCount,
      feedHealth: safeNewsIngestion.feedHealth,
    },
    whatChanged: (changesResult?.changes ?? []).slice(0, 8),
    marketPulse: buildMarketPulse(candidates, computedMarketQuality),
    catalystPulse: buildCatalystPulse(candidates),
    trackedUniverse,
    liveCoverageAudit,
    positionManagement,
    priorityBoard,
    newsTriggers,
    catalystRankingDebug,
    earlyRadar,
    breadth,
  };
}
