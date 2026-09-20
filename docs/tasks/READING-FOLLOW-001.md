# READING-FOLLOW-001 — Follow sources and topics

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - READING-FOLLOW-001 (DEV-018): Implemented and verified for the bounded scope;25 connected and10 selected offline scenarios passed, with final navigation reruns passing. Explicit source/topic subscriptions with a manual check of newly reviewed stored editions, dated coalesced private inbox, mute/acknowledge/reopen and withdrawal-safe navigation. Dependencies: SOURCE-WITHDRAWAL-001, current library/privacy and complete schedule export. Initial follow/re-add/unmute establishes a visible fresh
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **READING-FOLLOW-001 (DEV-018): Implemented and verified for the bounded scope;25 connected and10 selected offline scenarios passed, with final navigation reruns passing.** Explicit source/topic subscriptions with a manual check of newly reviewed stored editions, dated coalesced private inbox, mute/acknowledge/reopen and withdrawal-safe navigation. Dependencies: SOURCE-WITHDRAWAL-001, current library/privacy and complete schedule export. Initial follow/re-add/unmute establishes a visible fresh baseline without backlog; later explicit checks reopen only materially changed edition/state observations. No provider refresh, continuous monitoring, email/push, urgency/impact inference or financial mutation. Full scope/specification preparation: artifacts/reading-follow-preparation.md, now implemented in docs/product/reading-follow.md. Detailed Codex prompt: Implement READING-FOLLOW-001 end to end in the assigned isolated worktree against the reviewed SOURCE-WITHDRAWAL-001 interfaces; integrate only after that prerequisite. Read this preparation plus AGENTS/README/decisions/current library and privacy workflows. Author strict shared contracts/domain policies, migration032, account-owned API/storage, responsive Reading updates UI, serialized offline parity, complete privacy export/deletion, fixtures/units/API440–459/WEB440–459/OFFLINE450–469 and exact handoff. Follow only explicit reviewed catalogue sources/topics; initial saves establish a visible baseline with no backlog; manual checks inspect stored reviewed editions only. Persist one coalesced private notice per item with exact config/version/fingerprint/ack/reopen/mute/unfollow semantics. Keep immutable minimal receipts and bounded paginated reads without lifetime shutdown caps. Account-first/sorted-source locks with wall-clock reauthorization after every wait; exact replay remains historical until authoritative GET. Reuse withdrawal-aware current projections; never store/disclose source text in private notice history, mutate finance, call providers or schedule background work. Preserve all later report/schedule/privacy changes. No main tracker edits, tests/builds/format/install/service/provider/migration/commit execution by author. Send interfaces early, save increments, get bounded peer review, freeze manifest and honest limitations. Root integrates, runs authorized gates and commits locally without push. Current notice UI also projects readable titles/source names only from currently admitted published editions, labelled as current metadata; withdrawn/unverified views show an unavailable label and opaque identifiers only in receipt details. Titles never enter stored notice history or exports. Account-owned configuration, baseline and immutable notice/operation histories use additive032 and bounded pagination without a lifetime feature cutoff. Full exports must collect all pages with final account confirmation; later-page401 must not produce a partial file. API440–459, WEB440–459, OFFLINE450–469 cover actual database/publication/lock/race and serialized local flows. All UI states, consent/review/Back/focus/mobile, historical-vs-current receipts, muted/unfollowed behavior, unknown sources/topics and unchanged private finances require concrete acceptance. The broader event-policy and external-delivery gates remain open.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on READING-FOLLOW-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Saved subscription acceptance repair — 2026-09-17

Authored: exact Board catalogue selection, contract-validated stored `fed` configuration and reload persistence acceptance. Validation remains pending.

Input readiness: the pickup queue permits diagnosis of saved failures. BUG-2d4a4a832bb63904 and BUG-11f2347c63632afc from user-run1789569622822-36573 show WEB444 matching both Federal Reserve historical and Federal Reserve Board. Both catalogue choices are legitimate; no production subscription defect is established. Latest handoff1789668985904-90b04bf6-b668-4e6f-8631-f2152cfa5af8 started2026-09-17T18:16:25.904Z, passed eight other selected cases at API4104/web5176 and did not cover this repair.

Scope/specification: retain first-read outage and malformed-response recovery, exact source choice, consent, pending-save disabled controls and real API storage. Select Federal Reserve Board exactly, assert the stored source is `fed` only, then reload and verify the same selected choice. Existing WEB440 covers keyboard follow/baseline/check/acknowledge/withdrawal navigation; existing offline cases retain local parity. UI/API/contracts/database/source/automation implementation is reused unchanged; this is a fixture repair, with no new schema, migration, source permission or worker.

Reusable repair prompt: repair only saved acceptance defects, preserving actual subscription persistence and all recovery/consent checks. Do not substitute a mocked successful save, remove a legitimate catalogue source or mark generated failures resolved. Await user-run validation.

Manual acceptance: at the current `pnpm dev` web URL (latest saved target http://127.0.0.1:5176), open `/#reading-follow`, recover a read failure, choose Federal Reserve Board, confirm consent, save and reload. Its choice must remain saved; historical Federal Reserve must remain distinct. User command: `pnpm sdlc "Repair reading subscription acceptance" -- --project=desktop --project=mobile --grep "E2E-WEB-444"`. Existing migrated databases/API/web services are required; dependencies and migrations are unchanged. No tests, format, check, build, services, browser or commit executed. Current local commit at inspection: `bee7f02`; this repair and unrelated existing working-tree changes await user gates. Report failing ID/project, run ID and redacted handoff/error excerpt.

## WEB444 canonical source-label repair — 2026-09-18

Cause: the persistence regression added after the earlier ambiguous-selector failure looked for the shortened accessible name `Federal Reserve historical`. The real catalogue descriptor is `Federal Reserve historical policy decisions`, so the exact locator could not find the legitimate second checkbox after reload. The production catalogue and subscription behavior were correct; the failing assertion did not name the rendered control.

Authored repair: WEB444 now locates both legitimate choices by their complete canonical accessible names within the Sources group. It proves the historical source is initially unselected, saves the real `fed` subscription while controls are disabled, validates the stored config through the real API, reloads, and proves `fed` remains selected while `fed-policy-history` remains unselected. No assertion, API validation, recovery state or real persistence path was removed or mocked.

Validation remains pending for mobile. The supplied failure (run ID and start time unavailable) is the mobile WEB444 instance at the nonexistent shortened label. The newer saved handoff `1789720496239-da65e456-0861-45b3-b644-49563e18693b`, started 2026-09-18T08:34:56.239Z against API4104/web5176, covers desktop only and therefore does not close the supplied mobile failure. No dependencies, migrations, services or product behavior changed. Smallest retry: `pnpm e2e:run tests/e2e/cases/browser/reading-follow.spec.ts --project=mobile --grep "E2E-WEB-444 first-read recovery and pending subscription save preserve disabled draft controls @READING-FOLLOW-001 @TEST-SIMULATION$"`. Expect the outage/malformed-read recovery, pending disabled controls, real `fed` save, reload persistence and distinct unchecked historical-source assertions to complete. Report the new run ID, project and redacted assertion excerpt on failure. No deterministic command or commit was run during this repair; inspected HEAD was `2dbbceb` and these edits await the parent retry.

## Current acceptance review — 20 September 2026

Reviewed scope: Explicit source and topic subscriptions, fresh baseline, manual stored-edition checks, coalesced notices, acknowledgement, reopen, mute and unfollow, withdrawal-safe current navigation, replay and session recovery, complete paginated history and export, and local persistence. No provider refresh or continuous monitoring. Live source activation and physical-device release certification remain separate. Broader parent coverage is not completed.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789923079896-69469.
<!-- sdlc-validation:end -->
