# SRC-004-GENERAL-INSURANCE — General-insurance operating-results adapter

- **Status:** Implementation complete; validation pending
- **Parent:** [SRC-004](SRC-004.md). This completed scope does not complete its broader parent.
- **Implemented:** Retained premiums, claims and underwriting operating accounts with independent review; solvency-times and percentage ratios remain distinct.
- **Specification and source evidence:** Use the dated implementation specification, original-source research and detailed handoff in the parent task. This child makes the finished scope visible in the task index; it does not replace or duplicate that evidence.
- **Layers:** Contracts, API/source persistence, shared web/app workflow and offline behavior are implemented or reused as documented in the parent. Operations requires a connected API. Navigation-only changes reuse existing source APIs and schemas.
- **Authored acceptance:** API1820–1821, WEB1820, OFFLINE1820. Cases cover the specified behavior, not live provider permissions or physical-device acceptance.
- **Migration:** None. No dependency added for this child.
- **Remaining:** User-run validation and applicable source/device activation. Original-data access and wider source coverage remain explicit in the parent.
- **Verification:** Not executed. No format/check/build/E2E, migration, service change, commit or push was run. Baseline a2c53a0.

## Reusable implementation prompt

Read AGENTS.md and the linked parent specification before changing this workflow. Preserve the exact source/identity/unit and review invariants described above. Address a concrete reported gap or saved failing case through contracts, backend, shared web/app and offline behavior as applicable; update authored tests and this record plus TODO. Do not rerun deterministic gates or expand the supported source claim without evidence.

## Manual acceptance

With the documented database/API/web setup and required migrations, run `pnpm sdlc "Validate SRC-004-GENERAL-INSURANCE" -- --grep "E2E-(API|WEB|OFFLINE)-182[01]"`. Use the web URL printed by `pnpm dev`; keep test watch mode off. Check the corresponding Operations/reader flow documented in the parent. Installed Android/iOS bundles require the documented rebuild/reinstall. Report the exact failed case, saved artifact run and error. The user-operated SDLC command owns gated commit and execution.

## Current acceptance review — 20 September 2026

Reviewed scope: Verified general-insurance operating-format retention, reconciliation, distinct solvency and percentage units, independent publication, reader and offline proof and admission. Live source activation and physical-device release certification remain separate. Broader parent coverage is not completed.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: outage-final-1789852687840.
<!-- sdlc-validation:end -->
