import type { SocialSnapshot } from "../social/socialTypes";

export type NarrativeType =
  | "AI"
  | "försvar"
  | "cyber security"
  | "uranium"
  | "biotech turnaround"
  | "restructuring"
  | "datacenter"
  | "battery/metals"
  | "meme/social momentum"
  | "none";

export interface NarrativeResult {
  primaryNarrative: NarrativeType;
  narrativeStrength: number;
  trendDirection: "up" | "down" | "flat";
  emergingNarrative: boolean;
  matchedTerms: string[];
}

type NewsLike = {
  title?: string;
  rawText?: string;
  normalizedText?: string;
};

const dictionary: Record<Exclude<NarrativeType, "none">, string[]> = {
  AI: ["ai", "artificiell intelligens", "maskininlärning", "llm"],
  försvar: ["försvar", "nato", "drönare", "säkerhetspolitik"],
  "cyber security": ["cyber", "cybersäkerhet", "intrång", "säkerhetsplattform"],
  uranium: ["uran", "kärnkraft", "uranium"],
  "biotech turnaround": ["fas ii", "studieresultat", "biotech", "klinisk", "turnaround"],
  restructuring: ["strategisk översyn", "omstrukturering", "kostnadsprogram", "avyttring"],
  datacenter: ["datacenter", "gpu", "serverhall", "molninfrastruktur"],
  "battery/metals": ["batteri", "litium", "grafit", "nickel", "metaller"],
  "meme/social momentum": ["squeeze", "meme", "blankning", "rusar", "socialt"],
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function detectNarratives(
  news: NewsLike[],
  socialData: SocialSnapshot | null
): NarrativeResult {
  const text = news
    .map((item) => `${item.title ?? ""} ${item.rawText ?? ""} ${item.normalizedText ?? ""}`)
    .join(" ")
    .toLowerCase();
  const matches = Object.entries(dictionary)
    .map(([narrative, terms]) => ({
      narrative: narrative as Exclude<NarrativeType, "none">,
      terms: terms.filter((term) => text.includes(term)),
    }))
    .filter((item) => item.terms.length > 0)
    .sort((a, b) => b.terms.length - a.terms.length);
  const primary = matches[0];
  const socialBoost = socialData?.narrativeShift ? 22 : socialData?.score ? socialData.score * 0.15 : 0;
  const narrativeStrength = primary
    ? clamp(45 + primary.terms.length * 14 + socialBoost)
    : clamp(socialBoost);

  return {
    primaryNarrative: primary?.narrative ?? "none",
    narrativeStrength,
    trendDirection:
      narrativeStrength >= 68 ? "up" : narrativeStrength <= 35 ? "down" : "flat",
    emergingNarrative: narrativeStrength >= 70 && Boolean(socialData?.narrativeShift),
    matchedTerms: primary?.terms ?? [],
  };
}
