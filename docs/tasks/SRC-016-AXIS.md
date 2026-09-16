# SRC-016-AXIS — Axis ETF original portfolio disclosure

- **Status:** Completed implementation; manual validation pending.
- **Parent:** [SRC-016](SRC-016.md). This completed scope does not complete its broader parent.
- **Implemented:** Verified original workbook layout, equity/TREPS/current-assets reconciliation, independent AMFI identity mapping and downloaded NAV admission.
- **Specification and source evidence:** Use the dated implementation specification, original-source research and detailed handoff in the parent task. This child makes the finished scope visible in the task index; it does not replace or duplicate that evidence.
- **Layers:** Contracts, API/source persistence, shared web/app workflow and offline behavior are implemented or reused as documented in the parent. Operations requires a connected API. Navigation-only changes reuse existing source APIs and schemas.
- **Authored acceptance:** API1720–1721, WEB1720, OFFLINE1720. Cases cover the specified behavior, not live provider permissions or physical-device acceptance.
- **Migration:** None. No dependency added for this child.
- **Remaining:** User-run validation and applicable source/device activation. Original-data access and wider source coverage remain explicit in the parent.
- **Verification:** Not executed. No format/check/build/E2E, migration, service change, commit or push was run. Baseline a2c53a0.

## Reusable implementation prompt

Read AGENTS.md and the linked parent specification before changing this workflow. Preserve the exact source/identity/unit and review invariants described above. Address a concrete reported gap or saved failing case through contracts, backend, shared web/app and offline behavior as applicable; update authored tests and this record plus TODO. Do not rerun deterministic gates or expand the supported source claim without evidence.

## Manual acceptance

With the documented database/API/web setup and required migrations, run `pnpm sdlc "Validate SRC-016-AXIS" -- --grep "E2E-(API|WEB|OFFLINE)-172[01]"`. Use the web URL printed by `pnpm dev`; keep test watch mode off. Check the corresponding Operations/reader flow documented in the parent. Installed Android/iOS bundles require the documented rebuild/reinstall. Report the exact failed case, saved artifact run and error. The user-operated SDLC command owns gated commit and execution.
