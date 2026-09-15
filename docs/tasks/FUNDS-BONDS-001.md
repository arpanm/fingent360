# FUNDS-BONDS-001 — Indian mutual funds, bonds, XIRR and deposit comparisons

- **Status:** Partial
- **Implemented / recorded:** AMFI ingestion/review and cash-flow, accrual, XIRR, duration and deposit calculations are authored.
- **Pending:** Live AMFI acceptance/permission, fund look-through, bond quotes/ratings and broader conventions are missing.
- **Next action / inputs:** Developer: verify source terms and add holdings/bond feeds. Operator: activate only permitted sources.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### FUNDS-BONDS-001 — Indian mutual funds, bonds, XIRR and deposit comparisons

- **Status:** Partial: permission-gated AMFI NAV workflow and owned cash-flow/accrual/XIRR/duration/deposit comparisons authored; source activation, AMC look-through and bond quotes/ratings pending. Verification not run; migration055 authored.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver indian mutual funds, bonds, xirr and deposit comparisons with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on FUNDS-BONDS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Research-ready
- **User input needed now:** No for the independent next step.
- **Decision:** No user input needed for the next step: research primary documentation, record evidence and implement only verified source/domain behavior. Research-ready is not a claim that all inputs or permissions are already available.
- **Recorded answer / authority:** User: use free sources first and have the agent determine regulations, source usage and formats; do not ask the user to discover them.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Before live redistribution/offline bundling, establish dataset-specific rights. Ask only for an actual agreement or paid decision that research cannot supply.
- **Next action:** Developer: verify source terms and add holdings/bond feeds. Operator: activate only permitted sources.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.
