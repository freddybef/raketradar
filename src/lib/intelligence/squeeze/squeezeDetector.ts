export interface SqueezeMetrics {
  ticker: string;
  floatSharesMillions?: number;
  volumeRatio?: number;
  atrExpansion?: number;
  verticalAcceleration?: number;
  gapUpPercent?: number;
  socialVelocityScore?: number;
}

export interface SqueezeResult {
  score: number;
  triggeredFactors: string[];
  confidence: number;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function detectSqueezePotential(metrics: SqueezeMetrics): SqueezeResult {
  const factors: Array<{ label: string; score: number; active: boolean }> = [
    {
      label: "Låg float",
      score: metrics.floatSharesMillions && metrics.floatSharesMillions <= 30 ? 85 : 35,
      active: Boolean(metrics.floatSharesMillions && metrics.floatSharesMillions <= 30),
    },
    {
      label: "Ovanlig volym",
      score: Math.min(100, (metrics.volumeRatio ?? 1) * 24),
      active: (metrics.volumeRatio ?? 1) >= 2.8,
    },
    {
      label: "ATR-expansion",
      score: Math.min(100, (metrics.atrExpansion ?? 1) * 35),
      active: (metrics.atrExpansion ?? 1) >= 1.8,
    },
    {
      label: "Vertikal acceleration",
      score: Math.min(100, 45 + (metrics.verticalAcceleration ?? 0) * 5),
      active: (metrics.verticalAcceleration ?? 0) >= 5,
    },
    {
      label: "Gap-up",
      score: Math.min(100, 45 + (metrics.gapUpPercent ?? 0) * 4),
      active: (metrics.gapUpPercent ?? 0) >= 4,
    },
    {
      label: "Social velocity samtidigt",
      score: metrics.socialVelocityScore ?? 35,
      active: (metrics.socialVelocityScore ?? 0) >= 70,
    },
  ];
  const score = clamp(
    factors.reduce((sum, factor) => sum + factor.score, 0) / factors.length
  );
  const triggeredFactors = factors
    .filter((factor) => factor.active)
    .map((factor) => factor.label);

  return {
    score,
    triggeredFactors,
    confidence: clamp(45 + triggeredFactors.length * 9 + score * 0.25),
  };
}
