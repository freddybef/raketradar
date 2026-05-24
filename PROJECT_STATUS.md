# RaketRadar Project Status

Last verified: 2026-05-24
Source of truth: GitHub repo + this file. Chat history is not source of truth.

## Product definition

RaketRadar is a personal AI-first trading companion for Swedish/Nordic small caps.

Primary job:
- detect abnormality early
- identify continuation and repricing
- support explicit decisions: BUY, HOLD, SELL, WATCH
- remember previous movers and case behavior
- help with exits as much as entries

RaketRadar is not:
- a Bloomberg terminal
- a generic market dashboard
- a social product
- an order book / Level 2 system
- a hedge fund platform

## Locked architecture until a concrete verified problem proves otherwise

AI-first with thin backend.

Backend responsibilities:
- ingest feeds
- keep state/history
- persist alerts
- maintain watchlists/universe
- Supabase persistence

AI/resolution responsibilities:
- interpret signals
- recognize patterns
- build conviction
- compare with prior cases
- produce practical buy/hold/sell/watch reads

No new subsystem should be added unless it solves a verified edge problem.

## Current repo facts verified

### Framework and runtime

- Next.js app named `raketradar-core`.
- Scripts: `dev`, `build`, `start`, `lint`.
- Key dependencies: Next, React, Supabase JS.

### Persistence

The repo expects Supabase for durable state. If Supabase env vars are missing, multiple repository functions intentionally degrade to skipped/missing persistence rather than hard failing.

Known persistence areas in code:
- insider events
- provider runs
- signal outcomes
- signal feed
- ranked snapshots
- alert history
- intelligence runs
- case state snapshots
- ranking changes
- agent alerts
- learning observations

### Scheduler

`vercel.json` defines cron runs for `/api/intelligence/run`:
- pre/opening cluster around 06:45-07:15 UTC weekdays
- every 10 minutes during 07:00-15:00 UTC weekdays
- evening runs at 16:00 and 18:00 UTC weekdays

This is UTC and must be checked against Swedish market hours and daylight saving time.

### Intelligence runner

Current default run jobs:
- `marketReaction`
- `discovery`
- `warRoom`
- `agentLoop`
- `health`

Optional/additional job exists:
- `outcomes`

The API route supports POST and GET to `/api/intelligence/run`, protected by `INTELLIGENCE_RUN_SECRET` and/or `CRON_SECRET` outside localhost.

### Market coverage

There is a hardcoded verified Swedish/Nordic universe plus optional environment-driven additions via `SWEDISH_EQUITY_UNIVERSE`.

There is also an autonomous discovery expansion universe plus optional additions via:
- `RAKETRADAR_EXTRA_DISCOVERY_TICKERS`
- `DISCOVERY_EXTRA_TICKERS`

Current market data provider is Yahoo chart data with alias mapping and suffix attempts for Nordic names. The provider records alias debug data for coverage diagnosis.

### Market reaction logic

The live market reaction module calculates:
- intraday momentum
- day change
- relative volume
- gap
- acceleration
- volatility expansion
- squeeze probability
- continuation probability
- fade probability
- abnormal move score
- market aggression
- trader attention

Labels include:
- EARLY_MOMENTUM
- CONTINUATION
- PULLBACK_VALID
- REACCELERATION_WATCH
- COOLING_BUT_VALID
- FAILED_MOVE
- EARLY_CONTINUATION
- LATE_BREAKOUT
- FAKE_SPIKE
- PARABOLIC_RISK
- STEALTH_STRENGTH
- DEAD_BOUNCE

### Discovery logic

Autonomous discovery scores candidates using:
- RVOL
- acceleration
- continuation
- market aggression
- squeeze/fade/parabolic risk
- liquidity penalty
- fake-spike penalty
- crowding/parabolic penalty

Discovery buckets include:
- HOT
- WATCH
- STEALTH
- PARABOLIC_WATCH
- RISK
- SUPPRESSED

## Current risk / suspected main blocker

The likely main blocker is still market-data blindness rather than UI or scoring sophistication.

Most important unknowns to verify next:
1. How many universe tickers return usable intraday bars today?
2. How many return daily baseline but no intraday bars?
3. Which exchanges/suffixes fail most often?
4. Are provider runs actually being saved in Supabase in production?
5. Are case_state_snapshots and learning_observations being populated over multiple days?
6. Are alerts created from real state changes or mostly noisy rerank churn?

## Current constraints

Do not add now:
- large dashboard work
- new scoring engine architecture
- order book / Level 2
- social monitoring subsystem
- broad refactor
- speculative AI memory layer

Allowed now:
- small verification patches
- coverage diagnostics
- provider/source fixes
- ticker alias fixes
- persistence health checks
- continuation memory checks
- reducing false HOT/100% cases when proven by data

## Next single blocker to attack

Verify real live coverage.

Concrete next task:
- Run or inspect `/api/intelligence/run` output and debug snapshot.
- Measure scanned count, live hits, missing data count, missing tickers, alias attempts, and exchange-level coverage.
- If coverage is weak, fix ticker/provider mapping before touching UI or scoring.

Decision rule:
- If coverage is under acceptable level, market coverage is blocker #1.
- If coverage is good but alerts are noisy, continuation/state memory is blocker #1.
- If both are good, then improve buy/hold/sell read quality.

## Working rules

- Repo + this file is project memory.
- Update this file after meaningful repo/status changes.
- Prefer one small verified fix over broad plans.
- Do not optimize UI before live edge is working.
- Ranking is not a buy signal.
- +30% does not mean finished.
- Continuation and repricing matter more than first spike.
- RR may stay quiet when edge is missing.
