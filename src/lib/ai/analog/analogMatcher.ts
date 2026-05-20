import { historicalAnalogs } from "./historicalAnalogs";
import { calculateRunnerSimilarity, type RunnerSimilarity } from "./runnerSimilarity";
import type { SetupFingerprint } from "./setupFingerprint";

export interface AnalogMatchResult {
  ticker: string;
  bestMatch: RunnerSimilarity;
  alternatives: RunnerSimilarity[];
  explanation: string;
}

export function matchAnalogs(fingerprint: SetupFingerprint): AnalogMatchResult {
  const ranked = historicalAnalogs
    .map((analog) => calculateRunnerSimilarity(fingerprint, analog))
    .sort((a, b) => b.similarityScore - a.similarityScore);
  const bestMatch = ranked[0];

  return {
    ticker: fingerprint.ticker,
    bestMatch,
    alternatives: ranked.slice(1, 3),
    explanation: `Detta case liknar ${bestMatch.analog.name} eftersom ${bestMatch.matchedTraits.join(
      ", "
    )} matchar. Skillnader: ${bestMatch.mismatchedTraits.join(", ") || "få tydliga"}.`,
  };
}
