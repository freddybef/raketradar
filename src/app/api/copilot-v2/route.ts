import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TradingCandidate {
  ticker: string;
  company?: string;
  action: string;
  setupType: string;
  thesis: string;
  pros: string[];
  cons: string[];
  trigger: string;
  invalidation: string;
  continuation?: number;
  risk?: number;
  rvol?: number;
  movePct?: number;
  whyNow?: string;
  needsNow?: string;
  personality?: string;
  catalystType?: string;
  catalystScore?: number;
  catalystSummary?: string;
  sourceBucket?: string;
  freshnessStatus?: string;
  dataAgeMinutes?: number;
  isActiveToday?: boolean;
  firstSeenAt?: string | null;
  lastConfirmedAt?: string | null;
  freshnessMinutes?: number;
  momentumAge?: number;
  confirmationCount?: number;
  lastExpansionAt?: string | null;
  decayScore?: number;
  staleReason?: string | null;
  signalQuality?: string;
  narrativeTriggerType?: string;
  narrativeStrength?: number;
  narrativeFreshness?: number;
  thematicTailwind?: number;
  repricingProbability?: number;
  marketAttentionShift?: number;
  hasFreshFundamentalCatalyst?: boolean;
}

interface CanonicalTradingSnapshot {
  timestamp: string;
  snapshotDate?: string;
  marketSessionDate?: string;
  generatedAt?: string;
  dataAgeMinutes?: number;
  isFreshForToday?: boolean;
  marketSessionPhase?: string;
  providerStatus: {
    status?: string;
    scanned: number;
    liveHits: number;
    coveragePercent?: number;
  };
  marketQuality: {
    label: string;
  };
  newsProviderStatus?: {
    providerName: string;
    mode: "mock" | "manual" | "rss" | "api" | "disabled";
    isLive: boolean;
    isConfigured: boolean;
    lastFetchAt: string;
    error: string | null;
    headlineCount: number;
  };
  candidates: TradingCandidate[];
  topFocus: TradingCandidate[];
  portfolioDecisions?: Array<{ ticker: string; decision: string; reason: string; risk?: string }>;
  warnings?: string[];
  marketPulse?: { label: string; summary: string; drivers: string[] };
  catalystPulse?: {
    narrative: string;
    dominantTypes: Array<{ type: string; count: number; score: number }>;
    cases: Array<{ ticker: string; catalystType: string; summary: string; score: number }>;
  };
  whatChanged?: Array<{ ticker: string; changeType: string; reason: string }>;
  trackedUniverse?: TrackedTicker[];
  positionManagement?: PositionManagementDecision[];
  priorityBoard?: PriorityItem[];
  newsTriggers?: NewsTrigger[];
  earlyRadar?: EarlyRadarItem[];
  breadth?: {
    hot?: TradingCandidate[];
    watch?: TradingCandidate[];
    stealth?: TradingCandidate[];
    noChase?: TradingCandidate[];
    recentlyActive?: TradingCandidate[];
  };
}

interface TrackedTicker {
  ticker: string;
  company?: string;
  status: "activeCandidate" | "trackedButNotActive" | "recentlyActive" | "unknown";
  source: string;
  summary: string;
  lastKnownState?: string | null;
  lastKnownScore?: number | null;
  lastKnownConfidence?: number | null;
  candidate?: TradingCandidate;
}

interface PositionManagementDecision {
  ticker: string;
  company?: string;
  state: string;
  decisionLabel?: string;
  decision: string;
  reason?: string;
  why: string;
  trigger: string;
  invalidation: string;
  risk?: number;
  whatChanged: string;
  confidenceTrend: string;
  confidence: number;
  sourceStatus?: string;
  suggestedAction?: string;
  source: string;
}

interface PriorityItem {
  ticker: string;
  company?: string;
  priorityState: "MUST_ACT" | "WATCH_CLOSELY" | "REENTRY_WATCH" | "LOW_PRIORITY" | "DEAD" | "AVOID";
  headline: string;
  whyNow: string;
  action: string;
  urgencyScore: number;
  confidence: number;
  sourceStatus: string;
  freshnessStatus?: string;
  signalQuality?: string;
  narrativeTriggerType?: string;
  narrativeStrength?: number;
  freshnessMinutes?: number;
  lastConfirmedAt?: string | null;
  changedFrom?: string | null;
  changedAt?: string | null;
  expiresSoon: boolean;
}

interface NewsTrigger {
  id: string;
  ticker: string | null;
  company: string | null;
  headline: string;
  source: string;
  publishedAt: string;
  triggerType: string;
  triggerStrength: number;
  narrativeTriggerType: string;
  thematicTags: string[];
  isFreshToday: boolean;
  marketCapSensitivity: number;
  secondDerivativeScore: number;
  repricingPotential: number;
  summary: string;
}

interface EarlyRadarItem {
  ticker: string;
  company?: string | null;
  rank: number;
  radarReason: string;
  preOpenTrigger: string;
  narrativeTriggerType: string;
  triggerStrength: number;
  marketCapSensitivity: number;
  secondDerivativeScore: number;
  watchBeforeOpen: boolean;
  confirmationNeeded: string;
  invalidation: string;
  priorityScore: number;
  source: string;
  status: string;
}

const COPILOT_V2_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = 12_000;

function timeoutAfter(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
}

function snapshotCandidates(snapshot: CanonicalTradingSnapshot) {
  const seen = new Set<string>();
  return [
    ...snapshot.candidates,
    ...Object.values(snapshot.breadth ?? {}).flatMap((items) => items ?? []),
  ].filter((candidate) => {
    if (seen.has(candidate.ticker)) return false;
    seen.add(candidate.ticker);
    return true;
  });
}

function normalizeTicker(value: string) {
  return value.toUpperCase().replace(/\.(ST|SS)$/i, "").replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeEntity(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(ab|publ|group|medical|tech|technologies|holding|holdings|international|sweden|nordic|b|a)\b/g, " ")
    .replace(/[^a-z0-9åäö ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesFor(candidate: TradingCandidate) {
  const ticker = normalizeEntity(candidate.ticker);
  const compactTicker = ticker.replace(/\s+/g, "");
  const company = normalizeEntity(candidate.company ?? "");
  const aliases = new Set([ticker, compactTicker, company]);
  if (candidate.ticker === "EPIS B" || /episurf/.test(company)) {
    aliases.add("episurf");
    aliases.add("epis");
    aliases.add("episurf medical");
  }
  if (candidate.ticker === "SBB B") {
    aliases.add("sbb");
    aliases.add("samhallsbyggnadsbolaget");
    aliases.add("samhällsbyggnadsbolaget");
  }
  if (candidate.ticker === "NEXAM" || /nexam/.test(company)) aliases.add("nexam");
  if (candidate.ticker === "SHT" || /sht/.test(company)) aliases.add("sht");
  return [...aliases].filter(Boolean);
}

function aliasesForTracked(item: TrackedTicker) {
  return aliasesFor({
    ticker: item.ticker,
    company: item.company,
    action: "Bevaka",
    setupType: "Tracked",
    thesis: item.summary,
    pros: [],
    cons: [],
    trigger: "",
    invalidation: "",
  });
}

function mentionedTicker(message: string, snapshot: CanonicalTradingSnapshot) {
  const normalizedMessage = ` ${normalizeTicker(message)} `;
  const direct = snapshotCandidates(snapshot).find((candidate) => {
    const ticker = normalizeTicker(candidate.ticker);
    const compact = ticker.replace(/\s+/g, "");
    return normalizedMessage.includes(` ${ticker} `) || normalizedMessage.includes(` ${compact} `);
  });
  if (direct) return { candidate: direct, assumed: false, query: direct.ticker };

  const normalizedEntity = normalizeEntity(message);
  const scored = snapshotCandidates(snapshot)
    .map((candidate) => {
      const aliases = aliasesFor(candidate);
      const matchedAlias = aliases.find((alias) => alias && (normalizedEntity.includes(alias) || alias.includes(normalizedEntity)));
      if (matchedAlias) {
        const exact = normalizedEntity.includes(matchedAlias) ? 100 : 82;
        return { candidate, score: exact, alias: matchedAlias };
      }
      const words = normalizedEntity.split(" ").filter((word) => word.length >= 3);
      const fuzzyScore = aliases.reduce((score, alias) => {
        const overlap = words.filter((word) => alias.includes(word) || word.includes(alias)).length;
        return Math.max(score, overlap * 28);
      }, 0);
      return { candidate, score: fuzzyScore, alias: aliases[0] ?? candidate.ticker };
    })
    .filter((item) => item.score >= 56)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best ? { candidate: best.candidate, assumed: true, query: best.alias } : null;
}

function mentionedTracked(message: string, snapshot: CanonicalTradingSnapshot) {
  const normalizedMessage = ` ${normalizeTicker(message)} `;
  const normalizedEntity = normalizeEntity(message);
  const tracked = snapshot.trackedUniverse ?? [];
  const direct = tracked.find((item) => {
    const ticker = normalizeTicker(item.ticker);
    const compact = ticker.replace(/\s+/g, "");
    return normalizedMessage.includes(` ${ticker} `) || normalizedMessage.includes(` ${compact} `);
  });
  if (direct) return { item: direct, assumed: false };
  const scored = tracked
    .map((item) => {
      const matchedAlias = aliasesForTracked(item).find((alias) => alias && normalizedEntity.includes(alias));
      return { item, score: matchedAlias ? 100 : 0 };
    })
    .filter((entry) => entry.score >= 80)
    .sort((a, b) => b.score - a.score);
  return scored[0] ? { item: scored[0].item, assumed: true } : null;
}

function mentionedCandidates(message: string, snapshot: CanonicalTradingSnapshot) {
  const normalizedMessage = ` ${normalizeTicker(message)} `;
  const normalizedEntity = normalizeEntity(message);
  const matches = snapshotCandidates(snapshot).filter((candidate) => {
    const ticker = normalizeTicker(candidate.ticker);
    const compact = ticker.replace(/\s+/g, "");
    if (normalizedMessage.includes(` ${ticker} `) || normalizedMessage.includes(` ${compact} `)) return true;
    return aliasesFor(candidate).some((alias) => alias.length >= 3 && normalizedEntity.includes(alias));
  });
  return [...new Map(matches.map((candidate) => [candidate.ticker, candidate])).values()];
}

function mentionedTrackedItems(message: string, snapshot: CanonicalTradingSnapshot) {
  const normalizedMessage = ` ${normalizeTicker(message)} `;
  const normalizedEntity = normalizeEntity(message);
  return (snapshot.trackedUniverse ?? []).filter((item) => {
    const ticker = normalizeTicker(item.ticker);
    const compact = ticker.replace(/\s+/g, "");
    if (normalizedMessage.includes(` ${ticker} `) || normalizedMessage.includes(` ${compact} `)) return true;
    return aliasesForTracked(item).some((alias) => alias.length >= 3 && normalizedEntity.includes(alias));
  });
}

function trackedAnswer(item: TrackedTicker) {
  if (item.candidate) return candidateAnswer(item.candidate, true);
  const statusText = item.status === "recentlyActive"
    ? "nyligen aktiv men inte aktiv toppkandidat just nu"
    : item.status === "trackedButNotActive"
      ? "tracked men inte aktiv toppkandidat just nu"
      : item.status;
  return [
    `Beslut: ${item.ticker} är ${statusText}.`,
    `Varför: ${item.summary}`,
    `Trigger: behöver färsk livebekräftelse, ny volym eller ny plats i Live Edge Board.`,
    "Risk: utan färsk bekräftelse är det bevakning, inte agera.",
    `Invalidation: fortsätter sakna momentum/coverage i kommande scan.`,
    item.lastKnownScore !== null && item.lastKnownScore !== undefined ? `Senast känt: state ${item.lastKnownState ?? "okänd"}, score ${item.lastKnownScore}, confidence ${item.lastKnownConfidence ?? "-"}.` : "Senast känt: ingen sparad score i snapshoten.",
  ].join("\n");
}

function positionAnswer(decision: PositionManagementDecision) {
  return [
    `Beslut: ${decision.ticker} - ${decision.decisionLabel ?? decision.state}. ${decision.decision}`,
    `Varför: ${decision.reason ?? decision.why}`,
    `Trigger: ${decision.trigger}`,
    `Risk: ${decision.risk ?? "okänd"}/100. Confidence trend ${decision.confidenceTrend}, confidence ${decision.confidence}.`,
    `Invalidation: ${decision.invalidation}`,
    `Nästa åtgärd: ${decision.suggestedAction ?? "wait"}.`,
    `Ändrat: ${decision.whatChanged}`,
  ].join("\n");
}

function compareTracked(items: Array<TradingCandidate | TrackedTicker>) {
  const line = (item: TradingCandidate | TrackedTicker) => {
    if ("status" in item) return `${item.ticker}: ${item.status}. ${item.summary}`;
    return `${item.ticker}: ${item.action}, ${item.personality ?? item.setupType}. ${item.catalystSummary ?? item.thesis}`;
  };
  return [
    "Starkast just nu",
    items.some((item) => !("status" in item)) ? "Aktiv kandidat går före tracked utan färsk livebekräftelse." : "Ingen av tickers är aktiv toppkandidat i snapshoten.",
    "",
    "X / Y",
    ...items.map(line),
    "",
    "Slutsats",
    "Agera bara på färsk snapshot-edge. Tracked tickers ska bevakas tills de återkommer med livebekräftelse.",
  ].join("\n");
}

function candidateAnswer(candidate: TradingCandidate, stale = false) {
  const staleLine = stale ? "\n\nObs: svaret bygger på senaste snapshot som klienten skickade in." : "";
  const freshnessLine = candidate.isActiveToday
    ? "Freshness: active today med same-day livebekräftelse."
    : `Freshness: ${candidate.freshnessStatus ?? "okänd"}. Behandla som context/re-entry, inte dagens action utan ny bekräftelse.`;
  const tone = candidate.sourceBucket === "PARABOLIC_WATCH" || candidate.action === "Het men jaga inte"
    ? "Bra att bevaka, men sämre som ny entré efter dagens move."
    : candidate.sourceBucket === "RISK" || candidate.action === "Hog risk"
      ? "Hög risk: caset kan vara aktivt men kräver hård confirmation."
      : candidate.sourceBucket === "STEALTH"
        ? "Tidigt case: intressant om volymen fortsätter utan att bli crowded."
        : "Aktivt case i senaste tavlan.";
  return [
    `Bedömning: ${candidate.ticker} är ${candidate.action.toLowerCase()} i senaste snapshot, inte ett coverage gap.`,
    freshnessLine,
    `Story: ${candidate.narrativeTriggerType ?? "UNKNOWN"} · narrative ${candidate.narrativeStrength ?? 0}/100 · repricing ${candidate.repricingProbability ?? 0}/100${candidate.hasFreshFundamentalCatalyst ? " · färsk fundamental catalyst" : ""}.`,
    `Signal quality: ${candidate.signalQuality ?? "okänd"} · decay ${candidate.decayScore ?? 0}/100 · confirmations ${candidate.confirmationCount ?? 0}.`,
    candidate.staleReason ? `Stale/decay: ${candidate.staleReason}.` : `Senast bekräftad: ${candidate.lastConfirmedAt ?? "okänd"}.`,
    `Tone: ${tone}`,
    `Catalyst: ${candidate.catalystSummary ?? candidate.catalystType ?? "ingen verifierad catalyst i snapshot"}${candidate.catalystScore !== undefined ? ` (${candidate.catalystScore}/100)` : ""}.`,
    `Typ av move: ${candidate.personality ?? candidate.setupType}.`,
    `Varför nu: ${candidate.whyNow ?? candidate.thesis}`,
    `För: ${candidate.pros.length > 0 ? candidate.pros.join("; ") : "ingen stark datapunkt utöver snapshot-rankingen"}.`,
    `Emot: ${candidate.cons.length > 0 ? candidate.cons.join("; ") : "inga tydliga motargument i snapshot"}.`,
    `Trigger: ${candidate.needsNow ?? candidate.trigger}.`,
    `Invalidation: ${candidate.invalidation}.`,
  ].join("\n") + staleLine;
}

function fallbackAnswer(input: {
  message: string;
  snapshot: CanonicalTradingSnapshot;
  reason: string;
}) {
  const lowerMessage = input.message.toLowerCase();
  const comparisonMode = /jämför|jamfor|vilken|bäst|bast|starkast|mest intressant/.test(lowerMessage);
  const positionMode = /äger|ager|innehav|position|håller|haller|trimma|sälja|salja|stop|add|öka|oka|minska|alive|fortfarande/.test(lowerMessage);
  const priorityMode = /fokus|plan|spelar roll|prioritet|prioritera|ignorer|undvik|dött|dott|dog|dead|ändrat|andrat|changed/.test(lowerMessage);
  const candidate = mentionedTicker(input.message, input.snapshot);
  const tracked = mentionedTracked(input.message, input.snapshot);
  const position = input.snapshot.positionManagement?.find((item) => item.ticker === candidate?.candidate.ticker || item.ticker === tracked?.item.ticker);
  const comparisonCandidates = comparisonMode
    ? [...new Map([...(candidate ? [candidate.candidate] : []), ...mentionedCandidates(input.message, input.snapshot)].map((item) => [item.ticker, item])).values()].slice(0, 2)
    : [];
  const comparisonItems = comparisonMode
    ? [...new Map< string, TradingCandidate | TrackedTicker >([
        ...comparisonCandidates.map((item): [string, TradingCandidate | TrackedTicker] => [item.ticker, item]),
        ...mentionedTrackedItems(input.message, input.snapshot).map((item): [string, TradingCandidate | TrackedTicker] => [item.ticker, item]),
      ]).values()].slice(0, 2)
    : [];
  const answer = comparisonMode && comparisonCandidates.length >= 2
    ? comparisonAnswer(comparisonCandidates)
    : comparisonMode && comparisonItems.length >= 2
      ? compareTracked(comparisonItems)
    : positionMode && position
      ? positionAnswer(position)
    : priorityMode
      ? priorityQuestionAnswer(input.message, input.snapshot)
    : candidate
      ? `${candidate.assumed ? `Jag hittar inte exakt formulering, men jag antar att du menar ${candidate.candidate.ticker}${candidate.candidate.company ? ` / ${candidate.candidate.company}` : ""}.\n` : ""}${candidateAnswer(candidate.candidate, Boolean(input.snapshot))}`
      : tracked
        ? `${tracked.assumed ? `Jag antar att du menar ${tracked.item.ticker}${tracked.item.company ? ` / ${tracked.item.company}` : ""}.\n` : ""}${trackedAnswer(tracked.item)}`
      : /fokus|plan|idag|nu|ändrats|andrats/i.test(input.message)
        ? focusAnswer(input.snapshot)
        : unknownTickerAnswer(input.message, input.snapshot);
  return { answer, matchedTicker: candidate?.candidate.ticker ?? tracked?.item.ticker ?? null, reason: input.reason };
}

function compactCandidate(candidate: TradingCandidate) {
  return {
    ticker: candidate.ticker,
    company: candidate.company,
    action: candidate.action,
    setupType: candidate.setupType,
    personality: candidate.personality,
    thesis: candidate.thesis,
    whyNow: candidate.whyNow,
    needsNow: candidate.needsNow,
    trigger: candidate.trigger,
    invalidation: candidate.invalidation,
    pros: candidate.pros?.slice(0, 4),
    cons: candidate.cons?.slice(0, 4),
    continuation: candidate.continuation,
    risk: candidate.risk,
    rvol: candidate.rvol,
    movePct: candidate.movePct,
    sourceBucket: candidate.sourceBucket,
    freshnessStatus: candidate.freshnessStatus,
    dataAgeMinutes: candidate.dataAgeMinutes,
    isActiveToday: candidate.isActiveToday,
    signalQuality: candidate.signalQuality,
    freshnessMinutes: candidate.freshnessMinutes,
    confirmationCount: candidate.confirmationCount,
    lastConfirmedAt: candidate.lastConfirmedAt,
    decayScore: candidate.decayScore,
    staleReason: candidate.staleReason,
    narrativeTriggerType: candidate.narrativeTriggerType,
    narrativeStrength: candidate.narrativeStrength,
    narrativeFreshness: candidate.narrativeFreshness,
    thematicTailwind: candidate.thematicTailwind,
    repricingProbability: candidate.repricingProbability,
    marketAttentionShift: candidate.marketAttentionShift,
    hasFreshFundamentalCatalyst: candidate.hasFreshFundamentalCatalyst,
    catalystType: candidate.catalystType,
    catalystScore: candidate.catalystScore,
    catalystSummary: candidate.catalystSummary,
  };
}

function compactSnapshot(snapshot: CanonicalTradingSnapshot) {
  const candidates = snapshotCandidates(snapshot).slice(0, 24);
  return {
    timestamp: snapshot.timestamp,
    snapshotDate: snapshot.snapshotDate,
    marketSessionDate: snapshot.marketSessionDate,
    generatedAt: snapshot.generatedAt,
    dataAgeMinutes: snapshot.dataAgeMinutes,
    isFreshForToday: snapshot.isFreshForToday,
    marketSessionPhase: snapshot.marketSessionPhase,
    providerStatus: snapshot.providerStatus,
    marketQuality: snapshot.marketQuality,
    newsProviderStatus: snapshot.newsProviderStatus,
    marketPulse: snapshot.marketPulse,
    catalystPulse: snapshot.catalystPulse,
    warnings: snapshot.warnings?.slice(0, 5) ?? [],
    topFocus: snapshot.topFocus.slice(0, 6).map(compactCandidate),
    candidates: candidates.slice(0, 20).map(compactCandidate),
    breadth: {
      hot: (snapshot.breadth?.hot ?? []).slice(0, 8).map(compactCandidate),
      watch: (snapshot.breadth?.watch ?? []).slice(0, 8).map(compactCandidate),
      stealth: (snapshot.breadth?.stealth ?? []).slice(0, 8).map(compactCandidate),
      noChase: (snapshot.breadth?.noChase ?? []).slice(0, 8).map(compactCandidate),
      recentlyActive: (snapshot.breadth?.recentlyActive ?? []).slice(0, 8).map(compactCandidate),
    },
    portfolioDecisions: snapshot.portfolioDecisions?.slice(0, 10) ?? [],
    positionManagement: snapshot.positionManagement?.slice(0, 18) ?? [],
    priorityBoard: snapshot.priorityBoard?.slice(0, 12) ?? [],
    newsTriggers: snapshot.newsTriggers?.slice(0, 10) ?? [],
    earlyRadar: snapshot.earlyRadar?.slice(0, 10) ?? [],
    trackedUniverse: (snapshot.trackedUniverse ?? []).slice(0, 40).map((item) => ({
      ticker: item.ticker,
      company: item.company,
      status: item.status,
      source: item.source,
      summary: item.summary,
      lastKnownState: item.lastKnownState,
      lastKnownScore: item.lastKnownScore,
      lastKnownConfidence: item.lastKnownConfidence,
      candidate: item.candidate ? compactCandidate(item.candidate) : undefined,
    })),
    whatChanged: snapshot.whatChanged?.slice(0, 10) ?? [],
  };
}

function buildSystemPrompt() {
  return [
    "Du är RaketRadar Copilot v2, en trading companion för svenska small/mid caps.",
    "Du får bara använda canonical snapshot JSON som skickas i prompten. Hitta inte på kurser, nyheter, insiderdata eller signaler utanför snapshoten.",
    "Om något saknas: säg tydligt 'finns inte i senaste snapshoten' eller 'saknar färsk livebekräftelse'.",
    "Kalla inte något coverage gap bara för att det saknas i topplistan. Skilj på inte i snapshot, nyligen aktiv, risk/no-chase, saknad coverage och historisk miss.",
    "Vid frågan 'hade du kunnat hitta X före rusningen?' är X ämnet. Tolka inte svenska hjälpverb som tickers.",
    "Vid hindsight/missed mover måste du alltid svara med rubrikerna: Kunde systemet ha hittat den?, Vad fanns i snapshoten?, Vad saknades?, Vad krävs nästa gång?.",
    "Om X inte finns i snapshoten ska du inte säga tvärsäkert att systemet inte kunde hitta den historiskt. Säg: den finns inte i senaste snapshoten, och utifrån just denna snapshot kan jag inte bevisa att den var observerad före rusningen.",
    "Om ticker/bolag finns i candidates, breadth eller recentlyActive får du aldrig säga att det saknas.",
    "Presentera aldrig en gårdagens/recentMemory/stale runner som dagens åtgärd. Dagens action kräver isActiveToday eller tydligt färsk same-day livebekräftelse.",
    "Om snapshoten inte är freshForToday ska du säga det direkt vid breda frågor och behandla case som context/re-entry, inte current action.",
    "Skilj alltid på 'var intressant' och 'är fortfarande actionable'. Använd signalQuality, decayScore, lastConfirmedAt, confirmationCount och staleReason.",
    "Old RVOL eller gammal squeeze får inte bära action. Om signalQuality är STALLED/EXHAUSTED/DEAD ska svaret nedgraderas tydligt.",
    "Vid frågor som varför går den, vad är storyn, är detta bara squeeze: börja med narrativeTriggerType, narrativeStrength, repricingProbability och hasFreshFundamentalCatalyst före RVOL/momentum.",
    "Om newsTriggers finns för tickern eller frågan gäller dagens triggers/PM/rubriker: använd newsTriggers först, sedan price/volume.",
    "Om newsProviderStatus.isLive är false måste du tydligt säga att nyhetsdatan är mock/manual/disabled och inte riktig live news coverage ännu. Om isLive är true får du säga baserat på live RSS/API-feed.",
    "Om ticker finns i trackedUniverse men inte i aktiva candidates: säg att den är tracked men inte aktiv toppkandidat just nu. Säg aldrig 'no data' för tracked tickers.",
    "Tracked tickers kan sakna färsk livebekräftelse. Då är beslutet bevaka/re-check, inte att caset är okänt.",
    "Vid breda frågor som vad ska jag fokusera på, vad spelar roll nu, vad ignorerar jag eller vad har dött: prioritera priorityBoard framför långa kandidatlistor.",
    "Om frågan gäller innehav: svara som position manager: håll, trimma, sälj, bevaka, risk, trigger, invalidation. Inga orderinstruktioner.",
    "Om positionManagement finns för tickern ska du använda state, decisionLabel, suggestedAction, reason/why, trigger, invalidation, risk, whatChanged och confidenceTrend som primär källa för innehav/position-frågor.",
    "Var skeptisk mot parabolic/no-chase, men behandla dem som viktiga momentum-case: inte chase, bara pullback/re-entry/ny trigger.",
    "Svarsstil: kort, trader-mässigt, beslut först. Defaultformat: Beslut, Varför, Trigger, Risk, Invalidation.",
    "Vid jämförelse: Starkast just nu, X för/emot, Y för/emot, Slutsats.",
    "Vid hindsight/missed mover: Kunde systemet ha hittat den?, Vad fanns i snapshoten?, Vad saknades?, Vad krävs nästa gång?",
  ].join("\n");
}

function isHindsightQuestion(message: string) {
  return /hade|kunde|kunnat|hitta|hittat|före|fore|innan|rusade|rusat|missade|missat/i.test(message);
}

function extractSubjectToken(message: string) {
  const stopWords = new Set([
    "VAD", "OM", "OCH", "SKA", "JAG", "TYCKER", "DU", "AR", "ÄR", "HADE", "KUNDE", "KUNNAT", "HITTA", "HITTAT",
    "FORE", "FÖRE", "INNAN", "DEN", "DET", "RUSADE", "RUSAT", "MISSADE", "MISSAT", "VI", "SYSTEMET",
  ]);
  return normalizeTicker(message).split(" ").find((token) => /^[A-ZÅÄÖ0-9]{2,8}$/.test(token) && !stopWords.has(token)) ?? null;
}

function enforceHindsightFormat(message: string, snapshot: CanonicalTradingSnapshot, answer: string) {
  if (!isHindsightQuestion(message) || /Kunde systemet ha hittat den\?/i.test(answer)) return answer;
  const subject = extractSubjectToken(message) ?? "caset";
  const match = mentionedTicker(subject, snapshot);
  const tracked = mentionedTracked(subject, snapshot);
  if (match) {
    return [
      "Kunde systemet ha hittat den?",
      `Ja, ${match.candidate.ticker} finns i senaste snapshoten. Det betyder att v2 kan resonera om caset från tavlan, men inte bevisa exakt vad som fanns före själva rusningen utan äldre snapshots.`,
      "",
      "Vad fanns i snapshoten?",
      `${match.candidate.ticker}: ${match.candidate.action}, ${match.candidate.personality ?? match.candidate.setupType}. ${match.candidate.catalystSummary ?? match.candidate.thesis}`,
      "",
      "Vad saknades?",
      "Exakt pre-move-tidslinje saknas i den snapshot som skickades till Copilot.",
      "",
      "Vad krävs nästa gång?",
      "Spara/visa tidigare snapshot före rörelsen, upptäck volymavvikelse tidigare och markera om caset låg i recently active, no-chase eller stealth.",
    ].join("\n");
  }
  if (tracked) {
    return [
      "Kunde systemet ha hittat den?",
      `${tracked.item.ticker} finns i trackedUniverse som ${tracked.item.status}, men är inte nödvändigtvis aktiv toppkandidat just nu.`,
      "",
      "Vad fanns i snapshoten?",
      tracked.item.summary,
      "",
      "Vad saknades?",
      "Färsk livebekräftelse eller exakt pre-move-tidslinje saknas i snapshoten.",
      "",
      "Vad krävs nästa gång?",
      "Att tickern återkommer med live momentum/volume eller att tidigare snapshots visar att den låg i recently active före rörelsen.",
    ].join("\n");
  }
  return [
    "Kunde systemet ha hittat den?",
    `${subject} finns inte i senaste snapshoten. Utifrån just denna snapshot kan jag inte bevisa att den var observerad före rusningen.`,
    "",
    "Vad fanns i snapshoten?",
    "Ingen matchande kandidat i candidates, breadth eller recently active.",
    "",
    "Vad saknades?",
    "Antingen saknades tickern i v2-universet/provider coverage, eller så fanns den inte bland de case som snapshoten skickade till Copilot.",
    "",
    "Vad krävs nästa gång?",
    "Bättre universe/provider-alias, sparade snapshots före rörelsen och en explicit missed-mover/coverage-markering för tickern.",
  ].join("\n");
}

async function askOpenAi(input: { message: string; snapshot: CanonicalTradingSnapshot }) {
  const response = await Promise.race([
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COPILOT_V2_MODEL,
        temperature: 0.2,
        max_tokens: 650,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          {
            role: "user",
            content: [
              `Fråga: ${input.message}`,
              "Canonical snapshot JSON:",
              JSON.stringify(compactSnapshot(input.snapshot)),
            ].join("\n\n"),
          },
        ],
      }),
    }),
    timeoutAfter(OPENAI_TIMEOUT_MS, "OpenAI Copilot v2"),
  ]);
  const text = await response.text();
  if (!response.ok) {
    let details = text.slice(0, 1000);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      details = parsed.error?.message ?? details;
    } catch {
      // Keep raw details.
    }
    throw new Error(details);
  }
  const payload = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() ?? "Jag kunde inte skapa ett svar från snapshoten.";
}

function comparisonAnswer(candidates: TradingCandidate[]) {
  const [a, b] = candidates;
  if (!a || !b) return candidateAnswer(a ?? b);
  const score = (candidate: TradingCandidate) =>
    (candidate.catalystScore ?? 35) * 0.25 +
    (candidate.action === "Agera" ? 18 : candidate.action === "Bevaka" ? 10 : candidate.action === "Het men jaga inte" ? 4 : 0) +
    (candidate.sourceBucket === "PARABOLIC_WATCH" || candidate.sourceBucket === "RISK" ? -12 : 0);
  const winner = score(a) >= score(b) ? a : b;
  const other = winner === a ? b : a;
  return [
    `Beslut: ${winner.ticker} ser starkare ut än ${other.ticker} i senaste snapshot.`,
    `${winner.ticker}: ${winner.action}, ${winner.personality ?? winner.setupType}. Catalyst: ${winner.catalystSummary ?? "ingen tydlig catalyst"}.`,
    `${other.ticker}: ${other.action}, ${other.personality ?? other.setupType}. Catalyst: ${other.catalystSummary ?? "ingen tydlig catalyst"}.`,
    `Edge: ${winner.ticker} har bättre kombination av catalyst/decision-läge i snapshoten.`,
    `Risk: om ${winner.ticker} tappar triggern (${winner.invalidation}) ska jämförelsen göras om.`,
  ].join("\n");
}

function focusAnswer(snapshot: CanonicalTradingSnapshot) {
  const priority = (snapshot.priorityBoard ?? [])
    .filter((item) => snapshot.isFreshForToday ? item.freshnessStatus === "activeToday" : item.freshnessStatus !== "activeToday")
    .slice(0, 5);
  if (priority.length > 0) {
    const must = priority.filter((item) => item.priorityState === "MUST_ACT");
    const watch = priority.filter((item) => item.priorityState === "WATCH_CLOSELY" || item.priorityState === "REENTRY_WATCH");
    const avoid = priority.filter((item) => item.priorityState === "AVOID" || item.priorityState === "DEAD");
    return [
      `Beslut: ${must[0]?.ticker ? `${must[0].ticker} spelar mest roll nu.` : "ingen ren MUST_ACT just nu."}`,
      snapshot.isFreshForToday ? "Freshness: same-day live snapshot." : `Freshness: inte färsk live-session (${snapshot.marketSessionDate ?? "okänd session"}). Behandla som market memory/re-entry.`,
      `Nu: ${(must[0] ?? priority[0]).ticker} - ${(must[0] ?? priority[0]).action}.`,
      watch[0] ? `Bevaka: ${watch[0].ticker} - ${watch[0].headline}.` : "Bevaka: inget tydligt nästa case.",
      avoid[0] ? `Ignorera/undvik: ${avoid[0].ticker} - ${avoid[0].action}.` : "Undvik: inga nya tydliga röda flaggor i priorityBoard.",
      `Datakvalitet: ${snapshot.marketQuality.label}, ${snapshot.providerStatus.liveHits}/${snapshot.providerStatus.scanned} live hits.`,
    ].join("\n");
  }
  const focus = snapshot.topFocus.slice(0, 3);
  if (focus.length === 0) {
    return [
      "Beslut: inga rena fokuscase i senaste snapshot.",
      "Varför: canonical snapshot saknar kandidater som passerar v2-filtret.",
      "Trigger: kör ny scan och invänta bättre provider coverage eller tydligare momentum.",
      "Risk: att marknaden rör sig utanför täckningen.",
      "Invalidation: ny snapshot med HOT/STEALTH/NO-CHASE case.",
    ].join("\n");
  }
  return [
    "Beslut: fokusera på de här casen i senaste snapshot.",
    ...focus.map((candidate) => `${candidate.ticker}: ${candidate.action} - ${candidate.setupType}. ${candidate.thesis}`),
    `Datakvalitet: ${snapshot.marketQuality.label}, ${snapshot.providerStatus.liveHits}/${snapshot.providerStatus.scanned} live hits.`,
  ].join("\n");
}

function priorityQuestionAnswer(message: string, snapshot: CanonicalTradingSnapshot) {
  const lower = message.toLowerCase();
  if (/före öppning|fore oppning|pre.?open|imorgon bitti|radarn|radar|innan öppning|innan oppning/.test(lower)) {
    const radar = (snapshot.earlyRadar ?? []).slice(0, 5);
    if (radar.length > 0) {
      return [
        "Beslut: använd Early Radar före öppning, inte gårdagens movers.",
        ...radar.map((item) => `${item.rank}. ${item.ticker}: ${item.status} - ${item.preOpenTrigger}. Bekräftelse: ${item.confirmationNeeded}`),
        snapshot.newsProviderStatus?.isLive ? "News: live RSS/API-feed i snapshoten." : "News: mock/manual eller disabled, inte live coverage.",
      ].join("\n");
    }
  }
  if (/trigger|pm|rubrik|headline|nyhet|nyheter/.test(lower)) {
    const triggers = (snapshot.newsTriggers ?? []).slice(0, 5);
    if (triggers.length > 0) {
      return [
        `Beslut: viktigaste triggers först, inte momentum först.`,
        snapshot.newsProviderStatus?.isLive
          ? "News: baserat på live RSS/API-feed i snapshoten."
          : snapshot.newsProviderStatus?.mode === "mock"
          ? "Obs: news provider är MOCK/MANUAL, inte live Avanza/Finwire/MFN/Cision ännu."
          : snapshot.newsProviderStatus?.mode === "manual"
            ? "Obs: news provider är MANUAL env input, inte automatiserad livefeed."
            : "News provider saknar live/headline-data.",
        ...triggers.map((item) => `${item.ticker ?? "NO TICKER"}: ${item.triggerType}/${item.narrativeTriggerType} (${item.triggerStrength}/100). ${item.summary}`),
        "Nästa steg: kräv live reaction innan det blir action-case.",
      ].join("\n");
    }
  }
  const items = (snapshot.priorityBoard ?? []).filter((item) =>
    snapshot.isFreshForToday ? item.freshnessStatus === "activeToday" : item.freshnessStatus !== "activeToday"
  );
  if (items.length === 0) return focusAnswer(snapshot);
  const filtered = /ignorer|undvik|avoid/.test(lower)
    ? items.filter((item) => item.priorityState === "AVOID" || item.priorityState === "LOW_PRIORITY")
    : /dött|dott|dog|dead/.test(lower)
      ? items.filter((item) => item.priorityState === "DEAD")
      : /ändrat|andrat|changed/.test(lower)
        ? items.filter((item) => item.changedFrom)
        : items.filter((item) => item.priorityState === "MUST_ACT" || item.priorityState === "WATCH_CLOSELY" || item.priorityState === "REENTRY_WATCH");
  const top = (filtered.length > 0 ? filtered : items).slice(0, 4);
  return [
    `Beslut: ${top[0]?.ticker ?? "inget"} är högsta prioritet i priorityBoard.`,
    snapshot.isFreshForToday ? "Freshness: dagens livebekräftelse." : `Freshness: inte dagens live-action. Visar ${snapshot.marketSessionPhase ?? "market memory"} / recent context.`,
    ...top.map((item) => `${item.ticker}: ${item.priorityState} (${item.signalQuality ?? "WATCH"}, ${item.narrativeTriggerType ?? "UNKNOWN"}, ${item.freshnessMinutes ?? "-"}m) - ${item.action}. ${item.whyNow}`),
    "Ignorera resten tills de får ny urgency eller state-ändring.",
  ].join("\n");
}

function unknownTickerAnswer(message: string, snapshot: CanonicalTradingSnapshot) {
  const uppercaseTokens = normalizeTicker(message).split(" ").filter((token) => /^[A-ZÅÄÖ0-9]{2,8}$/.test(token));
  const stopWords = new Set([
    "VAD", "OM", "OCH", "SKA", "JAG", "TYCKER", "DU", "AR", "ÄR", "HADE", "KUNDE", "KUNNAT", "HITTA", "HITTAT",
    "FORE", "FÖRE", "DEN", "DET", "RUSADE", "RUSAT", "NU", "IDAG", "MINA", "MITT", "AGERA", "BEVAKA", "SALJ",
    "SÄLJ", "HALL", "HÅLL", "GÖR", "GOR", "MOT", "ELLER", "SOM", "ETT", "EN",
  ]);
  const ticker = uppercaseTokens.find((token) => !stopWords.has(token));
  if (!ticker) return focusAnswer(snapshot);
  return [
    `Bedömning: jag hittar inte ${ticker} som tydligt case i senaste tavlan.`,
    "Jag tolkar det inte som ett dåligt case bara för att det saknas här.",
    "Nästa steg: testa exakt ticker/bolagsnamn eller kör ny scan om du tror att rörelsen är färsk.",
    "Traderläge: ingen edge att agera på från snapshoten, men det kan vara ett bevaknings-/coverage-problem.",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      message?: string;
      snapshot?: CanonicalTradingSnapshot;
    };
    const message = body.message?.trim() ?? "";
    if (!message) {
      return NextResponse.json({ error: "Tom fråga.", answer: "Skriv en fråga först." }, { status: 400 });
    }
    if (!body.snapshot) {
      return NextResponse.json(
        {
          error: "Snapshot saknas.",
          answer: "Copilot v2 läser bara canonicalTradingSnapshot från terminalen. Ladda /terminal-v2 och försök igen.",
        },
        { status: 400 },
      );
    }
    const snapshot = body.snapshot;
    const fallback = fallbackAnswer({ message, snapshot, reason: process.env.OPENAI_API_KEY ? "openai_fallback" : "missing_openai_key" });
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        answer: fallback.answer,
        mode: "fallback_snapshot",
        warning: "OPENAI_API_KEY saknas. Fallback-svar från snapshot.",
        snapshotTimestamp: snapshot.timestamp,
        matchedTicker: fallback.matchedTicker,
        context: "canonicalTradingSnapshot",
      });
    }

    try {
      const answer = enforceHindsightFormat(message, snapshot, await askOpenAi({ message, snapshot }));
      return NextResponse.json({
        answer,
        mode: "ai_snapshot",
        model: COPILOT_V2_MODEL,
        snapshotTimestamp: snapshot.timestamp,
        matchedTicker: fallback.matchedTicker,
        context: "canonicalTradingSnapshot",
      });
    } catch (openAiError) {
      console.error("[copilot-v2] OpenAI failed, using fallback", {
        message: openAiError instanceof Error ? openAiError.message : "unknown OpenAI error",
      });
      return NextResponse.json({
        answer: fallback.answer,
        mode: "fallback_snapshot",
        warning: openAiError instanceof Error ? openAiError.message : "OpenAI failed",
        model: COPILOT_V2_MODEL,
        snapshotTimestamp: snapshot.timestamp,
        matchedTicker: fallback.matchedTicker,
        context: "canonicalTradingSnapshot",
      });
    }

  } catch (error) {
    console.error("[copilot-v2] failed", error);
    return NextResponse.json(
      {
        error: "Copilot v2 kunde inte svara från canonical snapshot.",
        details: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
