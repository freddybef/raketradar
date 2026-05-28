# Copilot context-universe fix

Root cause: `src/app/api/copilot-v2/route.ts` uses a narrower ticker universe than the UI renders.

Current matcher mainly searches:
- `snapshot.candidates`
- `snapshot.breadth.*`

But the UI also shows tickers from:
- `topFocus` / Live Continuation Focus
- `priorityBoard`
- `positionManagement`
- `trackedUniverse`
- `earlyRadar`
- `newsTriggers`
- `portfolioDecisions`

This causes errors like:
- TROAX visible in Live Continuation Focus, but Copilot says it is not in the latest snapshot.
- HCRTO2 visible in Action Now / rotation, but Copilot treats it as missing or coverage-related.

Required patch:
1. Add one shared helper in `route.ts`: `snapshotMentionUniverse(snapshot)`.
2. It should collect ticker-bearing objects from all surfaces above.
3. `mentionedTicker`, `mentionedCandidates`, and hindsight matching must use this shared universe.
4. If a ticker exists outside active candidates, Copilot should say: `RR har den i [surface], men den är inte clean active setup just nu.`
5. It must not say `finns inte i senaste snapshoten` or `provider coverage gap` when the ticker exists on any RR surface.

Acceptance tests:

TROAX question:
`vad är det du tycker är bra med troax?`
Expected: explain that TROAX was a persisted continuation/watch case and now needs fresh live confirmation. Do not say missing.

HCRTO2 question:
`du hittade hcrt02 igår innan den gick upp 25% idag. Bra jobbat!`
Expected: acknowledge HCRTO2 if it appears in Action Now/rotation/breadth/early context. Do not call it provider coverage gap.

Scope guard:
- no new scoring engine
- no new continuation state
- no ML/vector memory
- no UI polish
- plumbing consistency only
