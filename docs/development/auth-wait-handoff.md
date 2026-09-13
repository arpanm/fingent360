# AUTH-WAIT-001 handoff

Authored in `artifacts/task-worktrees/auth-wait-001`, branch `codex/auth-wait-001`, base `dec6d47`. No tests, builds, type checks, formatting, dependency installation, migrations, service operations, provider calls or commits were executed by the author. Implementation awaits parent integration and verification. No dependency or schema change is required.

## Frozen manifest

- `apps/api/src/accounts.ts`: session lookup compares expiry with `clock_timestamp()` so a transaction cannot preserve an expired session through its start timestamp.
- `apps/api/src/holdings.ts`: reauthenticate after the account locks for preview/confirm and after confirmation's preview/current-holdings locks.
- `apps/api/src/goals.ts`: reauthenticate after account locks for create/update/delete and after the goal lock.
- `apps/api/src/allocations.ts`: reauthenticate after shared/exclusive account locks for current/save.
- `apps/api/src/reports.ts`: reauthenticate after account/advisory/job locks, including early replay paths. Cancel/retry now acquires account → job locks. Worker logic is unchanged.
- `tests/e2e/helpers/auth-wait.ts`: lazy API-anchored `pg` resolution, isolated schema assertion, owned account/goal/preview/job/advisory blockers, observed `pg_blocking_pids`, actual reset, controlled expiry, private-state digests and request draining.
- `tests/e2e/cases/api/auth-wait.spec.ts`: API300–309.
- `tests/e2e/cases/browser/auth-wait.spec.ts`: WEB300, both desktop/mobile projects.
- `docs/product/account-lock-authorization.md`: specification, ordering, acceptance and local-mode boundary.
- `docs/development/auth-wait-handoff.md`: this handoff.

No shared TODO/README/status/catalogue/coverage-matrix files were edited. Parent owns their registration and verified status. No unrelated pre-existing changes were present in this worktree. HEAD remains `dec6d47`; all listed edits are uncommitted pending gates.

## Cases and layers

| ID     | Actual behavior exercised                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API300 | CSV/XLSX preview waits behind recovery; no new previews or financial changes; recovered-session preview succeeds                                                                                                 |
| API301 | New holdings confirmation and previously confirmed replay require current authorization; recovered replay is identical                                                                                           |
| API302 | Goal creation rejected after reset, then succeeds with the recovered session                                                                                                                                     |
| API303 | Goal update/delete rejection preserves heads/revisions; authorized operations remain usable                                                                                                                      |
| API304 | Allocation shared-lock read and exclusive-lock save reject stale sessions; positive read is identical and positive save creates revision2                                                                        |
| API305 | New report capture and existing issued-report replay reject stale sessions; real worker/receipt positive controls                                                                                                |
| API306 | Report deletion and tombstone replay reject stale sessions; deletion metadata, budgets and issued content remain unchanged until authorized                                                                      |
| API307 | Cancel with independently blocked account/job rows cannot mutate after real reset                                                                                                                                |
| API308 | Retry with independently blocked account/job rows cannot mutate after real reset; authorized retry is actually issued by the worker                                                                              |
| API309 | Expiry after transaction start during account, preview, goal, request-advisory/replay and report-job waits; seven observed waits, unchanged state and positive sign-in controls                                  |
| WEB300 | Actual browser allocation save waits behind real reset;401 clears private cards/review; keyboard sign-in returns to retained plan; successful save/reload preserves earlier history and unrelated holdings/goals |

The specification and existing runtime contracts define the unchanged401/ownership/version behavior. The existing PostgreSQL model is reused. User-entered financial fixtures are explicitly synthetic; workbook tests use the actual standard workbook parser and reports use the actual worker. Cancel/retry/expiry tests explicitly alter only owned report rows to represent pre-issuance queued/failed faults; no successful response or production source data is fabricated. Account/session rows are created through real APIs. No provider is contacted.

UI/UX reuse the existing401 AccountGate and sign-in destination handling; no production UI changes are needed. WEB300 covers keyboard interaction and runs in desktop/mobile. Loading/empty/error/draft/saved behavior otherwise remains covered by the existing planning/recovery cases. Offline handlers have serialized local state and no independent PostgreSQL wait; existing OFFLINE250–252/260–264 coverage remains applicable. No local network call, background trigger or new automation is introduced. Physical-phone rendering/focus and user design acceptance remain manual.

## Integration notes

Apply the focused diffs onto main. Do not replace whole files from this earlier base: retain RETENTION-001's confirmed-preview preservation/count predicates, XLSX import/provenance handling, EVIDENCE-LINKS navigation/privacy additions and REPORTS-003 snapshot fields if already integrated. Keep every report recheck when merging new capture paths, including the one immediately after advisory acquisition before existing-request returns. Recovery-code rotation and account deletion already recheck after their account locks; login already validates its password under the lock.

The test observer reads only PID/wait relationships for requests blocked by its owned lock PID; it does not print global activity, usernames, SQL parameters or connection strings. It uses `createRequire` anchored to `apps/api/package.json`, not a bare test-tree import of `pg`. All recovery tests disable Playwright trace/video/screenshots. Hash comparisons cover owned holdings, preview receipts, goals, allocation revisions, report snapshots/content/deletion metadata and budgets without putting their contents into assertion artifacts.

The lock-wait assertions are bounded below the API's5-second statement timeout. If a slow machine cannot establish the expected wait, inspect the safe phase assertion and isolated-schema annotation rather than increasing production timeouts or manufacturing a pass. The account and job blocker releases run even on failure; pending HTTP bodies are drained before the isolated API teardown. The API309 timeout accommodates its seven independent real-account scenarios, not a sleep.

## Exact parent/user verification

Use the repository's already configured Node24–26 and pinned pnpm. No new install is necessary. The existing PostgreSQL/MongoDB services must be reachable with `.env`; private test requests use the fixture's temporary API/schema and are never sent to the main account store. Browser cases also require the ordinary local web app (normally `http://127.0.0.1:5173`, or the URL printed by `pnpm dev`). Existing migrations are applied only inside the fixture; this feature adds none. Do not run cleanup against the main application.

After integration, the parent/user may run:

```bash
pnpm format
pnpm check
# In the already running development environment; otherwise start pnpm dev.
E2E_BROWSER=chrome pnpm e2e:run --project=api --grep @AUTH-WAIT-001
E2E_BROWSER=chrome pnpm e2e:run --project=desktop --project=mobile --grep @AUTH-WAIT-001
```

Expected selection:10 API cases and WEB300 in2 browser projects, all passing. `pnpm check` builds the API required by the owned fixture. To verify via the existing dashboard instead, run `pnpm e2e:ui`, use its printed loopback URL (default9323 when available), filter `@AUTH-WAIT-001`, select api/desktop/mobile, and explicitly Run; leave watch off. Parent should also retain the existing recovery, holdings, goals, allocations and report-deletion regressions when choosing the combined integration run.

Manual UI acceptance: open the configured web URL at `/#allocations` with synthetic saved records, review a change, reset that account from another session using its real saved recovery code, then attempt Save. The sign-in route must replace private data, show no saved claim, and return to the unchanged plan after signing in with the new password. Repeat keyboard-only and at360px width; a later authorized save must persist and preserve earlier history.

For failures report `artifacts/e2e/latest.md` or its historical handoff with run ID/time, selected case/project, target URL and safe error/phase. Include the fixture's isolated schema annotation and current commit, but never passwords, recovery codes, cookies, connection strings or private exports. A local commit remains pending until parent format/check gates pass; no push is authorized.

Parent integration correction: cleanup failures are checked after finally so they cannot replace the primary failure; browser capture retains and forwards the actual upstream401 response rather than depending on Chromium retaining its continued response body. All API and browser assertions remain. Executed evidence and final gate identity are in status.md.
