type SummaryLike = {
  generatedAt?: string;
  biggestStateChanges?: unknown[];
  newCasesDiscovered?: unknown[];
  casesUpgraded?: unknown[];
  casesDowngraded?: unknown[];
  parabolicFakeSpikeWarnings?: unknown[];
  portfolioHoldingsRequiringAttention?: unknown[];
  missedMovers?: unknown[];
  dataCoverageIssues?: string[];
  providerFailures?: unknown[];
  whatToFocusOnNextSession?: unknown[];
  whatToIgnore?: unknown[];
  morningBrief?: {
    focus_now?: unknown[];
    watchlist?: unknown[];
    avoid?: unknown[];
    portfolio_alerts?: unknown[];
    discovery_candidates?: unknown[];
    data_quality?: unknown;
    unresolved_risks?: unknown[];
    suggested_next_checks?: string[];
  };
};

function first<T>(items: T[] | undefined, limit: number) {
  return (items ?? []).slice(0, limit);
}

export function generateMorningBriefPayload(summary: SummaryLike) {
  const brief = summary.morningBrief ?? {};
  return {
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: summary.generatedAt ?? null,
    what_happened_while_away: {
      biggest_state_changes: first(summary.biggestStateChanges, 8),
      new_cases: first(summary.newCasesDiscovered, 8),
      upgrades: first(summary.casesUpgraded, 8),
      downgrades: first(summary.casesDowngraded, 8),
      missed_movers: first(summary.missedMovers, 8),
    },
    strongest_upgrades: first(summary.casesUpgraded, 5),
    fades_warnings: [...first(summary.casesDowngraded, 5), ...first(summary.parabolicFakeSpikeWarnings, 5)],
    new_cases: first(summary.newCasesDiscovered, 5),
    cases_moving_toward_high_conviction: first(brief.focus_now, 5),
    provider_issues: {
      failures: first(summary.providerFailures, 10),
      coverage_warnings: summary.dataCoverageIssues ?? [],
    },
    learning_notes: {
      observations: first(summary.biggestStateChanges, 5),
      warnings: summary.dataCoverageIssues ?? [],
      ignore: first(summary.whatToIgnore, 8),
    },
    suggested_user_actions: {
      focus_now: first(brief.focus_now, 5),
      watchlist: first(brief.watchlist, 8),
      avoid: first(brief.avoid, 8),
      portfolio_alerts: first(brief.portfolio_alerts, 8),
      discovery_candidates: first(brief.discovery_candidates, 8),
      suggested_next_checks: brief.suggested_next_checks ?? [
        "Vänta på bekräftelse om score/coverage är svag.",
        "Jaga inte parabolic/fake-spike case.",
        "Kontrollera provider coverage innan stark slutsats.",
      ],
    },
    data_quality: brief.data_quality ?? {
      warnings: summary.dataCoverageIssues ?? [],
    },
    unresolved_risks: brief.unresolved_risks ?? [],
  };
}
