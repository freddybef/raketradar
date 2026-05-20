create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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

create index if not exists provider_coverage_gaps_ticker_idx on public.provider_coverage_gaps(ticker, observed_at desc);
create index if not exists provider_coverage_gaps_type_idx on public.provider_coverage_gaps(gap_type, severity, observed_at desc);
create index if not exists ticker_coverage_profiles_ticker_idx on public.ticker_coverage_profiles(ticker);
create index if not exists ticker_coverage_profiles_risk_idx on public.ticker_coverage_profiles(false_negative_risk desc, updated_at desc);

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
