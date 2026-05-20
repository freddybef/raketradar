import type { SetupFingerprint } from "./setupFingerprint";

export interface HistoricalAnalog {
  name: string;
  market: "Sverige" | "Global";
  year: number;
  description: string;
  fingerprint: Omit<SetupFingerprint, "ticker">;
  outcome: {
    maxMovePercent: number;
    durationDays: number;
    failureMode?: string;
  };
}

export const historicalAnalogs: HistoricalAnalog[] = [
  {
    name: "Fingerprint Cards tidig hypefas",
    market: "Sverige",
    year: 2015,
    description: "Låg initial skepsis, accelererande narrativ och social spridning före bred retail-upptäckt.",
    fingerprint: {
      insiderPattern: "single_buy",
      socialVelocity: "accelerating",
      floatCharacteristics: "normal",
      narrativeType: "AI",
      volatilityExpansion: "expanding",
      volumeStructure: "rising_under_surface",
      marketRegime: "risk_on",
      accumulationPattern: "visible",
    },
    outcome: { maxMovePercent: 240, durationDays: 90 },
  },
  {
    name: "Embracer pre-hype rollup",
    market: "Sverige",
    year: 2019,
    description: "Narrativet byggdes gradvis medan marknaden underskattade förvärvs- och skalningslogik.",
    fingerprint: {
      insiderPattern: "cluster_buying",
      socialVelocity: "warming",
      floatCharacteristics: "normal",
      narrativeType: "restructuring",
      volatilityExpansion: "compressing",
      volumeStructure: "rising_under_surface",
      marketRegime: "risk_on",
      accumulationPattern: "stealth",
    },
    outcome: { maxMovePercent: 180, durationDays: 120 },
  },
  {
    name: "Biotech turnaround runner",
    market: "Sverige",
    year: 2020,
    description: "Studieresultat och låg förväntan skapade asymmetri innan bred repricing.",
    fingerprint: {
      insiderPattern: "none",
      socialVelocity: "silent",
      floatCharacteristics: "tight",
      narrativeType: "biotech turnaround",
      volatilityExpansion: "compressing",
      volumeStructure: "dry",
      marketRegime: "neutral",
      accumulationPattern: "none",
    },
    outcome: { maxMovePercent: 160, durationDays: 35 },
  },
  {
    name: "Parabolisk social squeeze som falnade",
    market: "Global",
    year: 2021,
    description: "Social acceleration var extrem men caset saknade fundamental bekräftelse.",
    fingerprint: {
      insiderPattern: "sell_pressure",
      socialVelocity: "overheated",
      floatCharacteristics: "tight",
      narrativeType: "meme/social momentum",
      volatilityExpansion: "explosive",
      volumeStructure: "breakout_volume",
      marketRegime: "risk_on",
      accumulationPattern: "distribution",
    },
    outcome: { maxMovePercent: 70, durationDays: 4, failureMode: "exhaustion" },
  },
];
