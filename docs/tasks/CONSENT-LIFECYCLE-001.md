# CONSENT-LIFECYCLE-001 — explicit purpose, expiry and revocation controls

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented; user validation pending. Parent: DEV017 retains encryption/key-management, support and broader security acceptance. Inspect actual existing per-action/storage and scheduling choices before defining a consent ledger. Implement explicit versioned purpose grants with optional expiry, clear review/revoke/renew UI, immutable receipts, ownership, actual enforcement at relevant private-context and background-use boundaries, complete export/deletion and offline parity. Start with external AI private-context sharing and existing personalization/scheduled report purposes where real consented actions are available. Preserve essential sign-in, own-data read/export/deletion and unrelated financial records; revocation stops the specified future use rather than silently deleting records. Do not infer consent from mere account existence, retroactively invent a grant or claim a legal certification. Any legacy basis must point to an actual recorded user choice and be labelled distinctly. Revalidate grant/expiry after waits and before dispatch/commit; generated/provider text cannot restore revoked authority. No automatic external requests or changed personal data while authoring. Design the concrete existing-flow integration before code, then deliver strict contracts, migration043, backend/UI/local/workers where relevant, tests and docs. Reserve API/WEB/OFFLINE760–779. User owns gates, migrations/services, deterministic execution and commits.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### CONSENT-LIFECYCLE-001 — explicit purpose, expiry and revocation controls

- **Implementation: Implemented; user validation pending. Parent: DEV017 retains encryption/key-management, support and broader security acceptance.** Inspect actual existing per-action/storage and scheduling choices before defining a consent ledger. Implement explicit versioned purpose grants with optional expiry, clear review/revoke/renew UI, immutable receipts, ownership, actual enforcement at relevant private-context and background-use boundaries, complete export/deletion and offline parity. Start with external AI private-context sharing and existing personalization/scheduled report purposes where real consented actions are available. Preserve essential sign-in, own-data read/export/deletion and unrelated financial records; revocation stops the specified future use rather than silently deleting records. Do not infer consent from mere account existence, retroactively invent a grant or claim a legal certification. Any legacy basis must point to an actual recorded user choice and be labelled distinctly. Revalidate grant/expiry after waits and before dispatch/commit; generated/provider text cannot restore revoked authority. No automatic external requests or changed personal data while authoring. Design the concrete existing-flow integration before code, then deliver strict contracts, migration043, backend/UI/local/workers where relevant, tests and docs. Reserve API/WEB/OFFLINE760–779. User owns gates, migrations/services, deterministic execution and commits.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on CONSENT-LIFECYCLE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789709592634-72179.
<!-- sdlc-validation:end -->
