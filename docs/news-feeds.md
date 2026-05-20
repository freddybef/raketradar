# RaketRadar news feeds

Terminal V2 can read server-side RSS/Atom feeds and pass the headlines into the canonical trading snapshot.

## Configure RSS feeds

Add one or more RSS/Atom URLs to `.env.local`:

```env
NEWS_PROVIDER_MODE=rss
NEWS_RSS_FEEDS=https://example.com/rss,https://example.com/feed.xml
```

Use comma-separated URLs. Keep the value on one line.

## Restart after changes

Next.js reads environment variables when the dev server starts. After changing `.env.local`, restart:

```powershell
npm run dev
```

## Verify in Terminal V2

Open:

```text
/terminal-v2
```

Check `News Trigger Inbox`:

- `RSS LIVE` means at least one configured RSS/API feed fetched successfully.
- `RSS ERROR` means RSS was configured but fetch/parse failed or returned no current headlines.
- `MOCK` means no RSS feed is configured and RaketRadar is using safe local mock/manual examples.
- `DISABLED` means no usable news provider data is available.

RaketRadar only claims live news coverage when `NEWS_RSS_FEEDS` is configured and at least one feed returns current headlines. Mock/manual headlines are visible for development but should not be treated as live market news.

## Current limitations

- No Avanza scraping is used.
- No external package dependency is required.
- RSS parsing is intentionally lightweight and server-side only.
- Only current Stockholm trading-day headlines are treated as live/current when the feed provides dates.
