# RESEARCH-WORKER-ISOLATION-001 — Intermittent filing schedule test under shared worker lock

- **Status:** Implementation authored — user validation pending; original incident cause remains uncertain
- **Implemented / recorded:** API2002 failed its second scheduled tick with expected1 fetched report and actual0 in the complete run, then passed unchanged in the scoped retry at the same source fingerprint.
- **Pending:** User-run format/check and scoped acceptance of explicit scheduler outcomes and real lock contention. The original failed branch remains unrecorded.
- **Next action / inputs:** User validation using the scoped SDLC command below after root integrates the isolated authoring worktree; no source activation or new input required.
- **Verification:** Failure: SDLC1789852776002-50046, filing-discovery.spec.ts185. Strict passing retry: artifacts/e2e/2026-09-19T22-31-13-940Z-56957/results.json. Read-only diagnostic artifacts/sdlc/final-scoped-1789857073654/advisory-lock-observation.jsonl contains259 samples and two samples with one lock-holder PID; it was collected during the passing retry, not the original failure. Sampling cannot prove or exclude earlier contention. No source/test change was made for the retry.

## Specification and reusable prompt

The research worker intentionally skips ticks when its database-wide advisory key360954 is held; schema-isolated test fixtures share that database with the normal worker. This is a concrete contention opportunity, not yet proof of the failed branch. PostgreSQL next_at comparison retains native timestamp precision; no precision fix is justified by the saved trace. Read actual failure and prior passing receipts, inspect ResearchAutoStore.tick and the filing-watch helper, and expose a safe explicit outcome if required. If a bounded fixture retry is used, allow it only for an evidenced lock-busy outcome, not no-due, acquisition, permission, storage or publication failures. Preserve two real RSS fetches, deduplication and permission-change denial. No UI/database migration or live-source activation is implied. Author unit/E2E diagnostics and update this task and TODO; preserve the original failure and do not call an unchanged passing retry a root-cause fix.

## 2026-09-20 implementation specification (before code authoring)

Input readiness: agent-ready task above and latest explicit instruction authorize authoring only. The pickup queue's historical validation-only guidance does not override this specific repair request. Latest saved report at inspection is API004 run1789857081896, one passed case; it supplies no new scheduler evidence. Preserve original failure and unchanged retry as historical evidence, not a confirmed cause or verification of new changes.

Acceptance:

1. `ResearchAutoStore.tick` returns a typed internal outcome: disabled, lock-busy, not-due, or completed. Completed means the existing acquisition/publication and final persistence completed; every existing failure still rejects. No outcome includes source contents, credentials or raw errors.
2. Keep database-wide lock360954, acquisition permission locks, cadence and source admission unchanged. The fixture retries only an explicit lock-busy outcome, within five seconds; no-due/disabled or real acquisition, permission, storage/publication rejection must not become a successful retry.
3. Real schema-isolated PostgreSQL acceptance deliberately holds lock360954 from a separate connection, observes lock-busy with zero fetches/runs, releases the owner, then performs exactly one real scheduled RSS acquisition. Existing API2002 still requires two fetches, one deduplicated capture and permission-change denial.
4. Acceptance distinguishes disabled and no-due states; a held lock that outlasts the fixture retry budget fails explicitly and creates no run/capture. Upstream acquisition and a deliberately rejected PostgreSQL capture write fail once, record failed runs and never retry or report completed.
5. Synthetic upstream data remains visibly marked TEST-SIMULATION. No real source permissions, live acquisition or parent SRC-004 completion is implied.

Layers: API internal TypeScript outcome only, no public response or runtime wire contract change; automation and real database isolation are covered above. Data model unchanged, no migrations. Existing provenance and dedup stores reused. UI/UX, browser keyboard/mobile/visual and offline are not applicable: this change adds no user-facing controls, navigation, rendering or offline operation. Documentation records residual incident uncertainty and manual validation. Root owns TODO/README/catalogue/coverage/acceptance manifest reconciliation.

## Authored implementation and acceptance

- `apps/api/src/research-auto.ts`: exported internal `ResearchAutoTickOutcome` union and explicit returns. Timer discards the result without changing its rejection handling or cadence. All source permission/acquisition/advisory locks and error persistence remain unchanged.
- `tests/e2e/helpers/filing-watch.ts`: shared actual-worker lifetime helper; bounded monotonic lock-busy retry with a test observer for deterministic release. Any other non-completed outcome fails explicitly; rejection is never caught/retried. Upstream simulation restored and workers/pools closed in finally.
- `tests/e2e/cases/api/research-worker-isolation.spec.ts`: API2060 holds a separate actual database lock, proves no run/capture/fetch, releases it and requires exactly one acquisition; API2061 distinguishes disabled/no-due and rejects no-due in the higher-level fixture; API2062 keeps the lock through retry exhaustion and requires zero work; API2063 rejects one actual upstream transport attempt and one deliberately rejected PostgreSQL capture write, preserves failed status and zero capture receipts. Temporary fault trigger is confined to the owned random schema and removed on cleanup. Test imports have no database/service side effects.
- `apps/api/test/research-worker-outcomes.test.mjs`: unit failure doubles verify exact publication-error propagation, failed persistence and lock release, plus connection failure propagation without retry. These unit doubles are not source integration evidence.
- Reused API1990/API1991/API2002 retain original watch, acquisition-permission and two-fetch dedup assertions unchanged. No public API, UI, dependencies, migration or offline bundle changed.

No format, check, unit/E2E, build, service, migration or commit was executed. Authored coverage is not a pass. Original investigation evidence above remains valid only for its recorded revision; this implementation addresses an observed fixture assumption and adds diagnostics, not proof of the historical failed branch.

## Manual validation handoff

After root integrates all reviewed changes and updates acceptance/catalogue, the user runs:

```sh
pnpm sdlc "Make research scheduler contention explicit" -- --project=api --grep 'E2E-API-(1990|1991|2002|2060|2061|2062|2063)'
```

No dependency installation or migration is introduced. Existing owned PostgreSQL/Mongo and configured API/web services are required for fixture setup. Use the API/web URLs printed by the user's existing dev launcher (last saved run: API http://127.0.0.1:4104, web http://127.0.0.1:5176); no UI action or browser/mobile/offline project is needed. The SDLC check gate includes the new API unit file. Expected: four explicit internal outcomes, only bounded contention retries, exact fetch/capture counts, original errors preserved and all seven selected API cases pass. On failure report the SDLC stage/run ID, selected case/project, saved assertion/trace path and safe outcome message; never connection strings or raw session/provider credentials. A five-second lock-busy exhaustion remains a meaningful failure, not a successful skip.

Local authoring base commit: c7874a5 in `/Users/arpanmacmini/code/fingent360-authoring-20260920`. No commit made: mandatory format/check gates remain user-operated. Root owns shared documentation and reconciliation; other collaborators' changes remain outside this file ownership. No watchers or automatic validation started.
