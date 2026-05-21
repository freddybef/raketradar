import { getSwedishEquityUniverse } from "@/lib/market/swedishEquityUniverse";

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
  url?: string;
}

export interface NewsTrigger {
  id: string;
  ticker: string | null;
  company: string | null;
  headline: string;
  source: string;
  publishedAt: string;
  url?: string;
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

const MANUAL_COMPANY_ALIASES: Array<{ pattern: RegExp; ticker: string; company: string; marketCapSensitivity: number }> = [
  { pattern: /\bsurgical science\b|\bsurgical science sweden\b/i, ticker: "SUS", company: "Surgical Science Sweden AB", marketCapSensitivity: 72 },
  { pattern: /\bdiamyd\b/i, ticker: "DMYD B", company: "Diamyd Medical", marketCapSensitivity: 74 },
  { pattern: /\bapr technologies\b|\bapr\b/i, ticker: "APR", company: "APR Technologies", marketCapSensitivity: 78 },
  { pattern: /\bredsense\b/i, ticker: "REDS", company: "Redsense Medical", marketCapSensitivity: 82 },
  { pattern: /\bnanologica\b/i, ticker: "NICA", company: "Nanologica", marketCapSensitivity: 86 },
  { pattern: /\bepisurf\b/i, ticker: "EPIS B", company: "Episurf Medical", marketCapSensitivity: 80 },
  { pattern: /\bnexam\b/i, ticker: "NEXAM", company: "Nexam Chemical", marketCapSensitivity: 70 },
  { pattern: /\bsht\b/i, ticker: "SHT", company: "SHT Smart High-Tech", marketCapSensitivity: 76 },
  { pattern: /\bkvix\b/i, ticker: "KVIX", company: "Kvix AB", marketCapSensitivity: 86 },
  { pattern: /\bgomx\b|\bgomspace\b|\bgom space\b/i, ticker: "GOMX", company: "GomSpace Group AB", marketCapSensitivity: 82 },
  { pattern: /\bsive\b|\bsivers\b|\bsievers\b|\bsivers semiconductors\b|\bsievers semiconductors\b/i, ticker: "SIVE", company: "Sivers Semiconductors AB", marketCapSensitivity: 72 },
  { pattern: /\byubico\b|\byubi\b/i, ticker: "YUBICO", company: "Yubico AB", marketCapSensitivity: 58 },
  { pattern: /\bmildef\b|\bmil def\b/i, ticker: "MILDEF", company: "MilDef Group AB", marketCapSensitivity: 58 },
  { pattern: /\baac clyde\b|\baac clyde space\b|\baccon\b|\baac\b/i, ticker: "AAC", company: "AAC Clyde Space AB", marketCapSensitivity: 82 },
  { pattern: /\bmaven wireless\b|\bmaven\b/i, ticker: "MAVEN", company: "Maven Wireless Sweden AB", marketCapSensitivity: 70 },
  { pattern: /\bsmart high tech\b|\bsmart high-tech\b/i, ticker: "SHT", company: "Smart High Tech AB", marketCapSensitivity: 76 },
  { pattern: /\bfreja eid\b|\bfreja e-id\b|\bfreja\b/i, ticker: "FREJA", company: "Freja eID Group AB", marketCapSensitivity: 70 },
  { pattern: /\bclavister\b/i, ticker: "CLAV", company: "Clavister Holding AB", marketCapSensitivity: 82 },
  { pattern: /\bastor group\b|\bastor\b/i, ticker: "ASTOR", company: "Astor Group AB", marketCapSensitivity: 86 },
  { pattern: /\bplejd\b/i, ticker: "PLEJD", company: "Plejd AB", marketCapSensitivity: 70 },
  { pattern: /\bwyld networks\b|\bwyld\b/i, ticker: "WYLD", company: "Wyld Networks AB", marketCapSensitivity: 84 },
  { pattern: /\bnosa plugs\b|\bnosa\b/i, ticker: "NOSA", company: "Nosa Plugs AB", marketCapSensitivity: 84 },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function companyAliasPattern(companyName: string, ticker: string) {
  const compactName = companyName
    .replace(/\bAB\b/gi, "")
    .replace(/\bGroup\b/gi, "")
    .replace(/\bHolding\b/gi, "")
    .replace(/\bHoldings\b/gi, "")
    .replace(/\bplc\b/gi, "")
    .replace(/\(publ\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const tickerWithoutSuffix = ticker.replace(/\s[AB]$/i, "");
  const alternatives = [ticker, tickerWithoutSuffix, companyName, compactName]
    .map((item) => item.trim())
    .filter((item, index, array) => item.length >= 3 && array.indexOf(item) === index)
    .map(escapeRegExp);
  return new RegExp(`\\b(?:${alternatives.join("|")})\\b`, "i");
}

const UNIVERSE_COMPANY_ALIASES = getSwedishEquityUniverse().map((entry) => ({
  pattern: companyAliasPattern(entry.companyName, entry.ticker),
  ticker: entry.ticker,
  company: entry.companyName,
  marketCapSensitivity: entry.marketCapBucket === "micro" ? 82 : entry.marketCapBucket === "small" ? 72 : entry.marketCapBucket === "mid" ? 58 : 35,
}));

const COMPANY_ALIASES = [...MANUAL_COMPANY_ALIASES, ...UNIVERSE_COMPANY_ALIASES];

function asArray(input: Array<string | RawHeadlineInput>) {
  return input
    .map((item): RawHeadlineInput => typeof item === "string" ? { headline: item } : item)
    .filter((item) => item.headline.trim().length > 0);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeTicker(value: string) {
  return value
    .replace(/\.(ST|SS|CO|HE|OL)$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
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
    const ticker = input.ticker ? normalizeTicker(input.ticker) : null;
    const universeMatch = ticker ? getSwedishEquityUniverse().find((entry) => entry.ticker === ticker) : null;
    const companyMatch = input.company
      ? COMPANY_ALIASES.find((entry) => entry.pattern.test(input.company ?? ""))
      : null;
    return {
      ticker: ticker ?? companyMatch?.ticker ?? null,
      company: input.company?.trim() ?? universeMatch?.companyName ?? companyMatch?.company ?? null,
      marketCapSensitivity: universeMatch?.marketCapBucket === "micro" ? 82 : universeMatch?.marketCapBucket === "small" ? 72 : 60,
    };
  }
  const match = COMPANY_ALIASES
    .filter((entry) => entry.pattern.test(input.headline))
    .sort((a, b) => b.company.length - a.company.length)[0];
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
  if (/market signal|börsen|omx|index|ränta|inflation|usa|futures|makro|geopolitik|fed|ecb|olja|guld|dollar|kronan|wall street|asienbörser|morgonrapport|börsöppning|börsstängning|marknadskommentar|teknisk analys|podcast|webbtv|kalender|iran|israel|krig|militär|attack|sanktion|handelskrig/.test(text)) {
    tags.push("macro");
    return {
      triggerType: "MACRO_NOISE",
      narrativeTriggerType: "UNKNOWN",
      thematicTags: tags,
      baseStrength: 12,
      secondDerivativeScore: 5,
      summary: "Makro/general headline. Bra kontext men ingen bolagsspecifik Nordic repricing-trigger.",
    };
  }
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
  if (/produktionskapacitet|produktion|produktionslinje|fabrik|anläggning|kapacitet|scale-up|skalar upp|expanderar produktion|production expansion|manufacturing/.test(text)) {
    tags.push("production", "commercialization");
    return {
      triggerType: "COMMERCIALIZATION",
      narrativeTriggerType: "COMMERCIALIZATION_SHIFT",
      thematicTags: tags,
      baseStrength: 74,
      secondDerivativeScore: 56,
      summary: "Produktions-/kapacitetssignal som kan flytta bolaget från utveckling mot kommersiell leverans.",
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
  if (!input.ticker) return "PRICE_ONLY";
  if (!input.isFreshToday) return "UNVERIFIED";
  if (input.triggerType === "SECTOR_THEME") return "THEMATIC";
  if (input.triggerType === "UNKNOWN" || input.triggerType === "ANALYST_TARGET") return input.ticker ? "UNVERIFIED" : "PRICE_ONLY";
  return "VERIFIED";
}

function isTradableNordicTrigger(trigger: NewsTrigger) {
  if (trigger.triggerType === "MACRO_NOISE") return false;
  if (!trigger.ticker) return false;
  if (!trigger.isFreshToday) return false;
  if (trigger.triggerType === "UNKNOWN") return Boolean(trigger.ticker) && trigger.isFreshToday && trigger.triggerStrength >= 45;
  if (trigger.triggerType === "ANALYST_TARGET") return Boolean(trigger.ticker) && trigger.isFreshToday && trigger.repricingPotential >= 45;
  if (trigger.triggerType === "SECTOR_THEME") return Boolean(trigger.ticker) && trigger.isFreshToday && trigger.repricingPotential >= 55;
  return trigger.triggerStrength >= 45;
}

export function parseNewsTriggers(rawHeadlines: Array<string | RawHeadlineInput>): NewsTrigger[] {
  const seen = new Set<string>();
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
        url: input.url,
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
    .filter((trigger) => {
      const key = `${trigger.ticker ?? "NO_TICKER"}|${normalize(trigger.headline).replace(/[^\p{L}\p{N}\s]/gu, "").slice(0, 96)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter(isTradableNordicTrigger)
    .sort((a, b) => b.repricingPotential - a.repricingPotential || b.triggerStrength - a.triggerStrength);
}
