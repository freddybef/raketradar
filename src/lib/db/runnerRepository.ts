import { createClient } from "@supabase/supabase-js";

export interface RunnerCaseSnapshot {
  ticker: string;
  state: string;
  score: number;
  confidence: number;
  risk: number;
  source: string;
  rawPayload: unknown;
  createdAt?: string | null;
}

export interface RankingChange {
  ticker: string;
  changeType:
    | "movedUp"
    | "movedDown"
    | "newEntrant"
    | "dropped"
    | "stateChanged"
    | "confidenceChanged"
    | "riskChanged";
  previousValue: string | number | null;
  currentValue: string | number | null;
  severity: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
}

export interface IntelligenceRunRecord {
  id: string | null;
  persistence: "active" | "missing_supabase";
}

export interface LearningObservation {
  sessionId?: string | null;
  observedAt: string;
  sessionMode: string;
  ticker?: string | null;
  observationType: string;
  source: string;
  signalState?: string | null;
  confidence?: number | null;
  score?: number | null;
  risk?: number | null;
  rvol?: number | null;
  momentum?: number | null;
  continuationProbability?: number | null;
  fadeProbability?: number | null;
  suppressionReason?: string | null;
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
  return (
    value?.code === "42P01" ||
    value?.code === "42703" ||
    /intelligence_runs|ranking_changes|case_state_snapshots|agent_alerts|learning_observations|autonomy_sessions|autonomy_session_id/i.test(value?.message ?? "")
  );
}

export async function createIntelligenceRun(input: {
  jobs: string[];
  reason: string;
  status: "running" | "success" | "partial" | "error";
  startedAt: string;
}) : Promise<IntelligenceRunRecord> {
  const supabase = getServerSupabase();
  if (!supabase) return { id: null, persistence: "missing_supabase" };
  const { data, error } = await supabase
    .from("intelligence_runs")
    .insert({
      jobs: input.jobs,
      reason: input.reason,
      status: input.status,
      started_at: input.startedAt,
    })
    .select("id")
    .single();
  if (error) {
    if (isMissingTable(error)) return { id: null, persistence: "missing_supabase" };
    throw error;
  }
  return { id: data.id as string, persistence: "active" };
}

export async function finishIntelligenceRun(input: {
  runId: string | null;
  status: "success" | "partial" | "error";
  finishedAt: string;
  latencyMs: number;
  summary: unknown;
  errorMessage?: string | null;
}) {
  const supabase = getServerSupabase();
  if (!supabase || !input.runId) return { saved: 0, skipped: true };
  const { error } = await supabase
    .from("intelligence_runs")
    .update({
      status: input.status,
      finished_at: input.finishedAt,
      latency_ms: input.latencyMs,
      summary: input.summary ?? {},
      error_message: input.errorMessage ?? null,
    })
    .eq("id", input.runId);
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: 1, skipped: false };
}

export async function getLatestCaseStateSnapshots(limit = 200): Promise<RunnerCaseSnapshot[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("case_state_snapshots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const seen = new Set<string>();
  const snapshots: RunnerCaseSnapshot[] = [];
  for (const row of data) {
    const ticker = String(row.ticker ?? "").trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    snapshots.push({
      ticker,
      state: row.state,
      score: Number(row.score ?? 0),
      confidence: Number(row.confidence ?? 0),
      risk: Number(row.risk ?? 0),
      source: row.source,
      rawPayload: row.raw_payload,
      createdAt: row.created_at,
    });
  }
  return snapshots;
}

export async function saveCaseStateSnapshots(runId: string | null, snapshots: RunnerCaseSnapshot[]) {
  const supabase = getServerSupabase();
  if (!supabase || !runId || snapshots.length === 0) return { saved: 0, skipped: !supabase || !runId };
  const { error } = await supabase.from("case_state_snapshots").insert(
    snapshots.map((snapshot) => ({
      run_id: runId,
      ticker: snapshot.ticker.trim().toUpperCase(),
      state: snapshot.state,
      score: snapshot.score,
      confidence: snapshot.confidence,
      risk: snapshot.risk,
      source: snapshot.source,
      raw_payload: snapshot.rawPayload ?? {},
    }))
  );
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: snapshots.length, skipped: false };
}

export async function saveRankingChanges(runId: string | null, changes: RankingChange[]) {
  const supabase = getServerSupabase();
  if (!supabase || !runId || changes.length === 0) return { saved: 0, skipped: !supabase || !runId };
  const { error } = await supabase.from("ranking_changes").insert(
    changes.map((change) => ({
      run_id: runId,
      ticker: change.ticker,
      change_type: change.changeType,
      previous_value: change.previousValue === null ? null : String(change.previousValue),
      current_value: change.currentValue === null ? null : String(change.currentValue),
      severity: change.severity,
      reason: change.reason,
    }))
  );
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: changes.length, skipped: false };
}

export async function saveChangeAlerts(runId: string | null, changes: RankingChange[]) {
  const supabase = getServerSupabase();
  const actionable = changes.filter((change) => change.severity !== "LOW" && change.currentValue !== "REJECTED");
  if (!supabase || !runId || actionable.length === 0) return { saved: 0, skipped: !supabase || !runId };
  const { error } = await supabase.from("agent_alerts").upsert(
    actionable.map((change) => ({
      session_id: null,
      ticker: change.ticker,
      alert_type:
        change.changeType === "stateChanged" && change.currentValue === "PARABOLIC_RISK"
          ? "PARABOLIC_RISK_TRIGGERED"
          : change.changeType === "movedUp"
            ? "CASE_UPGRADED"
            : change.changeType === "dropped"
              ? "CASE_DROPPED"
              : change.changeType === "confidenceChanged"
                ? "CONFIDENCE_UP"
                : "CASE_DOWNGRADED",
      severity: change.severity,
      title: `${change.ticker}: ${change.changeType}`,
      message: change.reason,
      dedupe_key: `${runId}-${change.ticker}-${change.changeType}`.toLowerCase(),
      raw_payload: change,
    })),
    { onConflict: "dedupe_key" }
  );
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: actionable.length, skipped: false };
}

export async function getLatestRunChanges() {
  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      persistence: "missing_supabase" as const,
      latestRun: null,
      changes: [] as Array<RankingChange & { createdAt: string }>,
    };
  }
  const { data: run, error: runError } = await supabase
    .from("intelligence_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError) {
    return { persistence: "missing_supabase" as const, latestRun: null, changes: [] };
  }
  if (!run) return { persistence: "active" as const, latestRun: null, changes: [] };
  const { data } = await supabase
    .from("ranking_changes")
    .select("*")
    .eq("run_id", run.id)
    .order("created_at", { ascending: false })
    .limit(80);
  return {
    persistence: "active" as const,
    latestRun: {
      id: run.id,
      jobs: run.jobs ?? [],
      reason: run.reason,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      latencyMs: Number(run.latency_ms ?? 0),
      errorMessage: run.error_message ?? null,
    },
    changes: (data ?? []).map((row) => ({
      ticker: row.ticker,
      changeType: row.change_type,
      previousValue: row.previous_value,
      currentValue: row.current_value,
      severity: row.severity,
      reason: row.reason,
      createdAt: row.created_at,
    })),
  };
}

export async function saveLearningObservations(runId: string | null, observations: LearningObservation[]) {
  const supabase = getServerSupabase();
  if (!supabase || observations.length === 0) return { saved: 0, skipped: !supabase };
  const { error } = await supabase.from("learning_observations").insert(
    observations.map((item) => ({
      run_id: runId,
      autonomy_session_id: item.sessionId ?? null,
      observed_at: item.observedAt,
      session_mode: item.sessionMode,
      ticker: item.ticker ?? null,
      observation_type: item.observationType,
      source: item.source,
      signal_state: item.signalState ?? null,
      confidence: item.confidence ?? null,
      score: item.score ?? null,
      risk: item.risk ?? null,
      rvol: item.rvol ?? null,
      momentum: item.momentum ?? null,
      continuation_probability: item.continuationProbability ?? null,
      fade_probability: item.fadeProbability ?? null,
      suppression_reason: item.suppressionReason ?? null,
      payload: item.payload ?? {},
    }))
  );
  if (error) {
    if (isMissingTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: observations.length, skipped: false };
}

export async function getLearningObservations(hours = 18, limit = 300) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      persistence: "missing_supabase" as const,
      observations: [] as Array<LearningObservation & { id: string; createdAt: string }>,
    };
  }
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("learning_observations")
    .select("*")
    .gte("observed_at", since)
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) {
    return { persistence: "missing_supabase" as const, observations: [] };
  }
  return {
    persistence: "active" as const,
    observations: (data ?? []).map((row) => ({
      id: row.id,
      sessionId: row.autonomy_session_id,
      observedAt: row.observed_at,
      sessionMode: row.session_mode,
      ticker: row.ticker,
      observationType: row.observation_type,
      source: row.source,
      signalState: row.signal_state,
      confidence: row.confidence === null ? null : Number(row.confidence),
      score: row.score === null ? null : Number(row.score),
      risk: row.risk === null ? null : Number(row.risk),
      rvol: row.rvol === null ? null : Number(row.rvol),
      momentum: row.momentum === null ? null : Number(row.momentum),
      continuationProbability: row.continuation_probability === null ? null : Number(row.continuation_probability),
      fadeProbability: row.fade_probability === null ? null : Number(row.fade_probability),
      suppressionReason: row.suppression_reason,
      payload: row.payload,
      createdAt: row.created_at,
    })),
  };
}
