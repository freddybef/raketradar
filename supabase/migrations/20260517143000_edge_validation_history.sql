create table if not exists public.signal_outcomes (
  id uuid primary key default gen_random_uuid(),
  signal_id text not null,
  ticker text not null,
  triggered_at timestamptz not null,
  horizon text not null,
  entry_price numeric not null,
  observed_price numeric,
  high_price numeric,
  low_price numeric,
  max_upside_percent numeric,
  downside_percent numeric,
  volatility_percent numeric,
  follow_through_quality integer,
  catalyst_mix text[] not null default '{}',
  conviction integer,
  regime text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pattern_history (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  pattern_type text not null,
  confidence integer not null,
  evidence text[] not null default '{}',
  observed_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.edge_statistics (
  id uuid primary key default gen_random_uuid(),
  signal_combo text not null,
  historical_winrate numeric not null,
  average_upside numeric not null,
  false_breakout_probability numeric not null,
  average_duration_days numeric not null,
  edge_score integer not null,
  sample_size integer not null default 0,
  calculated_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.market_regimes_history (
  id uuid primary key default gen_random_uuid(),
  risk_mode text not null,
  small_cap_appetite integer not null,
  ai_theme_expansion integer not null,
  biotech_speculation integer not null,
  squeeze_environment integer not null,
  ranking_weights jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists signal_outcomes_ticker_horizon_idx on public.signal_outcomes(ticker, horizon, triggered_at desc);
create index if not exists pattern_history_ticker_observed_idx on public.pattern_history(ticker, observed_at desc);
create index if not exists edge_statistics_combo_idx on public.edge_statistics(signal_combo, calculated_at desc);
create index if not exists market_regimes_history_observed_idx on public.market_regimes_history(observed_at desc);

alter table public.signal_outcomes enable row level security;
alter table public.pattern_history enable row level security;
alter table public.edge_statistics enable row level security;
alter table public.market_regimes_history enable row level security;

create policy "Authenticated users can read signal outcomes"
on public.signal_outcomes for select to authenticated using (true);

create policy "Authenticated users can read pattern history"
on public.pattern_history for select to authenticated using (true);

create policy "Authenticated users can read edge statistics"
on public.edge_statistics for select to authenticated using (true);

create policy "Authenticated users can read market regimes history"
on public.market_regimes_history for select to authenticated using (true);
