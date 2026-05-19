export type TriggerType =
  | "order"
  | "avtal"
  | "kontrakt"
  | "ramavtal"
  | "FDA"
  | "CE"
  | "emission"
  | "finansiering"
  | "omvänd vinstvarning"
  | "insiderköp"
  | "bud"
  | "uppköp"
  | "uppköpsrykte"
  | "strategisk översyn"
  | "myndighetsbesked"
  | "AI/datacenter/försvar/cyber/biotech themes"
  | "vd-byte"
  | "rapport"
  | "riktkurshöjning"
  | "patent"
  | "studie/resultat"
  | "partneravtal"
  | "squeeze/momentum"
  | "konkurs/varning";

export type TriggerDirection = "bullish" | "bearish" | "neutral";

export type NewsTrigger = {
  type: TriggerType;
  impactScore: number;
  confidence: number;
  direction: TriggerDirection;
  evidence: string;
  suggestedAction: string;
  decayHours: number;
};

type TriggerRule = {
  type: TriggerType;
  keywords: string[];
  impactScore: number;
  confidence: number;
  direction: TriggerDirection;
  suggestedAction: string;
  decayHours: number;
};

const rules: TriggerRule[] = [
  {
    type: "order",
    keywords: ["order", "beställning", "ordervärde", "kundorder"],
    impactScore: 82,
    confidence: 82,
    direction: "bullish",
    suggestedAction: "Kontrollera ordervärde, marginal och om ordern är återkommande.",
    decayHours: 48,
  },
  {
    type: "kontrakt",
    keywords: ["kontrakt", "tecknar kontrakt", "tilldelas kontrakt"],
    impactScore: 78,
    confidence: 78,
    direction: "bullish",
    suggestedAction: "Verifiera kontraktsstorlek, motpart och leveranstid.",
    decayHours: 72,
  },
  {
    type: "ramavtal",
    keywords: ["ramavtal", "framework agreement", "avropsavtal"],
    impactScore: 72,
    confidence: 76,
    direction: "bullish",
    suggestedAction: "Kontrollera om ramavtalet har minimiåtaganden eller bara potential.",
    decayHours: 72,
  },
  {
    type: "FDA",
    keywords: ["fda", "510(k)", "fast track", "orphan drug"],
    impactScore: 88,
    confidence: 78,
    direction: "bullish",
    suggestedAction: "Verifiera regulatorisk status och kommersiell tidslinje.",
    decayHours: 96,
  },
  {
    type: "CE",
    keywords: ["ce-märkning", "ce märkning", "ce mark", "mdr"],
    impactScore: 82,
    confidence: 78,
    direction: "bullish",
    suggestedAction: "Kontrollera om CE-beskedet öppnar faktisk försäljning.",
    decayHours: 96,
  },
  {
    type: "emission",
    keywords: ["företrädesemission", "riktad emission", "nyemission", "emissionslikvid"],
    impactScore: 78,
    confidence: 84,
    direction: "bearish",
    suggestedAction: "Kontrollera utspädning, rabatt, garanter och kapitalbehov.",
    decayHours: 120,
  },
  {
    type: "finansiering",
    keywords: ["finansiering", "lånefacilitet", "kreditfacilitet", "brygglån", "säkrar finansiering"],
    impactScore: 64,
    confidence: 72,
    direction: "neutral",
    suggestedAction: "Bedöm runway, ränta, covenants och om emission fortfarande behövs.",
    decayHours: 96,
  },
  {
    type: "omvänd vinstvarning",
    keywords: ["omvänd vinstvarning", "höjer prognos", "överträffar förväntan", "starkare än väntat"],
    impactScore: 86,
    confidence: 80,
    direction: "bullish",
    suggestedAction: "Kontrollera om upprevideringen är engångseffekt eller trendbrott.",
    decayHours: 48,
  },
  {
    type: "insiderköp",
    keywords: ["insiderköp", "köper aktier", "insynsperson", "ledande befattningshavare köper"],
    impactScore: 72,
    confidence: 82,
    direction: "bullish",
    suggestedAction: "Jämför köpet med lön, ägande och tidigare insiderhistorik.",
    decayHours: 96,
  },
  {
    type: "bud",
    keywords: ["offentligt uppköpserbjudande", "lägger bud", "budplikt", "bud på"],
    impactScore: 94,
    confidence: 86,
    direction: "bullish",
    suggestedAction: "Verifiera premie, villkor och sannolikhet för motbud.",
    decayHours: 120,
  },
  {
    type: "uppköp",
    keywords: ["uppköp", "förvärvas", "takeover", "förvärvserbjudande"],
    impactScore: 88,
    confidence: 76,
    direction: "bullish",
    suggestedAction: "Skilj bekräftat bud från rykte.",
    decayHours: 96,
  },
  {
    type: "strategisk översyn",
    keywords: ["strategisk översyn", "strategiska alternativ", "ser över verksamheten"],
    impactScore: 70,
    confidence: 74,
    direction: "neutral",
    suggestedAction: "Bevaka om översynen leder till avyttring, emission eller budprocess.",
    decayHours: 120,
  },
  {
    type: "AI/datacenter/försvar/cyber/biotech themes",
    keywords: ["ai", "artificiell intelligens", "datacenter", "försvar", "cyber", "nato", "biotech", "medtech"],
    impactScore: 72,
    confidence: 66,
    direction: "bullish",
    suggestedAction: "Kräv konkret order/avtal, annars hög hype-risk.",
    decayHours: 36,
  },
  {
    type: "vd-byte",
    keywords: ["vd avgår", "ny vd", "byter vd", "verkställande direktör"],
    impactScore: 58,
    confidence: 72,
    direction: "neutral",
    suggestedAction: "Bedöm om bytet är planerat, akut eller kopplat till strategi.",
    decayHours: 72,
  },
  {
    type: "rapport",
    keywords: ["delårsrapport", "bokslut", "rapport", "ebit", "omsättning"],
    impactScore: 68,
    confidence: 76,
    direction: "neutral",
    suggestedAction: "Jämför mot förväntan, marginaltrend och kassaflöde.",
    decayHours: 36,
  },
  {
    type: "riktkurshöjning",
    keywords: ["höjer riktkurs", "riktkursen höjs", "upprepar köp"],
    impactScore: 64,
    confidence: 70,
    direction: "bullish",
    suggestedAction: "Kontrollera analyshus, ny riktkurs och om estimat faktiskt höjs.",
    decayHours: 48,
  },
  {
    type: "patent",
    keywords: ["patent", "patentgodkännande", "patent beviljas"],
    impactScore: 58,
    confidence: 70,
    direction: "bullish",
    suggestedAction: "Avgör om patentet skyddar en produkt med nära intäkter.",
    decayHours: 120,
  },
  {
    type: "studie/resultat",
    keywords: ["studieresultat", "fas ii", "fas 2", "topline", "klinisk studie", "positiva resultat"],
    impactScore: 90,
    confidence: 78,
    direction: "bullish",
    suggestedAction: "Läs endpoints, säkerhet, p-värden och nästa regulatoriska steg.",
    decayHours: 96,
  },
  {
    type: "squeeze/momentum",
    keywords: ["squeeze", "blankning", "momentum", "rusar", "hög volym"],
    impactScore: 70,
    confidence: 68,
    direction: "bullish",
    suggestedAction: "Fokusera på likviditet, spread och exitplan.",
    decayHours: 12,
  },
  {
    type: "konkurs/varning",
    keywords: ["konkurs", "rekonstruktion", "vinstvarning", "going concern", "likviditetsbrist"],
    impactScore: 92,
    confidence: 88,
    direction: "bearish",
    suggestedAction: "Undvik ny risk och granska om innehav ska reduceras omedelbart.",
    decayHours: 168,
  },
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function evidenceFor(text: string, keyword: string) {
  const normalized = normalize(text);
  const index = normalized.indexOf(keyword);
  if (index < 0) return keyword;
  const start = Math.max(0, index - 48);
  const end = Math.min(normalized.length, index + keyword.length + 64);
  return normalized.slice(start, end);
}

export function extractTriggers(rawText: string): NewsTrigger[] {
  const normalized = normalize(rawText);

  return rules
    .map((rule) => {
      const keyword = rule.keywords.find((item) => normalized.includes(item));
      if (!keyword) return null;

      return {
        type: rule.type,
        impactScore: rule.impactScore,
        confidence: rule.confidence,
        direction: rule.direction,
        evidence: evidenceFor(rawText, keyword),
        suggestedAction: rule.suggestedAction,
        decayHours: rule.decayHours,
      };
    })
    .filter((trigger): trigger is NewsTrigger => Boolean(trigger));
}

export function aggregateTriggerImpact(
  triggers: NewsTrigger[],
  publishedAt: string
) {
  if (triggers.length === 0) {
    return { impactScore: 35, direction: "neutral" as TriggerDirection };
  }

  const ageHours = Math.max(
    0,
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
  );

  const weighted = triggers.map((trigger) => {
    const freshness = Math.max(0.15, 1 - ageHours / trigger.decayHours);
    const directionMultiplier =
      trigger.direction === "bearish" ? -1 : trigger.direction === "bullish" ? 1 : 0.25;

    return trigger.impactScore * freshness * directionMultiplier;
  });

  const total = weighted.reduce((sum, value) => sum + value, 0);
  const average = total / triggers.length;
  const direction =
    average <= -20 ? "bearish" : average >= 20 ? "bullish" : "neutral";

  return {
    impactScore: Math.max(0, Math.min(100, Math.round(50 + average / 2))),
    direction,
  };
}
