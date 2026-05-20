import type { IntelligenceReport } from "./mockData";

export interface MovementExplanation {
  ticker: string;
  strongestCatalyst: string;
  supportingSignals: string[];
  insiderActivity: string;
  narrativeExplanation: string;
  socialExplanation: string;
  riskFactors: string[];
}

export function explainMovement(
  ticker: string,
  report: IntelligenceReport
): MovementExplanation | null {
  const input = report.inputs.find(
    (item) => item.ticker.toUpperCase() === ticker.toUpperCase()
  );
  const ranked = report.topRanked.find(
    (item) => item.ticker.toUpperCase() === ticker.toUpperCase()
  );

  if (!input || !ranked) return null;

  const strongestCatalyst =
    input.squeeze.score >= input.social.score && input.squeeze.score >= input.insider.score
      ? `Squeeze setup ${input.squeeze.score}/100`
      : input.social.score >= input.insider.score
        ? `Social acceleration ${input.social.score}/100`
        : `Insideraktivitet ${input.insider.score}/100`;

  return {
    ticker: input.ticker,
    strongestCatalyst,
    supportingSignals: ranked.reasons,
    insiderActivity: `${input.insider.direction} (${input.insider.score}/100): ${input.insider.reasons.join(", ")}`,
    narrativeExplanation: `${input.narrative.primaryNarrative} med styrka ${input.narrative.narrativeStrength}/100.`,
    socialExplanation: `${input.social.sources.join(", ")} driver velocity ${input.social.velocityScore}/100 och sentiment ${input.social.sentimentScore}/100.`,
    riskFactors: ranked.risks,
  };
}
