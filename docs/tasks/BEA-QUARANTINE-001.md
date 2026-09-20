# BEA-QUARANTINE-001 — Inspect and recover rejected BEA data

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - BEA-QUARANTINE-001 (DEV-005/015/021): Implemented; migration035, verification and commit await user-run SDLC. Detailed Codex prompt: implement a bounded BEA-only retained-response recovery workflow using the existing fixed official RSS endpoint, permitted source evidence and shared bounded parser. Spec first. Add additive035 for immutable attempt/response-link/revalidation/staging receipts with truthful network/non-200/oversize/unavailable/pending/parsed/failed states, parser revision, ori
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **BEA-QUARANTINE-001 (DEV-005/015/021): Implemented; migration035, verification and commit await user-run SDLC.** Detailed Codex prompt: implement a bounded BEA-only retained-response recovery workflow using the existing fixed official RSS endpoint, permitted source evidence and shared bounded parser. Spec first. Add additive035 for immutable attempt/response-link/revalidation/staging receipts with truthful network/non-200/oversize/unavailable/pending/parsed/failed states, parser revision, original retrieval time/hash/size/fixed source/run association. Existing legacy raw evidence without a trustworthy link remains unavailable, never guessed by timestamp/URL. New normal BEA ingestion must record actual attempts and verified durable Mongo links; published drafts and staging-success receipt commit together under PostgreSQL locks, with honest cross-store failure states and no hidden success assertion. Operator list→attempt→safe evidence metadata/body→explicit revalidate stored body (zero provider call)→inspect candidates/differences→explicit stage drafts→existing exact-head source review; never force acceptance, edit raw bodies, accept arbitrary URLs/hashes or auto-publish. Revalidation and stage bind the original attempt/parser/candidate fingerprint and actual current head baseline; identical request retries return historical receipts and changed/stale input conflicts. Use account-independent operator authorization, Origin checks, sorted source admission and post-wait wall-clock reauth, bounded parse/storage/deadlines and escaped text. Preserve withdrawal/public evidence policies, original evidence and private finances. UI complete loading/empty/no-linked-evidence/failed/retry/uncertain/historical/current/conflict/401/Back/keyboard/mobile flows; use shared Operations denial barrier and extracted component. Offline explains connected-only with no network; no new public bundle content. Author real isolated PG/Mongo API500–519, desktop/mobile WEB500–519, OFFLINE510–529 plus parser/domain cases, actual retained permitted source fixtures labelled synthetic when faults introduced, missing/tampered/incomplete bytes, concurrent replay/staging, crash boundaries, head/authorization races and unchanged originals. No agent execution/providers/build/install/migration/service/commit/root tracker edits; parent integrates/gates/tests/docs/commit. No dependency unless concretely justified; broader RSS adapters, legacy linkage and production source approval remain separate.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on BEA-QUARANTINE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Current acceptance review — 20 September 2026

Reviewed scope: BEA-only retained-response recovery: immutable attempt/body linkage, incomplete/tampered-response refusal, zero-provider revalidation, exact replay, fingerprint/head-bound atomic staging, concurrent retries and authorization after waits, honest finalization failure receipts, bounded validation history, responsive inspect/Back/revalidate/stage/publication navigation, lost-reply/authentication recovery and connected-only offline denial. Production source permission, live activation/refresh, physical-device and native release certification, and broader parent requirements remain separate. Passing this matrix establishes only the reviewed bounded functional scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->
