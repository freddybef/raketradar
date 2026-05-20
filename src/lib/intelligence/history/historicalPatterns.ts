export interface HistoricalPattern {
  name: string;
  signalCombo: string[];
  narrative?: string;
  marketCapRange?: string;
  regime?: string;
  hitRate: number;
  averageUpside: number;
  falsePositiveRate: number;
  sampleSize: number;
}

export function getMockHistoricalPatterns(): HistoricalPattern[] {
  return [
    {
      name: "insider + social acceleration",
      signalCombo: ["insider accumulation", "social heat"],
      marketCapRange: "small",
      regime: "risk_on",
      hitRate: 64,
      averageUpside: 18.4,
      falsePositiveRate: 24,
      sampleSize: 42,
    },
    {
      name: "narrative shift + low float",
      signalCombo: ["emerging narrative", "low float", "volume expansion"],
      marketCapRange: "micro",
      hitRate: 58,
      averageUpside: 24.7,
      falsePositiveRate: 31,
      sampleSize: 33,
    },
    {
      name: "biotech turnaround + unusual volume",
      signalCombo: ["biotech turnaround", "unusual volume"],
      narrative: "biotech turnaround",
      hitRate: 52,
      averageUpside: 31.2,
      falsePositiveRate: 39,
      sampleSize: 21,
    },
    {
      name: "repeated accumulation",
      signalCombo: ["insider accumulation", "repeat volume expansion"],
      marketCapRange: "small",
      hitRate: 69,
      averageUpside: 14.6,
      falsePositiveRate: 18,
      sampleSize: 27,
    },
  ];
}
