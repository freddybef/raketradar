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

update public.signal_outcomes_detailed
set trigger_combo = lower(
  coalesce(trigger, 'signal') || case when insider_activity >= 60 then '+insider' else '+no_insider' end ||
  case when float_profile = 'low' then '+low_float' else '' end
)
where trigger_combo is null;

create index if not exists signal_outcomes_status_horizon_idx
  on public.signal_outcomes(outcome_status, horizon, triggered_at desc);

create index if not exists signal_outcomes_trigger_combo_idx
  on public.signal_outcomes(trigger_combo, horizon, triggered_at desc);

create index if not exists signal_outcomes_detailed_combo_idx
  on public.signal_outcomes_detailed(trigger_combo, outcome_classification, observed_at desc);

create index if not exists signal_outcomes_detailed_status_idx
  on public.signal_outcomes_detailed(outcome_status, observed_at desc);
