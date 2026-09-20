# Non-deferred follow-up — 20 September 2026

## What changed

These are authored changes, not new passing receipts. The preceding validated
baseline was source `a9e4f43`, with documentation at `c7874a5`. Source edits invalidate
that baseline for current verification. Generated validation blocks preserve their
historical run IDs; they must be reconciled by the user's next SDLC run.

| Task                          | Authored implementation and acceptance                                                                                                                                                                | Still required                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| READINESS-RECOVERY-001        | Explicit Mongo reconnect, shared concurrent probes and orderly shutdown; actual driver refusal/restoration regression without stopping a shared database.                                             | API2302 and API002 current receipts. Exact original incident rejection was not captured.                                                        |
| RESEARCH-WORKER-ISOLATION-001 | Distinct disabled/lock-busy/not-due/completed outcomes; bounded contention-only fixture retry; real advisory lock and failure propagation cases.                                                      | API2060–2063 and existing1990/1991/2002 receipts. Passing retries do not prove the earlier incident cause.                                      |
| UX-002C                       | Explicit independently reviewed same-event release membership; Scan expansion/ungrouping, Stories context, conflict/stale fallback and shared offline projection.                                     | API/WEB2300/2301 and OFFLINE2300, existing story matrix, assistive/physical reading acceptance.                                                 |
| ASSIST-001                    | Shared field explanations/editable names in connected and offline query help; truthful local copy, explicit Apply/Dismiss and no-match recovery.                                                      | OFFLINE150 plus connected matrix and separately configured live-provider acceptance.                                                            |
| STORY-MEDIA-002               | Superseded image replay now409 instead of silently returning newer bytes. Real preparation/concurrency/replay/source-change/independent-review/error UI cases.                                        | API1146–1149/WEB1146 plus existing matrix; live-provider/model and physical-device acceptance.                                                  |
| FEEDBACK-001                  | Real submitted context/model lineage, private/stale exclusions, destination/pause/lease/backoff/history recovery and keyboard/narrow-layout cases. Existing implementation reused.                    | WEB1121–1127 plus existing matrix, review synthetic layout screenshots and physical native capture/microphone/storage/HTTPS receipt acceptance. |
| DATA-001                      | Explicit connected freshness and offline absent/unreadable-cache503; local freshness evaluation preserves observation dates. Actual provider failure, retained revisions/evidence and recovery cases. | API2310/WEB2310/OFFLINE2310/2311 plus existing matrix and normal parser/unit gates.                                                             |
| DEV-017                       | Private AI history clears after401 and guards late completion; MFA/history keyboard, error and recovery acceptance.                                                                                   | New privacy cases and parent matrix, actual key/historical rollout, production security and physical-device requirements.                       |
| SRC-012                       | Existing real company-news case now loses only committed acknowledgment, retries the same identity without duplicate capture, and clears after actual session revocation.                             | WEB1594/current matrix, full manual visual/tab-order review, source-specific permission and physical acceptance.                                |

No dependency or production schema migration is introduced. Event grouping reuses
immutable versioned event payloads. All new SQL fixture tables are confined to owned
E2E schemas and exist only when the user runs tests. Simulated upstreams do not
claim a live source licence or provider-model pass.

## Execution boundary and integration

The original checkout had active TypeScript/Vite/API watchers. To avoid triggering
agent-run builds or restarts, all work was authored in
`/Users/arpanmacmini/code/fingent360-authoring-20260920`, branch
`codex/nondeferred-completion-20260920`, based on `c7874a5`. No gates, tests, API/browser
smoke checks, builds, installs, services, migrations or commits were run.

Do not copy source edits into running watched development sessions. Stop the
original `pnpm dev` terminals first. If changes have not yet been brought back,
apply the final authored patch supplied at handoff to the original checkout using
`git apply --check` followed by `git apply`; a conflict means stop and preserve the
newer local changes. Never use a reset to force application.

No commit is claimed: the required format/check gates have not run. `pnpm sdlc`
performs them and commits only after they pass; it never pushes. Existing source
credentials remain in the original ignored `.env`; none is copied into the patch.

## Smallest complete story commands

Run in the original checkout after integration. Use configured local PostgreSQL
and MongoDB, existing migrations and the user-started API/web. No new migration
is needed for this change. Use the web/API URLs printed by `pnpm dev`, rather than
assuming port5173. The current saved targets were web5176/API4104, but port selection
may change. The E2E UI, if used instead, must keep watch/eye toggles off.

```bash
pnpm sdlc "Repair Mongo readiness recovery" --story READINESS-RECOVERY-001
pnpm sdlc "Complete scheduler contention acceptance" --story RESEARCH-WORKER-ISOLATION-001
pnpm sdlc "Complete reviewed release grouping" --story UX-002C
pnpm sdlc "Complete offline assistance" --story ASSIST-001
pnpm sdlc "Complete story image generation" --story STORY-MEDIA-002
pnpm sdlc "Complete feedback workflow acceptance" --story FEEDBACK-001
pnpm sdlc "Complete annual macro recovery" --story DATA-001
pnpm sdlc "Complete private history and MFA recovery" --story DEV-017
pnpm sdlc "Complete company news recovery" --story SRC-012
```

These select each reviewed story matrix, not the whole repository suite. Run one
at a time and fix a reported failure before continuing. They may share companion
cases; these commands prioritize complete story reconciliation over a tiny retry
that cannot close a parent. For an isolated failure, retain its case/project and
use the SDLC repair runner's scoped retry rather than repeating passing suites.

Expected: current selected cases pass; generated validation and bug records update.
A passing automated matrix does not close explicit provider/device/permission gates.
On failure report `artifacts/sdlc/<run-id>` and the linked case/project error context;
never paste `.env`, receipt capability tokens, real private accounts or provider keys.
Review synthetic WEB1127 and image/MFA layout captures separately. Installed Android
apps require rebuilding their assets/snapshot/APK and reinstalling; web source edits
do not update an existing APK automatically.

## Requirements this authoring cannot truthfully close

- Five original broker export grammars/representative layouts remain unverified.
  Official download instructions are recorded in BROKER-PARSERS-002; generic mapping
  is not five named parsers. The prior template-availability question is unanswered.
- Broader original exchange/XBRL/index/taxonomy coverage, current corporate-bond
  pricing/liquidity and curve conventions remain scoped source work. The new
  grouping/recovery tests do not implement those sources.
- Groww/Breeze/private CAS/registrar/AA integration prerequisites remain with their
  recorded tasks; existing adapters do not prove these separate integrations.
- Source retention/display/offline permissions and deliberate worker activation
  require real evidence. Test attestations never enable production sources.
- Actual provider/model use, deployment identity/HTTPS/monitoring/restore/security,
  key/history rollout and physical Android/iOS/PWA acceptance need the intended
  installation and responsible operator/device evidence.
- Regulated advice activation still needs the recorded operating entity and
  qualified approval. Educational workflows do not grant that approval.

These remain visible in TODO and linked tasks. No task was relabeled Done to hide
unimplemented work or replace missing validation with code authoring.
