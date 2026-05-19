"use client";

import { useState } from "react";
import { getSession } from "@/lib/auth";

const OPTIONS = [
  ["GOOD_CALL", "Bra call"],
  ["BAD_CALL", "Dåligt call"],
  ["MISSED_MOVER", "Missad mover"],
  ["TOO_AGGRESSIVE", "För aggressiv"],
  ["TOO_DEFENSIVE", "För defensiv"],
  ["RANK_HIGHER", "Borde rankas högre"],
  ["RANK_LOWER", "Borde rankas lägre"],
] as const;

export function FeedbackButtons({ ticker, rawPayload }: { ticker: string; rawPayload?: unknown }) {
  const [status, setStatus] = useState<string | null>(null);

  async function submit(feedbackType: (typeof OPTIONS)[number][0]) {
    setStatus("Sparar feedback...");
    const session = await getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setStatus("Logga in för att spara feedback.");
      return;
    }

    const response = await fetch("/api/agent-loop/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ticker, feedbackType, rawPayload }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; saved?: number };
    setStatus(response.ok ? "Feedback sparad." : payload.error ?? `Feedback fel ${response.status}`);
  }

  return (
    <div className="border border-zinc-800 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Feedback loop</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => void submit(value)}
            className="border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-emerald-500/50"
          >
            {label}
          </button>
        ))}
      </div>
      {status && <p className="mt-2 text-xs text-zinc-500">{status}</p>}
    </div>
  );
}
