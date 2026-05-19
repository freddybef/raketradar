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
  created_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists social_mentions_ticker_observed_idx on public.social_mentions(ticker, observed_at desc);
create index if not exists insider_events_ticker_date_idx on public.insider_events(ticker, event_date desc);
create index if not exists signal_feed_ticker_observed_idx on public.signal_feed(ticker, observed_at desc);
create index if not exists ranked_snapshots_ticker_snapshot_idx on public.ranked_snapshots(ticker, snapshot_at desc);
create index if not exists narrative_history_ticker_observed_idx on public.narrative_history(ticker, observed_at desc);
create index if not exists alert_history_ticker_triggered_idx on public.alert_history(ticker, triggered_at desc);

alter table public.social_mentions enable row level security;
alter table public.insider_events enable row level security;
alter table public.signal_feed enable row level security;
alter table public.ranked_snapshots enable row level security;
alter table public.narrative_history enable row level security;
alter table public.alert_history enable row level security;

create policy "Authenticated users can read social mentions"
on public.social_mentions for select to authenticated using (true);

create policy "Authenticated users can read insider events"
on public.insider_events for select to authenticated using (true);

create policy "Authenticated users can read signal feed"
on public.signal_feed for select to authenticated using (true);

create policy "Authenticated users can read ranked snapshots"
on public.ranked_snapshots for select to authenticated using (true);

create policy "Authenticated users can read narrative history"
on public.narrative_history for select to authenticated using (true);

create policy "Authenticated users can read alert history"
on public.alert_history for select to authenticated using (true);
