import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRecentCopilotMessages, saveCopilotMessage } from "@/lib/db/copilotRepository";
import { buildCopilotRetrieval } from "@/lib/intelligence/copilot/copilotRetrieval";

type FastSnapshotSetup = {
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
};

type CopilotRequest = {
  message?: string;
  quickPrompt?: string;
  fastMode?: boolean;
  terminalContext?: {
    selectedTicker?: string;
    fastSnapshot?: {
      focusTicker?: string;
      actionCount?: number;
      topSetups?: FastSnapshotSetup[];
      recentImportantCases?: FastSnapshotSetup[];
      latestChange?: string | null;
      providerStatus?: string | null;
    };
  };
};

type OpenAiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    param?: string;
  };
  message?: string;
};

const COPILOT_ROUTE_VERSION = "copilot-root-cause-20260519";

function timeoutAfter(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  try {
    return await Promise.race([promise, timeoutAfter(ms, label)]);
  } catch (error) {
    console.error("[RaketRadar Copilot] Context fetch failed", {
      label,
      message: error instanceof Error ? error.message : "Unknown context fetch error",
      stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

async function buildCopilotContext() {
  const [
    intelligenceRepository,
    morningWarRoom,
    autonomousDiscovery,
    liveMarketReactionProvider,
    agentRepository,
    runnerRepository,
    overnightSummary,
  ] = await Promise.all([
    import("@/lib/db/intelligenceRepository"),
    import("@/lib/intelligence/morningWarRoom"),
    import("@/lib/intelligence/autonomousDiscovery"),
    import("@/lib/providers/liveMarketReactionProvider"),
    import("@/lib/db/agentRepository"),
    import("@/lib/db/runnerRepository"),
    import("@/lib/intelligence/overnightSummary"),
  ]);

  const [warRoomInput, discovery, learning, debug, agentMemory, latestChanges, overnight] = await Promise.all([
    withTimeout(intelligenceRepository.getMorningWarRoomInput(), 8000, "Morning War Room input"),
    withTimeout(
      autonomousDiscovery.runAutonomousDiscoveryScan({ provider: liveMarketReactionProvider.yahooLiveMarketReactionProvider }),
      12000,
      "Autonomous Discovery"
    ),
    withTimeout(intelligenceRepository.getOutcomeLearningReport(), 8000, "Outcome Learning"),
    withTimeout(intelligenceRepository.getIntelligenceDebugSnapshot(), 8000, "Intelligence Debug"),
    withTimeout(agentRepository.getAgentMemorySnapshot(), 8000, "Agent Memory"),
    withTimeout(runnerRepository.getLatestRunChanges(), 8000, "Latest Runner Changes"),
    withTimeout(overnightSummary.generateOvernightSummary(), 10000, "Overnight Summary"),
  ]);

  const warRoom = warRoomInput ? morningWarRoom.buildMorningWarRoom(warRoomInput) : null;

  return {
    warRoom,
    autonomousDiscovery: discovery,
    outcomeLearning: learning,
    debug: debug
      ? {
          ...debug,
          rejected_signals: warRoom?.rejectedCandidates ?? [],
          latestWarRoom: warRoom,
        }
      : null,
    agentMemory,
    latestChanges,
    overnightSummary: overnight,
  };
}

async function readPortfolioHoldings(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return { userId: null, holdings: [], error: token ? "Supabase env saknas" : "Ingen auth-token" };

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const user = await supabase.auth.getUser(token);
  if (user.error || !user.data.user) return { userId: null, holdings: [], error: user.error?.message ?? "Ogiltig session" };

  const holdings = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("user_id", user.data.user.id)
    .order("ticker", { ascending: true });

  return {
    userId: user.data.user.id,
    holdings: holdings.data ?? [],
    error: holdings.error?.message ?? null,
  };
}

function buildSystemPrompt() {
  return [
    "Du ar RaketRadar Copilot, en skeptisk trading-assistent for svenska smabolag.",
    "Fokus: pre-open/intraday edge, continuation vs fade, portfoljrisk, do-not-chase-disciplin och ticker identity safety.",
    "Svara pa svenska. Kort, konkret, beslut forst. Default max 5 korta punkter eller fem korta rubriker.",
    "Vid case-fragor ska svaret alltid ha rubrikerna: Slutsats, Vad systemet vet, Vad systemet inte vet, Coverage/entity-status, Risk for falskt negativt, Nasta forbattrning.",
    "Om anvandaren namner en ticker maste du svara om just den tickern. Byt inte till annan ticker utan att forklara exakt varfor.",
    "Unknown ticker betyder coverage/entity gap. Unknown betyder inte rejected, irrelevant eller daligt case.",
    "Coverage gap kan vara suspicious unknown om repeated mentions, user feedback, peer momentum eller unresolved frequency ar hog.",
    "Sarskilj alltid: no signal, no data, weak signal, inferred signal, suspicious unknown, hidden runner candidate.",
    "Suspicious unknown ar aldrig en kop-signal. Det betyder coverage expansion och false-negative-risk.",
    "Om retrieval saknar data ska du saga att det ar saknad coverage, inte svag edge.",
    "Du far inte latsas ha orderbok/live-data som saknas.",
    "Ge inte tvarsakra koprekommendationer. Sag hellre 'ingen trade' eller 'bevaka' nar edge ar tunn.",
    "Rejected tickers far endast diskuteras som rejected/risk, aldrig som kop-case.",
    "Case med REJECTED state far aldrig rekommenderas eller uppgraderas.",
    "Var extra skeptisk mot parabolic moves och fake-spike-risk.",
    "Parabolic movers ar inte automatiskt ointressanta. De ska beskrivas som viktiga men farliga momentum-case: ingen chase, endast re-entry/pullback/ny trigger.",
    "Om anvandaren fragar om EPIS B-liknande case ska du saga att caset ar viktigt, redan langt ganget, inte chase, bevaka bara pullback som haller VWAP, ny volymvag, hogre botten, spread ok och risk for snabb rekyl.",
    "Var inte for defensiv: stark mover + continuation + RVOL kan vara hog risk men fortsatt intressant. Skriv 'inte chase, bevaka reclaim/pullback' hellre an generiskt 'undvik'.",
    "DEAD_BOUNCE ska bara behandlas som svagt nar continuation faktiskt kollapsar. Cooling/pullback med kvarvarande continuation ar fortfarande watch.",
    "Namn BIOX eller andra icke-svenska konflikter far inte rekommenderas som svenska smabolag.",
    "For KVIX-liknande fall: klassificera som unresolved entity / possible coverage gap om symbolen saknas i universe, feeds eller snapshots.",
    "Om retrieval innehaller suspiciousUnknown ska du beskriva unknown_score, false-negative-risk och vad som kravs for att verifiera caset.",
  ].join("\n");
}

function compactContext(context: unknown) {
  const json = JSON.stringify(context);
  return json.length > 28000 ? `${json.slice(0, 28000)}...TRUNCATED` : json;
}

function parseOpenAiError(text: string): { message: string; details: string; responseData: unknown } {
  try {
    const parsed = JSON.parse(text) as OpenAiErrorPayload;
    const message = parsed.error?.message ?? parsed.message ?? "OpenAI request failed";
    const details = [
      parsed.error?.type ? `type=${parsed.error.type}` : null,
      parsed.error?.code ? `code=${parsed.error.code}` : null,
      parsed.error?.param ? `param=${parsed.error.param}` : null,
      message,
    ]
      .filter(Boolean)
      .join(" | ");
    return { message, details, responseData: parsed };
  } catch {
    return {
      message: "OpenAI request failed",
      details: text.slice(0, 1600),
      responseData: text.slice(0, 1600),
    };
  }
}

function logOpenAiFailure(input: {
  status?: number;
  statusText?: string;
  model: string;
  hasApiKey: boolean;
  message: string;
  responseData?: unknown;
  error?: unknown;
}) {
  const error = input.error as { stack?: string; response?: { data?: unknown } } | undefined;
  console.error("[RaketRadar Copilot] OpenAI failure", {
    status: input.status ?? null,
    statusText: input.statusText ?? null,
    model: input.model,
    hasApiKey: input.hasApiKey,
    message: input.message,
    responseData: input.responseData ?? null,
    responseDataFromError: error?.response?.data ?? null,
    stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
  });
}

function averageEntityConfidence(entities: Array<{ confidence: number }>) {
  if (entities.length === 0) return null;
  return Math.round(entities.reduce((sum, entity) => sum + entity.confidence, 0) / entities.length);
}

function shouldUseFastMode(message: string, body: CopilotRequest) {
  if (!body.terminalContext?.fastSnapshot) return false;
  const upper = message.toUpperCase();
  const hasSnapshotTicker = [
    ...(body.terminalContext.fastSnapshot.topSetups ?? []),
    ...(body.terminalContext.fastSnapshot.recentImportantCases ?? []),
  ].some((setup) => upper.includes(setup.ticker.toUpperCase()));
  if (hasSnapshotTicker) return true;
  if (!body.fastMode) return false;
  return /fokusera|dagens plan|kopbar|chase|svagast|andrats|ändrats/i.test(message);
}

function buildFastAnswer(message: string, snapshot: NonNullable<NonNullable<CopilotRequest["terminalContext"]>["fastSnapshot"]>) {
  const upper = message.toUpperCase();
  const activeCases = snapshot.topSetups ?? [];
  const recentCases = snapshot.recentImportantCases ?? [];
  const mentionedActive = activeCases.find((setup) => upper.includes(setup.ticker.toUpperCase())) ?? null;
  const mentionedRecent = recentCases.find((setup) => upper.includes(setup.ticker.toUpperCase())) ?? null;
  const mentioned = mentionedActive ?? mentionedRecent ?? null;
  const focus = mentioned ?? activeCases[0] ?? null;
  const fromRecentOnly = Boolean(!mentionedActive && mentionedRecent);
  const parabolic = focus?.live && (focus.live.label === "PARABOLIC_RISK" || focus.live.fade >= 60);
  const tickerQuestion = Boolean(mentioned);
  const decision = !focus
    ? "Ingen ren trade. Bevaka tills live-data ger tydligare edge."
    : parabolic
      ? `${focus.ticker}: viktig mover, men inte chase. Re-entry only.`
      : `${focus.ticker}: ${focus.action}.`;
  if (tickerQuestion && focus) {
    return [
      `Bedömning: ${fromRecentOnly ? `${focus.ticker} var nyligen viktigt men ligger inte i senaste topp-listan. ` : ""}${decision}`,
      `Typ av move: ${focus.personality ?? focus.edge ?? "Momentum case"}`,
      `Varför nu: ${focus.whyNow ?? focus.why}`,
      `För: ${(focus.pros && focus.pros.length > 0 ? focus.pros : [`${focus.live?.rvol ?? "-"} RVOL`, `${focus.live?.continuation ?? "-"}% continuation`]).join(", ")}`,
      `Emot: ${(focus.cons && focus.cons.length > 0 ? focus.cons : [focus.risk ? `${focus.risk} risk` : "begransad catalystbekraftelse"]).join(", ")}`,
      `Trigger: ${focus.trigger ?? (parabolic ? "pullback haller VWAP + ny volymvag" : "haller VWAP/forsta pullback")}`,
      `Invalidation: ${focus.invalidation ?? "tappar VWAP eller volymen dor"}`,
      `Starkare/svagare: ${focus.strongerIf ?? "ny volymbekraftelse"} / ${focus.weakerIf ?? "volymen dor"}`,
    ].join("\n");
  }

  return [
    `Beslut: ${decision}`,
    `Varfor: ${focus ? `${focus.why} Score ${focus.score}, confidence ${focus.confidence}.` : `Datakvalitet/provider: ${snapshot.providerStatus ?? "okand"}.`}`,
    `Trigger: ${parabolic ? "Pullback haller VWAP, ny volymvag, hogre botten och spread ok." : focus?.live ? `RVOL ${focus.live.rvol}, continuation ${focus.live.continuation}%, move ${focus.live.move}%.` : "Vanta pa volym- och prisbekraftelse."}`,
    `Risk: ${focus?.live ? `Fade-risk ${focus.live.fade}%. ${parabolic ? "Hog risk for snabb rekyl." : "Ingen chase utan confirmation."}` : "Otillracklig live-context for aggressivt beslut."}`,
    `Invalidation: ${focus?.invalidation ?? "Tappar VWAP/forsta pullback eller provider-data blir stale."}`,
  ].join("\n");
}

function fallbackRetrievalAnswer(input: {
  userMessage: string;
  retrieval: Awaited<ReturnType<typeof buildCopilotRetrieval>>;
  contextError?: string | null;
  openAiError?: string | null;
}) {
  const entities = input.retrieval.entities ?? [];
  const entityLine = entities.length > 0
    ? entities.map((entity) => `${entity.normalizedTicker}: ${entity.status}, confidence ${entity.confidence}`).join("; ")
    : "Ingen tydlig ticker/entity hittades.";
  const warnings = [
    input.contextError ? `Terminal-context fel: ${input.contextError}` : null,
    input.openAiError ? `OpenAI fel: ${input.openAiError}` : null,
  ].filter(Boolean);
  return [
    "Slutsats",
    "Copilot kör retrieval-only fallback just nu. Jag kan visa vad systemet vet, men inte göra LLM-resonemang förrän OpenAI/context-steget fungerar.",
    "",
    "Vad systemet vet",
    entityLine,
    input.retrieval.contextSummary ? JSON.stringify(input.retrieval.contextSummary).slice(0, 800) : "Ingen context summary.",
    "",
    "Vad systemet inte vet",
    warnings.length > 0 ? warnings.join(" | ") : "Inga extra fel rapporterade.",
    "",
    "Coverage/entity-status",
    entityLine,
    "",
    "Risk för falskt negativt",
    "Om coverage saknas eller retrieval är ofullständig ska caset behandlas som coverage gap, inte som svagt case.",
    "",
    "Nästa förbättring",
    "Retry Copilot efter att provider/context-felet är löst. Terminalens Action Board och Autonomous Discovery fortsätter vara primära.",
  ].join("\n");
}

async function safeSaveCopilotMessage(input: Parameters<typeof saveCopilotMessage>[0], stage: string) {
  try {
    const result = await saveCopilotMessage(input);
    if (result.skipped || !result.id) {
      console.error("[RaketRadar Copilot] message persistence skipped", {
        stage,
        saved: result.saved,
        skipped: result.skipped,
        id: result.id,
        payloadKeys: Object.keys(input),
        role: input.role,
        source: input.source,
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      });
    }
    return result;
  } catch (error) {
    console.error("[RaketRadar Copilot] message persistence failed", {
      stage,
      message: error instanceof Error ? error.message : "Unknown persistence error",
      stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
    });
    return { saved: 0, skipped: false, id: null, error: error instanceof Error ? error.message : "Unknown persistence error" };
  }
}

export async function POST(request: Request) {
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  let body: CopilotRequest;
  try {
    body = (await request.json().catch(() => ({}))) as CopilotRequest;
  } catch (error) {
    console.error("[RaketRadar Copilot] request parse failed", error);
    return NextResponse.json({ error: "Ogiltig request", details: "Kunde inte lasa JSON-body", model }, { status: 400 });
  }
  const userMessage = body.message?.trim() || body.quickPrompt?.trim();
  if (!userMessage) {
    return NextResponse.json({ error: "Tom fraga" }, { status: 400 });
  }

  const userSave = await safeSaveCopilotMessage({
    role: "user",
    message: userMessage,
    normalizedQuery: userMessage.toLowerCase(),
    detectedTickers: [],
    resolvedEntities: [],
    contextPayload: { stage: "pre_retrieval" },
    confidence: null,
    source: "terminal",
  }, "save_user_message_pre_retrieval");

  if (shouldUseFastMode(userMessage, body)) {
    const fastAnswer = buildFastAnswer(userMessage, body.terminalContext?.fastSnapshot ?? {});
    const savedFast = await safeSaveCopilotMessage({
      role: "assistant",
      message: fastAnswer,
      normalizedQuery: userMessage.toLowerCase(),
      detectedTickers: [],
      resolvedEntities: [],
      contextPayload: { mode: "fast_terminal_snapshot", snapshot: body.terminalContext?.fastSnapshot ?? {} },
      confidence: null,
      source: "copilot",
    }, "save_fast_mode_answer");
    return NextResponse.json({
      answer: fastAnswer,
      routeVersion: COPILOT_ROUTE_VERSION,
      mode: "fast_terminal_snapshot",
      messageId: savedFast.id,
      persistenceDebug: { userSave, assistantSave: savedFast },
      detectedEntities: [],
      contextSummary: { fastMode: true, providerStatus: body.terminalContext?.fastSnapshot?.providerStatus ?? null },
    });
  }

  let retrieval: Awaited<ReturnType<typeof buildCopilotRetrieval>>;
  try {
    retrieval = await buildCopilotRetrieval({
      query: userMessage,
      selectedTicker: body.terminalContext?.selectedTicker,
    });
  } catch (error) {
    console.error("[RaketRadar Copilot] entity/retrieval failed", {
      message: error instanceof Error ? error.message : "Unknown retrieval error",
      stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
    });
    retrieval = ({
      normalizedQuery: userMessage.toLowerCase(),
      detectedTickers: [],
      entities: [],
      contextPayload: { retrievalError: error instanceof Error ? error.message : "Unknown retrieval error" },
      contextSummary: { error: "retrieval_failed" },
    } as unknown) as Awaited<ReturnType<typeof buildCopilotRetrieval>>;
  }

  const [terminalContextResult, portfolioResult] = await Promise.allSettled([
    buildCopilotContext(),
    readPortfolioHoldings(request),
  ]);
  const terminalContext = terminalContextResult.status === "fulfilled"
    ? terminalContextResult.value
    : {
        warRoom: null,
        autonomousDiscovery: null,
        outcomeLearning: null,
        debug: null,
        agentMemory: null,
        latestChanges: null,
        overnightSummary: null,
      };
  const contextError = terminalContextResult.status === "rejected"
    ? terminalContextResult.reason instanceof Error ? terminalContextResult.reason.message : "Unknown terminal context error"
    : null;
  if (contextError) {
    console.error("[RaketRadar Copilot] terminal context failed", {
      message: contextError,
      stack: terminalContextResult.status === "rejected" && process.env.NODE_ENV === "development" && terminalContextResult.reason instanceof Error ? terminalContextResult.reason.stack : undefined,
    });
  }
  const portfolio = portfolioResult.status === "fulfilled"
    ? portfolioResult.value
    : { userId: null, holdings: [], error: portfolioResult.reason instanceof Error ? portfolioResult.reason.message : "Portfolio context failed" };

  const context = {
    selectedTicker: body.terminalContext?.selectedTicker ?? null,
    retrieval: retrieval.contextPayload,
    ...terminalContext,
    portfolio,
    dataSourceWarnings: {
      portfolioAuth: portfolio.error,
      openAiModel: model,
    },
  };

  if (!hasApiKey) {
    const noKeyMessage = fallbackRetrievalAnswer({ userMessage, retrieval, contextError, openAiError: "OpenAI API key saknas" });
    const savedFallback = await safeSaveCopilotMessage({
      role: "assistant",
      message: noKeyMessage,
      normalizedQuery: retrieval.normalizedQuery,
      detectedTickers: retrieval.detectedTickers,
      resolvedEntities: retrieval.entities,
      contextPayload: retrieval.contextPayload,
      confidence: null,
      source: "copilot",
    }, "save_missing_key_fallback");
    return NextResponse.json(
      {
        answer: noKeyMessage,
        warning: "OpenAI API key saknas",
        details: "Lagg OPENAI_API_KEY i .env.local for att aktivera full Copilot. Retrieval-only fallback returnerades.",
        model,
        routeVersion: COPILOT_ROUTE_VERSION,
        messageId: savedFallback.id,
        persistenceDebug: { userSave, assistantSave: savedFallback },
        detectedEntities: retrieval.entities,
        contextSummary: retrieval.contextSummary,
      },
      { status: 200 }
    );
  }

  let response: Response;
  try {
    response = await Promise.race([
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.15,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            {
              role: "user",
              content: `Structured retrieval + terminal-context JSON:\n${compactContext(context)}\n\nFraga:\n${userMessage}`,
            },
          ],
        }),
      }),
      timeoutAfter(25000, "OpenAI request"),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI network request failed";
    logOpenAiFailure({ model, hasApiKey, message, error });
    const fallback = fallbackRetrievalAnswer({ userMessage, retrieval, contextError, openAiError: message });
    const savedFallback = await safeSaveCopilotMessage({
      role: "assistant",
      message: fallback,
      normalizedQuery: retrieval.normalizedQuery,
      detectedTickers: retrieval.detectedTickers,
      resolvedEntities: retrieval.entities,
      contextPayload: retrieval.contextPayload,
      confidence: null,
      source: "copilot",
    }, "save_openai_network_fallback");
    return NextResponse.json(
      {
        answer: fallback,
        warning: "OpenAI network request failed",
        details: message,
        model,
        routeVersion: COPILOT_ROUTE_VERSION,
        messageId: savedFallback.id,
        persistenceDebug: { userSave, assistantSave: savedFallback },
        detectedEntities: retrieval.entities,
        contextSummary: retrieval.contextSummary,
      },
      { status: 200 }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    const parsed = parseOpenAiError(errorText);
    logOpenAiFailure({
      status: response.status,
      statusText: response.statusText,
      model,
      hasApiKey,
      message: parsed.message,
      responseData: parsed.responseData,
    });
    const fallback = fallbackRetrievalAnswer({ userMessage, retrieval, contextError, openAiError: parsed.details });
    const savedFallback = await safeSaveCopilotMessage({
      role: "assistant",
      message: fallback,
      normalizedQuery: retrieval.normalizedQuery,
      detectedTickers: retrieval.detectedTickers,
      resolvedEntities: retrieval.entities,
      contextPayload: retrieval.contextPayload,
      confidence: null,
      source: "copilot",
    }, "save_openai_error_fallback");
    return NextResponse.json(
      {
        answer: fallback,
        warning: parsed.message,
        details: parsed.details,
        model,
        routeVersion: COPILOT_ROUTE_VERSION,
        messageId: savedFallback.id,
        persistenceDebug: { userSave, assistantSave: savedFallback },
        detectedEntities: retrieval.entities,
        contextSummary: retrieval.contextSummary,
      },
      { status: 200 }
    );
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = payload.choices?.[0]?.message?.content ?? "Copilot kunde inte skapa ett svar.";
  const savedAnswer = await safeSaveCopilotMessage({
    role: "assistant",
    message: answer,
    normalizedQuery: retrieval.normalizedQuery,
    detectedTickers: retrieval.detectedTickers,
    resolvedEntities: retrieval.entities,
    contextPayload: retrieval.contextPayload,
    confidence: averageEntityConfidence(retrieval.entities),
    source: "copilot",
  }, "save_assistant_message");

  return NextResponse.json({
    answer,
    routeVersion: COPILOT_ROUTE_VERSION,
    messageId: savedAnswer.id,
    persistenceDebug: { userSave, assistantSave: savedAnswer },
    detectedEntities: retrieval.entities,
    contextSummary: {
      ...retrieval.contextSummary,
      hasWarRoom: Boolean(terminalContext.warRoom),
      hasDiscovery: Boolean(terminalContext.autonomousDiscovery),
      hasLearning: Boolean(terminalContext.outcomeLearning),
      portfolioHoldings: portfolio.holdings.length,
      portfolioError: portfolio.error,
    },
  });
}

export async function GET() {
  return NextResponse.json(await getRecentCopilotMessages(10));
}
