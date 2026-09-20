# SRC-007-GDP — India GDP original vintages and scheduled discovery

- **Status:** Completed implementation; manual validation pending.
- **Parent:** [SRC-007](SRC-007.md). This completed scope does not complete its broader parent.
- **Implemented:** Original quarterly constant-price releases, base-year isolation, independent review, quarantine, shared reader and current-day scheduled draft capture.
- **Specification and source evidence:** Use the dated implementation specification, original-source research and detailed handoff in the parent task. This child makes the finished scope visible in the task index; it does not replace or duplicate that evidence.
- **Layers:** Contracts, API/source persistence, shared web/app workflow and offline behavior are implemented or reused as documented in the parent. Operations requires a connected API. Navigation-only changes reuse existing source APIs and schemas.
- **Authored acceptance:** API1770–1772, WEB1770, OFFLINE1770. Cases cover the specified behavior, not live provider permissions or physical-device acceptance.
- **Migration:** 109. No dependency added for this child.
- **Remaining:** User-run validation and applicable source/device activation. Original-data access and wider source coverage remain explicit in the parent.
- **Verification:** Not executed. No format/check/build/E2E, migration, service change, commit or push was run. Baseline a2c53a0.

## Reusable implementation prompt

Read AGENTS.md and the linked parent specification before changing this workflow. Preserve the exact source/identity/unit and review invariants described above. Address a concrete reported gap or saved failing case through contracts, backend, shared web/app and offline behavior as applicable; update authored tests and this record plus TODO. Do not rerun deterministic gates or expand the supported source claim without evidence.

## Manual acceptance

With the documented database/API/web setup and required migrations, run `pnpm sdlc "Validate SRC-007-GDP" -- --grep "E2E-(API|WEB|OFFLINE)-177[0-2]"`. Use the web URL printed by `pnpm dev`; keep test watch mode off. Check the corresponding Operations/reader flow documented in the parent. Installed Android/iOS bundles require the documented rebuild/reinstall. Report the exact failed case, saved artifact run and error. The user-operated SDLC command owns gated commit and execution.

## Reviewed acceptance scope — 20 September 2026

Original India quarterly GDP vintages, publication cutoff/base isolation, independent review/quarantine/shared reader/offline projection and actual scheduled draft acquisition with retained synthetic transport.

The complete required case/project matrix is now recorded in `acceptance.json`. This review is not a test pass; actual current-revision receipts determine validation.

Remaining gates: Actual source-specific retention/display/offline permissions and documented physical-device source acceptance remain activation gates.

## Remaining completion gates — 20 September 2026

The complete current automated matrix passed. The reviewed manifest retains these separate requirements; rerunning passing cases does not satisfy them:

- Actual source-specific retention/display/offline permissions and documented physical-device source acceptance remain activation gates.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926953092-78982.
<!-- sdlc-validation:end -->
