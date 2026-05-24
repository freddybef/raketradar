import { createClient } from "@supabase/supabase-js";
import { getProviderNews } from "@/lib/providers/newsProvider";

export interface DiscoveryPrefilterCandidate {
  ticker: string;
  score: number;
  sourceCount: number;
  reasons: string[];
  pinned: boolean;
  lastSeenAt: string | null;
}

export interface DiscoveryPrefilterResult {
  candidates: DiscoveryPrefilterCandidate[];
  selectedTickers: string[];
  debug: {
    enabled: boolean;
    maxTickers: number;
    baseUniverseSize: number;
    prefilterCandidates: number;
    finalSelectedCount: number;
    fallbackReason: string | null;
    topSourceReasons: Array<{ reason: string; count: number }>;
  };
}

type SupabaseRow = Record<string, unknown>;

interface CandidateAccumulator {
  ticker: string;
  score: number;
  sources: Set<string>;
  reasons: string[];
  pinned: boolean;
  lastSeenAt: string | null;
}

const DEFAULT_MAX_PREFILTER_TICKERS = 400;

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function cleanTicker(value: unknown) {
  return String(value ?? "")
    .replace(/\.(ST|SS|OL|HE|CO)$/i, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function numeric(value: unknown, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function recencyScore(timestamp?: unknown) {
  if (!timestamp) return 0;
  const ageMs = Date.now() - new Date(String(timestamp)).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0;
  const ageHours = ageMs / 3600000;
  if (ageHours <= 1) return 55;
  if (ageHours <= 6) return 40;
  if (ageHours <= 24) return 28;
  if (ageHours <= 72) return 16;
  if (ageHours <= 168) return 8;
  return 2;
}

function priorityScore(value: unknown) {
  const priority = String(value ?? "").toUpperCase();
  if (priority === "EXTREME") return 40;
  if (priority === "HIGH") return 30;
  if (priority === "MEDIUM") return 16;
  if (priority === "LOW") return 5;
  return 0;
}

function severityScore(value: unknown) {
  const severity = String(value ?? "").toUpperCase();
  if (severity === "EXTREME") return 36;
  if (severity === "HIGH") return 28;
  if (severity === "MEDIUM") return 14;
  if (severity === "LOW") return 4;
  return 0;
}

function newerTimestamp(a: string | null, b: unknown) {
  if (!b) return a;
  const value = String(b);
  if (!a) return value;
  return new Date(value).getTime() > new Date(a).getTime() ? value : a;
}

function addCandidate(
  map: Map<string, CandidateAccumulator>,
  input: {
    ticker: unknown;
    source: string;
    reason: string;
    score?: number;
    timestamp?: unknown;
    pinned?: boolean;
  }
) {
  const ticker = cleanTicker(input.ticker);
  if (!ticker) return;
  const current = map.get(ticker) ?? {
    ticker,
    score: 0,
    sources: new Set<string>(),
    reasons: [],
    pinned: false,
    lastSeenAt: null,
  };
  current.sources.add(input.source);
  current.score += input.score ?? 0;
  current.pinned = current.pinned || Boolean(input.pinned);
  current.lastSeenAt = newerTimestamp(current.lastSeenAt, input.timestamp);
  if (!current.reasons.includes(input.reason)) current.reasons.push(input.reason);
  map.set(ticker, current);
}

async function selectRows(
  table: string,
  columns: string,
  orderColumn: string,
  limit: number
): Promise<SupabaseRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as SupabaseRow[];
}

async function collectNewsCandidates(
  candidates: Map<string, CandidateAccumulator>,
  baseSymbols: string[]
) {
  const news = await getProviderNews(baseSymbols).catch(() => []);
  for (const item of news.slice(0, 200)) {
    for (const ticker of item.tickers ?? []) {
      addCandidate(candidates, {
        ticker,
        source: "news",
        reason: "fresh news/RSS ticker trigger",
        score: 30 + recencyScore(item.publishedAt) + numeric(item.importanceScore) * 0.35,
        timestamp: item.publishedAt,
      });
    }
  }
}

function topSourceReasons(candidates: CandidateAccumulator[]) {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const reason of candidate.reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function buildDiscoveryPrefilterUniverse(input: {
  baseUniverseTickers: string[];
  extraTickers?: string[];
  maxTickers?: number;
}): Promise<DiscoveryPrefilterResult> {
  const maxTickers = input.maxTickers ?? Number(process.env.DISCOVERY_PREFILTER_MAX_TICKERS ?? DEFAULT_MAX_PREFILTER_TICKERS);
  const candidates = new Map<string, CandidateAccumulator>();
  const baseSymbols = [...new Set(input.baseUniverseTickers.map(cleanTicker).filter(Boolean))];

  await Promise.all([
    collectNewsCandidates(candidates, baseSymbols),
    selectRows("signal_feed", "ticker,score,confidence,priority,observed_at", "observed_at", 300).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "signal_feed",
          reason: "recent signal_feed",
          score: recencyScore(row.observed_at) + numeric(row.score) * 0.45 + priorityScore(row.priority),
          timestamp: row.observed_at,
        });
      }
    }),
    selectRows("ranked_snapshots", "ticker,total_score,conviction,snapshot_at", "snapshot_at", 300).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "ranked_snapshots",
          reason: "recent ranked snapshot/mover",
          score: recencyScore(row.snapshot_at) + numeric(row.total_score) * 0.35 + numeric(row.conviction) * 0.2,
          timestamp: row.snapshot_at,
        });
      }
    }),
    selectRows("alert_history", "ticker,priority,confluence_score,triggered_at", "triggered_at", 200).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "alert_history",
          reason: "recent alert_history",
          score: recencyScore(row.triggered_at) + priorityScore(row.priority) + numeric(row.confluence_score) * 0.35,
          timestamp: row.triggered_at,
        });
      }
    }),
    selectRows("agent_alerts", "ticker,severity,created_at", "created_at", 200).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "agent_alerts",
          reason: "recent agent alert",
          score: recencyScore(row.created_at) + severityScore(row.severity),
          timestamp: row.created_at,
        });
      }
    }),
    selectRows("case_state_snapshots", "ticker,state,score,confidence,risk,created_at", "created_at", 300).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "case_state_snapshots",
          reason: "recent case_state snapshot",
          score: recencyScore(row.created_at) + numeric(row.score) * 0.4 + numeric(row.confidence) * 0.15 - numeric(row.risk) * 0.08,
          timestamp: row.created_at,
        });
      }
    }),
    selectRows("ranking_changes", "ticker,severity,created_at", "created_at", 200).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "ranking_changes",
          reason: "recent ranking change",
          score: recencyScore(row.created_at) + severityScore(row.severity),
          timestamp: row.created_at,
        });
      }
    }),
    selectRows("portfolio_positions", "ticker,status,updated_at,created_at", "updated_at", 500).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "portfolio_positions",
          reason: "portfolio position",
          score: 100 + recencyScore(row.updated_at ?? row.created_at),
          timestamp: row.updated_at ?? row.created_at,
          pinned: true,
        });
      }
    }),
    selectRows("portfolio_holdings", "ticker,conviction,updated_at,created_at", "updated_at", 500).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "portfolio_holdings",
          reason: "portfolio holding",
          score: 100 + numeric(row.conviction) * 0.4 + recencyScore(row.updated_at ?? row.created_at),
          timestamp: row.updated_at ?? row.created_at,
          pinned: true,
        });
      }
    }),
    selectRows("watchlist_items", "ticker,priority,updated_at,created_at", "updated_at", 800).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "watchlist_items",
          reason: "watchlist item",
          score: 95 + Math.max(0, 5 - numeric(row.priority, 3)) * 8 + recencyScore(row.updated_at ?? row.created_at),
          timestamp: row.updated_at ?? row.created_at,
          pinned: true,
        });
      }
    }),
    selectRows("insider_events", "ticker,event_type,value_sek,event_date,created_at", "created_at", 200).then((rows) => {
      for (const row of rows) {
        addCandidate(candidates, {
          ticker: row.ticker,
          source: "insider_events",
          reason: "recent insider event",
          score: 25 + recencyScore(row.created_at ?? row.event_date) + Math.min(40, numeric(row.value_sek) / 100000),
          timestamp: row.created_at ?? row.event_date,
        });
      }
    }),
  ]);

  for (const ticker of input.extraTickers ?? []) {
    addCandidate(candidates, {
      ticker,
      source: "extra_tickers",
      reason: "manual/env extra ticker",
      score: 120,
      pinned: true,
    });
  }

  const ranked = [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      score: candidate.score + candidate.sources.size * 12 + (candidate.pinned ? 500 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.sources.size - a.sources.size || a.ticker.localeCompare(b.ticker));

  const selected = ranked.slice(0, Math.max(1, maxTickers));
  const selectedTickers = selected.map((candidate) => candidate.ticker);
  const fallbackReason = selectedTickers.length === 0 ? "no cheap prefilter sources returned tickers" : null;

  return {
    candidates: selected.map((candidate) => ({
      ticker: candidate.ticker,
      score: Math.round(candidate.score),
      sourceCount: candidate.sources.size,
      reasons: candidate.reasons,
      pinned: candidate.pinned,
      lastSeenAt: candidate.lastSeenAt,
    })),
    selectedTickers,
    debug: {
      enabled: selectedTickers.length > 0,
      maxTickers,
      baseUniverseSize: baseSymbols.length,
      prefilterCandidates: ranked.length,
      finalSelectedCount: selectedTickers.length,
      fallbackReason,
      topSourceReasons: topSourceReasons(ranked),
    },
  };
}
