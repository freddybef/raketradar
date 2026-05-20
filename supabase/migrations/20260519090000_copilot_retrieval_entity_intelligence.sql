create extension if not exists pgcrypto;

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

create index if not exists copilot_messages_created_idx on public.copilot_messages(created_at desc);
create index if not exists copilot_messages_tickers_idx on public.copilot_messages using gin(detected_tickers);
create index if not exists copilot_messages_source_idx on public.copilot_messages(source, created_at desc);
create index if not exists copilot_feedback_created_idx on public.copilot_feedback(created_at desc);
create index if not exists copilot_feedback_ticker_idx on public.copilot_feedback(ticker, created_at desc);

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
