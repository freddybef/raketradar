import { createClient } from "@supabase/supabase-js";

export type AutonomySessionStatus = "running" | "stopped" | "error";

export interface AutonomySessionRecord {
  id: string | null;
  persistence: "active" | "missing_supabase";
}

export interface AutonomySessionSummary {
  id: string;
  mode: string;
  status: AutonomySessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastRunAt: string | null;
  intervalMs: number;
  runCount: number;
  casesObserved: number;
  observationsCount: number;
  failedProviders: unknown[];
  missingCoverage: unknown[];
  notableChanges: unknown[];
  learnedObservations: unknown[];
  morningSummaryPayload: unknown;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingTable(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return (
    value?.code === "42P01" ||
    value?.code === "42703" ||
    /autonomy_sessions|overnight_summaries|provider_coverage_snapshots|morning_brief_payloads|autonomy_session_id/i.test(value?.message ?? "")
  );
}

function mapSession(row: Record<string, unknown>): AutonomySessionSummary {
  return {
    id: String(row.id),
    mode: String(row.mode ?? "manual"),
    status: String(row.status ?? "stopped") as AutonomySessionStatus,
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    intervalMs: Number(row.interval_ms ?? 0),
    runCount: Number(row.run_count ?? 0),
    casesObserved: Number(row.cases_observed ?? 0),
    observationsCount: Number(row.observations_count ?? 0),
    failedProviders: Array.isArray(row.failed_providers) ? row.failed_providers : [],
    missingCoverage: Array.isArray(row.missing_coverage) ? row.missing_coverage : [],
    notableChanges: Array.isArray(row.notable_changes) ? row.notable_changes : [],
    learnedObservations: Array.isArray(row.learned_observations) ? row.learned_observations : [],
    morningSummaryPayload: row.morning_summary_payload ?? null,
  };
}

export async function createAutonomySession(input: { mode: string; intervalMs: number; startedAt: string }): Promise<AutonomySessionRecord> {
  const supabase = getServerSupabase();
  if (!supabase) return { id: null, persistence: "missing_supabase" };
  const { data, error } = await supabase
    .from("autonomy_sessions")
    .insert({
      mode: input.mode,
      status: "running",
      interval_ms: input.intervalMs,
      started_at: input.startedAt,
      last_run_at: null,
    })
    .select("id")
    .single();
  if (error) {
    if (isMissingTable(error)) return { id: null, persistence: "missing_supabase" };
    throw error;
  }
  return { id: data.id as string, persistence: "active" };
}

export async function stopAutonomySession(input: { sessionId: string | null; endedAt: string; status?: AutonomySessionStatus; errorMessage?: string | null }) {
  const supabase = getServerSupabase();
  if (!supabase || !input.sessionId) return { saved: 0, skipped: !supabase || !input.sessionId };
  const { error } = await supabase
    .from("autonomy_sessions")
    .update({
      status: input.status ?? "stopped",
      ended_at: input.endedAt,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.sessionId);
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: 1, skipped: false };
}

export async function getLatestAutonomySession() {
  const supabase = getServerSupabase();
  if (!supabase) return { persistence: "missing_supabase" as const, session: null };
  const { data, error } = await supabase
    .from("autonomy_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { persistence: "missing_supabase" as const, session: null };
    throw error;
  }
  return { persistence: "active" as const, session: data ? mapSession(data) : null };
}

export async function recordAutonomyRun(input: {
  sessionId: string | null;
  runId: string | null;
  ranAt: string;
  casesObserved: number;
  observationsSaved: number;
  failedProviders: unknown[];
  missingCoverage: unknown[];
  notableChanges: unknown[];
  learnedObservations: unknown[];
  summary: unknown;
}) {
  const supabase = getServerSupabase();
  if (!supabase || !input.sessionId) return { saved: 0, skipped: !supabase || !input.sessionId };
  const latest = await getLatestAutonomySession();
  const current = latest.session?.id === input.sessionId ? latest.session : null;
  const { error } = await supabase
    .from("autonomy_sessions")
    .update({
      last_run_at: input.ranAt,
      run_count: (current?.runCount ?? 0) + 1,
      cases_observed: (current?.casesObserved ?? 0) + input.casesObserved,
      observations_count: (current?.observationsCount ?? 0) + input.observationsSaved,
      failed_providers: input.failedProviders,
      missing_coverage: input.missingCoverage,
      notable_changes: input.notableChanges,
      learned_observations: input.learnedObservations,
      last_run_summary: input.summary ?? {},
    })
    .eq("id", input.sessionId);
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: 1, skipped: false };
}

export async function saveProviderCoverageSnapshot(input: {
  sessionId: string | null;
  runId: string | null;
  observedAt: string;
  provider: string;
  scannedCount: number;
  liveHits: number;
  missingDataCount: number;
  coverageByExchange: unknown;
  payload: unknown;
}) {
  const supabase = getServerSupabase();
  if (!supabase || !input.sessionId) return { saved: 0, skipped: !supabase || !input.sessionId };
  const { error } = await supabase.from("provider_coverage_snapshots").insert({
    autonomy_session_id: input.sessionId,
    run_id: input.runId,
    observed_at: input.observedAt,
    provider: input.provider,
    scanned_count: input.scannedCount,
    live_hits: input.liveHits,
    missing_data_count: input.missingDataCount,
    coverage_by_exchange: input.coverageByExchange ?? [],
    payload: input.payload ?? {},
  });
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: 1, skipped: false };
}

export async function saveOvernightSummary(input: { sessionId: string | null; generatedAt: string; summary: unknown; morningBriefPayload: unknown }) {
  const supabase = getServerSupabase();
  if (!supabase) return { saved: 0, skipped: true };
  const { error: summaryError } = await supabase.from("overnight_summaries").insert({
    autonomy_session_id: input.sessionId,
    generated_at: input.generatedAt,
    summary_payload: input.summary ?? {},
  });
  if (summaryError) {
    if (isMissingTable(summaryError)) return { saved: 0, skipped: true };
    throw summaryError;
  }
  const { error: briefError } = await supabase.from("morning_brief_payloads").insert({
    autonomy_session_id: input.sessionId,
    generated_at: input.generatedAt,
    payload: input.morningBriefPayload ?? {},
  });
  if (briefError) {
    if (isMissingTable(briefError)) return { saved: 1, skipped: true };
    throw briefError;
  }
  if (input.sessionId) {
    await supabase
      .from("autonomy_sessions")
      .update({ morning_summary_payload: input.morningBriefPayload ?? {} })
      .eq("id", input.sessionId);
  }
  return { saved: 2, skipped: false };
}

export async function getLatestOvernightSummary() {
  const supabase = getServerSupabase();
  if (!supabase) return { persistence: "missing_supabase" as const, summary: null };
  const { data, error } = await supabase
    .from("overnight_summaries")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { persistence: "missing_supabase" as const, summary: null };
    throw error;
  }
  return { persistence: "active" as const, summary: data?.summary_payload ?? null };
}
