# SOURCES-002-DIRECTORY — Specialized source-reader navigation

- **Status:** Completed implementation; manual validation pending.
- **Parent:** [SOURCES-002](SOURCES-002.md). This completed scope does not complete its broader parent.
- **Implemented:** Direct links to actual specialized source readers remain usable when discovery-feed coverage fails.
- **Specification and source evidence:** Use the dated implementation specification, original-source research and detailed handoff in the parent task. This child makes the finished scope visible in the task index; it does not replace or duplicate that evidence.
- **Layers:** Contracts, API/source persistence, shared web/app workflow and offline behavior are implemented or reused as documented in the parent. Operations requires a connected API. Navigation-only changes reuse existing source APIs and schemas.
- **Authored acceptance:** WEB1760–1761. Cases cover the specified behavior, not live provider permissions or physical-device acceptance.
- **Migration:** None. No dependency added for this child.
- **Remaining:** User-run validation and applicable source/device activation. Original-data access and wider source coverage remain explicit in the parent.
- **Verification:** Not executed. No format/check/build/E2E, migration, service change, commit or push was run. Baseline a2c53a0.

## Reusable implementation prompt

Read AGENTS.md and the linked parent specification before changing this workflow. Preserve the exact source/identity/unit and review invariants described above. Address a concrete reported gap or saved failing case through contracts, backend, shared web/app and offline behavior as applicable; update authored tests and this record plus TODO. Do not rerun deterministic gates or expand the supported source claim without evidence.

## Manual acceptance

With the documented database/API/web setup and required migrations, run `pnpm sdlc "Validate SOURCES-002-DIRECTORY" -- --grep "E2E-(API|WEB|OFFLINE)-176[01]"`. Use the web URL printed by `pnpm dev`; keep test watch mode off. Check the corresponding Operations/reader flow documented in the parent. Installed Android/iOS bundles require the documented rebuild/reinstall. Report the exact failed case, saved artifact run and error. The user-operated SDLC command owns gated commit and execution.

Fund/bond directory copy now identifies merger notices, dated fees and historical sovereign auction calculations. WEB1760 additionally asserts that the shared sovereign reader is reachable from Sources. API/persistence/calculator scope belongs to SRC-017; no additional migration. Authored, not executed.

## Reviewed acceptance scope — 20 September 2026

Specialized real source readers reachable independently of discovery-feed coverage, including GDP and sovereign destinations.

The complete required case/project matrix is now recorded in `acceptance.json`. This review is not a test pass; actual current-revision receipts determine validation.

Remaining gates: Authored physical offline Sources-to-specialist reader navigation scenario is not replaced by connected WEB1760/1761; retain manual package/reinstall/no-network evidence gate.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: outage-final-1789852687840.
<!-- sdlc-validation:end -->
