export type TerminalAction = "BUY WATCH" | "WATCH" | "WAIT_PULLBACK" | "AVOID_CHASE" | "NEWS_ONLY" | "HIGH_RISK_ONLY" | "IGNORE" | string;

export interface TerminalSetup {
  ticker: string;
  companyName: string;
  exchange: string;
  trigger: string;
  catalyst: string;
  whyNow: string;
  preOpenScore: number;
  openingAction: TerminalAction;
  risk: number;
  confidence: number;
  tags: string[];
  tickerConfidence: number;
  historicalSetupWinrate: number;
  triggerComboGrade: "A" | "B" | "C" | "D" | "N/A";
  falsePositiveRisk: number;
  adaptiveConfidenceDelta: number;
  avgContinuation: number;
  avgFadeRisk: number;
  similarPastSetups: string[];
  invalidation?: string;
  openingPlan?: {
    action?: string;
    reason?: string;
    whyBeforeOpen?: string;
    confirms?: string;
    invalidates?: string;
    doNot?: string;
  };
  liveMarketReaction?: LiveMarketReaction;
}

export interface LiveMarketReaction {
  ticker: string;
  companyName: string;
  exchange: string;
  asOf: string;
  price: number;
  intradayMomentum: number;
  relativeVolume: number;
  gapPercent: number;
  acceleration: number;
  volatilityExpansion: number;
  squeezeProbability: number;
  continuationProbability: number;
  fadeProbability: number;
  intradayStrengthScore: number;
  abnormalMoveScore: number;
  marketAggression: number;
  activeTraderAttention: number;
  label: string;
  flags: string[];
  reason: string;
}

export interface TerminalRejectedCandidate {
  ticker: string;
  trigger: string;
  preOpenScore: number;
  rejectedBecause: string[];
  tickerValidation?: {
    identity: {
      exchange: string;
      sourceConfidence: number;
    };
  };
}

export interface TerminalWarRoom {
  generatedAt: string;
  topPreOpenSetups: TerminalSetup[];
  rejectedCandidates: TerminalRejectedCandidate[];
  acceptedCount: number;
  rejectedCount: number;
  overnightRegime?: {
    nasdaqFutures: "positive" | "neutral" | "negative" | "unknown";
    activeThemes: string[];
    alignmentScore: number;
    sectorMomentum?: Array<{ sector: string; direction: string; score: number }>;
  };
  sourceHealth?: Array<{
    source: string;
    status: string;
    latencyMs: number;
    fetched: number;
    accepted: number;
    rejected: number;
    duplicateCount: number;
    parseErrors: number;
    freshness: string;
  }>;
  dedupeStats?: {
    fetched: number;
    accepted: number;
    rejected: number;
    duplicateCount: number;
    parseErrors: number;
  };
  feedStatus: {
    status: "healthy" | "missing" | "stale" | "error";
    message: string;
    latestNewsFetch: string | null;
    acceptedNews: number;
    rejectedNews: number;
  };
}

export interface AutonomousDiscoveryCandidate {
  ticker: string;
  companyName: string;
  exchange: string;
  sector: string;
  marketCapBucket: string;
  liquidityBucket: string;
  autonomousDiscoveryScore: number;
  bucket: "HOT" | "WATCH" | "STEALTH" | "PARABOLIC_WATCH" | "RISK" | "SUPPRESSED";
  discoveryConfidence: number;
  labels: string[];
  sourceTags: string[];
  whyDiscovered: string[];
  sourceWeights: Record<string, number>;
  suppressionReasons: string[];
  whyNotRankedHigher: string[];
  reaction: LiveMarketReaction;
}

export interface MissedMover {
  ticker: string;
  companyName: string;
  exchange: string;
  movePercent: number;
  relativeVolume: number;
  reason: string;
  detail: string;
  reaction?: LiveMarketReaction;
}

export interface AutonomousDiscoveryReport {
  generatedAt: string;
  universeSize: number;
  scannedCount: number;
  liveHits: number;
  missingDataCount: number;
  coverageByExchange: Array<{ exchange: string; total: number; liveHits: number; missing: number; coveragePercent: number }>;
  missingTickers: Array<{ ticker: string; companyName: string; exchange: string; sector: string; reason: string }>;
  aliasDebug?: Array<{
    ticker: string;
    exchange: string;
    attemptedSymbols: Array<{
      symbol: string;
      success: boolean;
      bars: number;
      range: string;
      interval: string;
    }>;
    workingAlias: string | null;
    lastError: string | null;
  }>;
  suppressedByReason: Array<{ reason: string; count: number }>;
  bucketCounts: Record<"HOT" | "WATCH" | "STEALTH" | "PARABOLIC_WATCH" | "RISK" | "SUPPRESSED", number>;
  scanned: number;
  candidates: AutonomousDiscoveryCandidate[];
  hotMovers: AutonomousDiscoveryCandidate[];
  watchMovers: AutonomousDiscoveryCandidate[];
  stealthMovers: AutonomousDiscoveryCandidate[];
  continuationLeaders: AutonomousDiscoveryCandidate[];
  highRiskParabolicMovers: AutonomousDiscoveryCandidate[];
  suppressedMovers: AutonomousDiscoveryCandidate[];
  topCandidatesByBucket: Record<"HOT" | "WATCH" | "STEALTH" | "PARABOLIC_WATCH" | "RISK" | "SUPPRESSED", AutonomousDiscoveryCandidate[]>;
  missedMovers: MissedMover[];
  providerStatus?: {
    status: "live" | "fallback_cached" | "provider_failure" | "partial";
    message: string;
    latestGoodScanAt: string | null;
    attemptedSymbols: number;
    timeoutCount: number;
    partialResults: number;
    successfulDailyBars?: number;
    successfulIntradayBars?: number;
    failedSymbolSamples?: string[];
  };
}

export interface ComboPerformance {
  key: string;
  sampleSize: number;
  winRate: number;
  avgContinuation: number;
  avgMaxMovePct: number;
  avgFadePct: number;
  falsePositiveRate: number;
}

export interface LearningReport {
  generatedAt: string;
  bestTriggerCombos: ComboPerformance[];
  worstTriggerCombos: ComboPerformance[];
  falsePositivePatterns: Array<{
    key: string;
    falsePositiveRate: number;
    avgFadePct: number;
    sampleSize: number;
    reason: string;
  }>;
  insiderQualityRanking: Array<{
    ticker: string;
    insiderName?: string;
    sampleSize: number;
    continuationRate: number;
    avgContinuation: number;
    insiderQualityScore?: number;
  }>;
  recentOutcomeSummary: {
    totalSignals: number;
    evaluatedSignals: number;
    pendingSignals: number;
    continuation: number;
    squeeze: number;
    fade: number;
    fakeSpike: number;
    noFollowThrough: number;
  };
  topContinuationSetups: ComboPerformance[];
  confidenceChanges: Array<{ key: string; delta: number; explanation: string }>;
}

export interface TerminalDebug {
  generatedAt: string;
  providerRuns: Array<{
    id: string;
    provider: string;
    status: string;
    latencyMs: number;
    fetchedCount: number;
    savedCount: number;
    errorMessage: string | null;
    createdAt: string;
  }>;
  newsFeed?: {
    accepted: number;
    rejected: number;
    freshness: string;
    sourceHealth: NonNullable<TerminalWarRoom["sourceHealth"]>;
    dedupeStats: NonNullable<TerminalWarRoom["dedupeStats"]>;
  };
  outcomeCollector?: {
    status: string;
    lastRunAt: string | null;
    processed: number;
    updated: number;
    stillPending: number;
    dead: number;
    missingMarketDataByTicker: Array<{ ticker: string; count: number; horizons: string[] }>;
    latestClassifiedOutcomes: Array<{
      signalId: string;
      ticker: string;
      horizon: string;
      outcomeLabel: string;
      followThroughQuality: number;
      maxUpsidePercent: number;
    }>;
  };
}

export type AgentCaseState =
  | "NEW_SIGNAL"
  | "WATCH"
  | "CONFIRMATION_PENDING"
  | "EARLY_CONTINUATION"
  | "HIGH_CONVICTION"
  | "PARABOLIC_RISK"
  | "FADE_WARNING"
  | "FAILED"
  | "COOLDOWN"
  | "REJECTED";

export interface AgentLoopCase {
  ticker: string;
  companyName?: string;
  exchange?: string;
  state: AgentCaseState;
  previousState?: AgentCaseState | null;
  sessionMode: string;
  reason: string;
  confidence: number;
  alertType?: string;
  alertSeverity?: string;
  confirmation?: string;
  invalidation?: string;
  feedbackScore: number;
  eventKey: string;
  raw?: {
    source?: string;
    preOpenScore?: number;
    [key: string]: unknown;
  };
}

export interface AgentLoopAlert {
  id: string;
  ticker: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface AgentLoopReport {
  generatedAt: string;
  sessionId: string | null;
  sessionMode: string;
  persistence: "active" | "missing_supabase";
  cases: AgentLoopCase[];
  alerts: AgentLoopAlert[];
  feedback: Array<{
    ticker: string;
    feedbackScore: number;
    falsePositiveCount: number;
    falseNegativeCount: number;
    userOverrideCount: number;
  }>;
  saved: {
    events: number;
    alerts: number;
  };
  diagnostics: {
    warRoomCases: number;
    discoveryCases: number;
    rejectedCases: number;
    coverage: {
      scannedCount: number;
      liveHits: number;
      missingDataCount: number;
      coverageByExchange: Array<{ exchange: string; total: number; liveHits: number; missing: number; coveragePercent: number }>;
    } | null;
  };
}

export interface IntelligenceChangesReport {
  persistence: "active" | "missing_supabase";
  latestRun: {
    id: string;
    jobs: string[];
    reason: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    latencyMs: number;
    errorMessage: string | null;
  } | null;
  changes: Array<{
    ticker: string;
    changeType: string;
    previousValue: string | number | null;
    currentValue: string | number | null;
    severity: string;
    reason: string;
    createdAt: string;
  }>;
}

export interface OvernightSummaryReport {
  generatedAt: string;
  persistence: "active" | "missing_supabase";
  windowHours: number;
  biggestStateChanges: Array<{ ticker: string; reason: string; severity: string; changeType: string }>;
  newCasesDiscovered: Array<{ ticker: string; reason: string; severity: string; changeType: string }>;
  casesUpgraded: Array<{ ticker: string; reason: string; severity: string; changeType: string }>;
  casesDowngraded: Array<{ ticker: string; reason: string; severity: string; changeType: string }>;
  parabolicFakeSpikeWarnings: Array<{ ticker?: string | null; signalState?: string | null; risk?: number | null }>;
  missedMovers: Array<{ ticker?: string | null; suppressionReason?: string | null; score?: number | null }>;
  dataCoverageIssues: string[];
  providerFailures: Array<{ provider: string; errorMessage: string | null; createdAt: string }>;
  morningBrief: {
    focus_now: Array<{ ticker?: string | null; state?: string | null; confidence?: number | null }>;
    watchlist: unknown[];
    avoid: unknown[];
    portfolio_alerts: unknown[];
    discovery_candidates: unknown[];
    data_quality: {
      coverageRatio: number | null;
      warnings: string[];
    };
    unresolved_risks: unknown[];
    suggested_next_checks: string[];
  };
  morningBriefPayload?: {
    what_happened_while_away?: unknown;
    strongest_upgrades?: unknown[];
    fades_warnings?: unknown[];
    new_cases?: unknown[];
    cases_moving_toward_high_conviction?: unknown[];
    provider_issues?: unknown;
    learning_notes?: unknown;
    suggested_user_actions?: unknown;
    data_quality?: unknown;
    unresolved_risks?: unknown[];
  };
}

export interface SuspiciousUnknownCandidate {
  ticker: string;
  unknownScore: number;
  suspicionLevel: "irrelevant_unknown" | "weak_unknown" | "suspicious_unknown" | "likely_hidden_runner";
  inferredInterest: "none" | "low" | "medium" | "high";
  inferredSector: string | null;
  inferredMarket: string | null;
  possibleAliases: string[];
  possiblePeers: string[];
  reasoning: string[];
  falseNegativeRisk: number;
  coverageLevel: number;
  repeatedMentions: number;
  unresolvedFrequency: number;
  hiddenRunnerProbability: number;
  guardrails: string[];
}

export interface SuspiciousUnknownsReport {
  generatedAt: string;
  persistence: "active" | "missing_supabase";
  candidates: SuspiciousUnknownCandidate[];
  counts: {
    likelyHiddenRunner: number;
    suspiciousUnknown: number;
    weakUnknown: number;
    irrelevantUnknown: number;
  };
}

export interface AutonomyStatusReport {
  mode: "market-open" | "intraday" | "evening" | "overnight" | "manual";
  status: "idle" | "running" | "stopped" | "error";
  intervalMs: number;
  running: boolean;
  hasLocalTimer: boolean;
  sessionId: string | null;
  persistence: "active" | "missing_supabase";
  lastRunAt: string | null;
  runCount: number;
  observationsSaved: number;
  lastError: string | null;
  note: string;
  databaseSession: null | {
    id: string;
    mode: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    lastRunAt: string | null;
    intervalMs: number;
    runCount: number;
    casesObserved: number;
    observationsCount: number;
    failedProviders: unknown[];
    missingCoverage: unknown[];
    notableChanges: unknown[];
    learnedObservations: unknown[];
    morningSummaryPayload: unknown;
  };
}
