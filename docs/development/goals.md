# Saved financial goals (GOALS-001)

TEAM-002 now adds [goal allocations](../product/goal-allocations.md): earmark exact quantities of actual saved holdings, review/save and retain history, with double-allocation checks and visible review when goals or holdings change. Recorded acquisition cost is separate from entered savings and market value. [Record reports](../product/record-reports.md) capture immutable contribution-only reviews; broader suitability/return scenarios remain open.

This completes an account-owned goal planning increment under DEV-009, with PostgreSQL persistence, repeat goal types, explicit storage consent, version history, optimistic edit/delete conflicts and responsive UI. No source feeds or mock portfolio balances are used. This does not complete portfolio allocation, suitability, inflation/return scenarios or regulated recommendations in the parent roadmap.

Amounts are INR with scale 2, transported as integer-paise strings. Input accepts at most two decimal places and rejects rounding. Calculations use BigInt: already saved + monthly contribution × entered months. A negative remaining gap is displayed as zero. No market growth, inflation, taxes, fees or withdrawals are assumed. The nominal calculation is an illustration of the user's inputs, not a promised outcome. Horizon is fixed to each saved plan, not automatically reduced with calendar time. Defaults (zero saved, zero monthly, 120 months) are visible and editable; assumptions have version no-growth-nominal-v1.

Sign in at `#account`, then open `#my-goals`. Create several goals, including repeat education/retirement types. Save and reload, edit and inspect prior revisions, then remove a goal. Removed goals are hidden but retained with revisions until account deletion; account deletion cascades all goal records. Private history requires ownership. No portfolio money is allocated or double-count checked: users must not count the same money towards multiple goals.

## Manual verification

No new dependencies. With Docker available, run `pnpm db:up`, `pnpm format`, `pnpm check`, `pnpm db:migrate` (adds 005_goals.sql), and `pnpm dev`. Use the printed web URL with `#my-goals`. In another terminal run `pnpm e2e:ui`, keep watch/eye mode off, select `@GOALS-001` in api/desktop/mobile and manually run E2E-API-060, E2E-API-061 and E2E-WEB-060. Expected: exact paise persistence, repeat types, revision history, stale writes rejected with 409, unrelated accounts rejected with 404, unauthenticated requests rejected with 401, invalid fields rejected with 400. Tests create only synthetic accounts/goals and delete them afterward. Credential captures are disabled. Report run timestamp, selected projects/cases and first failure using artifacts/e2e/latest.md.

Implementation authored; no tests, formatting, checks, migration or service actions executed by the implementing agent. Account/API outage errors remain explicit. Broader suitability and goal-to-portfolio linkage remain open.

## Integration verification

Parent verified this feature in full E2E run `2026-09-12T16-09-40-894Z-64656`: 51 passed, zero failed, one intentional outage skip across the entire suite. Format/check passed, including 40 unit tests. New migrations were applied and repeated successfully. PWA installation prompts remain browser-dependent; the offline/cache behavior was exercised on desktop and mobile. Historical authoring-only statements above describe the agent phase before parent integration testing.

## Guided planning experience

At `#my-goals`, the overview shows real account-owned goal cards and the percentage of each target represented by already-saved amounts. Percentage is display-only, computed with integer arithmetic and capped at 100; monetary values remain exact. Create a goal opens a focused form, Cancel discards unsaved edits, and Save returns to the overview. The projected contribution total and remaining gap stay separate from saved progress. Plan caveats and prior revisions are secondary to the next action. Signed-out entry returns through account creation/sign-in to saved goals. E2E-WEB-060 now covers the create/cancel interaction and saved-progress value in addition to persistence and revision history.

Authentication and recovery: HTTP 401 clears the displayed private state and shows a sign-in return gate; service outages remain retryable errors, not sign-in prompts. Unreadable responses receive a plain error. Cancelling/reloading or switching goal edits asks before discarding a changed draft; rejected discard keeps input. Successful save/cancel restores focus to Create a goal. WEB062 explicitly simulates 503/401 transport states and tests real-account draft cancellation without mock saved records.

## Step focus timing — UI-RACES-001

Goal wizard transitions focus the next step synchronously in a layout effect, before the browser presents the updated controls. A delayed animation-frame callback must not move focus back to Monthly contribution after the user has begun editing Months from this plan. This preserves both the user’s chosen input target and exact stored amounts; validation remains unchanged.

E2E-WEB-067 deliberately holds animation callbacks, moves from monthly contribution to months, releases the callbacks and enters 12. It checks monthly INR 1000.01 / horizon 12 and the actual saved whole-paise projection. Parent’s before-fix run `2026-09-13T17-12-59-569Z-14642` reproduced the missing months value in `artifacts/ui-races-goal-before.log`. Post-fix run `2026-09-13T17-17-23-232Z-14992` passed all 30 selected desktop/mobile executions, including WEB067 and reported WEB060, plus goal loading, consent, Back, draft-preservation and confirmed-save regressions. This is focused verification; [status](status.md) distinguishes it from previous full-suite results.

## Functional closure — 2026-09-16

Confirmed removal of the goal currently being edited closes the wizard, clears draft navigation protection and returns focus to Create a goal. Cancellation and other-goal removal preserve the draft. Read generations prevent delayed original list replies/errors from overwriting newer reloads or mutations; an immediate action guard prevents overlapping submissions. Backend version checks, owner isolation, exact calculations, encrypted revisions and on-device persistence are reused without a new migration.

WEB068/069 and OFFLINE068 supplement existing goals acceptance. The shared fixture creates actual accounts/goals; only WEB069 delays transport of a real server reply. Manual validation: `pnpm sdlc "Complete saved goals" --story GOALS-001` with migrated databases and current API/web running. The required matrix includes desktop/mobile and offline, and automatic closure requires every required result plus checks. No new dependency or provider input. New cases are authored, not run.
