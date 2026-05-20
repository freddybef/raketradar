create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

create index if not exists autonomy_sessions_status_idx on public.autonomy_sessions(status, created_at desc);
create index if not exists autonomy_sessions_started_idx on public.autonomy_sessions(started_at desc);
create index if not exists learning_observations_session_idx on public.learning_observations(autonomy_session_id, observed_at desc);
create index if not exists learning_observations_observed_idx on public.learning_observations(observed_at desc);
create index if not exists learning_observations_ticker_idx on public.learning_observations(ticker, observed_at desc);
create index if not exists learning_observations_type_idx on public.learning_observations(observation_type, observed_at desc);
create index if not exists provider_coverage_session_idx on public.provider_coverage_snapshots(autonomy_session_id, observed_at desc);
create index if not exists provider_coverage_provider_idx on public.provider_coverage_snapshots(provider, observed_at desc);
create index if not exists overnight_summaries_generated_idx on public.overnight_summaries(generated_at desc);
create index if not exists morning_brief_payloads_generated_idx on public.morning_brief_payloads(generated_at desc);

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
