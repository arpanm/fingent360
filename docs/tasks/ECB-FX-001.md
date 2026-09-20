# ECB-FX-001 — official daily reference rates and explicit USD/INR derivation

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - Implementation: Implemented; user validation pending. Parent: SRC009 retains EOD scope. Select free official ECB USD/EUR and INR/EUR reference rates after primary methodology/reuse review. Keep unchanged exact source decimals and dates alongside an explicitly Fingent360-derived INR-per-USD ratio using matching observation dates, bounded exact integer/rational arithmetic and documented rounding; never label the derived ratio an ECB/RBI/FBIL direct quote, executable price or Indian market close. Implement fixed-host bounded source capture, immutable raw/retrieval editions, missing-date/revision/quarantine policy and independent review/withdrawal, responsive latest/history/evidence/derived-method UI and dated offline parity. Do not forward-fill a missing pair or join different dates. Published reference rates are information-only; no trade/valuation/tax settlement inference. Retain source availability and actual known-at limitations. Use strict contracts and meaningful parser/numeric/storage/replay/concurrency/API/browser/offline cases and full docs. Reserve migration045 and API/WEB/OFFLINE810–829. No live ingestion, tests/gates, migration/service actions or commit by agents. Source research and selection evidence in docs/product/ecb-fx.md; the complete spec must precede code.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### ECB-FX-001 — official daily reference rates and explicit USD/INR derivation

- **Implementation: Implemented; user validation pending. Parent: SRC009 retains EOD scope.** Select free official ECB USD/EUR and INR/EUR reference rates after primary methodology/reuse review. Keep unchanged exact source decimals and dates alongside an explicitly Fingent360-derived INR-per-USD ratio using matching observation dates, bounded exact integer/rational arithmetic and documented rounding; never label the derived ratio an ECB/RBI/FBIL direct quote, executable price or Indian market close. Implement fixed-host bounded source capture, immutable raw/retrieval editions, missing-date/revision/quarantine policy and independent review/withdrawal, responsive latest/history/evidence/derived-method UI and dated offline parity. Do not forward-fill a missing pair or join different dates. Published reference rates are information-only; no trade/valuation/tax settlement inference. Retain source availability and actual known-at limitations. Use strict contracts and meaningful parser/numeric/storage/replay/concurrency/API/browser/offline cases and full docs. Reserve migration045 and API/WEB/OFFLINE810–829. No live ingestion, tests/gates, migration/service actions or commit by agents. Source research and selection evidence in docs/product/ecb-fx.md; the complete spec must precede code.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ECB-FX-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Saved full-inventory repair — 2026-09-19

The saved full run1789752953639-97020 includes failed cases tagged to this task. Confirmed causes, scoped authored repairs and remaining verification are recorded in [the full-audit RCA](../development/full-audit-2026-09-19.md). User runs `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016`. No new passing evidence or automatic bug resolution is claimed; this bounded repair does not remove broader source/device/functional requirements recorded above.

## Current acceptance review — 20 September 2026

Reviewed scope: Fixed ECB reference XML capture, exact USD/EUR and INR/EUR preservation and explicitly reconstructed INR/USD calculation; rolling-window absence, lexical precision revisions, immutable raw/numerical evidence, quarantine, replay, concurrency, independent review/withdrawal, responsive month/history/evidence navigation and offline admission. Production source permission, live activation/refresh, physical-device and native release certification, and broader parent requirements remain separate. Passing this matrix establishes only the reviewed bounded functional scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926953092-78982.
<!-- sdlc-validation:end -->
