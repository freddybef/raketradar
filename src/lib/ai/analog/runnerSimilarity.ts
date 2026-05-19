import type { HistoricalAnalog } from "./historicalAnalogs";
import type { SetupFingerprint } from "./setupFingerprint";

export interface RunnerSimilarity {
  analog: HistoricalAnalog;
  similarityScore: number;
  matchedTraits: string[];
  mismatchedTraits: string[];
}

const fields: Array<keyof Omit<SetupFingerprint, "ticker">> = [
  "insiderPattern",
  "socialVelocity",
  "floatCharacteristics",
  "narrativeType",
  "volatilityExpansion",
  "volumeStructure",
  "marketRegime",
  "accumulationPattern",
];

export function calculateRunnerSimilarity(
  fingerprint: SetupFingerprint,
  analog: HistoricalAnalog
): RunnerSimilarity {
  const matchedTraits: string[] = [];
  const mismatchedTraits: string[] = [];

  for (const field of fields) {
    if (fingerprint[field] === analog.fingerprint[field]) {
      matchedTraits.push(field);
    } else {
      mismatchedTraits.push(field);
    }
  }

  return {
    analog,
    similarityScore: Math.round((matchedTraits.length / fields.length) * 100),
    matchedTraits,
    mismatchedTraits,
  };
}
