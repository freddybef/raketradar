import { NextResponse } from "next/server";
import { saveCopilotFeedback, type CopilotFeedbackType } from "@/lib/db/copilotRepository";

const ALLOWED = new Set<CopilotFeedbackType>(["WRONG_TICKER", "MISSING_TICKER", "BAD_REASONING", "USEFUL"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    messageId?: string | null;
    feedbackType?: CopilotFeedbackType;
    ticker?: string | null;
    note?: string | null;
    rawPayload?: unknown;
  };
  if (!body.feedbackType || !ALLOWED.has(body.feedbackType)) {
    return NextResponse.json({ error: "Ogiltig Copilot-feedback" }, { status: 400 });
  }
  const saved = await saveCopilotFeedback({
    messageId: body.messageId,
    feedbackType: body.feedbackType,
    ticker: body.ticker,
    note: body.note,
    rawPayload: body.rawPayload,
  });
  return NextResponse.json(saved);
}
