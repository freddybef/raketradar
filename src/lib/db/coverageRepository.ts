import { createClient } from "@supabase/supabase-js";

export interface TickerCoverageProfileInput {
  ticker: string;
  providerSuccessRate: number;
  lastSuccessfulFetch?: string | null;
  newsCoverage: number;
  volumeCoverage: number;
  marketCoverage: number;
  entityConfidence: number;
  unresolvedFrequency: number;
  suppressionCount: number;
  falseNegativeRisk: number;
  payload?: unknown;
}

export interface ProviderCoverageGapInput {
  ticker?: string | null;
  provider: string;
  gapType: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
  observedAt: string;
  payload?: unknown;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingTable(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "42P01" || /provider_coverage_gaps|ticker_coverage_profiles/i.test(value?.message ?? "");
}

export async function upsertTickerCoverageProfiles(profiles: TickerCoverageProfileInput[]) {
  const supabase = getServerSupabase();
  if (!supabase || profiles.length === 0) return { saved: 0, skipped: !supabase };
  const { error } = await supabase.from("ticker_coverage_profiles").upsert(
    profiles.map((profile) => ({
      ticker: profile.ticker.toUpperCase(),
      provider_success_rate: profile.providerSuccessRate,
      last_successful_fetch: profile.lastSuccessfulFetch ?? null,
      news_coverage: profile.newsCoverage,
      volume_coverage: profile.volumeCoverage,
      market_coverage: profile.marketCoverage,
      entity_confidence: profile.entityConfidence,
      unresolved_frequency: profile.unresolvedFrequency,
      suppression_count: profile.suppressionCount,
      false_negative_risk: profile.falseNegativeRisk,
      payload: profile.payload ?? {},
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "ticker" }
  );
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: profiles.length, skipped: false };
}

export async function saveProviderCoverageGaps(gaps: ProviderCoverageGapInput[]) {
  const supabase = getServerSupabase();
  if (!supabase || gaps.length === 0) return { saved: 0, skipped: !supabase };
  const { error } = await supabase.from("provider_coverage_gaps").insert(
    gaps.map((gap) => ({
      ticker: gap.ticker?.toUpperCase() ?? null,
      provider: gap.provider,
      gap_type: gap.gapType,
      severity: gap.severity,
      reason: gap.reason,
      observed_at: gap.observedAt,
      payload: gap.payload ?? {},
    }))
  );
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: gaps.length, skipped: false };
}

export async function getTickerCoverageProfiles(tickers: string[]) {
  const supabase = getServerSupabase();
  const normalized = [...new Set(tickers.map((ticker) => ticker.toUpperCase()).filter(Boolean))];
  if (!supabase || normalized.length === 0) return [];
  const { data, error } = await supabase.from("ticker_coverage_profiles").select("*").in("ticker", normalized);
  if (error) return [];
  return data ?? [];
}

export async function getRecentCoverageGaps(limit = 100) {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("provider_coverage_gaps")
    .select("*")
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
