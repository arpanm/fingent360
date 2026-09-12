# Saved financial goals (GOALS-001)

This completes an account-owned goal planning increment under DEV-009, with PostgreSQL persistence, repeat goal types, explicit storage consent, version history, optimistic edit/delete conflicts and responsive UI. No source feeds or mock portfolio balances are used. This does not complete portfolio allocation, suitability, inflation/return scenarios or regulated recommendations in the parent roadmap.

Amounts are INR with scale 2, transported as integer-paise strings. Input accepts at most two decimal places and rejects rounding. Calculations use BigInt: already saved + monthly contribution × entered months. A negative remaining gap is displayed as zero. No market growth, inflation, taxes, fees or withdrawals are assumed. The nominal calculation is an illustration of the user's inputs, not a promised outcome. Horizon is fixed to each saved plan, not automatically reduced with calendar time. Defaults (zero saved, zero monthly, 120 months) are visible and editable; assumptions have version no-growth-nominal-v1.

Sign in at `#account`, then open `#my-goals`. Create several goals, including repeat education/retirement types. Save and reload, edit and inspect prior revisions, then remove a goal. Removed goals are hidden but retained with revisions until account deletion; account deletion cascades all goal records. Private history requires ownership. No portfolio money is allocated or double-count checked: users must not count the same money towards multiple goals.

## Manual verification

No new dependencies. With Docker available, run `pnpm db:up`, `pnpm format`, `pnpm check`, `pnpm db:migrate` (adds 005_goals.sql), and `pnpm dev`. Use the printed web URL with `#my-goals`. In another terminal run `pnpm e2e:ui`, keep watch/eye mode off, select `@GOALS-001` in api/desktop/mobile and manually run E2E-API-060, E2E-API-061 and E2E-WEB-060. Expected: exact paise persistence, repeat types, revision history, stale writes rejected with 409, unrelated accounts rejected with 404, unauthenticated requests rejected with 401, invalid fields rejected with 400. Tests create only synthetic accounts/goals and delete them afterward. Credential captures are disabled. Report run timestamp, selected projects/cases and first failure using artifacts/e2e/latest.md.

Implementation authored; no tests, formatting, checks, migration or service actions executed by the implementing agent. Account/API outage errors remain explicit. Broader suitability and goal-to-portfolio linkage remain open.

## Integration verification

Parent verified this feature in full E2E run `2026-09-12T16-09-40-894Z-64656`: 51 passed, zero failed, one intentional outage skip across the entire suite. Format/check passed, including 40 unit tests. New migrations were applied and repeated successfully. PWA installation prompts remain browser-dependent; the offline/cache behavior was exercised on desktop and mobile. Historical authoring-only statements above describe the agent phase before parent integration testing.
