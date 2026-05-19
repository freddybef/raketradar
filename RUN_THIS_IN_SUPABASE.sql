-- Kopiera ALLT i denna fil och kör i Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ==================================================
-- 1. CREATE ALL TABLES FIRST
-- ==================================================

create table if not exists public.social_mentions (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  source text not null,
  mentions integer not null default 0,
  sentiment numeric,
  velocity numeric,
  observed_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.insider_events (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  insider_name text not null,
  role text,
  event_type text not null,
  value_sek numeric,
  event_date date not null,
  source text not null default 'FI',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.signal_feed (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  signal_type text not null,
  title text not null,
  description text,
  score integer not null,
  confidence integer not null,
  priority text,
  tags text[] not null default '{}',
  observed_at timestamptz not null,
  signal_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.ranked_snapshots (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  total_score integer not null,
  conviction integer not null,
  reasons text[] not null default '{}',
  risks text[] not null default '{}',
  tags text[] not null default '{}',
  snapshot_at timestamptz not null,
  snapshot_key text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.narrative_history (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  primary_narrative text not null,
  narrative_strength integer not null,
  trend_direction text not null,
  emerging_narrative boolean not null default false,
  observed_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alert_history (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  alert_type text not null,
  priority text not null,
  reason text not null,
  confluence_score integer,
  dedupe_key text not null,
  triggered_at timestamptz not null,
  expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists public.provider_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  latency_ms integer not null default 0,
  fetched_count integer not null default 0,
  saved_count integer not null default 0,
  error_message text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ==================================================
-- 2. ADD/REPAIR COLUMNS BEFORE INDEXES
-- ==================================================

alter table public.insider_events
  add column if not exists dedupe_key text;

alter table public.signal_feed
  add column if not exists signal_key text;

alter table public.ranked_snapshots
  add column if not exists snapshot_key text;

alter table public.signal_outcomes
  add column if not exists first_5m_move numeric,
  add column if not exists first_15m_move numeric,
  add column if not exists first_30m_move numeric,
  add column if not exists first_60m_move numeric,
  add column if not exists close_move numeric,
  add column if not exists next_day_open_move numeric,
  add column if not exists open_price numeric,
  add column if not exists close_price numeric,
  add column if not exists volume numeric,
  add column if not exists max_drawdown_percent numeric,
  add column if not exists close_return_percent numeric,
  add column if not exists outcome_label text,
  add column if not exists trigger_combo text,
  add column if not exists learning_weight numeric default 1,
  add column if not exists outcome_status text not null default 'pending',
  add column if not exists updated_at timestamptz not null default now();

alter table public.signal_outcomes_detailed
  add column if not exists first_30m_move numeric default 0,
  add column if not exists first_60m_move numeric default 0,
  add column if not exists next_day_open_price numeric,
  add column if not exists next_day_open_move numeric default 0,
  add column if not exists outcome_classification text not null default 'pending',
  add column if not exists trigger_combo text,
  add column if not exists insider_quality_score numeric default 0,
  add column if not exists learning_weight numeric default 1,
  add column if not exists outcome_status text not null default 'pending',
  add column if not exists classification_version text not null default 'outcome-learning-v1';

update public.insider_events
set dedupe_key = lower(
  coalesce(ticker, '') || '|' ||
  coalesce(insider_name, '') || '|' ||
  coalesce(role, '') || '|' ||
  coalesce(event_type, '') || '|' ||
  coalesce(round(value_sek)::text, '0') || '|' ||
  coalesce(event_date::text, '')
)
where dedupe_key is null;

update public.signal_feed
set signal_key = lower(
  coalesce(ticker, '') || '|' ||
  coalesce(signal_type, '') || '|' ||
  coalesce(date_trunc('hour', observed_at)::text, '')
)
where signal_key is null;

update public.ranked_snapshots
set snapshot_key = lower(
  coalesce(ticker, '') || '|' ||
  coalesce(date_trunc('hour', snapshot_at)::text, '')
)
where snapshot_key is null;

update public.signal_outcomes_detailed
set trigger_combo = lower(
  coalesce(trigger, 'signal') || case when insider_activity >= 60 then '+insider' else '+no_insider' end ||
  case when float_profile = 'low' then '+low_float' else '' end
)
where trigger_combo is null;

alter table public.insider_events
  alter column dedupe_key set not null;

alter table public.signal_feed
  alter column signal_key set not null;

alter table public.ranked_snapshots
  alter column snapshot_key set not null;

-- ==================================================
-- 3. CLEAN DUPLICATES BEFORE UNIQUE INDEXES
-- ==================================================

delete from public.alert_history a
using public.alert_history b
where a.dedupe_key = b.dedupe_key
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

delete from public.insider_events a
using public.insider_events b
where a.dedupe_key = b.dedupe_key
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

delete from public.signal_feed a
using public.signal_feed b
where a.signal_key = b.signal_key
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

delete from public.ranked_snapshots a
using public.ranked_snapshots b
where a.snapshot_key = b.snapshot_key
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

-- ==================================================
-- 4. CREATE ALL INDEXES
-- ==================================================

create index if not exists social_mentions_ticker_observed_idx
  on public.social_mentions(ticker, observed_at desc);

create index if not exists insider_events_ticker_date_idx
  on public.insider_events(ticker, event_date desc);

create unique index if not exists insider_events_dedupe_key_idx
  on public.insider_events(dedupe_key);

create index if not exists signal_feed_ticker_observed_idx
  on public.signal_feed(ticker, observed_at desc);

create unique index if not exists signal_feed_signal_key_idx
  on public.signal_feed(signal_key);

create index if not exists ranked_snapshots_ticker_snapshot_idx
  on public.ranked_snapshots(ticker, snapshot_at desc);

create unique index if not exists ranked_snapshots_snapshot_key_idx
  on public.ranked_snapshots(snapshot_key);

create index if not exists narrative_history_ticker_observed_idx
  on public.narrative_history(ticker, observed_at desc);

create index if not exists alert_history_ticker_triggered_idx
  on public.alert_history(ticker, triggered_at desc);

create unique index if not exists alert_history_dedupe_key_idx
  on public.alert_history(dedupe_key);

create index if not exists signal_outcomes_ticker_horizon_idx
  on public.signal_outcomes(ticker, horizon, triggered_at desc);

create unique index if not exists signal_outcomes_signal_horizon_idx
  on public.signal_outcomes(signal_id, horizon);

create index if not exists signal_outcomes_status_horizon_idx
  on public.signal_outcomes(outcome_status, horizon, triggered_at desc);

create index if not exists signal_outcomes_trigger_combo_idx
  on public.signal_outcomes(trigger_combo, horizon, triggered_at desc);

create index if not exists signal_outcomes_detailed_ticker_idx
  on public.signal_outcomes_detailed(ticker, observed_at desc);

create index if not exists signal_outcomes_detailed_trigger_idx
  on public.signal_outcomes_detailed(trigger, outcome_label, observed_at desc);

create index if not exists signal_outcomes_detailed_regime_idx
  on public.signal_outcomes_detailed(market_regime, observed_at desc);

create index if not exists signal_outcomes_detailed_combo_idx
  on public.signal_outcomes_detailed(trigger_combo, outcome_classification, observed_at desc);

create index if not exists signal_outcomes_detailed_status_idx
  on public.signal_outcomes_detailed(outcome_status, observed_at desc);

create index if not exists pattern_history_ticker_observed_idx
  on public.pattern_history(ticker, observed_at desc);

create index if not exists edge_statistics_combo_idx
  on public.edge_statistics(signal_combo, calculated_at desc);

create index if not exists market_regimes_history_observed_idx
  on public.market_regimes_history(observed_at desc);

create index if not exists provider_runs_provider_created_idx
  on public.provider_runs(provider, created_at desc);

-- ==================================================
-- 5. ENABLE RLS
-- ==================================================

alter table public.social_mentions enable row level security;
alter table public.insider_events enable row level security;
alter table public.signal_feed enable row level security;
alter table public.ranked_snapshots enable row level security;
alter table public.narrative_history enable row level security;
alter table public.alert_history enable row level security;
alter table public.signal_outcomes enable row level security;
alter table public.signal_outcomes_detailed enable row level security;
alter table public.pattern_history enable row level security;
alter table public.edge_statistics enable row level security;
alter table public.market_regimes_history enable row level security;
alter table public.provider_runs enable row level security;

-- ==================================================
-- 6. DROP AND RECREATE POLICIES
-- ==================================================

drop policy if exists "Authenticated users can read social mentions" on public.social_mentions;
create policy "Authenticated users can read social mentions"
on public.social_mentions for select to authenticated using (true);

drop policy if exists "Authenticated users can read insider events" on public.insider_events;
create policy "Authenticated users can read insider events"
on public.insider_events for select to authenticated using (true);

drop policy if exists "Authenticated users can read signal feed" on public.signal_feed;
create policy "Authenticated users can read signal feed"
on public.signal_feed for select to authenticated using (true);

drop policy if exists "Authenticated users can read ranked snapshots" on public.ranked_snapshots;
create policy "Authenticated users can read ranked snapshots"
on public.ranked_snapshots for select to authenticated using (true);

drop policy if exists "Authenticated users can read narrative history" on public.narrative_history;
create policy "Authenticated users can read narrative history"
on public.narrative_history for select to authenticated using (true);

drop policy if exists "Authenticated users can read alert history" on public.alert_history;
create policy "Authenticated users can read alert history"
on public.alert_history for select to authenticated using (true);

drop policy if exists "Authenticated users can read signal outcomes" on public.signal_outcomes;
create policy "Authenticated users can read signal outcomes"
on public.signal_outcomes for select to authenticated using (true);

drop policy if exists "Authenticated users can read detailed signal outcomes" on public.signal_outcomes_detailed;
create policy "Authenticated users can read detailed signal outcomes"
on public.signal_outcomes_detailed for select to authenticated using (true);

drop policy if exists "Service role can manage detailed signal outcomes" on public.signal_outcomes_detailed;
create policy "Service role can manage detailed signal outcomes"
on public.signal_outcomes_detailed for all to service_role using (true) with check (true);

drop policy if exists "Authenticated users can read pattern history" on public.pattern_history;
create policy "Authenticated users can read pattern history"
on public.pattern_history for select to authenticated using (true);

drop policy if exists "Authenticated users can read edge statistics" on public.edge_statistics;
create policy "Authenticated users can read edge statistics"
on public.edge_statistics for select to authenticated using (true);

drop policy if exists "Authenticated users can read market regimes history" on public.market_regimes_history;
create policy "Authenticated users can read market regimes history"
on public.market_regimes_history for select to authenticated using (true);

drop policy if exists "Authenticated users can read provider runs" on public.provider_runs;
create policy "Authenticated users can read provider runs"
on public.provider_runs for select to authenticated using (true);

-- ==================================================
-- 7. PORTFOLIO INTELLIGENCE V1
-- ==================================================

create table if not exists public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text,
  exchange text,
  source_market text,
  isin text,
  currency text not null default 'SEK',
  country text,
  avg_entry numeric(18, 6) not null default 0 check (avg_entry >= 0),
  size numeric(18, 6) not null default 0 check (size >= 0),
  conviction integer not null default 50 check (conviction between 0 and 100),
  notes text,
  strategy_bucket text not null default 'swing' check (strategy_bucket in ('core', 'swing', 'speculative', 'event-driven')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

alter table public.portfolio_holdings add column if not exists source_market text;
alter table public.portfolio_holdings add column if not exists isin text;
alter table public.portfolio_holdings add column if not exists currency text not null default 'SEK';
alter table public.portfolio_holdings add column if not exists country text;

create table if not exists public.holding_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid not null references public.portfolio_holdings(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_holdings_user_id_idx on public.portfolio_holdings(user_id);
create index if not exists portfolio_holdings_ticker_idx on public.portfolio_holdings(ticker);
create index if not exists portfolio_holdings_isin_idx on public.portfolio_holdings(isin);
create unique index if not exists portfolio_holdings_user_isin_unique_idx
  on public.portfolio_holdings(user_id, isin)
  where isin is not null and isin <> '';
create index if not exists holding_notes_user_id_idx on public.holding_notes(user_id);
create index if not exists holding_notes_holding_id_idx on public.holding_notes(holding_id);

drop trigger if exists set_portfolio_holdings_updated_at on public.portfolio_holdings;
create trigger set_portfolio_holdings_updated_at
before update on public.portfolio_holdings
for each row execute function public.set_updated_at();

alter table public.portfolio_holdings enable row level security;
alter table public.holding_notes enable row level security;

drop policy if exists "Portfolio holdings are private per user" on public.portfolio_holdings;
create policy "Portfolio holdings are private per user"
on public.portfolio_holdings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can select own portfolio holdings" on public.portfolio_holdings;
create policy "Authenticated users can select own portfolio holdings"
on public.portfolio_holdings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Authenticated users can insert own portfolio holdings" on public.portfolio_holdings;
create policy "Authenticated users can insert own portfolio holdings"
on public.portfolio_holdings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can update own portfolio holdings" on public.portfolio_holdings;
create policy "Authenticated users can update own portfolio holdings"
on public.portfolio_holdings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can delete own portfolio holdings" on public.portfolio_holdings;
create policy "Authenticated users can delete own portfolio holdings"
on public.portfolio_holdings for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Holding notes are private per user" on public.holding_notes;
create policy "Holding notes are private per user"
on public.holding_notes for all
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.portfolio_holdings
    where portfolio_holdings.id = holding_notes.holding_id
    and portfolio_holdings.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.portfolio_holdings
    where portfolio_holdings.id = holding_notes.holding_id
    and portfolio_holdings.user_id = auth.uid()
  )
);

-- ==================================================
-- 8. RAKETRADAR AGENT LOOP V1
-- ==================================================

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  session_mode text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_case_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.agent_sessions(id) on delete cascade,
  ticker text not null,
  company_name text,
  exchange text,
  previous_state text,
  state text not null,
  reason text not null,
  confidence integer not null default 0,
  session_mode text not null,
  event_key text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.agent_sessions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  feedback_type text not null,
  note text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_alerts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.agent_sessions(id) on delete cascade,
  ticker text not null,
  alert_type text not null,
  severity text not null default 'LOW',
  title text not null,
  message text not null,
  acknowledged boolean not null default false,
  dedupe_key text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_sessions_key_idx on public.agent_sessions(session_key);
create index if not exists agent_case_events_session_created_idx on public.agent_case_events(session_id, created_at desc);
create index if not exists agent_case_events_ticker_created_idx on public.agent_case_events(ticker, created_at desc);
create unique index if not exists agent_case_events_session_event_key_idx on public.agent_case_events(session_id, event_key);
create index if not exists agent_feedback_user_created_idx on public.agent_feedback(user_id, created_at desc);
create index if not exists agent_feedback_ticker_created_idx on public.agent_feedback(ticker, created_at desc);
create index if not exists agent_alerts_session_created_idx on public.agent_alerts(session_id, created_at desc);
create index if not exists agent_alerts_ticker_created_idx on public.agent_alerts(ticker, created_at desc);
create unique index if not exists agent_alerts_dedupe_key_idx on public.agent_alerts(dedupe_key);

drop trigger if exists set_agent_sessions_updated_at on public.agent_sessions;
create trigger set_agent_sessions_updated_at
before update on public.agent_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_agent_alerts_updated_at on public.agent_alerts;
create trigger set_agent_alerts_updated_at
before update on public.agent_alerts
for each row execute function public.set_updated_at();

alter table public.agent_sessions enable row level security;
alter table public.agent_case_events enable row level security;
alter table public.agent_feedback enable row level security;
alter table public.agent_alerts enable row level security;

drop policy if exists "Authenticated users can read agent sessions" on public.agent_sessions;
create policy "Authenticated users can read agent sessions"
on public.agent_sessions for select to authenticated using (true);

drop policy if exists "Authenticated users can read agent case events" on public.agent_case_events;
create policy "Authenticated users can read agent case events"
on public.agent_case_events for select to authenticated using (true);

drop policy if exists "Authenticated users can read agent alerts" on public.agent_alerts;
create policy "Authenticated users can read agent alerts"
on public.agent_alerts for select to authenticated using (true);

drop policy if exists "Agent feedback is private per user" on public.agent_feedback;
create policy "Agent feedback is private per user"
on public.agent_feedback for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can insert own agent feedback" on public.agent_feedback;
create policy "Authenticated users can insert own agent feedback"
on public.agent_feedback for insert to authenticated
with check (auth.uid() = user_id);

-- ==================================================
-- 9. REALTIME RE-RANKING + SCHEDULER V1
-- ==================================================

create table if not exists public.intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  jobs text[] not null default '{}',
  reason text not null default 'manual',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  latency_ms integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ranking_changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.intelligence_runs(id) on delete cascade,
  ticker text not null,
  change_type text not null,
  previous_value text,
  current_value text,
  severity text not null default 'LOW',
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.case_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.intelligence_runs(id) on delete cascade,
  ticker text not null,
  state text not null,
  score numeric not null default 0,
  confidence numeric not null default 0,
  risk numeric not null default 0,
  source text not null default 'agent',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_runs_created_idx on public.intelligence_runs(created_at desc);
create index if not exists intelligence_runs_status_created_idx on public.intelligence_runs(status, created_at desc);
create index if not exists ranking_changes_run_idx on public.ranking_changes(run_id, created_at desc);
create index if not exists ranking_changes_ticker_idx on public.ranking_changes(ticker, created_at desc);
create index if not exists ranking_changes_type_idx on public.ranking_changes(change_type, severity, created_at desc);
create index if not exists case_state_snapshots_run_idx on public.case_state_snapshots(run_id, created_at desc);
create index if not exists case_state_snapshots_ticker_idx on public.case_state_snapshots(ticker, created_at desc);
create index if not exists case_state_snapshots_state_idx on public.case_state_snapshots(state, created_at desc);

drop trigger if exists set_intelligence_runs_updated_at on public.intelligence_runs;
create trigger set_intelligence_runs_updated_at
before update on public.intelligence_runs
for each row execute function public.set_updated_at();

alter table public.intelligence_runs enable row level security;
alter table public.ranking_changes enable row level security;
alter table public.case_state_snapshots enable row level security;

drop policy if exists "Authenticated users can read intelligence runs" on public.intelligence_runs;
create policy "Authenticated users can read intelligence runs"
on public.intelligence_runs for select to authenticated using (true);

drop policy if exists "Authenticated users can read ranking changes" on public.ranking_changes;
create policy "Authenticated users can read ranking changes"
on public.ranking_changes for select to authenticated using (true);

drop policy if exists "Authenticated users can read case state snapshots" on public.case_state_snapshots;
create policy "Authenticated users can read case state snapshots"
on public.case_state_snapshots for select to authenticated using (true);

drop policy if exists "Service role can manage intelligence runs" on public.intelligence_runs;
create policy "Service role can manage intelligence runs"
on public.intelligence_runs for all to service_role using (true) with check (true);

drop policy if exists "Service role can manage ranking changes" on public.ranking_changes;
create policy "Service role can manage ranking changes"
on public.ranking_changes for all to service_role using (true) with check (true);

drop policy if exists "Service role can manage case state snapshots" on public.case_state_snapshots;
create policy "Service role can manage case state snapshots"
on public.case_state_snapshots for all to service_role using (true) with check (true);

-- ==================================================
-- 10. OVERNIGHT AUTONOMY + LEARNING HARVEST V1
-- ==================================================

create table if not exists public.autonomy_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'manual',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_run_at timestamptz,
  interval_ms integer not null default 900000,
  run_count integer not null default 0,
  cases_observed integer not null default 0,
  observations_count integer not null default 0,
  failed_providers jsonb not null default '[]'::jsonb,
  missing_coverage jsonb not null default '[]'::jsonb,
  notable_changes jsonb not null default '[]'::jsonb,
  learned_observations jsonb not null default '[]'::jsonb,
  morning_summary_payload jsonb not null default '{}'::jsonb,
  last_run_summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_observations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.intelligence_runs(id) on delete set null,
  autonomy_session_id uuid references public.autonomy_sessions(id) on delete set null,
  observed_at timestamptz not null,
  session_mode text not null,
  ticker text,
  observation_type text not null,
  source text not null,
  signal_state text,
  confidence numeric,
  score numeric,
  risk numeric,
  rvol numeric,
  momentum numeric,
  continuation_probability numeric,
  fade_probability numeric,
  suppression_reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.learning_observations
  add column if not exists autonomy_session_id uuid references public.autonomy_sessions(id) on delete set null;

create table if not exists public.provider_coverage_snapshots (
  id uuid primary key default gen_random_uuid(),
  autonomy_session_id uuid references public.autonomy_sessions(id) on delete set null,
  run_id uuid references public.intelligence_runs(id) on delete set null,
  observed_at timestamptz not null default now(),
  provider text not null,
  scanned_count integer not null default 0,
  live_hits integer not null default 0,
  missing_data_count integer not null default 0,
  coverage_by_exchange jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.overnight_summaries (
  id uuid primary key default gen_random_uuid(),
  autonomy_session_id uuid references public.autonomy_sessions(id) on delete set null,
  generated_at timestamptz not null default now(),
  summary_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.morning_brief_payloads (
  id uuid primary key default gen_random_uuid(),
  autonomy_session_id uuid references public.autonomy_sessions(id) on delete set null,
  generated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists autonomy_sessions_status_idx
  on public.autonomy_sessions(status, created_at desc);

create index if not exists autonomy_sessions_started_idx
  on public.autonomy_sessions(started_at desc);

create index if not exists learning_observations_observed_idx
  on public.learning_observations(observed_at desc);

create index if not exists learning_observations_session_idx
  on public.learning_observations(autonomy_session_id, observed_at desc);

create index if not exists learning_observations_ticker_idx
  on public.learning_observations(ticker, observed_at desc);

create index if not exists learning_observations_type_idx
  on public.learning_observations(observation_type, observed_at desc);

create index if not exists learning_observations_run_idx
  on public.learning_observations(run_id, observed_at desc);

create index if not exists learning_observations_state_idx
  on public.learning_observations(signal_state, observed_at desc);

create index if not exists provider_coverage_session_idx
  on public.provider_coverage_snapshots(autonomy_session_id, observed_at desc);

create index if not exists provider_coverage_provider_idx
  on public.provider_coverage_snapshots(provider, observed_at desc);

create index if not exists overnight_summaries_generated_idx
  on public.overnight_summaries(generated_at desc);

create index if not exists morning_brief_payloads_generated_idx
  on public.morning_brief_payloads(generated_at desc);

drop trigger if exists set_autonomy_sessions_updated_at on public.autonomy_sessions;
create trigger set_autonomy_sessions_updated_at
before update on public.autonomy_sessions
for each row execute function public.set_updated_at();

alter table public.autonomy_sessions enable row level security;
alter table public.learning_observations enable row level security;
alter table public.provider_coverage_snapshots enable row level security;
alter table public.overnight_summaries enable row level security;
alter table public.morning_brief_payloads enable row level security;

drop policy if exists "Authenticated users can read autonomy sessions" on public.autonomy_sessions;
create policy "Authenticated users can read autonomy sessions"
on public.autonomy_sessions for select to authenticated using (true);

drop policy if exists "Service role can manage autonomy sessions" on public.autonomy_sessions;
create policy "Service role can manage autonomy sessions"
on public.autonomy_sessions for all to service_role using (true) with check (true);

drop policy if exists "Authenticated users can read learning observations" on public.learning_observations;
create policy "Authenticated users can read learning observations"
on public.learning_observations for select to authenticated using (true);

drop policy if exists "Service role can manage learning observations" on public.learning_observations;
create policy "Service role can manage learning observations"
on public.learning_observations for all to service_role using (true) with check (true);

drop policy if exists "Authenticated users can read provider coverage snapshots" on public.provider_coverage_snapshots;
create policy "Authenticated users can read provider coverage snapshots"
on public.provider_coverage_snapshots for select to authenticated using (true);

drop policy if exists "Service role can manage provider coverage snapshots" on public.provider_coverage_snapshots;
create policy "Service role can manage provider coverage snapshots"
on public.provider_coverage_snapshots for all to service_role using (true) with check (true);

drop policy if exists "Authenticated users can read overnight summaries" on public.overnight_summaries;
create policy "Authenticated users can read overnight summaries"
on public.overnight_summaries for select to authenticated using (true);

drop policy if exists "Service role can manage overnight summaries" on public.overnight_summaries;
create policy "Service role can manage overnight summaries"
on public.overnight_summaries for all to service_role using (true) with check (true);

drop policy if exists "Authenticated users can read morning brief payloads" on public.morning_brief_payloads;
create policy "Authenticated users can read morning brief payloads"
on public.morning_brief_payloads for select to authenticated using (true);

drop policy if exists "Service role can manage morning brief payloads" on public.morning_brief_payloads;
create policy "Service role can manage morning brief payloads"
on public.morning_brief_payloads for all to service_role using (true) with check (true);

-- ==================================================
-- 11. COPILOT RETRIEVAL + ENTITY INTELLIGENCE V1
-- ==================================================

create table if not exists public.copilot_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  normalized_query text,
  detected_tickers text[] not null default '{}'::text[],
  resolved_entities jsonb not null default '[]'::jsonb,
  context_payload jsonb not null default '{}'::jsonb,
  confidence numeric,
  source text not null default 'copilot',
  session_id uuid
);

create table if not exists public.copilot_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message_id uuid references public.copilot_messages(id) on delete set null,
  feedback_type text not null check (feedback_type in ('WRONG_TICKER', 'MISSING_TICKER', 'BAD_REASONING', 'USEFUL')),
  ticker text,
  note text,
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists copilot_messages_created_idx
  on public.copilot_messages(created_at desc);

create index if not exists copilot_messages_tickers_idx
  on public.copilot_messages using gin(detected_tickers);

create index if not exists copilot_messages_source_idx
  on public.copilot_messages(source, created_at desc);

create index if not exists copilot_feedback_created_idx
  on public.copilot_feedback(created_at desc);

create index if not exists copilot_feedback_ticker_idx
  on public.copilot_feedback(ticker, created_at desc);

alter table public.copilot_messages enable row level security;
alter table public.copilot_feedback enable row level security;

drop policy if exists "Authenticated users can read copilot messages" on public.copilot_messages;
create policy "Authenticated users can read copilot messages"
on public.copilot_messages for select to authenticated using (true);

drop policy if exists "Service role can manage copilot messages" on public.copilot_messages;
create policy "Service role can manage copilot messages"
on public.copilot_messages for all to service_role using (true) with check (true);

drop policy if exists "Authenticated users can read copilot feedback" on public.copilot_feedback;
create policy "Authenticated users can read copilot feedback"
on public.copilot_feedback for select to authenticated using (true);

drop policy if exists "Service role can manage copilot feedback" on public.copilot_feedback;
create policy "Service role can manage copilot feedback"
on public.copilot_feedback for all to service_role using (true) with check (true);

-- ==================================================
-- 12. PROVIDER COVERAGE + SUSPICIOUS UNKNOWNS V1
-- ==================================================

create table if not exists public.provider_coverage_gaps (
  id uuid primary key default gen_random_uuid(),
  ticker text,
  provider text not null,
  gap_type text not null,
  severity text not null default 'MEDIUM',
  reason text not null,
  observed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ticker_coverage_profiles (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  provider_success_rate numeric not null default 0,
  last_successful_fetch timestamptz,
  news_coverage numeric not null default 0,
  volume_coverage numeric not null default 0,
  market_coverage numeric not null default 0,
  entity_confidence numeric not null default 0,
  unresolved_frequency integer not null default 0,
  suppression_count integer not null default 0,
  false_negative_risk numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists provider_coverage_gaps_ticker_idx
  on public.provider_coverage_gaps(ticker, observed_at desc);

create index if not exists provider_coverage_gaps_type_idx
  on public.provider_coverage_gaps(gap_type, severity, observed_at desc);

create index if not exists ticker_coverage_profiles_ticker_idx
  on public.ticker_coverage_profiles(ticker);

create index if not exists ticker_coverage_profiles_risk_idx
  on public.ticker_coverage_profiles(false_negative_risk desc, updated_at desc);

drop trigger if exists set_ticker_coverage_profiles_updated_at on public.ticker_coverage_profiles;
create trigger set_ticker_coverage_profiles_updated_at
before update on public.ticker_coverage_profiles
for each row execute function public.set_updated_at();

alter table public.provider_coverage_gaps enable row level security;
alter table public.ticker_coverage_profiles enable row level security;

drop policy if exists "Authenticated users can read provider coverage gaps" on public.provider_coverage_gaps;
create policy "Authenticated users can read provider coverage gaps"
on public.provider_coverage_gaps for select to authenticated using (true);

drop policy if exists "Service role can manage provider coverage gaps" on public.provider_coverage_gaps;
create policy "Service role can manage provider coverage gaps"
on public.provider_coverage_gaps for all to service_role using (true) with check (true);

drop policy if exists "Authenticated users can read ticker coverage profiles" on public.ticker_coverage_profiles;
create policy "Authenticated users can read ticker coverage profiles"
on public.ticker_coverage_profiles for select to authenticated using (true);

drop policy if exists "Service role can manage ticker coverage profiles" on public.ticker_coverage_profiles;
create policy "Service role can manage ticker coverage profiles"
on public.ticker_coverage_profiles for all to service_role using (true) with check (true);
