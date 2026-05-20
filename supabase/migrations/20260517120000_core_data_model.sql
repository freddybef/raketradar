create extension if not exists "pgcrypto";

create table if not exists public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  base_currency text not null default 'SEK',
  risk_profile text not null default 'balanced' check (risk_profile in ('conservative', 'balanced', 'aggressive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text not null,
  market text,
  shares numeric(18, 6) not null default 0 check (shares >= 0),
  average_price numeric(18, 6) not null default 0 check (average_price >= 0),
  current_price numeric(18, 6) not null default 0 check (current_price >= 0),
  currency text not null default 'SEK',
  thesis text,
  risk_note text,
  target_price numeric(18, 6),
  stop_loss numeric(18, 6),
  status text not null default 'active' check (status in ('active', 'watching', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text not null,
  market text,
  target_entry numeric(18, 6),
  target_exit numeric(18, 6),
  notes text,
  priority integer not null default 3 check (priority between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, ticker)
);

create table if not exists public.stock_signals (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  company_name text not null,
  market text,
  score integer not null check (score between 0 and 100),
  signal_type text not null,
  action text not null,
  confidence integer check (confidence between 0 and 100),
  time_horizon text,
  trigger_source text,
  risk_level text,
  description text not null,
  ai_reason text,
  source_url text,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  ticker text,
  company_name text,
  headline text not null,
  summary text,
  source text,
  url text,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  impact_score integer check (impact_score between 0 and 100),
  published_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text,
  analysis_type text not null default 'stock',
  thesis text not null,
  bull_case text,
  bear_case text,
  recommendation text,
  confidence integer check (confidence between 0 and 100),
  model text,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  company_name text,
  alert_type text not null check (alert_type in ('price_above', 'price_below', 'signal_score', 'news', 'volume', 'custom')),
  threshold_value numeric(18, 6),
  message text not null,
  is_active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_positions_user_id_idx on public.portfolio_positions(user_id);
create index if not exists watchlists_user_id_idx on public.watchlists(user_id);
create index if not exists watchlist_items_watchlist_id_idx on public.watchlist_items(watchlist_id);
create index if not exists watchlist_items_user_id_idx on public.watchlist_items(user_id);
create index if not exists stock_signals_detected_at_idx on public.stock_signals(detected_at desc);
create index if not exists stock_signals_ticker_idx on public.stock_signals(ticker);
create index if not exists news_items_published_at_idx on public.news_items(published_at desc);
create index if not exists news_items_ticker_idx on public.news_items(ticker);
create index if not exists ai_analyses_user_id_idx on public.ai_analyses(user_id);
create index if not exists ai_analyses_ticker_idx on public.ai_analyses(ticker);
create index if not exists alerts_user_id_idx on public.alerts(user_id);
create index if not exists alerts_ticker_idx on public.alerts(ticker);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profile_updated_at on public.user_profile;
create trigger set_user_profile_updated_at
before update on public.user_profile
for each row execute function public.set_updated_at();

drop trigger if exists set_portfolio_positions_updated_at on public.portfolio_positions;
create trigger set_portfolio_positions_updated_at
before update on public.portfolio_positions
for each row execute function public.set_updated_at();

drop trigger if exists set_watchlists_updated_at on public.watchlists;
create trigger set_watchlists_updated_at
before update on public.watchlists
for each row execute function public.set_updated_at();

drop trigger if exists set_watchlist_items_updated_at on public.watchlist_items;
create trigger set_watchlist_items_updated_at
before update on public.watchlist_items
for each row execute function public.set_updated_at();

drop trigger if exists set_alerts_updated_at on public.alerts;
create trigger set_alerts_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();

alter table public.user_profile enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.stock_signals enable row level security;
alter table public.news_items enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.alerts enable row level security;

create policy "Profiles are owned by the authenticated user"
on public.user_profile for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Portfolio positions are private per user"
on public.portfolio_positions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Watchlists are private per user"
on public.watchlists for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Watchlist items are private per user"
on public.watchlist_items for all
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.watchlists
    where watchlists.id = watchlist_items.watchlist_id
    and watchlists.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.watchlists
    where watchlists.id = watchlist_items.watchlist_id
    and watchlists.user_id = auth.uid()
  )
);

create policy "Authenticated users can read stock signals"
on public.stock_signals for select
to authenticated
using (true);

create policy "Authenticated users can read news"
on public.news_items for select
to authenticated
using (true);

create policy "Users can read public or owned AI analyses"
on public.ai_analyses for select
to authenticated
using (user_id is null or auth.uid() = user_id);

create policy "Users can manage their own AI analyses"
on public.ai_analyses for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Alerts are private per user"
on public.alerts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
