import type { PortfolioHolding } from "@/lib/portfolioHoldings";

export type PortfolioIntelligenceStatus =
  | "STRENGTHENING"
  | "HOLD"
  | "REDUCE"
  | "HIGH_RISK"
  | "EXIT_WATCH"
  | "AVOID_ADDING"
  | "ACCUMULATING";

export interface PortfolioSignalContext {
  ticker: string;
  companyName?: string;
  exchange?: string;
  preOpenScore: number;
  confidence: number;
  falsePositiveRisk: number;
  avgContinuation: number;
  avgFadeRisk: number;
  adaptiveConfidenceDelta: number;
  openingAction: string;
  trigger: string;
  catalyst: string;
  tags: string[];
  risk: number;
  liveMarketReaction?: {
    marketAggression: number;
    continuationProbability: number;
    fadeProbability: number;
    relativeVolume: number;
    acceleration: number;
    intradayMomentum?: number;
    label?: string;
    flags: string[];
    reason: string;
  };
}

export interface PortfolioHoldingIntelligence {
  holding: PortfolioHolding;
  status: PortfolioIntelligenceStatus;
  statusLabel: string;
  currentConviction: number;
  confidenceDelta: number;
  deltaVsEntry: number | null;
  strengtheningEdge: number;
  weakeningEdge: number;
  insiderActivity: "aktiv" | "svag" | "saknas";
  crowdingRisk: number;
  continuationProbability: number;
  fadeRisk: number;
  narrativeTrend: "accelererar" | "neutral" | "tappar";
  unusualActivity: boolean;
  volatilityExpansion: boolean;
  riskRewardDeterioration: boolean;
  decision: string;
  reason: string;
}

export interface CapitalRotationSuggestion {
  weakeningHolding: string;
  suggestedAlternative: string;
  why: string;
  confidence: number;
  riskDifference: number;
}

export interface PortfolioIntelligenceReport {
  holdings: PortfolioHoldingIntelligence[];
  strongestHoldings: PortfolioHoldingIntelligence[];
  weakeningHoldings: PortfolioHoldingIntelligence[];
  unusualActivity: PortfolioHoldingIntelligence[];
  insiderActivity: PortfolioHoldingIntelligence[];
  riskWarnings: PortfolioHoldingIntelligence[];
  concentrationRisk: string[];
  suggestedReductions: PortfolioHoldingIntelligence[];
  suggestedRotations: CapitalRotationSuggestion[];
  checklist: string[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeTicker(ticker: string) {
  return ticker.toUpperCase().trim();
}

function statusLabel(status: PortfolioIntelligenceStatus) {
  const labels: Record<PortfolioIntelligenceStatus, string> = {
    STRENGTHENING: "Starkare edge",
    HOLD: "Hall",
    REDUCE: "Minska",
    HIGH_RISK: "Hog risk",
    EXIT_WATCH: "Exit-watch",
    AVOID_ADDING: "Oka inte",
    ACCUMULATING: "Ackumulerar",
  };
  return labels[status];
}

function estimateDeltaVsEntry(holding: PortfolioHolding, signal?: PortfolioSignalContext) {
  if (!signal || holding.avg_entry <= 0) return null;
  const proxyPrice = holding.avg_entry * (1 + (signal.avgContinuation - signal.avgFadeRisk) / 100);
  return Number((((proxyPrice - holding.avg_entry) / holding.avg_entry) * 100).toFixed(1));
}

function classifyHolding(holding: PortfolioHolding, signal?: PortfolioSignalContext): PortfolioHoldingIntelligence {
  const hasSignal = Boolean(signal);
  const confidence = signal?.confidence ?? holding.conviction;
  const live = signal?.liveMarketReaction;
  const confidenceDelta = (signal?.adaptiveConfidenceDelta ?? 0) + (live?.marketAggression && live.marketAggression >= 65 ? 8 : 0);
  const fadeRisk = signal?.avgFadeRisk ?? 0;
  const crowdingRisk = signal ? clamp(signal.falsePositiveRisk + Math.max(0, signal.risk - 55)) : 15;
  const continuationProbability = live
    ? clamp(signal ? signal.confidence * 0.25 + signal.preOpenScore * 0.2 + live.continuationProbability * 0.55 : live.continuationProbability)
    : signal
      ? clamp(signal.confidence * 0.45 + signal.preOpenScore * 0.25 + signal.avgContinuation * 0.2 + Math.max(0, confidenceDelta) * 0.1)
      : clamp(holding.conviction * 0.6);
  const strengtheningEdge = signal ? clamp(signal.preOpenScore * 0.35 + confidence * 0.35 + Math.max(0, confidenceDelta) * 1.5) : clamp(holding.conviction * 0.5);
  const weakeningEdge = signal
    ? clamp(crowdingRisk * 0.45 + fadeRisk * 4 + Math.max(0, -confidenceDelta) * 2 + (signal.preOpenScore < 45 ? 25 : 0))
    : 35;
  const insiderActivity = signal?.tags.some((tag) => /insider/i.test(tag)) ? "aktiv" : hasSignal ? "svag" : "saknas";
  const unusualActivity = Boolean(signal && (signal.preOpenScore >= 65 || signal.tags.some((tag) => /squeeze|volume|momentum/i.test(tag)) || (live?.relativeVolume ?? 0) >= 1.5));
  const volatilityExpansion = Boolean(signal && (signal.tags.some((tag) => /squeeze|momentum/i.test(tag)) || (live?.acceleration ?? 0) > 2));
  const parabolicHolding = Boolean(signal && (signal.openingAction === "REENTRY_ONLY" || live?.label === "PARABOLIC_RISK" || ((live?.intradayMomentum ?? 0) >= 12 && (live?.fadeProbability ?? 0) >= 60)));
  const riskRewardDeterioration = crowdingRisk >= 60 || fadeRisk >= 8 || confidenceDelta <= -10;

  let status: PortfolioIntelligenceStatus = "HOLD";
  if (!hasSignal && holding.conviction < 35) status = "EXIT_WATCH";
  else if (parabolicHolding) status = "HIGH_RISK";
  else if (riskRewardDeterioration && confidence < 55) status = "REDUCE";
  else if (crowdingRisk >= 70) status = "HIGH_RISK";
  else if (insiderActivity === "aktiv" && confidenceDelta >= 8) status = "ACCUMULATING";
  else if (strengtheningEdge >= 65 && confidenceDelta >= 5) status = "STRENGTHENING";
  else if (signal?.openingAction === "HIGH_RISK_ONLY" || signal?.openingAction === "AVOID_CHASE") status = "AVOID_ADDING";

  const decision =
    parabolicHolding
      ? "Ta hem delvinst/hoj stop. Re-entry endast efter pullback och ny volymvag."
      : status === "STRENGTHENING" || status === "ACCUMULATING"
      ? "Bevaka for eventuell okning vid bekraftelse"
      : status === "REDUCE" || status === "EXIT_WATCH"
        ? "Overvag minskning om svaghet bekraftas"
        : status === "HIGH_RISK" || status === "AVOID_ADDING"
          ? "Jaga inte mer kapital har"
          : "Ingen atgard fore bekraftelse";

  const reason = signal
    ? `${signal.trigger}: score ${signal.preOpenScore}, confidence ${signal.confidence}, FP ${signal.falsePositiveRisk}%. ${parabolicHolding ? "Parabolic/no-chase: prioritera riskkontroll." : ""} ${live ? `Live: ${live.reason}` : ""}`
    : "Inga verifierade live-signaler pa innehavet just nu.";

  return {
    holding,
    status,
    statusLabel: statusLabel(status),
    currentConviction: clamp(confidence),
    confidenceDelta,
    deltaVsEntry: estimateDeltaVsEntry(holding, signal),
    strengtheningEdge,
    weakeningEdge,
    insiderActivity,
    crowdingRisk,
    continuationProbability,
    fadeRisk,
    narrativeTrend: confidenceDelta >= 8 ? "accelererar" : confidenceDelta <= -8 ? "tappar" : "neutral",
    unusualActivity,
    volatilityExpansion,
    riskRewardDeterioration,
    decision,
    reason,
  };
}

export function buildPortfolioIntelligence(input: {
  holdings: PortfolioHolding[];
  marketSetups: PortfolioSignalContext[];
}): PortfolioIntelligenceReport {
  const setupByTicker = new Map(input.marketSetups.map((setup) => [normalizeTicker(setup.ticker), setup]));
  const holdings = input.holdings.map((holding) => classifyHolding(holding, setupByTicker.get(normalizeTicker(holding.ticker))));
  const strongestHoldings = holdings
    .filter((item) => item.status === "STRENGTHENING" || item.status === "ACCUMULATING")
    .sort((a, b) => b.strengtheningEdge - a.strengtheningEdge);
  const weakeningHoldings = holdings
    .filter((item) => item.status === "REDUCE" || item.status === "EXIT_WATCH" || item.status === "HIGH_RISK" || item.status === "AVOID_ADDING")
    .sort((a, b) => b.weakeningEdge - a.weakeningEdge);
  const unusualActivity = holdings.filter((item) => item.unusualActivity);
  const insiderActivity = holdings.filter((item) => item.insiderActivity === "aktiv");
  const riskWarnings = holdings.filter((item) => item.riskRewardDeterioration || item.crowdingRisk >= 60);
  const totalSize = holdings.reduce((sum, item) => sum + item.holding.size * item.holding.avg_entry, 0);
  const concentrationRisk = holdings
    .filter((item) => totalSize > 0 && (item.holding.size * item.holding.avg_entry) / totalSize > 0.35)
    .map((item) => `${item.holding.ticker} ar over 35% av registrerat portfoljvarde.`);
  const alternatives = input.marketSetups
    .filter((setup) => setup.preOpenScore >= 55 && setup.confidence >= 55 && setup.falsePositiveRisk < 45)
    .sort((a, b) => b.preOpenScore + b.confidence - (a.preOpenScore + a.confidence));
  const suggestedRotations = weakeningHoldings.slice(0, 2).flatMap((holding) => {
    const alternative = alternatives.find((setup) => normalizeTicker(setup.ticker) !== normalizeTicker(holding.holding.ticker));
    if (!alternative) return [];
    return [
      {
        weakeningHolding: holding.holding.ticker,
        suggestedAlternative: alternative.ticker,
        why: `${holding.holding.ticker} tappar edge medan ${alternative.ticker} har hogre pre-open score och lagre fade-risk.`,
        confidence: clamp((alternative.confidence + alternative.preOpenScore) / 2 - holding.weakeningEdge * 0.15),
        riskDifference: clamp(holding.crowdingRisk - alternative.falsePositiveRisk, -100, 100),
      },
    ];
  });

  const checklist = [
    `${riskWarnings.length} innehav kraver uppmarksamhet`,
    `${weakeningHoldings.length} innehav visar weakening edge`,
    suggestedRotations.length > 0 ? `${suggestedRotations.length} rotation kan vara battre an nuvarande swing-case` : "Ingen tydlig kapitalrotation just nu",
    alternatives.some((setup) => setup.confidence >= 70 && setup.preOpenScore >= 65) ? "Minst ett nytt setup nar hog conviction" : "Inga rena kop-case just nu",
    riskWarnings.some((item) => item.fadeRisk >= 8 || item.crowdingRisk >= 60) ? "Hog fake-spike-risk i minst ett innehav" : "Ingen bred fake-spike-varning i portfoljen",
  ];

  return {
    holdings,
    strongestHoldings,
    weakeningHoldings,
    unusualActivity,
    insiderActivity,
    riskWarnings,
    concentrationRisk,
    suggestedReductions: weakeningHoldings.filter((item) => item.status === "REDUCE" || item.status === "EXIT_WATCH"),
    suggestedRotations,
    checklist,
  };
}
