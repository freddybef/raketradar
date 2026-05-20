import type { AutonomousDiscoveryCandidate, AutonomousDiscoveryReport, TerminalSetup, TerminalWarRoom } from "@/components/terminal/types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function falsePositiveRisk(candidate: AutonomousDiscoveryCandidate) {
  if (candidate.bucket === "PARABOLIC_WATCH" || candidate.bucket === "RISK" || candidate.reaction.label === "PARABOLIC_RISK") return Math.max(75, candidate.reaction.fadeProbability);
  return clamp(candidate.reaction.fadeProbability + (candidate.liquidityBucket === "thin" && candidate.reaction.relativeVolume < 1.5 ? 8 : 0));
}

function openingAction(candidate: AutonomousDiscoveryCandidate) {
  const reaction = candidate.reaction;
  const parabolicWatch =
    candidate.bucket === "PARABOLIC_WATCH" ||
    (reaction.label === "PARABOLIC_RISK" && reaction.intradayMomentum >= 12 && reaction.continuationProbability >= 65 && reaction.fadeProbability >= 60);
  const isHotActionable =
    candidate.bucket === "HOT" &&
    candidate.autonomousDiscoveryScore >= 64 &&
    reaction.relativeVolume >= 1.15 &&
    reaction.continuationProbability >= 66 &&
    reaction.fadeProbability < 70 &&
    reaction.label !== "PARABOLIC_RISK";
  if (isHotActionable) return "PREPARE_ORDER";
  if (parabolicWatch) return "REENTRY_ONLY";
  if (candidate.bucket === "RISK") return "AVOID_CHASE";
  if (candidate.bucket === "STEALTH" || candidate.autonomousDiscoveryScore >= 55) return "WATCH";
  return "HIGH_RISK_ONLY";
}

function discoveryToSetup(candidate: AutonomousDiscoveryCandidate): TerminalSetup {
  const fpRisk = falsePositiveRisk(candidate);
  const action = openingAction(candidate);
  const sourceTags = [
    "Found autonomously",
    candidate.bucket === "HOT" ? "Discovery HOT" : null,
    candidate.bucket === "STEALTH" ? "Stealth mover" : null,
    candidate.bucket === "PARABOLIC_WATCH" || candidate.reaction.label === "PARABOLIC_RISK" ? "Parabolic watch" : null,
    candidate.bucket === "PARABOLIC_WATCH" || candidate.reaction.label === "PARABOLIC_RISK" ? "No chase" : null,
    candidate.bucket === "PARABOLIC_WATCH" || candidate.reaction.label === "PARABOLIC_RISK" ? "Re-entry only" : null,
    ...candidate.labels,
  ].filter((tag): tag is string => Boolean(tag));

  return {
    ticker: candidate.ticker,
    companyName: candidate.companyName,
    exchange: candidate.exchange,
    trigger: candidate.bucket === "HOT" ? "Discovery HOT" : candidate.bucket === "STEALTH" ? "Stealth mover" : candidate.bucket === "PARABOLIC_WATCH" ? "Parabolic no-chase" : `Discovery ${candidate.bucket}`,
    catalyst: `${candidate.bucket}: ${candidate.whyDiscovered.join(" / ")}`,
    whyNow: `Found autonomously. ${candidate.reaction.reason}`,
    preOpenScore: candidate.autonomousDiscoveryScore,
    openingAction: action,
    risk: fpRisk,
    confidence: candidate.discoveryConfidence,
    tags: sourceTags,
    tickerConfidence: 92,
    historicalSetupWinrate: 0,
    triggerComboGrade: "N/A",
    falsePositiveRisk: fpRisk,
    adaptiveConfidenceDelta: 0,
    avgContinuation: candidate.reaction.continuationProbability,
    avgFadeRisk: candidate.reaction.fadeProbability,
    similarPastSetups: [],
    invalidation: candidate.whyNotRankedHigher.join(", ") || "tappar VWAP/volymbekraftelse",
    openingPlan: {
      action,
      reason: "Autonomous discovery promotion",
      whyBeforeOpen: candidate.whyDiscovered.join(" / "),
      confirms: `RVOL ${candidate.reaction.relativeVolume}, continuation ${candidate.reaction.continuationProbability}%, hall VWAP/forsta pullback`,
      invalidates: candidate.whyNotRankedHigher.join(", ") || "fade-risk eller svag nasta candle",
      doNot: candidate.bucket === "PARABOLIC_WATCH"
        ? "Ingen chase. Endast re-entry efter pullback, ny volymvag och hogre botten."
        : candidate.bucket === "RISK"
          ? "Ingen chase: parabolic/fade-risk"
          : "Jaga inte utan volym- och spreadbekraftelse",
    },
    liveMarketReaction: candidate.reaction,
  };
}

function setupPriority(setup: TerminalSetup) {
  const live = setup.liveMarketReaction;
  const sourceBoost = setup.tags.some((tag) => tag === "Discovery HOT") ? 12 : setup.tags.some((tag) => tag === "Stealth mover") ? 6 : 0;
  const liveBoost = live ? live.relativeVolume * 3 + live.continuationProbability * 0.11 + Math.max(0, live.intradayMomentum) * 0.8 - live.fadeProbability * 0.035 : 0;
  return setup.preOpenScore + setup.confidence * 0.35 + sourceBoost + liveBoost;
}

function mergeSetup(existing: TerminalSetup, incoming: TerminalSetup): TerminalSetup {
  const keepIncoming = setupPriority(incoming) > setupPriority(existing);
  const primary = keepIncoming ? incoming : existing;
  const secondary = keepIncoming ? existing : incoming;
  return {
    ...primary,
    trigger: [...new Set([primary.trigger, secondary.trigger].filter(Boolean))].join(" + "),
    catalyst: [...new Set([primary.catalyst, secondary.catalyst].filter(Boolean))].join(" | "),
    whyNow: [...new Set([primary.whyNow, secondary.whyNow].filter(Boolean))].join(" | "),
    tags: [...new Set([...primary.tags, ...secondary.tags])],
    preOpenScore: Math.max(primary.preOpenScore, secondary.preOpenScore),
    confidence: Math.max(primary.confidence, secondary.confidence),
    falsePositiveRisk: Math.min(primary.falsePositiveRisk, secondary.falsePositiveRisk),
    avgContinuation: Math.max(primary.avgContinuation, secondary.avgContinuation),
    avgFadeRisk: Math.min(primary.avgFadeRisk, secondary.avgFadeRisk),
    liveMarketReaction: primary.liveMarketReaction ?? secondary.liveMarketReaction,
  };
}

export function mergeWarRoomAndDiscovery(warRoom: TerminalWarRoom | null, discovery: AutonomousDiscoveryReport | null) {
  const map = new Map<string, TerminalSetup>();
  for (const setup of warRoom?.topPreOpenSetups ?? []) {
    map.set(setup.ticker, setup);
  }

  const promotable = (discovery?.candidates ?? []).filter((candidate) => {
    if (/^BIOX$/i.test(candidate.ticker)) return false;
    if (candidate.bucket === "PARABOLIC_WATCH" || candidate.bucket === "RISK" || candidate.reaction.label === "PARABOLIC_RISK") return true;
    if (candidate.bucket === "HOT") {
      return candidate.autonomousDiscoveryScore >= 75 && candidate.reaction.relativeVolume >= 1.5 && candidate.reaction.continuationProbability >= 70 && candidate.reaction.fadeProbability < 60;
    }
    if (candidate.bucket === "STEALTH") {
      return candidate.autonomousDiscoveryScore >= 65 && (candidate.labels.includes("unusual volume") || candidate.reaction.continuationProbability >= 65);
    }
    return false;
  });

  for (const candidate of promotable) {
    const setup = discoveryToSetup(candidate);
    const existing = map.get(setup.ticker);
    map.set(setup.ticker, existing ? mergeSetup(existing, setup) : setup);
  }

  return [...map.values()].sort((a, b) => setupPriority(b) - setupPriority(a));
}
