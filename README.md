# RaketRadar Core

RaketRadar är en Next.js-baserad trading-assistent för svenska småbolag. Fokus just nu är live-loop: FI insider-ingestion, Supabase-persistens, pipeline health och historikinsamling.

## Local Development

```bash
npm run dev
npm run lint
npm run build
```

## Production Env

Lägg dessa i `.env.local` lokalt och i deployment-providerns environment settings i produktion:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INTELLIGENCE_RUN_SECRET=
CRON_SECRET=
FI_INSIDER_SOURCE_URL=
MFN_FEED_URL=
CISION_FEED_URL=
NEWS_FEED_URL=
FINWIRE_FEED_URL=
PLACERA_FEED_URL=
BORSKOLLEN_FEED_URL=
YAHOO_NORDIC_FEED_URL=
DI_BORS_FEED_URL=
BREAKIT_FEED_URL=
REDEYE_FEED_URL=
MANGOLD_INSIGHT_FEED_URL=
ANALYST_GROUP_FEED_URL=
NASDAQ_FUTURES_TONE=
INTELLIGENCE_RUN_MIN_INTERVAL_MS=
```

`FI_INSIDER_SOURCE_URL` är optional. Om den saknas används standardadaptern mot FI:s publiceringsklient.
`CRON_SECRET` är optional om den sätts till samma värde som `INTELLIGENCE_RUN_SECRET`, men rekommenderas för Vercel Cron-kompatibilitet.
News-feed URL:er är optional och kan vara RSS, Atom eller JSON. Sätt minst en av dem för riktig pre-open news-ingestion. `NASDAQ_FUTURES_TONE` kan vara `positive`, `neutral` eller `negative` tills riktig makrofeed kopplas.

## Supabase Migrations

Kör migrationerna i denna ordning:

```text
supabase/migrations/20260517133000_intelligence_storage.sql
supabase/migrations/20260517143000_edge_validation_history.sql
supabase/migrations/20260517150000_fi_live_ingestion.sql
supabase/migrations/20260517160000_live_loop_hardening.sql
```

Efter migration ska dessa tabeller finnas:

```text
insider_events
provider_runs
signal_outcomes
signal_feed
ranked_snapshots
alert_history
```

## Live Pipeline

Kör pipeline manuellt:

```bash
curl -X POST https://YOUR_DOMAIN/api/intelligence/run \
  -H "x-raketradar-secret: YOUR_INTELLIGENCE_RUN_SECRET"
```

Alternativt fungerar:

```bash
curl https://YOUR_DOMAIN/api/intelligence/run \
  -H "Authorization: Bearer YOUR_INTELLIGENCE_RUN_SECRET"
```

Verifiera FI-data:

```bash
curl https://YOUR_DOMAIN/api/intelligence/insiders
```

## Scheduler

`vercel.json` innehåller Vercel Cron för:

- tätare körning inför och runt öppning
- var 10:e minut intradag
- långsammare efter stängning

Cron-tiderna är satta i UTC och matchar svensk sommartid. Justera inför vintertid om Vercel-projektet inte använder en separat scheduler som hanterar Europe/Stockholm.

## Daily-Use Checklist

- Börja i Morning War Room.
- Skanna HIGH CONVICTION först.
- Titta på EARLY ONLY för setups innan breakout.
- Titta på STEALTH ONLY för låg uppmärksamhet plus insider/volym.
- Kontrollera FI Insider Live för nya köp/sälj och kluster.
- Följ utfall i `signal_outcomes`.
- Trimma false positives varje vecka utifrån provider_runs, alert_history och utfall.
