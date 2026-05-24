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

Verified locally:
- latest run changes active
- learning observations active
- case snapshots active
- memory endpoint returns active persistence

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

Lifecycle retention is now wired into the intelligence runner:
- fresh agent snapshots are combined with retained continuation/cooling snapshots
- missing but still relevant cases can stay in cooling states before terminal drop
- runner summary exposes lifecycle counts

### Market coverage

There is a hardcoded verified Swedish/Nordic universe plus optional environment-driven additions via `SWEDISH_EQUITY_UNIVERSE`.

There is also an autonomous discovery expansion universe plus optional additions via:
- `RAKETRADAR_EXTRA_DISCOVERY_TICKERS`
- `DISCOVERY_EXTRA_TICKERS`

Verified local coverage snapshot on 2026-05-24:
- universeSize: 154
- scannedCount: 76
- liveHits: 74
- missingDataCount: 2
- coveragePercent: 48 overall due scanned count semantics
- exchange coverage:
  - Sweden: 55/57 live hits, 96%
  - First North: 10/10, 100%
  - Spotlight: 7/7, 100%
  - Nordic SME: 2/2, 100%
- missing examples: BERGMAN, MEDI, both wrong_market_suffix

Interpretation:
- RR is no longer broadly market-data blind.
- Remaining live coverage problem is ticker/suffix robustness for a small set of names.

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

### Lifecycle / memory logic

Previously verified issue:
- cases disappeared immediately when missing from current agent scan
- this created noisy `dropped` events and weak continuation memory

Current fix:
- missing but lifecycle-relevant cases are retained for a grace window
- cooling states introduced:
  - COOLING_WATCH
  - COOLING_CONTINUATION_WATCH
  - COOLING_RISK_WATCH
- terminal DROPPED snapshots are appended only after retention/no-confirmation
- retention state changes are lower severity than real upgrades/downgrades

Purpose:
- RR should behave like a trading companion with multi-run memory, not a stateless screener.

### Outcome loop

Verified locally:
- `/api/intelligence/outcomes` works
- outcomeLoopWorking: true
- previous blocker `market_data_missing_for_outcomes` was removed after improving Yahoo outcome symbol resolution
- trigger-combo learning started producing results, including insider+buy+stealth continuation data

Important provider fix:
- outcome market-data provider now uses robust alias/suffix candidate resolution similar to live provider
- this replaced the previous weak `TICKER.ST`-style mapping

Known limitation:
- outcome data model appears split between `signal_outcomes` and `signal_outcomes_detailed`
- learning report and standard outcome rows can report different evaluated/pending counts
- this is the next likely source-of-truth problem

## Current risk / suspected main blocker

Market coverage is no longer the main blocker.

Current main blocker:
- outcome truth-model / datakonsistens

Specific risk:
- setup learning may be built from multiple tables with inconsistent meanings
- evaluated/pending counts may not reflect the same source as trigger-combo learning
- RR needs one coherent outcome truth layer before decision weighting should depend heavily on historical performance

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
- outcome truth-model diagnostics and consolidation

## Next single blocker to attack

Outcome truth-model / setup-performance consistency.

Concrete next task:
1. Inspect how `signal_outcomes`, `signal_outcomes_detailed`, and outcome learning report relate.
2. Identify which table should be canonical for setup performance.
3. Fix only the smallest inconsistency that prevents reliable evaluated/pending and trigger-combo learning.
4. Verify with `/api/intelligence/outcomes`.

Decision rule:
- If outcome tables disagree, fix canonical mapping first.
- If outcome rows are sparse but detailed outcomes work, expose that clearly instead of mixing semantics.
- If both are consistent, then use outcome learning to adjust buy/hold/sell conviction.

## Working rules

- Repo + this file is project memory.
- Update this file after meaningful repo/status changes.
- Prefer one small verified fix over broad plans.
- Do not optimize UI before live edge is working.
- Ranking is not a buy signal.
- +30% does not mean finished.
- Continuation and repricing matter more than first spike.
- RR may stay quiet when edge is missing.
