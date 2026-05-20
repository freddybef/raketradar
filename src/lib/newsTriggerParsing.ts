export type HeadlineTriggerType =
  | "REPORT"
  | "ORDER_CONTRACT"
  | "GUIDANCE"
  | "PROFIT_WARNING"
  | "ANALYST_TARGET"
  | "INSIDER"
  | "REGULATORY"
  | "COMMERCIALIZATION"
  | "PARTNERSHIP"
  | "FUNDING"
  | "SECTOR_THEME"
  | "MACRO_NOISE"
  | "UNKNOWN";

export type ParsedNarrativeTriggerType =
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

export type TriggerVerificationState = "VERIFIED" | "UNVERIFIED" | "PRICE_ONLY" | "THEMATIC";

export interface RawHeadlineInput {
  id?: string;
  ticker?: string;
  company?: string;
  headline: string;
  source?: string;
  publishedAt?: string;
  category?: string;
}

export interface NewsTrigger {
  id: string;
  ticker: string | null;
  company: string | null;
  headline: string;
  source: string;
  publishedAt: string;
  triggerType: HeadlineTriggerType;
  triggerStrength: number;
  narrativeTriggerType: ParsedNarrativeTriggerType;
  thematicTags: string[];
  isFreshToday: boolean;
  marketCapSensitivity: number;
  secondDerivativeScore: number;
  repricingPotential: number;
  triggerVerificationState: TriggerVerificationState;
  summary: string;
}

const COMPANY_ALIASES: Array<{ pattern: RegExp; ticker: string; company: string; marketCapSensitivity: number }> = [
  { pattern: /\bdiamyd\b/i, ticker: "DMYD B", company: "Diamyd Medical", marketCapSensitivity: 74 },
  { pattern: /\bapr technologies\b|\bapr\b/i, ticker: "APR", company: "APR Technologies", marketCapSensitivity: 78 },
  { pattern: /\bredsense\b/i, ticker: "REDS", company: "Redsense Medical", marketCapSensitivity: 82 },
  { pattern: /\bnanologica\b/i, ticker: "NICA", company: "Nanologica", marketCapSensitivity: 86 },
  { pattern: /\bepisurf\b/i, ticker: "EPIS B", company: "Episurf Medical", marketCapSensitivity: 80 },
  { pattern: /\bnexam\b/i, ticker: "NEXAM", company: "Nexam Chemical", marketCapSensitivity: 70 },
  { pattern: /\bsht\b/i, ticker: "SHT", company: "SHT Smart High-Tech", marketCapSensitivity: 76 },
];

function asArray(input: Array<string | RawHeadlineInput>) {
  return input
    .map((item): RawHeadlineInput => typeof item === "string" ? { headline: item } : item)
    .filter((item) => item.headline.trim().length > 0);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isFreshToday(publishedAt: string) {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return false;
  return dateKey(date) === dateKey(new Date());
}

function resolveCompany(input: RawHeadlineInput) {
  if (input.ticker || input.company) {
    return {
      ticker: input.ticker?.toUpperCase().trim() ?? null,
      company: input.company?.trim() ?? null,
      marketCapSensitivity: 60,
    };
  }
  const match = COMPANY_ALIASES.find((entry) => entry.pattern.test(input.headline));
  return {
    ticker: match?.ticker ?? null,
    company: match?.company ?? null,
    marketCapSensitivity: match?.marketCapSensitivity ?? 35,
  };
}

function classifyTrigger(headline: string): {
  triggerType: HeadlineTriggerType;
  narrativeTriggerType: ParsedNarrativeTriggerType;
  thematicTags: string[];
  baseStrength: number;
  secondDerivativeScore: number;
  summary: string;
} {
  const text = normalize(headline);
  const tags: string[] = [];
  if (/gmp|tillstånd|fda|ce\b|godkänn|myndighet|regulator|certifikat/.test(text)) {
    tags.push("regulatory", "commercialization");
    return {
      triggerType: "REGULATORY",
      narrativeTriggerType: /gmp|certifikat|tillstånd/.test(text) ? "COMMERCIALIZATION_SHIFT" : "REGULATORY_TRIGGER",
      thematicTags: tags,
      baseStrength: 82,
      secondDerivativeScore: 58,
      summary: "Regulatorisk eller kvalitetsmässig trigger som kan flytta bolaget närmare kommersialisering.",
    };
  }
  if (/utvärderingsavtal|samarbete|partner|partnership|joint development|pilot/.test(text)) {
    tags.push("partnership", "commercialization");
    return {
      triggerType: "PARTNERSHIP",
      narrativeTriggerType: "COMMERCIALIZATION_SHIFT",
      thematicTags: tags,
      baseStrength: 76,
      secondDerivativeScore: 64,
      summary: "Partnerskap/utvärdering som kan signalera kommersiell validering snarare än ren tradingrörelse.",
    };
  }
  if (/order|kontrakt|ramavtal|avtal|contract|kundorder/.test(text)) {
    tags.push("order", "revenue");
    return {
      triggerType: "ORDER_CONTRACT",
      narrativeTriggerType: "NEW_CONTRACT",
      thematicTags: tags,
      baseStrength: 78,
      secondDerivativeScore: 45,
      summary: "Order/kontrakt kan ge konkret intäkts- eller valideringsrepricing.",
    };
  }
  if (/q[1-4]\b|rapport|delårsrapport|bokslut|vänder till vinst|vinst|lönsamhet|profitability|ebit/.test(text)) {
    tags.push("earnings", "profitability");
    return {
      triggerType: "REPORT",
      narrativeTriggerType: /vänder till vinst|lönsamhet|profitability|positivt ebit/.test(text) ? "PROFITABILITY_INFLECTION" : "REPORT_REPRICING",
      thematicTags: tags,
      baseStrength: /vänder till vinst|lönsamhet|profitability/.test(text) ? 84 : 72,
      secondDerivativeScore: 38,
      summary: "Rapport/repricing där marknaden kan behöva justera synen på vinst, marginal eller uthållighet.",
    };
  }
  if (/höjer prognos|guidance|outlook|omsättningsmål|finansiella mål/.test(text)) {
    tags.push("guidance");
    return {
      triggerType: "GUIDANCE",
      narrativeTriggerType: "REPORT_REPRICING",
      thematicTags: tags,
      baseStrength: 80,
      secondDerivativeScore: 42,
      summary: "Guidanceförändring som kan ge omvärdering om marknaden låg fel.",
    };
  }
  if (/vinstvarning|sänker prognos|profit warning/.test(text)) {
    tags.push("warning");
    return {
      triggerType: "PROFIT_WARNING",
      narrativeTriggerType: "REPORT_REPRICING",
      thematicTags: tags,
      baseStrength: 68,
      secondDerivativeScore: 25,
      summary: "Negativ rapport-/guidance-trigger. Repricing kan vara stor men riskprofilen är hög.",
    };
  }
  if (/insider|köper aktier|säljer aktier|transaktion/.test(text)) {
    tags.push("insider");
    return {
      triggerType: "INSIDER",
      narrativeTriggerType: "UNKNOWN",
      thematicTags: tags,
      baseStrength: 56,
      secondDerivativeScore: 22,
      summary: "Insidersignal som behöver stöd av pris/volym för att bli riktig repricing.",
    };
  }
  if (/finansiering|riktad emission|företrädesemission|lån|kreditfacilitet|funding/.test(text)) {
    tags.push("funding");
    return {
      triggerType: "FUNDING",
      narrativeTriggerType: "FUNDING_SURVIVAL",
      thematicTags: tags,
      baseStrength: 52,
      secondDerivativeScore: 28,
      summary: "Finansiering kan minska överlevnadsrisk men kräver hård granskning av utspädning.",
    };
  }
  if (/obesitas|glp-?1|novo|lilly|eli lilly|wegovy|ozempic|fetma/.test(text)) {
    tags.push("obesity", "global theme");
    return {
      triggerType: "SECTOR_THEME",
      narrativeTriggerType: "OBESITY_ADJACENCY",
      thematicTags: tags,
      baseStrength: 64,
      secondDerivativeScore: 82,
      summary: "Obesity/GLP-1-adjacency kan skapa second-derivative-flöden i småbolag nära värdekedjan.",
    };
  }
  if (/försvar|defense|nato|drön|drone|cyber|säkerhet/.test(text)) {
    tags.push("defense", "security");
    return {
      triggerType: "SECTOR_THEME",
      narrativeTriggerType: "DEFENSE_ADJACENCY",
      thematicTags: tags,
      baseStrength: 62,
      secondDerivativeScore: 76,
      summary: "Försvar/cyber-tema kan ge snabb thematic repricing i småbolag.",
    };
  }
  if (/datacenter|data center|ai infra|kraft|power|server|cooling|semiconductor|chip/.test(text)) {
    tags.push("datacenter", "ai infrastructure");
    return {
      triggerType: "SECTOR_THEME",
      narrativeTriggerType: "DATACENTER_INFRA",
      thematicTags: tags,
      baseStrength: 62,
      secondDerivativeScore: 78,
      summary: "Datacenter/AI-infrastruktur är second-derivative-tema där småbolag kan reprisas snabbt.",
    };
  }
  if (/riktkurs|target price|analytiker|analyst/.test(text)) {
    tags.push("analyst");
    return {
      triggerType: "ANALYST_TARGET",
      narrativeTriggerType: "UNKNOWN",
      thematicTags: tags,
      baseStrength: 38,
      secondDerivativeScore: 18,
      summary: "Riktkurs/analytiker är lågprioritet utan small-cap och live reaction.",
    };
  }
  if (/market signal|börsen|omx|ränta|inflation|usa|futures|makro/.test(text)) {
    tags.push("macro");
    return {
      triggerType: "MACRO_NOISE",
      narrativeTriggerType: "UNKNOWN",
      thematicTags: tags,
      baseStrength: 18,
      secondDerivativeScore: 10,
      summary: "Makro/general headline. Bra kontext men normalt ingen bolagsspecifik trigger.",
    };
  }
  return {
    triggerType: "UNKNOWN",
    narrativeTriggerType: "UNKNOWN",
    thematicTags: [],
    baseStrength: 25,
    secondDerivativeScore: 10,
    summary: "Ingen tydlig triggerklassning i rubriken.",
  };
}

function verificationState(input: {
  triggerType: HeadlineTriggerType;
  narrativeTriggerType: ParsedNarrativeTriggerType;
  ticker: string | null;
  isFreshToday: boolean;
}): TriggerVerificationState {
  if (input.triggerType === "SECTOR_THEME") return "THEMATIC";
  if (input.triggerType === "UNKNOWN" || input.triggerType === "ANALYST_TARGET") return input.ticker ? "UNVERIFIED" : "PRICE_ONLY";
  if (!input.isFreshToday) return "UNVERIFIED";
  if (!input.ticker && input.narrativeTriggerType === "UNKNOWN") return "PRICE_ONLY";
  return "VERIFIED";
}

export function parseNewsTriggers(rawHeadlines: Array<string | RawHeadlineInput>): NewsTrigger[] {
  return asArray(rawHeadlines)
    .map((input, index) => {
      const publishedAt = input.publishedAt ?? new Date().toISOString();
      const company = resolveCompany(input);
      const classified = classifyTrigger(input.headline);
      const freshToday = isFreshToday(publishedAt);
      const triggerStrength = Math.max(0, Math.min(100, Math.round(
        classified.baseStrength +
          (freshToday ? 8 : -18) +
          company.marketCapSensitivity * 0.08 +
          classified.secondDerivativeScore * 0.08,
      )));
      const repricingPotential = Math.max(0, Math.min(100, Math.round(
        triggerStrength * 0.45 +
          company.marketCapSensitivity * 0.28 +
          classified.secondDerivativeScore * 0.22 +
          (classified.narrativeTriggerType !== "UNKNOWN" ? 8 : 0),
      )));
      const triggerVerificationState = verificationState({
        triggerType: classified.triggerType,
        narrativeTriggerType: classified.narrativeTriggerType,
        ticker: company.ticker,
        isFreshToday: freshToday,
      });
      return {
        id: input.id ?? `${publishedAt}-${index}-${input.headline.slice(0, 24)}`,
        ticker: company.ticker,
        company: company.company,
        headline: input.headline.trim(),
        source: input.source ?? "manual",
        publishedAt,
        triggerType: classified.triggerType,
        triggerStrength,
        narrativeTriggerType: classified.narrativeTriggerType,
        thematicTags: classified.thematicTags,
        isFreshToday: freshToday,
        marketCapSensitivity: company.marketCapSensitivity,
        secondDerivativeScore: classified.secondDerivativeScore,
        repricingPotential,
        triggerVerificationState,
        summary: classified.summary,
      };
    })
    .filter((trigger) => trigger.triggerType !== "MACRO_NOISE" || trigger.triggerStrength >= 30)
    .sort((a, b) => b.repricingPotential - a.repricingPotential || b.triggerStrength - a.triggerStrength);
}
