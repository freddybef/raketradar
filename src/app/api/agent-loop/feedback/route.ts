import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveAgentFeedback, type AgentFeedbackType } from "@/lib/db/agentRepository";

const FEEDBACK_TYPES = new Set<AgentFeedbackType>([
  "GOOD_CALL",
  "BAD_CALL",
  "MISSED_MOVER",
  "TOO_AGGRESSIVE",
  "TOO_DEFENSIVE",
  "RANK_HIGHER",
  "RANK_LOWER",
]);

async function getUserId(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return null;
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Logga in for att spara agent-feedback" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ticker?: string;
    feedbackType?: AgentFeedbackType;
    note?: string;
    rawPayload?: unknown;
  };
  const ticker = body.ticker?.trim().toUpperCase();
  if (!ticker || !body.feedbackType || !FEEDBACK_TYPES.has(body.feedbackType)) {
    return NextResponse.json({ error: "Ogiltig feedback payload" }, { status: 400 });
  }

  const result = await saveAgentFeedback({
    userId,
    ticker,
    feedbackType: body.feedbackType,
    note: body.note,
    rawPayload: body.rawPayload,
  });

  return NextResponse.json({ ok: true, ...result });
}
