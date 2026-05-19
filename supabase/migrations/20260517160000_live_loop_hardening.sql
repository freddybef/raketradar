alter table public.signal_feed
  add column if not exists signal_key text;

update public.signal_feed
set signal_key = lower(
  coalesce(ticker, '') || '|' ||
  coalesce(signal_type, '') || '|' ||
  coalesce(date_trunc('hour', observed_at)::text, '')
)
where signal_key is null;

delete from public.signal_feed a
using public.signal_feed b
where a.signal_key = b.signal_key
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

alter table public.signal_feed
  alter column signal_key set not null;

create unique index if not exists signal_feed_signal_key_idx
  on public.signal_feed(signal_key);

alter table public.ranked_snapshots
  add column if not exists snapshot_key text;

update public.ranked_snapshots
set snapshot_key = lower(
  coalesce(ticker, '') || '|' ||
  coalesce(date_trunc('hour', snapshot_at)::text, '')
)
where snapshot_key is null;

delete from public.ranked_snapshots a
using public.ranked_snapshots b
where a.snapshot_key = b.snapshot_key
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id < b.id)
  );

alter table public.ranked_snapshots
  alter column snapshot_key set not null;

create unique index if not exists ranked_snapshots_snapshot_key_idx
  on public.ranked_snapshots(snapshot_key);
