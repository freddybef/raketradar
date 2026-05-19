create extension if not exists "pgcrypto";

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
