import type { IntelligenceReport } from "@/lib/intelligence/mockData";

export interface CapitalRotationSignal {
  fromNarrative: string;
  toNarrative: string;
  stealthInflows: string[];
  fadingNarratives: string[];
  reason: string;
}

export function detectCapitalRotation(report: IntelligenceReport): CapitalRotationSignal {
  const sorted = [...report.strongestNarratives].sort((a, b) => b.strength - a.strength);
  const stealthInflows = report.inputs
    .filter((input) => input.insider.direction === "bullish" && input.social.score < 75)
    .map((input) => input.ticker);
  const fadingNarratives = sorted
    .filter((item) => item.strength < 45)
    .map((item) => item.narrative);

  return {
    fromNarrative: sorted.at(-1)?.narrative ?? "svagt narrativ",
    toNarrative: sorted[0]?.narrative ?? "okänt",
    stealthInflows,
    fadingNarratives,
    reason: `Momentum roterar mot ${sorted[0]?.narrative ?? "okänt"} medan ${stealthInflows.join(", ") || "inga"} visar stealth inflows.`,
  };
}
