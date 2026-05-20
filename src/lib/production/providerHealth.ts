import type { ProviderHealth } from "@/lib/providers/types";

export interface ProviderHealthState extends ProviderHealth {
  uptimePercent: number;
  failures: number;
  latencyMs: number;
  staleData: boolean;
  retryCount: number;
  rateLimited: boolean;
}

export function evaluateProviderHealth(input: {
  name: string;
  checks: Array<{ ok: boolean; latencyMs: number; checkedAt: string }>;
  retryCount?: number;
  rateLimited?: boolean;
  staleAfterMs?: number;
}): ProviderHealthState {
  const checks = input.checks.slice(-50);
  const failures = checks.filter((check) => !check.ok).length;
  const uptimePercent =
    checks.length > 0
      ? Math.round(((checks.length - failures) / checks.length) * 1000) / 10
      : 0;
  const latencyMs =
    checks.length > 0
      ? Math.round(checks.reduce((sum, check) => sum + check.latencyMs, 0) / checks.length)
      : 0;
  const last = checks.at(-1);
  const staleData = last
    ? Date.now() - new Date(last.checkedAt).getTime() > (input.staleAfterMs ?? 300000)
    : true;
  const status: ProviderHealth["status"] =
    input.rateLimited || staleData
      ? "fallback"
      : failures >= Math.max(2, checks.length / 2)
        ? "error"
        : "healthy";

  return {
    name: input.name,
    status,
    message: staleData
      ? "Data kan vara stale"
      : input.rateLimited
        ? "Rate limit aktiv"
        : status === "healthy"
          ? "Provider frisk"
          : "Provider har fel",
    lastCheckedAt: last?.checkedAt ?? new Date().toISOString(),
    uptimePercent,
    failures,
    latencyMs,
    staleData,
    retryCount: input.retryCount ?? 0,
    rateLimited: input.rateLimited ?? false,
  };
}
