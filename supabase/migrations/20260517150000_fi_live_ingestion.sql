alter table public.insider_events
  add column if not exists dedupe_key text;

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

delete from public.insider_events a
using public.insider_events b
where a.dedupe_key = b.dedupe_key
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

alter table public.insider_events
  alter column dedupe_key set not null;

create unique index if not exists insider_events_dedupe_key_idx
  on public.insider_events(dedupe_key);

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

create index if not exists provider_runs_provider_created_idx
  on public.provider_runs(provider, created_at desc);

alter table public.provider_runs enable row level security;

create policy "Authenticated users can read provider runs"
on public.provider_runs for select to authenticated using (true);

create unique index if not exists signal_outcomes_signal_horizon_idx
  on public.signal_outcomes(signal_id, horizon);
