import { createClient } from "@supabase/supabase-js";

export type CopilotRole = "user" | "assistant" | "system";
export type CopilotFeedbackType = "WRONG_TICKER" | "MISSING_TICKER" | "BAD_REASONING" | "USEFUL";

export interface CopilotMessageInput {
  role: CopilotRole;
  message: string;
  normalizedQuery?: string | null;
  detectedTickers?: string[];
  resolvedEntities?: unknown;
  contextPayload?: unknown;
  confidence?: number | null;
  source?: string;
  sessionId?: string | null;
}

export interface CopilotMessageRecord {
  id: string;
  createdAt: string;
  role: CopilotRole;
  message: string;
  normalizedQuery: string | null;
  detectedTickers: string[];
  resolvedEntities: unknown;
  contextPayload: unknown;
  confidence: number | null;
  source: string;
  sessionId: string | null;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isMissingCopilotTable(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "42P01" || /copilot_messages|copilot_feedback/i.test(value?.message ?? "");
}

function supabaseErrorDetails(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  return {
    code: value?.code ?? null,
    message: value?.message ?? String(error ?? "unknown"),
    details: value?.details ?? null,
    hint: value?.hint ?? null,
  };
}

function missingColumn(error: unknown) {
  const message = supabaseErrorDetails(error).message;
  const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation|column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
  return match?.[1] ?? match?.[2] ?? null;
}

function jsonSafe(value: unknown, fallback: unknown) {
  try {
    JSON.stringify(value);
    return value ?? fallback;
  } catch {
    return { serialization_error: "Value was not JSON serializable" };
  }
}

function buildMessageRow(input: CopilotMessageInput) {
  return {
    role: input.role,
    message: input.message,
    normalized_query: input.normalizedQuery ?? null,
    detected_tickers: input.detectedTickers ?? [],
    resolved_entities: jsonSafe(input.resolvedEntities, []),
    context_payload: jsonSafe(input.contextPayload, {}),
    confidence: input.confidence ?? null,
    source: input.source ?? "copilot",
    session_id: input.sessionId ?? null,
  };
}

function mapMessage(row: Record<string, unknown>): CopilotMessageRecord {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    role: String(row.role) as CopilotRole,
    message: String(row.message ?? ""),
    normalizedQuery: row.normalized_query ? String(row.normalized_query) : null,
    detectedTickers: Array.isArray(row.detected_tickers) ? row.detected_tickers.map(String) : [],
    resolvedEntities: row.resolved_entities ?? [],
    contextPayload: row.context_payload ?? {},
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    source: String(row.source ?? "copilot"),
    sessionId: row.session_id ? String(row.session_id) : null,
  };
}

export async function saveCopilotMessage(input: CopilotMessageInput) {
  const supabase = getServerSupabase();
  if (!supabase) return { saved: 0, skipped: true, id: null as string | null };
  const row = buildMessageRow(input);
  const { data, error } = await supabase
    .from("copilot_messages")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    if (isMissingCopilotTable(error)) return { saved: 0, skipped: true, id: null };
    const details = supabaseErrorDetails(error);
    const column = missingColumn(error);
    console.error("[RaketRadar Copilot] Supabase insert failed", {
      ...details,
      missingColumn: column,
      payloadKeys: Object.keys(row),
      role: row.role,
      messageLength: row.message.length,
      detectedTickersCount: row.detected_tickers.length,
      contextPayloadBytes: JSON.stringify(row.context_payload).length,
    });

    if (column) {
      const fallbackRow = Object.fromEntries(Object.entries(row).filter(([key]) => key !== column));
      const fallback = await supabase
        .from("copilot_messages")
        .insert(fallbackRow)
        .select("id")
        .single();
      if (!fallback.error) return { saved: 1, skipped: false, id: fallback.data.id as string };
      console.error("[RaketRadar Copilot] Supabase fallback insert failed", {
        ...supabaseErrorDetails(fallback.error),
        removedColumn: column,
        payloadKeys: Object.keys(fallbackRow),
      });
    }

    throw new Error(`Copilot persistence failed: ${details.code ?? "no_code"} ${details.message}${details.details ? ` | ${details.details}` : ""}${details.hint ? ` | hint: ${details.hint}` : ""}`);
  }
  return { saved: 1, skipped: false, id: data.id as string };
}

export async function getRecentCopilotMessages(limit = 10) {
  const supabase = getServerSupabase();
  if (!supabase) return { persistence: "missing_supabase" as const, messages: [] as CopilotMessageRecord[] };
  const { data, error } = await supabase
    .from("copilot_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingCopilotTable(error)) return { persistence: "missing_supabase" as const, messages: [] };
    throw error;
  }
  return {
    persistence: "active" as const,
    messages: (data ?? []).map((row) => mapMessage(row)).reverse(),
  };
}

export async function getCopilotMessagesForTickers(tickers: string[], limit = 200) {
  const supabase = getServerSupabase();
  if (!supabase || tickers.length === 0) return [];
  const normalized = [...new Set(tickers.map((ticker) => ticker.toUpperCase()).filter(Boolean))];
  const { data, error } = await supabase
    .from("copilot_messages")
    .select("*")
    .overlaps("detected_tickers", normalized)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function saveCopilotFeedback(input: {
  messageId?: string | null;
  feedbackType: CopilotFeedbackType;
  ticker?: string | null;
  note?: string | null;
  rawPayload?: unknown;
}) {
  const supabase = getServerSupabase();
  if (!supabase) return { saved: 0, skipped: true };
  const { error } = await supabase.from("copilot_feedback").insert({
    message_id: input.messageId ?? null,
    feedback_type: input.feedbackType,
    ticker: input.ticker?.toUpperCase() ?? null,
    note: input.note ?? null,
    raw_payload: input.rawPayload ?? {},
  });
  if (error) {
    if (isMissingCopilotTable(error)) return { saved: 0, skipped: true };
    throw error;
  }
  return { saved: 1, skipped: false };
}

export async function getRecentCopilotFeedback(limit = 100) {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("copilot_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function getCopilotFeedbackForTickers(tickers: string[], limit = 200) {
  const supabase = getServerSupabase();
  if (!supabase || tickers.length === 0) return [];
  const normalized = [...new Set(tickers.map((ticker) => ticker.toUpperCase()).filter(Boolean))];
  const { data, error } = await supabase
    .from("copilot_feedback")
    .select("*")
    .in("ticker", normalized)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

async function selectByTickers(table: string, tickers: string[], limit = 80) {
  const supabase = getServerSupabase();
  if (!supabase || tickers.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .in("ticker", tickers)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

async function selectRecent(table: string, orderColumn = "created_at", limit = 60) {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function getCopilotRetrievalRows(tickers: string[]) {
  const normalized = [...new Set(tickers.map((ticker) => ticker.toUpperCase()).filter(Boolean))];
  const [
    rankingChanges,
    learningObservations,
    agentAlerts,
    caseStateSnapshots,
    signalOutcomes,
    signalOutcomesDetailed,
    providerCoverage,
    morningBriefs,
    overnightSummaries,
    recentMessages,
  ] = await Promise.all([
    selectByTickers("ranking_changes", normalized),
    selectByTickers("learning_observations", normalized, 120),
    selectByTickers("agent_alerts", normalized),
    selectByTickers("case_state_snapshots", normalized, 120),
    selectByTickers("signal_outcomes", normalized, 120),
    selectByTickers("signal_outcomes_detailed", normalized, 120),
    selectRecent("provider_coverage_snapshots", "observed_at", 40),
    selectRecent("morning_brief_payloads", "generated_at", 10),
    selectRecent("overnight_summaries", "generated_at", 10),
    getRecentCopilotMessages(10),
  ]);

  return {
    rankingChanges,
    learningObservations,
    agentAlerts,
    caseStateSnapshots,
    signalOutcomes,
    signalOutcomesDetailed,
    providerCoverage,
    morningBriefs,
    overnightSummaries,
    recentMessages: recentMessages.messages,
    persistence: recentMessages.persistence,
  };
}
