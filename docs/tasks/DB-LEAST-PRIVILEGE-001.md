# DB-LEAST-PRIVILEGE-001 — Separate database runtime and migration access

- **Status:** Done (accepted scope)
- **Implemented / recorded:** Runtime/migration access separation is implemented and local activation was recorded. Later fixture/runtime corrections have separate regression records.
- **Pending:** None for the reviewed acceptance scope; native release certification remains separate.
- **Next action / inputs:** No further action for this accepted scope.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### DB-LEAST-PRIVILEGE-001 follow-up — typed and lint-safe owned-role cleanup

- **Implementation: Type/lint correction committed in b5cfcd0. Verification: subsequent user SDLC passed format/check and reached E2E; API586 runtime regression is tracked in REGRESSION-011.** Latest correction scope: use the existing typed owned-database helper, type the lazy role-module boundary, and retain a definite provisioning promise for the body plus optional teardown reference. Preserve lazy discovery, guarded cleanup and real assertions without casts to any or non-null assertions. No agent-run checks/tests/commit. Previous report: User reports no-unsafe-finally at database-roles.spec.ts435/445; format passed, check stopped at lint, so this invocation did not reach commit/E2E. Detailed Codex prompt: refactor API586's exceptional owned-role cleanup into an explicit helper outside the finally block. Preserve exact marker/identifier guards before any revoke/drop, pending-query settlement and unconditional connection closure. Do not suppress lint, weaken ownership checks or change production grants. Update existing case documentation and README/status; leave format/check/E2E and the gated commit to user pnpm sdlc. Existing latest.md is older offline470 evidence (2026-09-14T04:30:50.845Z), not this lint-stage failure.

### Embedded task brief

- **DB-LEAST-PRIVILEGE-001 (DEV-004): Implemented and locally activated; regression validation/commit pending.** Detailed Codex prompt: complete the explicitly missing least-privilege PostgreSQL application access. Inspect compose/bootstrap/migrate/AccountStore/DiscoveryStore and isolated fixture behavior. Add a manually invoked, safe and repeatable local role-provisioning workflow separating migration/owner credentials from a nonsuperuser runtime role with only required schema USAGE, table DML and sequence permissions. No application ownership/CREATE/role/database-management privileges, no public permission widening; retain immutable triggers and existing data. Explicitly handle new migrations/default grants, existing DB configurations, repeat invocation and failure recovery; do not reset volumes/data or print credentials. Introduce a migration-only connection setting with backward-compatible behavior for existing setups, document least-privilege not enabled until user provision/configuration, and keep test fixtures' owned migration credentials separate from runtime role connections. Do not edit real .env or execute provisioning. Strictly validate identifiers/URLs and use safe SQL construction; unknown remote/admin configurations need clear user-run setup instructions rather than silent privilege changes. Actual isolated API580–589 acceptance should verify runtime DML for normal workflows, denied DDL/role changes, successful owner migration and post-migration grants, preserved immutable rows/data and teardown only by fixture owner. UI not applicable because this is infrastructure; existing app/health diagnostics must give actionable failures. Author spec/code/cases/docs/handoff in worktree, no agent execution/gates/commit. Main migration list includes pending035; preserve all registrations. Root integrates and updates trackers; user invokes pnpm sdlc and provisioning manually.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on DB-LEAST-PRIVILEGE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Reviewed scope: Safe repeatable owner/runtime PostgreSQL role separation, restricted DML/default grants, actual denied DDL/escalation, migration rollback and guarded cancellation cleanup. Local activation is recorded separately; no new remote provisioning or production security certification. Completion applies only to this bounded child.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Passed — automated acceptance. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789848189876-42077.
<!-- sdlc-validation:end -->
