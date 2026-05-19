import type { DoNotChaseResult } from "@/lib/intelligence/doNotChaseFilter";
import type { PreOpenClassification } from "@/lib/intelligence/preOpenClassifier";
import type { PreOpenEdgeScore } from "@/lib/intelligence/preOpenEdgeScore";

export type OpeningPlanAction =
  | "WATCH"
  | "WAIT_PULLBACK"
  | "AVOID_CHASE"
  | "IGNORE"
  | "HIGH_RISK_ONLY";

export interface OpeningPlan {
  action: OpeningPlanAction;
  whyBeforeOpen: string;
  confirms: string;
  invalidates: string;
  doNot: string;
}

export function buildOpeningPlan(input: {
  ticker: string;
  classification?: PreOpenClassification;
  edgeScore: PreOpenEdgeScore;
  doNotChase: DoNotChaseResult;
  hasInsiderSupport: boolean;
}): OpeningPlan {
  const catalyst = input.classification?.catalystType ?? (input.hasInsiderSupport ? "FI insider" : "lagrad signal");
  const score = input.edgeScore.totalScore;

  if (input.doNotChase.blocked) {
    return {
      action: "AVOID_CHASE",
      whyBeforeOpen: `${input.ticker}: ${catalyst} finns, men riskbilden är för trång före öppning.`,
      confirms: "Endast lugn öppning, spread som tajtar och volym som absorberas utan spike.",
      invalidates: input.doNotChase.reasons.join(", "),
      doNot: "Jaga inte första gröna candle eller tunn orderbok.",
    };
  }

  if (score >= 76) {
    return {
      action: "WATCH",
      whyBeforeOpen: `${input.ticker}: ${catalyst} med edge-score ${score}/100 före öppning.`,
      confirms: "Öppning över triggernivå med stigande volym och tight spread.",
      invalidates: "Gap upp utan följdvolym, snabb fade under VWAP eller ny negativ PM-detalj.",
      doNot: "Köp inte om första rörelsen redan är utsträckt och likviditeten tunn.",
    };
  }

  if (score >= 58) {
    return {
      action: "WAIT_PULLBACK",
      whyBeforeOpen: `${input.ticker}: intressant setup men kräver bättre entry.`,
      confirms: "Pullback håller nivå, säljtryck absorberas och signalen återtar styrka.",
      invalidates: "Tappar morgonrange eller catalyst visar sig vara svagare än rubriken.",
      doNot: "Betala inte upp i öppningsauktionen.",
    };
  }

  if (score >= 44) {
    return {
      action: "HIGH_RISK_ONLY",
      whyBeforeOpen: `${input.ticker}: signal finns men edge är tunn.`,
      confirms: "Ovanligt stark volym med tydlig continuation efter första 15 minuterna.",
      invalidates: "Svag öppning, bred spread eller snabb reversal.",
      doNot: "Behandla inte detta som core-case.",
    };
  }

  return {
    action: "IGNORE",
    whyBeforeOpen: `${input.ticker}: för låg pre-open edge relativt risk.`,
    confirms: "Behöver ny starkare catalyst eller validerad volym senare.",
    invalidates: "Nuvarande signal saknar edge före öppning.",
    doNot: "Lägg inte fokuskapital här före öppning.",
  };
}
