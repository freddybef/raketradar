import { createClient } from "@supabase/supabase-js";
import type { AgentCaseState, AgentCaseStateResult, AgentFeedbackSummary } from "@/lib/agent/stateEngine";

export type AgentFeedbackType =
  | "GOOD_CALL"
  | "BAD_CALL"
  | "MISSED_MOVER"
  | "TOO_AGGRESSIVE"
  | "TOO_DEFENSIVE"
  | "RANK_HIGHER"
  | "RANK_LOWER";

export interface AgentMemorySnapshot {
  generatedAt: string;
  persistence: "active" | "missing_supabase";
  sessionId: string | null;
  sessionMode: string | null;
  caseEvents: Array<{
    ticker: string;
    state: AgentCaseState;
    previousState: AgentCaseState | null;
    reason: string;
    confidence: number;
    createdAt: string;
  }>;
  alerts: Array<{
    id: string;
    ticker: string;
    alertType: string;
    severity: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
  feedback: AgentFeedbackSummary[];
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingAgentTable(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "42P01" || /agent_sessions|agent_case_events|agent_feedback|agent_alerts/i.test(value?.message ?? "");
}

export function todaySessionKey(now = new Date()) {
  return `terminal-${now.toISOString().slice(0, 10)}`;
}

export async function ensureAgentSession(sessionMode: string) {
  const supabase = getServerSupabase();
  if (!supabase) return { sessionId: null, skipped: true };
  const sessionKey = todaySessionKey();
  const { data, error } = await supabase
    .from("agent_sessions")
    .upsert(
      {
        session_key: sessionKey,
        session_mode: sessionMode,
        started_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "session_key" }
    )
    .select("id")
    .single();

  if (error) {
    if (isMissingAgentTable(error)) return { sessionId: null, skipped: true };
    throw error;
  }
  return { sessionId: data.id as string, skipped: false };
}

export async function getLatestCaseStates(sessionId: string | null) {
  const supabase = getServerSupabase();
  if (!supabase || !sessionId) return new Map<string, AgentCaseState>();
  const { data, error } = await supabase
    .from("agent_case_events")
    .select("ticker,state,created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return new Map<string, AgentCaseState>();

  const map = new Map<string, AgentCaseState>();
  for (const row of data) {
    if (!map.has(row.ticker)) map.set(row.ticker, row.state as AgentCaseState);
  }
  return map;
}

export async function getFeedbackSummary() {
  const supabase = getServerSupabase();
  if (!supabase) return new Map<string, AgentFeedbackSummary>();
  const { data, error } = await supabase
    .from("agent_feedback")
    .select("ticker,feedback_type")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);
  if (error || !data) return new Map<string, AgentFeedbackSummary>();

  const summary = new Map<string, AgentFeedbackSummary>();
  for (const row of data) {
    const ticker = String(row.ticker ?? "").toUpperCase();
    if (!ticker) continue;
    const current = summary.get(ticker) ?? {
      ticker,
      feedbackScore: 0,
      falsePositiveCount: 0,
      falseNegativeCount: 0,
      userOverrideCount: 0,
    };
    const type = String(row.feedback_type ?? "");
    if (type === "GOOD_CALL" || type === "RANK_HIGHER") current.feedbackScore += 2;
    if (type === "TOO_DEFENSIVE" || type === "MISSED_MOVER") {
      current.feedbackScore += 1;
      current.falseNegativeCount += 1;
    }
    if (type === "BAD_CALL" || type === "TOO_AGGRESSIVE" || type === "RANK_LOWER") {
      current.feedbackScore -= 2;
      current.falsePositiveCount += 1;
    }
    if (type === "RANK_HIGHER" || type === "RANK_LOWER") current.userOverrideCount += 1;
    summary.set(ticker, current);
  }
  return summary;
}

export async function saveAgentCaseEvents(sessionId: string | null, events: AgentCaseStateResult[]) {
  const supabase = getServerSupabase();
  if (!supabase || !sessionId || events.length === 0) return { saved: 0, skipped: !supabase || !sessionId };
  const { error } = await supabase.from("agent_case_events").upsert(
    events.map((event) => ({
      session_id: sessionId,
      ticker: event.ticker,
      company_name: event.companyName ?? null,
      exchange: event.exchange ?? null,
      previous_state: event.previousState ?? null,
      state: event.state,
      reason: event.reason,
      confidence: event.confidence,
      session_mode: event.sessionMode,
      event_key: event.eventKey,
      raw_payload: event,
    })),
    { onConflict: "session_id,event_key" }
  );
  if (error) {
    if (isMissingAgentTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: events.length, skipped: false };
}

export async function saveAgentAlerts(sessionId: string | null, events: AgentCaseStateResult[]) {
  const supabase = getServerSupabase();
  const alertEvents = events.filter((event) => event.alertType);
  if (!supabase || !sessionId || alertEvents.length === 0) return { saved: 0, skipped: !supabase || !sessionId };
  const { error } = await supabase.from("agent_alerts").upsert(
    alertEvents.map((event) => ({
      session_id: sessionId,
      ticker: event.ticker,
      alert_type: event.alertType,
      severity: event.alertSeverity ?? "LOW",
      title: `${event.ticker}: ${event.state}`,
      message: event.reason,
      dedupe_key: `${event.ticker}-${event.alertType}-${new Date().toISOString().slice(0, 13)}`.toLowerCase(),
      raw_payload: event,
    })),
    { onConflict: "dedupe_key" }
  );
  if (error) {
    if (isMissingAgentTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: alertEvents.length, skipped: false };
}

export async function saveAgentFeedback(input: {
  userId: string;
  ticker: string;
  feedbackType: AgentFeedbackType;
  note?: string;
  rawPayload?: unknown;
}) {
  const supabase = getServerSupabase();
  if (!supabase) return { saved: 0, skipped: true };
  const session = await ensureAgentSession("feedback");
  const { error } = await supabase.from("agent_feedback").insert({
    session_id: session.sessionId,
    user_id: input.userId,
    ticker: input.ticker.toUpperCase(),
    feedback_type: input.feedbackType,
    note: input.note ?? null,
    raw_payload: input.rawPayload ?? {},
  });
  if (error) {
    if (isMissingAgentTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: 1, skipped: false };
}

export async function getAgentMemorySnapshot(): Promise<AgentMemorySnapshot> {
  const supabase = getServerSupabase();
  const generatedAt = new Date().toISOString();
  if (!supabase) {
    return {
      generatedAt,
      persistence: "missing_supabase",
      sessionId: null,
      sessionMode: null,
      caseEvents: [],
      alerts: [],
      feedback: [],
    };
  }

  const { data: session, error: sessionError } = await supabase
    .from("agent_sessions")
    .select("*")
    .eq("session_key", todaySessionKey())
    .maybeSingle();
  if (sessionError && isMissingAgentTable(sessionError)) {
    return {
      generatedAt,
      persistence: "missing_supabase",
      sessionId: null,
      sessionMode: null,
      caseEvents: [],
      alerts: [],
      feedback: [],
    };
  }

  const sessionId = session?.id ?? null;
  const [events, alerts, feedbackMap] = await Promise.all([
    sessionId
      ? supabase
          .from("agent_case_events")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    sessionId
      ? supabase
          .from("agent_alerts")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    getFeedbackSummary(),
  ]);

  return {
    generatedAt,
    persistence: "active",
    sessionId,
    sessionMode: session?.session_mode ?? null,
    caseEvents: (events.data ?? []).map((row) => ({
      ticker: row.ticker,
      state: row.state,
      previousState: row.previous_state,
      reason: row.reason,
      confidence: Number(row.confidence ?? 0),
      createdAt: row.created_at,
    })),
    alerts: (alerts.data ?? []).map((row) => ({
      id: row.id,
      ticker: row.ticker,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      createdAt: row.created_at,
    })),
    feedback: [...feedbackMap.values()],
  };
}
