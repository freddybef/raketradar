export interface PipelineMetrics {
  ingestTimeMs: number;
  rankingTimeMs: number;
  alertLatencyMs: number;
  providerLatencyMs: Record<string, number>;
  dashboardFreshnessMs: number;
}

export function createPipelineMetrics(input: PipelineMetrics) {
  return {
    ...input,
    totalPipelineMs: input.ingestTimeMs + input.rankingTimeMs + input.alertLatencyMs,
    freshnessLabel:
      input.dashboardFreshnessMs < 60000
        ? "fresh"
        : input.dashboardFreshnessMs < 300000
          ? "warm"
          : "stale",
  };
}
