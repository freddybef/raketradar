import { displayActionLabel, isParabolicNoChase } from "@/components/terminal/decision";
import type { TerminalSetup } from "@/components/terminal/types";

export interface TerminalCaseSummary {
  ticker: string;
  action: string;
  edge: string;
  interpretationType: string;
  personality: string;
  why: string;
  whyNow: string;
  pros: string[];
  cons: string[];
  trigger: string;
  invalidation: string;
  strongerIf: string;
  weakerIf: string;
  risk: string;
  score: number;
  confidence: number;
  live?: {
    move: number;
    rvol: number;
    continuation: number;
    fade: number;
    label: string;
  };
}

function actionText(setup: TerminalSetup) {
  if (isParabolicNoChase(setup)) return "Het men jaga inte";
  const label = displayActionLabel(setup);
  if (label === "HIGH CONVICTION") return "Agera";
  if (label === "AVOID") return "Undvik";
  return "Bevaka";
}

export function edgeText(setup: TerminalSetup) {
  const live = setup.liveMarketReaction;
  if (isParabolicNoChase(setup)) return "Parabolic re-entry";
  if (live?.label === "EARLY_MOMENTUM") return "Early momentum";
  if (live?.label === "CONTINUATION") return "Continuation";
  if (live?.label === "PULLBACK_VALID") return "Pullback valid";
  if (live?.label === "REACCELERATION_WATCH") return "Reacceleration";
  if (setup.tags.includes("Stealth mover")) return "Stealth";
  if (setup.tags.includes("Discovery HOT")) return "Momentum";
  return setup.trigger.replaceAll("_", " ");
}

export function riskText(setup: TerminalSetup) {
  const live = setup.liveMarketReaction;
  if (isParabolicNoChase(setup)) return "Hog";
  if ((live?.fadeProbability ?? setup.falsePositiveRisk) >= 65) return "Hog";
  if ((live?.fadeProbability ?? setup.falsePositiveRisk) >= 40 || setup.risk >= 60) return "Medium";
  return "Lag";
}

function interpretationType(setup: TerminalSetup) {
  const live = setup.liveMarketReaction;
  if (isParabolicNoChase(setup) || live?.label === "PARABOLIC_RISK") return "parabolic_exhaustion";
  if (setup.tags.some((tag) => /insider/i.test(tag))) return "insider_driven";
  if (setup.tags.some((tag) => /news|order|avtal|rapport/i.test(tag))) return "news_expansion";
  if (live?.squeezeProbability && live.squeezeProbability >= 75 && live.intradayMomentum >= 2) return "squeeze_candidate";
  if (live?.label === "EARLY_MOMENTUM") return "early_momentum";
  if (live?.label === "CONTINUATION") return "continuation_leader";
  if (live?.label === "PULLBACK_VALID") return "healthy_pullback";
  if (live?.label === "REACCELERATION_WATCH") return "rotation_candidate";
  if (setup.tags.includes("Stealth mover") || live?.label === "STEALTH_STRENGTH") return "stealth_accumulation";
  if (live?.label === "FAKE_SPIKE") return "retail_chase";
  if (live?.label === "DEAD_BOUNCE" || live?.label === "FAILED_MOVE") return "dead_bounce";
  if (setup.tags.some((tag) => /defense|ai|cyber|biotech|medtech/i.test(tag))) return "sympathy_momentum";
  return "continuation_leader";
}

function personality(type: string) {
  const labels: Record<string, string> = {
    stealth_accumulation: "Stealth accumulation",
    early_momentum: "Early momentum",
    retail_chase: "Retail chase risk",
    squeeze_candidate: "Squeeze candidate",
    news_expansion: "News expansion",
    insider_driven: "Insider-driven",
    sympathy_momentum: "Sympathy momentum",
    continuation_leader: "Orderly continuation",
    parabolic_exhaustion: "Exhausted parabolic",
    dead_bounce: "Dead bounce",
    healthy_pullback: "Healthy pullback",
    rotation_candidate: "Rotation/reacceleration",
  };
  return labels[type] ?? "Momentum case";
}

function thesis(setup: TerminalSetup, type: string) {
  const live = setup.liveMarketReaction;
  if (!live) return setup.catalyst || setup.whyNow;
  const move = `${live.intradayMomentum}%`;
  const rvol = `${live.relativeVolume}x RVOL`;
  if (type === "early_momentum") return `Tidigt momentum efter lugnare fas. ${move} upp med ${rvol}; marknaden borjar trycka men caset ar inte nödvändigtvis crowded an.`;
  if (type === "stealth_accumulation") return `Volymen expanderar före stor prisrörelse. Det luktar ackumulation snarare än färdig spike.`;
  if (type === "squeeze_candidate") return `Squeeze-profil: pris och volym rör sig samtidigt. Intressant om köparna försvarar nästa pullback.`;
  if (type === "continuation_leader") return `Orderly continuation: marknaden fortsätter betala upp utan att fade-risk dominerar.`;
  if (type === "healthy_pullback") return `Pullbacken ser fortfarande konstruktiv ut. Caset är inte dött så länge reclaim/volym kommer tillbaka.`;
  if (type === "rotation_candidate") return `Reacceleration/rotation: momentum försöker komma tillbaka efter paus. Behöver ny volymvåg.`;
  if (type === "parabolic_exhaustion") return `Viktig men farlig mover. Momentum finns, men caset är långt gånget och ska bara bevakas för re-entry.`;
  if (type === "retail_chase") return `Rörelsen riskerar vara crowded/chase. Kräver hård disciplin och tydlig reclaim innan ny entry.`;
  if (type === "dead_bounce") return `Svag kvalitet just nu: continuation har inte bevisat sig och risken är att studsen dör ut.`;
  if (type === "news_expansion") return `Nyhetsdriven expansion: marknaden försöker prisa in ny catalyst. Nästa steg kräver volymbekräftelse.`;
  if (type === "insider_driven") return `Insiderstöd ger case-kvalitet, men marknaden måste fortfarande bekräfta med pris/volym.`;
  return `${edgeText(setup)} med ${move}, ${rvol} och ${live.continuationProbability}% continuation.`;
}

export function buildCaseSummary(setup: TerminalSetup): TerminalCaseSummary {
  const live = setup.liveMarketReaction;
  const type = interpretationType(setup);
  const casePersonality = personality(type);
  const pros = [
    live && live.relativeVolume >= 1.5 ? `RVOL ${live.relativeVolume}` : null,
    live && live.intradayMomentum >= 2 ? `${live.intradayMomentum}% prisexpansion` : null,
    live && live.continuationProbability >= 65 ? `${live.continuationProbability}% continuation` : null,
    live && live.marketAggression >= 60 ? "marknaden attackerar aktivt" : null,
    setup.tags.includes("Discovery HOT") ? "autonomt hittat momentum" : null,
    setup.tags.includes("Stealth mover") ? "tidig/stealth-volym" : null,
  ].filter((item): item is string => Boolean(item));
  const cons = [
    live && live.fadeProbability >= 55 ? `${live.fadeProbability}% fade-risk` : null,
    setup.falsePositiveRisk >= 55 ? "false-positive risk" : null,
    setup.historicalSetupWinrate <= 0 ? "lite historik" : null,
    setup.triggerComboGrade === "N/A" ? "svag catalystbekraftelse" : null,
    live && live.relativeVolume < 1.2 && live.intradayMomentum >= 3 ? "rörelsen saknar stark RVOL" : null,
  ].filter((item): item is string => Boolean(item));
  const trigger = isParabolicNoChase(setup)
    ? "pullback haller VWAP, ny volymvag och hogre botten"
    : live
      ? "haller VWAP/forsta pullback och volymen fortsatter"
      : setup.openingPlan?.confirms ?? "krav pa volymbekraftelse";
  const invalidation = setup.invalidation ?? (live ? "tappar VWAP eller volymen dor" : "ingen bekraftelse");
  const whyNow = thesis(setup, type);
  const why = `${casePersonality}: ${whyNow} Nästa steg: ${trigger}.`;
  const strongerIf = isParabolicNoChase(setup)
    ? "kontrollerad pullback, ny volymvåg och högre botten"
    : type === "stealth_accumulation"
      ? "pris börjar följa volymen utan att spread/fade ökar"
      : "VWAP håller och nästa candle kommer med volym";
  const weakerIf = isParabolicNoChase(setup)
    ? "snabb fade, wide spread eller misslyckad reclaim"
    : "volymen dör, VWAP tappas eller lower high bekräftas";

  return {
    ticker: setup.ticker,
    action: actionText(setup),
    edge: edgeText(setup),
    interpretationType: type,
    personality: casePersonality,
    why,
    whyNow,
    pros: pros.slice(0, 4),
    cons: cons.slice(0, 3),
    trigger,
    invalidation,
    strongerIf,
    weakerIf,
    risk: riskText(setup),
    score: setup.preOpenScore,
    confidence: setup.confidence,
    live: live
      ? {
          move: live.intradayMomentum,
          rvol: live.relativeVolume,
          continuation: live.continuationProbability,
          fade: live.fadeProbability,
          label: live.label,
        }
      : undefined,
  };
}
