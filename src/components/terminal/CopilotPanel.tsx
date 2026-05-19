"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import { FeedbackButtons } from "@/components/terminal/FeedbackButtons";
import { EmptyTerminalState, SignalPill, TerminalPanel } from "@/components/terminal/TerminalPanel";

type EntityStatus = "resolved" | "unresolved" | "ambiguous" | "coverage_gap";

interface CopilotEntity {
  normalizedTicker: string;
  status: EntityStatus;
  confidence: number;
  displayTicker?: string;
  evidence: string[];
  guardrails: string[];
  coverageGap: boolean;
  rejectedState: boolean;
  recommendationAllowed: boolean;
}

interface CopilotHistoryMessage {
  id: string;
  createdAt: string;
  role: "user" | "assistant" | "system";
  message: string;
  detectedTickers: string[];
  resolvedEntities: CopilotEntity[];
}

interface CopilotFastSetup {
  ticker: string;
  action: string;
  edge?: string;
  interpretationType?: string;
  personality?: string;
  score: number;
  confidence: number;
  why: string;
  whyNow?: string;
  pros?: string[];
  cons?: string[];
  trigger?: string;
  invalidation?: string;
  strongerIf?: string;
  weakerIf?: string;
  risk?: string;
  live?: {
    move: number;
    rvol: number;
    continuation: number;
    fade: number;
    label: string;
  };
}

const QUICK_PROMPTS = [
  "Vad ska jag fokusera pa just nu?",
  "Vilka innehav ser svagast ut?",
  "Ar EPIS B kopbar eller chase?",
  "Vad ska jag absolut undvika idag?",
  "Vilka movers missar systemet?",
  "Sammanfatta morgonlaget",
  "Vad ar dagens plan?",
];

const ENTITY_PROMPTS = [
  "Kunde vi ha hittat KVIX innan uppgangen?",
  "Varfor svarade du om BERGMAN nar jag fragade om KVIX?",
  "Ar KVIX ett coverage gap eller ett daligt case?",
  "Vad vet du om MOFAST?",
  "Vilka case har lag confidence pga dalig coverage?",
];

const AGENT_PROMPTS = ["Vad har andrats?"];
const AUTONOMY_PROMPTS = [
  "Vad hande medan jag var borta?",
  "Vad larde sig systemet i natt?",
  "Vilka providers saknade tackning?",
  "Vad bor jag titta pa vid oppning?",
];

const FEEDBACK = [
  ["WRONG_TICKER", "Wrong ticker"],
  ["MISSING_TICKER", "Missing ticker"],
  ["BAD_REASONING", "Bad reasoning"],
  ["USEFUL", "Useful"],
] as const;

export interface CopilotFastContext {
  focusTicker: string;
  actionCount: number;
  topSetups: CopilotFastSetup[];
  recentImportantCases?: CopilotFastSetup[];
  latestChange?: string | null;
  providerStatus?: string | null;
}

const FAST_PROMPTS = new Set([
  "Vad ska jag fokusera pa just nu?",
  "Vad ar dagens plan?",
  "Ar EPIS B kopbar eller chase?",
  "Vilka innehav ser svagast ut?",
  "Vad har andrats?",
]);

function mentionsSnapshotTicker(prompt: string, fastContext?: CopilotFastContext) {
  const upper = prompt.toUpperCase();
  return Boolean([...(fastContext?.topSetups ?? []), ...(fastContext?.recentImportantCases ?? [])].some((setup) => upper.includes(setup.ticker.toUpperCase())));
}

export function CopilotPanel({ selectedTicker, fastContext }: { selectedTicker?: string | null; fastContext?: CopilotFastContext }) {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [entities, setEntities] = useState<CopilotEntity[]>([]);
  const [history, setHistory] = useState<CopilotHistoryMessage[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadHistory() {
    const response = await fetch("/api/copilot", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { messages?: CopilotHistoryMessage[] };
    setHistory(payload.messages ?? []);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  async function askCopilot(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setAnswer(null);
    setMessageId(null);
    setEntities([]);

    const session = await getSession();
    const token = session.data.session?.access_token;
    const response = await fetch("/api/copilot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: trimmed,
        fastMode: FAST_PROMPTS.has(trimmed) || mentionsSnapshotTicker(trimmed, fastContext),
        terminalContext: { selectedTicker, fastSnapshot: fastContext },
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      answer?: string;
      warning?: string;
      error?: string;
      message?: string;
      detail?: string;
      details?: string;
      model?: string;
      messageId?: string | null;
      detectedEntities?: CopilotEntity[];
    };
    setIsLoading(false);
    setEntities(payload.detectedEntities ?? []);

    if (!response.ok) {
      const headline = payload.error ?? payload.message ?? `Copilot fel ${response.status}`;
      const details = payload.details ?? payload.detail;
      const model = payload.model ? `Model: ${payload.model}` : null;
      setError([headline, details, model].filter(Boolean).join("\n"));
      await loadHistory();
      return;
    }

    setAnswer(payload.answer ?? "Copilot returnerade inget svar.");
    setError(payload.warning ? `Copilot tillfalligt fel\n${payload.warning}${payload.details ? `\n${payload.details}` : ""}` : null);
    setMessageId(payload.messageId ?? null);
    setMessage("");
    await loadHistory();
  }

  async function submitCopilotFeedback(feedbackType: (typeof FEEDBACK)[number][0]) {
    setFeedbackStatus("Sparar Copilot-feedback...");
    const response = await fetch("/api/copilot/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId,
        feedbackType,
        ticker: entities[0]?.normalizedTicker ?? selectedTicker ?? null,
        rawPayload: { selectedTicker, entities, answer },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; saved?: number };
    setFeedbackStatus(response.ok ? "Copilot-feedback sparad." : payload.error ?? `Feedback fel ${response.status}`);
  }

  return (
    <TerminalPanel title="RaketRadar Copilot" eyebrow="AI decision support" action={<SignalPill tone={error ? "warn" : "neutral"}>{isLoading ? "tanker" : "redo"}</SignalPill>}>
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          {[...QUICK_PROMPTS, ...ENTITY_PROMPTS, ...AGENT_PROMPTS, ...AUTONOMY_PROMPTS].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void askCopilot(prompt)}
              className="border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-300 hover:border-emerald-500/40"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_8rem]">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Fraga: vad ska jag gora, undvika eller bevaka?"
            className="min-h-20 border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
          />
          <button
            type="button"
            onClick={() => void askCopilot(message)}
            disabled={isLoading || message.trim().length === 0}
            className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 disabled:opacity-40"
          >
            Fraga
          </button>
        </div>

        {entities.length > 0 ? <EntityStatusStrip entities={entities} /> : null}
        {isLoading && <EmptyTerminalState title="Copilot analyserar" body="Snabba fragor besvaras fran senaste terminalsnapshot. Djupare fragor kan ta langre tid." />}
        {error && (
          <div className="border border-yellow-500/30 bg-yellow-950/10 p-3">
            <EmptyTerminalState title="Copilot tillfalligt fel" body={error} />
            <button
              type="button"
              onClick={() => void askCopilot(message || QUICK_PROMPTS[0])}
              className="mt-2 border border-yellow-500/40 px-3 py-2 text-xs text-yellow-100"
            >
              Forsok igen
            </button>
          </div>
        )}
        {answer && (
          <div className="whitespace-pre-wrap border border-zinc-800 bg-black/30 p-4 text-sm leading-6 text-zinc-200">
            {answer}
          </div>
        )}
        {(answer || error) && (
          <div className="border border-zinc-800 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Copilot feedback</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void submitCopilotFeedback(value)}
                  className="border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-emerald-500/50"
                >
                  {label}
                </button>
              ))}
            </div>
            {feedbackStatus && <p className="mt-2 text-xs text-zinc-500">{feedbackStatus}</p>}
          </div>
        )}
        {answer && <FeedbackButtons ticker={selectedTicker ?? entities[0]?.normalizedTicker ?? "COPILOT"} rawPayload={{ selectedTicker, answer, entities }} />}
        <details className="border border-zinc-800 bg-zinc-950 p-3">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-zinc-500">Senaste Copilot-historik</summary>
          <div className="mt-3">
            <CopilotHistory history={history} />
          </div>
        </details>
      </div>
    </TerminalPanel>
  );
}

function EntityStatusStrip({ entities }: { entities: CopilotEntity[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {entities.map((entity) => (
        <div key={`${entity.normalizedTicker}-${entity.status}`} className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm text-zinc-100">{entity.displayTicker ?? entity.normalizedTicker}</p>
            <SignalPill tone={entity.status === "resolved" && entity.recommendationAllowed ? "good" : entity.status === "coverage_gap" ? "warn" : "neutral"}>
              {entity.status}
            </SignalPill>
          </div>
          <p className="mt-1 text-xs text-zinc-500">confidence {entity.confidence} / coverage gap {entity.coverageGap ? "yes" : "no"}</p>
          {entity.guardrails.length ? <p className="mt-1 text-xs text-yellow-300">{entity.guardrails.join(" / ")}</p> : null}
        </div>
      ))}
    </div>
  );
}

function CopilotHistory({ history }: { history: CopilotHistoryMessage[] }) {
  if (history.length === 0) {
    return <EmptyTerminalState title="Ingen Copilot-historik" body="Fragor och svar sparas nar copilot_messages-tabellen finns i Supabase." />;
  }
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Senaste Copilot-historik</p>
      <div className="mt-2 grid gap-2">
        {history.slice(-10).map((item) => (
          <div key={item.id} className="border border-zinc-900 bg-black/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase text-zinc-500">{item.role}</p>
              <p className="font-mono text-[11px] text-zinc-600">{new Date(item.createdAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-300">{item.message}</p>
            {item.detectedTickers.length ? <p className="mt-1 font-mono text-[11px] text-emerald-300">{item.detectedTickers.join(", ")}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
