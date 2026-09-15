# EQUITY-COVERAGE-001 — Indian equity reference, prices, actions, fundamentals and sectors

- **Status:** Partial
- **Implemented / recorded:** NSE identities, Nifty50 constituents, UDiFF price ingestion, stored revisions and company/offline views are authored.
- **Pending:** Implement corporate-action and fundamental parsers, adjusted prices, broader exchange/sector history and backfill.
- **Next action / inputs:** Developer: verify remaining exchange formats and usage rights; implement missing ingestion.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### EQUITY-COVERAGE-001 — Indian equity reference, prices, actions, fundamentals and sectors

- **Status:** Partial: five-family storage/review/public/offline workflow authored; automated NSE master/Nifty50 constituents plus official versioned UDiFF price ZIP parser/fetch. Corporate-action/fundamental parsers and broader historical coverage still pending. Verification not run; migration049 authored.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver indian equity reference, prices, actions, fundamentals and sectors with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on EQUITY-COVERAGE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Research-ready
- **User input needed now:** No for the independent next step.
- **Decision:** No user input needed for the next step: research primary documentation, record evidence and implement only verified source/domain behavior. Research-ready is not a claim that all inputs or permissions are already available.
- **Recorded answer / authority:** User: use free sources first and have the agent determine regulations, source usage and formats; do not ask the user to discover them.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Before live redistribution/offline bundling, establish dataset-specific rights. Ask only for an actual agreement or paid decision that research cannot supply.
- **Next action:** Developer: verify remaining exchange formats and usage rights; implement missing ingestion.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.
