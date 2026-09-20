# DATA-001 — Real India macro ingestion, evidence and public screen

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** Existing real World Bank ingestion/evidence/revisions plus explicit annual freshness and absent/unreadable offline snapshot errors.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Upstream failure and offline acceptance specification — 20 September 2026

The reviewed manifest identified missing branch coverage rather than a request for another provider integration. Implement and validate explicit annual-route failure/recovery with accepted values preserved, including no installed snapshot. Keep the official production fetch URL allowlist and existing numerical/provenance/revision rules unchanged. Synthetic provider transport is test-only, opt-in and scoped to an owned test schema; never treat it as live source activation or source rights evidence.

Authored changes:

- UI/UX: the annual macro page now labels never checked, recently checked and refresh due explicitly while retaining observation years and checked dates. Failed Operations refresh continues to show its error and leaves accepted values accessible.
- Offline API: `/macro` returns a specific503 with an install-update recovery message when no snapshot exists or the snapshot fails the existing strict schema. Valid snapshots recalculate freshness from their retained last-success times without changing observations, source hashes or the installed bundle/local account state.
- Contracts/data/real sources: reused MacroDashboard/History/Evidence schemas, immutable PostgreSQL observations/runs and Mongo accepted/quarantined evidence. No new contract, migration, dependency, source permission or production fetch injection.
- Automation: new default-off `worldBankSimulation` test option installs an isolated transport only after the fixture has created/verified its random schema. It rejects every unexpected outbound URL. Loading tests has no execution side effects. Existing story-image and other simulation options remain intact.
- API2310 exercises actual `fetchWorldBank` and `MacroStore` with HTTP503, failed transport, wrong content type, empty body, interrupted stream, >1MB body and invalid schema. Each failure must produce a failed run, preserve exact accepted decimal/revision/hash/history/evidence and leave stale status. Quarantined evidence cannot be served; successful retry deduplicates observations and restores recently-checked status.
- WEB2310 runs the real isolated API and actual Operations refresh UI through failure and retry, verifying annual cached values and explicit freshness. OFFLINE2310 reads installed annual values, history and evidence through the real offline adapter with no API network. OFFLINE2311 directly exercises absent/unreadable cache, aged snapshot and never-checked empty state while preserving original values and local state. All cases use `@DATA-001`; simulation cases also use `@TEST-SIMULATION`. Existing real-source API020/021 and WEB020 remain required.

Reusable prompt: inspect the saved user-run DATA-001 matrix evidence, fix only identified branch failures, preserve official URL/precision/quarantine boundaries and distinguish synthetic branch testing from live-source evidence. Never run deterministic gates or start services as an agent.

User manual focused validation (or prefer the parent's final consolidated story command for all authored work):

```bash
SDLC_AUTO_REPAIR=0 pnpm sdlc "Validate annual macro upstream and offline recovery" --story DATA-001
```

No dependency install or migration is required by these changes. Connected cases need existing PostgreSQL/MongoDB and web services; if not already available, the user invokes `pnpm db:up` and `pnpm dev`. Use the printed web URL → `/#macro` and `/#ops` → Macro ingestion. Offline project uses its existing installed-mode launcher. Expected: preserved accepted figures/provenance after each upstream failure, visible refresh-due status, successful retry, explicit503/recovery copy for absent/broken snapshots and zero API network for installed history/evidence. Report failing case/project, SDLC run ID and saved error/report/log if validation fails.

Manual physical/accessibility and provider activation gates remain distinct. No tests, formatting, checks, builds, browser verification, services, migrations, installs, SDLC or commit were run. HEAD remains `c7874a5`; this change and other agents' unrelated authored work remain uncommitted until user-run gates. Existing generated validation below applies only to its prior recorded revision and is unchanged.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### DATA-001 — Real India macro ingestion, evidence and public screen

- **Implementation:** Implemented
- **Verification:** Awaiting user execution. User reported manually committing/pushing prior work; no new case-specific pass evidence inferred.
- **Request:** Continue all backlog tasks as end-to-end features, not documents or mocked UI. This increment implements the real-data portion of DEV-003/004/005/006/015/016 and SRC-007 before further dependent financial features.
- **Scope:** World Bank India annual GDP growth and CPI inflation, official allowlisted server fetch, strict provider validation with original decimal lexemes, source rights/attribution, Mongo raw snapshots, PostgreSQL canonical revisions and sync records, operator-protected manual refresh, public values/history/source details, responsive UI and executable API/browser tests. No fabricated defaults if upstream or storage fails.
- **Acceptance:** User can refresh real provider data in UI, inspect years/units/source timestamps, reload persisted values, inspect revisions and source status; failed/invalid ingestion never replaces accepted data; repeated refresh deduplicates values; unauthorized refresh rejects; upstream error and stale-cache states are explicit.
- **Codex prompt:** Read AGENTS/README/TODO and implement DATA-001 contracts first through real adapter, additive migration, persistence, API, React screen and meaningful unit/API/browser cases. Preserve decimal tokens, nulls, revisions and raw-source hashes. Use a configured local operator key for writes; never expose credentials or permit arbitrary fetch URLs. No synthetic application data, automatic background refresh or automatic tests/migrations. Update all task/source progress honestly, commit locally with hooks disabled, never push. Continue dependent feature work without seeking routine reconfirmation; leave actual provider/production gates explicit.

- **Delivery:** packages/contracts/src/macro.ts; World Bank adapter, macro service/controller, additive 002 migration, Mongo source snapshots, Macro.tsx and local research-key setup tool. E2E-API-020/021 and E2E-WEB-020 plus parser precision/quarantine tests authored. See docs/development/real-data.md for manual setup and expected outcomes.
- **Scope remaining:** Other sources, real equity holdings, regulated advice and real user accounts are not delivered by this macro feature. No startup sync, automatic execution or push performed.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on DATA-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation only
- **User input needed now:** No for the independent next step.
- **Decision:** No new feature input needed. Implementation is already recorded; do not put this in the implementation queue solely because tests are unrun. Match saved failures to this task before authoring a repair.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** User-owned SDLC/test evidence is needed for verification. The report observed during triage is incomplete; no new full run is requested.
- **Next action:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

## Reviewed acceptance scope — 20 September 2026

World Bank annual India GDP growth/CPI original retrieval, hashed evidence, immutable numerical revisions, deduplicated refresh, protected operator refresh and responsive contextual history/source reader.

The complete required case/project matrix is now recorded in `acceptance.json`. This review is not a test pass; actual current-revision receipts determine validation.

Remaining gates: user-run validation of the newly authored API2310/WEB2310/OFFLINE2310/2311 branch coverage, retained real-source API020/021/WEB020 and the normal parser precision/quarantine check gate. No current new pass is claimed.

## Remaining completion gates — 20 September 2026

The complete current automated matrix passed. The reviewed manifest retains these separate requirements; rerunning passing cases does not satisfy them:

- Run/review parser precision/quarantine check results and the newly authored API2310/WEB2310 upstream/stale-cache branch cases.
- Run the newly authored OFFLINE2310/2311 annual route/cache absence cases. These remain independent of connected WEB020 and do not establish physical-device acceptance.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789923079896-69469.
<!-- sdlc-validation:end -->
