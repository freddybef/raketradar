create table if not exists public.signal_outcomes_detailed (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  ticker text not null,
  trigger text not null,
  catalyst text,
  market_regime text,
  insider_activity numeric default 0,
  float_profile text default 'unknown',
  crowding numeric default 0,
  overnight_strength numeric default 0,
  pre_open_score numeric default 0,
  opening_plan text,
  open_price numeric,
  high_price numeric,
  close_price numeric,
  opening_gap numeric,
  first_5m_move numeric,
  first_15m_move numeric,
  max_move_pct numeric,
  fade_pct numeric,
  continuation_score numeric,
  outcome_label text not null default 'DEAD',
  observed_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signal_outcomes_detailed_ticker_idx
  on public.signal_outcomes_detailed(ticker, observed_at desc);

create index if not exists signal_outcomes_detailed_trigger_idx
  on public.signal_outcomes_detailed(trigger, outcome_label, observed_at desc);

create index if not exists signal_outcomes_detailed_regime_idx
  on public.signal_outcomes_detailed(market_regime, observed_at desc);

alter table public.signal_outcomes_detailed enable row level security;

drop policy if exists "Authenticated users can read detailed signal outcomes" on public.signal_outcomes_detailed;
create policy "Authenticated users can read detailed signal outcomes"
on public.signal_outcomes_detailed for select to authenticated using (true);

drop policy if exists "Service role can manage detailed signal outcomes" on public.signal_outcomes_detailed;
create policy "Service role can manage detailed signal outcomes"
on public.signal_outcomes_detailed for all to service_role using (true) with check (true);
