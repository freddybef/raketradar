import type { LearningReport, TerminalRejectedCandidate, TerminalSetup, TerminalWarRoom } from "@/components/terminal/types";

export type DecisionBucket = "act" | "watch" | "parabolic" | "avoid";

export interface DecisionItem {
  id: string;
  bucket: DecisionBucket;
  ticker: string;
  title: string;
  company?: string;
  exchange?: string;
  technicalAction?: string;
  humanAction: string;
  score: number;
  confidence: number;
  falsePositiveRisk: number;
  tickerConfidence?: number;
  reason: string;
  confirmation?: string;
  invalidation?: string;
  labels?: string[];
  source: "accepted" | "rejected";
}

const BUYABLE_ACTIONS = new Set(["BUY", "ADD", "HIGH_CONVICTION", "PREPARE_ORDER"]);
const WATCH_ACTIONS = new Set(["HIGH_RISK_ONLY", "WATCH", "BUY WATCH", "WAIT_PULLBACK", "NEWS_ONLY"]);
const AVOID_ACTIONS = new Set(["AVOID", "AVOID_CHASE", "IGNORE", "NO_TRADE"]);
const REENTRY_ACTIONS = new Set(["REENTRY_ONLY", "NO_CHASE_BUT_MONITOR", "PARABOLIC_WATCH"]);

export function normalizeAction(action?: string) {
  return (action ?? "").trim().toUpperCase().replaceAll("-", "_");
}

export function isDoNotChase(setup: TerminalSetup) {
  const action = normalizeAction(setup.openingAction);
  const live = setup.liveMarketReaction;
  if (isParabolicNoChase(setup)) return false;
  return action === "AVOID_CHASE" || action === "IGNORE" || setup.falsePositiveRisk >= 70 || setup.risk >= 82 || live?.label === "PARABOLIC_RISK" || (live ? live.intradayMomentum > 25 && live.fadeProbability >= 55 : false);
}

export function isParabolicNoChase(setup: TerminalSetup) {
  const action = normalizeAction(setup.openingAction);
  const live = setup.liveMarketReaction;
  return (
    REENTRY_ACTIONS.has(action) ||
    setup.tags.some((tag) => /parabolic watch|re-entry only|no chase/i.test(tag)) ||
    Boolean(live && live.fadeProbability >= 60 && (live.intradayMomentum > 20 || (live.label === "PARABOLIC_RISK" && live.intradayMomentum >= 12)) && (live.relativeVolume >= 1.1 || live.label === "PARABOLIC_RISK") && live.continuationProbability >= 65)
  );
}

export function isActionableSetup(setup: TerminalSetup) {
  const action = normalizeAction(setup.openingAction);
  const live = setup.liveMarketReaction;
  const liveContinuation =
    Boolean(live) &&
    setup.preOpenScore >= 70 &&
    setup.confidence >= 48 &&
    (live?.continuationProbability ?? 0) >= 66 &&
    (live?.fadeProbability ?? 100) < 70 &&
    (live?.relativeVolume ?? 0) >= 1.15 &&
    (live?.intradayMomentum ?? 0) >= 2 &&
    live?.label !== "PARABOLIC_RISK";
  return (
    !isDoNotChase(setup) &&
    ((BUYABLE_ACTIONS.has(action) && setup.confidence >= 70 && setup.preOpenScore >= 65 && setup.falsePositiveRisk < 45) || liveContinuation)
  );
}

export function humanActionLabel(action?: string) {
  const normalized = normalizeAction(action);
  if (normalized === "REENTRY_ONLY" || normalized === "NO_CHASE_BUT_MONITOR" || normalized === "PARABOLIC_WATCH") return "Re-entry watch";
  if (normalized === "HIGH_RISK_ONLY") return "Bevaka - bara vid bekraftelse";
  if (normalized === "WATCH" || normalized === "BUY WATCH" || normalized === "WAIT_PULLBACK" || normalized === "NEWS_ONLY") return "Bevaka";
  if (normalized === "AVOID" || normalized === "AVOID_CHASE" || normalized === "IGNORE") return "Undvik";
  if (normalized === "BUY" || normalized === "ADD" || normalized === "PREPARE_ORDER" || normalized === "HIGH_CONVICTION") return "Agera";
  if (normalized === "NO_TRADE") return "Ingen trade";
  return "Bevaka";
}

export function displayActionLabel(setup: TerminalSetup) {
  const action = normalizeAction(setup.openingAction);
  if (isActionableSetup(setup)) return "HIGH CONVICTION";
  if (isParabolicNoChase(setup)) return "NO CHASE / RE-ENTRY WATCH";
  if (action === "HIGH_RISK_ONLY") return "FOCUS / WATCHLIST";
  if (AVOID_ACTIONS.has(action) || isDoNotChase(setup)) return "AVOID";
  return "WATCH";
}

export function confirmationText(setup: TerminalSetup) {
  const hints: string[] = [];
  if (setup.falsePositiveRisk >= 45 || setup.avgFadeRisk >= 7) hints.push("vanta forsta 15 min");
  if (setup.risk >= 65) hints.push("krav hogre low");
  if (setup.preOpenScore < 65 || setup.confidence < 60) hints.push("krav nyhetsbekraftelse");
  if (setup.tags.some((tag) => /volume|squeeze|momentum/i.test(tag)) || setup.preOpenScore >= 65) hints.push("vanta pa stark oppningsvolym");
  if (setup.tags.some((tag) => /liquidity|float|smallcap/i.test(tag)) || setup.risk >= 60) hints.push("krav spread under kontroll");
  return hints.length > 0 ? hints.slice(0, 2).join(" + ") : "vanta pa volym och att kursen haller forsta 15 min";
}

export function avoidReason(setup: TerminalSetup) {
  if (setup.preOpenScore < 45) return "for lag score";
  if (setup.falsePositiveRisk >= 60) return "risk for fade";
  if (setup.risk >= 75) return "for hog risk";
  if (normalizeAction(setup.openingAction) === "AVOID_CHASE") return "for stor efterhandsrorelse";
  if (normalizeAction(setup.openingAction) === "IGNORE") return "saknar edge fore oppning";
  return "svag edge";
}

export function decisionText(setup: TerminalSetup) {
  const action = normalizeAction(setup.openingAction);
  const human = humanActionLabel(action);
  const live = setup.liveMarketReaction;
  if (live?.marketAggression && live.marketAggression >= 60 && live.fadeProbability < 65) {
    return `${setup.ticker}: Agera: bevaka aktivt / vanta trigger. Marknaden attackerar denna aktie. ${live.continuationProbability}% continuation, RVOL ${live.relativeVolume}.`;
  }
  if (isParabolicNoChase(setup) && live) {
    return `${setup.ticker}: Het men farlig. Viktig momentum-signal, men inte chase. Bevaka bara re-entry: pullback haller VWAP, ny volymvag, hogre botten och spread ok. Fade-risk ${live.fadeProbability}%.`;
  }
  if (live?.fadeProbability && live.fadeProbability >= 60) {
    return `${setup.ticker}: Hog risk men fortsatt intressant om continuation haller. Inte chase; bevaka reclaim/pullback. Fade ${live.fadeProbability}%.`;
  }
  if (live?.fadeProbability && live.fadeProbability >= 60) {
    return `${setup.ticker}: Undvik att jaga. Rörelsen saknar hållbart stöd/parabolic risk: fade ${live.fadeProbability}%.`;
  }
  if (live?.squeezeProbability && live.squeezeProbability >= 70) {
    return `${setup.ticker}: ${human}. Squeeze-risk ökar, men kräv volym och spread-kontroll.`;
  }
  if (isActionableSetup(setup)) {
    return `${setup.ticker}: Agera: bevaka aktivt / vanta trigger. Edge ar ren nog for aktiv orderberedskap, men bekrafta fortfarande spread och oppningsvolym.`;
  }
  if (AVOID_ACTIONS.has(action) || isDoNotChase(setup)) {
    return `${setup.ticker}: Undvik. Inte jaga direkt. ${avoidReason(setup)}.`;
  }
  return `${setup.ticker}: ${human}. Inte kop direkt. ${confirmationText(setup)}.`;
}

export function buildDecisionBoard(warRoom: TerminalWarRoom | null): DecisionItem[] {
  const accepted = warRoom?.topPreOpenSetups ?? [];
  const rejected = warRoom?.rejectedCandidates ?? [];

  const acceptedItems = accepted.map((setup, index): DecisionItem => {
    const action = normalizeAction(setup.openingAction);
    const watchCandidate =
      WATCH_ACTIONS.has(action) ||
      setup.confidence < 70 ||
      setup.historicalSetupWinrate <= 0 ||
      setup.triggerComboGrade === "N/A";
    const parabolicCandidate = isParabolicNoChase(setup);
    const strongMomentum = Boolean(setup.liveMarketReaction && setup.liveMarketReaction.continuationProbability >= 66 && setup.liveMarketReaction.intradayMomentum >= 2 && setup.liveMarketReaction.relativeVolume >= 1.15);
    const avoidCandidate = !parabolicCandidate && !strongMomentum && (AVOID_ACTIONS.has(action) || isDoNotChase(setup) || setup.preOpenScore < 45 || setup.falsePositiveRisk >= 68);
    const bucket: DecisionBucket = isActionableSetup(setup) ? "act" : parabolicCandidate ? "parabolic" : avoidCandidate ? "avoid" : watchCandidate ? "watch" : "watch";

    return {
      id: `${setup.ticker}-${setup.trigger}-${setup.openingAction}-${index}-decision`,
      bucket,
      ticker: setup.ticker,
      title: setup.catalyst || setup.trigger,
      company: setup.companyName,
      exchange: setup.exchange,
      technicalAction: setup.openingAction,
      humanAction: humanActionLabel(setup.openingAction),
      score: setup.preOpenScore,
      confidence: setup.confidence,
      falsePositiveRisk: setup.falsePositiveRisk,
      tickerConfidence: setup.tickerConfidence,
      reason: bucket === "avoid" ? avoidReason(setup) : decisionText(setup),
      confirmation: bucket === "watch" || bucket === "parabolic" ? confirmationText(setup) : undefined,
      invalidation: bucket === "act" || bucket === "watch" || bucket === "parabolic" ? invalidationText(setup) : undefined,
      labels: setup.tags.filter((tag) => ["Found autonomously", "Discovery HOT", "Stealth mover", "Parabolic watch", "No chase", "Re-entry only"].includes(tag)),
      source: "accepted",
    };
  });

  const rejectedItems = rejected.map((item, index) => rejectedToDecisionItem(item, index));
  return [...acceptedItems, ...rejectedItems];
}

export function rejectedToDecisionItem(item: TerminalRejectedCandidate, index: number): DecisionItem {
  const reason = item.rejectedBecause[0] ?? "unresolved_symbol";
  return {
    id: `${item.ticker}-${reason}-${index}-rejected-decision`,
    bucket: "avoid",
    ticker: item.ticker,
    title: item.trigger,
    exchange: item.tickerValidation?.identity.exchange ?? "unknown",
    humanAction: "Undvik",
    score: item.preOpenScore,
    confidence: item.tickerValidation?.identity.sourceConfidence ?? 0,
    falsePositiveRisk: 100,
    tickerConfidence: item.tickerValidation?.identity.sourceConfidence ?? 0,
    reason: rejectionLabel(reason),
    source: "rejected",
  };
}

export function rejectionLabel(reason: string) {
  if (reason === "unresolved_symbol") return "ticker osaker";
  if (reason === "exchange_conflict") return "exchange conflict";
  if (reason === "low_ticker_confidence") return "for lag ticker confidence";
  if (reason === "non_swedish_exchange") return "inte svensk/nordisk marknad";
  if (reason === "ticker_collision") return "ticker collision";
  return reason.replaceAll("_", " ");
}

export function invalidationText(setup: TerminalSetup) {
  if (setup.falsePositiveRisk >= 45) return "fade efter forsta 15 min";
  if (setup.risk >= 65) return "spread/likviditet tappar kontroll";
  if (setup.preOpenScore < 65) return "ingen volymbekraftelse";
  return "oppningsvolym uteblir eller kursen tappar VWAP";
}

export function dataQualityLabel(warRoom: TerminalWarRoom | null, learning: LearningReport | null) {
  const feedHealthy = warRoom?.feedStatus.status === "healthy";
  const accepted = warRoom?.acceptedCount ?? 0;
  const evaluated = learning?.recentOutcomeSummary.evaluatedSignals ?? 0;
  if (feedHealthy && accepted >= 3 && evaluated >= 20) return "hog";
  if ((feedHealthy && accepted > 0) || evaluated >= 10) return "medel";
  return "lag";
}
