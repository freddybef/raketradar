import type { NarrativeResult } from "@/lib/intelligence/narrative/narrativeEngine";

export function generateNarrativeSummary(narrative: NarrativeResult) {
  if (narrative.primaryNarrative === "none") {
    return "Inget tydligt narrativ dominerar ännu.";
  }

  return `${narrative.primaryNarrative} är huvudnarrativet med styrka ${narrative.narrativeStrength}/100 och trend ${narrative.trendDirection}.`;
}
