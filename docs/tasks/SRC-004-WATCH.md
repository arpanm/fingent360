# SRC-004-WATCH — Watch verified original financial filings

- **Status:** Completed implementation; validation pending.
- **Scope:** Check a fixed researched25-company original-URL registry, at most three selected originals per due run. Preserve unchanged/corrected/quarantined/unavailable outcomes and raw bytes, create drafts only, independently review through the existing equity workflow, and expose admitted facts in company/derived/offline views.
- **Specification:** [Original filing watch](../development/filing-watch.md); [parent](SRC-004.md).
- **Data:** Migration127 adds disabled permission/schedule controls and immutable attempts; existing equity editions/observations and Mongo originals are reused. Gate revocation is enforced centrally for fresh company and downstream fundamental reads. Offline copies remain dated snapshots.
- **Cases:** API1990–1992, WEB1990 and OFFLINE1990; actual storage/review/worker paths with simulated upstream transport. Repaired WEB1990 has saved desktop evidence; the supplied mobile run used the committed pre-repair path and failed before schedule enablement.
- **Remaining:** User validation and actual source permission/activation. This watches known historical URLs; new-release URL discovery and original XBRL remain separate missing parent scope.
- **Manual next action:** With configured PostgreSQL/MongoDB/API/web, rerun the exact WEB1990 mobile selection below. Broader acceptance still uses `pnpm db:migrate`, then `pnpm sdlc "Validate original filing watch" -- --grep "E2E-(API|WEB|OFFLINE)-199[0-2]"`. Use Operations → Original filing watch and Automatic research at the printed development URL. Report selected case/project and saved error-context/run directory.
- **Commit:** No gates, jobs, migrations, app builds or commit executed for this repair. Current local HEAD remains `8c5c164`; repair edits are uncommitted for the parent SDLC retry.

## WEB1990 automatic schedule-load repair — 2026-09-18

The committed case saved filing permission, opened Automatic research and then immediately looked for `Enable equity-filing-watch`. The panel initialized with no schedule state and only populated it after the separate Refresh research schedules action, so the schedule control could not exist on the tested first visit. The supplied mobile stack points to that pre-repair click at line 59; the current regression has moved that interaction and first requires the loaded schedule heading.

Automatic research now performs the same runtime-schema-validated schedule request on mount, shows its existing loading state immediately and uses a generation guard so an obsolete initial response cannot replace a newer refresh or update state after unmount. The explicit refresh button and its error-recovery path remain available. WEB1990 now scopes schedule interactions to the Automatic research region and first requires the `equity-filing-watch` heading, directly covering initial schedule discovery before the existing enable/pause and independent-publication assertions.

No contract, API, database, fixture, dependency, source permission or migration changed. Saved run `1789723036823-6f833c8e-c99d-49f7-bc1c-b71fad7bd5fc`, started `2026-09-18T09:17:16.823Z` against API `http://127.0.0.1:4104` and web `http://127.0.0.1:5176`, passed the repaired desktop selection only. No validation was run during this mobile repair attempt, and no commit was made. With the existing PostgreSQL, MongoDB, API and web services available at the URL printed by `pnpm dev`, the smallest validation is the exact supplied mobile case:

```bash
pnpm e2e:run "/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/filing-watch\\.spec\\.ts" --project=mobile --grep "E2E-WEB-1990 original filing permission schedule and independent publication use actual Operations forms @SRC-004 @TEST-SIMULATION$"
```

Expected: on the mobile viewport, Automatic research exposes the filing-watch schedule without a manual refresh, the case enables it, publishes through the independent reviewer and opens the company facts. On failure, report the saved run ID, project, exact case and error excerpt.

## Reusable task prompt

Read AGENTS.md and linked acceptance. Resolve concrete failures in permission-bound original acquisition, unchanged/correction handling, immutable source review or central admission. Never substitute a known historical-URL watch for new-release discovery; never auto-publish findings or accept arbitrary fetch URLs. Update cases/docs/status, leaving deterministic execution manual.
