# Market Reality Layer v1

## Purpose

RaketRadar must first become a reliable trading aid by seeing the same market reality the user sees. Ranking, reasoning and UI improvements are secondary until RR ingests complete external market lists.

This is not a manual ticker fix. The system must ingest full Avanza-style market lists and preserve every row, including rows that cannot yet be resolved to a provider symbol.

## Product layers

RR must keep these layers separate:

1. Market Reality
   - what is moving right now
   - full external list rows
   - unresolved rows preserved

2. Portfolio Decisions
   - what this means for current holdings
   - protect capital first
   - exit-risk, trim, hold, re-entry

3. Opportunities
   - strict Action Now only when clean
   - Watch / Discovery / No Chase otherwise

Action Now must not become a dump of every external mover.

## MarketRealityRow contract

```ts
type MarketRealityStatus =
  | "FULLY_TRACKED"
  | "DISCOVERY_ONLY"
  | "PROVIDER_FAILED"
  | "NORMALIZATION_FAILED"
  | "UNSUPPORTED_MARKET";

type MarketRealityListType =
  | "WINNERS"
  | "LOSERS"
  | "MOST_TRADED"
  | "MOST_OWNED"
  | "UNKNOWN";

interface MarketRealityRow {
  id: string;
  rawName: string;
  normalizedName: string;
  ticker: string | null;
  providerSymbol: string | null;
  market: string | null;
  listType: MarketRealityListType;
  changePct: number | null;
  lastPrice: number | null;
  currency: string | null;
  observedAt: string;
  source: "AVANZA" | "MANUAL_IMPORT" | "EXTERNAL_JSON" | "SUPABASE";
  sourceUrl?: string | null;
  status: MarketRealityStatus;
  reason: string;
  providerAttempts?: Array<{
    symbol: string;
    statusCode: number | null;
    error: string | null;
    hasQuote: boolean;
    hasVolume: boolean;
  }>;
}
```

## Supabase table

Suggested table: `market_reality_rows`

```sql
create table if not exists market_reality_rows (
  id uuid primary key default gen_random_uuid(),
  raw_name text not null,
  normalized_name text not null,
  ticker text null,
  provider_symbol text null,
  market text null,
  list_type text not null check (list_type in ('WINNERS', 'LOSERS', 'MOST_TRADED', 'MOST_OWNED', 'UNKNOWN')),
  change_pct numeric null,
  last_price numeric null,
  currency text null,
  observed_at timestamptz not null,
  source text not null check (source in ('AVANZA', 'MANUAL_IMPORT', 'EXTERNAL_JSON', 'SUPABASE')),
  source_url text null,
  status text not null check (status in ('FULLY_TRACKED', 'DISCOVERY_ONLY', 'PROVIDER_FAILED', 'NORMALIZATION_FAILED', 'UNSUPPORTED_MARKET')),
  reason text not null,
  provider_attempts jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists market_reality_rows_observed_at_idx on market_reality_rows (observed_at desc);
create index if not exists market_reality_rows_normalized_name_idx on market_reality_rows (normalized_name);
create index if not exists market_reality_rows_ticker_idx on market_reality_rows (ticker);
create index if not exists market_reality_rows_market_idx on market_reality_rows (market);
create index if not exists market_reality_rows_list_type_idx on market_reality_rows (list_type);
create index if not exists market_reality_rows_status_idx on market_reality_rows (status);
```

## Ingest rule

Do not hardcode specific tickers as the solution.

Acceptable v1 sources:

1. Existing reliable repo/Supabase source if already available.
2. Avanza-style external JSON/table input.
3. Temporary import endpoint that accepts full copied/exported market-list rows.

A temporary manual import is acceptable only if it imports full rows from watched lists, not handpicked ticker names.

## Snapshot requirement

Canonical snapshot must expose market reality separately from ranked candidates.

Required counters:

- marketRealityRows
- fullyTrackedRows
- discoveryOnlyRows
- providerFailedRows
- normalizationFailedRows
- unsupportedMarketRows

Required behavior:

- resolved rows may enter discovery prefilter
- unresolved rows must stay visible as market reality
- unresolved rows must not be forced into Action Now

## Copilot requirement

Copilot must answer from market reality before saying a name is missing.

If the user asks about a raw or normalized market-reality row:

- `FULLY_TRACKED`: explain the active/tracked state and whether it is Action Now, Watch, Re-entry, or No Chase.
- `DISCOVERY_ONLY`: say RR has seen it externally but lacks full tradeable confirmation.
- `PROVIDER_FAILED`: say RR has seen it externally but provider/symbol resolution failed.
- `NORMALIZATION_FAILED`: say RR saw the row but could not map the name safely.
- `UNSUPPORTED_MARKET`: say the row is outside current provider/market support.

Copilot must not answer only `not in latest snapshot` when `market_reality_rows` contains the name.

## Definition of done

A fresh scan can ingest complete Avanza-style winners/losers rows and RR can:

1. Count all ingested market reality rows.
2. Preserve unresolved rows.
3. Expose resolved and unresolved rows in snapshot/Copilot.
4. Keep Action Now strict.
5. Answer questions about any ingested market reality row.

## Scope guard

Do not add:

- ML
- broad scoring engine rewrite
- cosmetic UI
- manual ticker patch list
- Action Now spam

The foundation is complete market visibility first.
