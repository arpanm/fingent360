# SDLC-REPAIR-015 — Reclassify failures after agent repair

- **Status:** Done (verified gate scope)
- **Scope:** Fix the user-operated SDLC recovery path that sends formatting failures introduced by a code repair back to an agent. Preserve check-before-commit ordering and exact-case E2E retries.
- **Evidence:** Run `1789527818860-12801`, stages 04/05, failed Prettier on offline bond/credit cases. Repair attempt 3 manually edited whitespace and exhausted the budget. The bundled Codex CLI launched successfully. Root `fflate` is declared but its local dependency link is absent.
- **Acceptance:** Reclassify every failed command retry; use scoped Prettier before another agent, including when the agent budget is exhausted. A subsequent compiler error must supply its own latest details. Cancellation, the shared attempt limit and bounded formatting drift remain enforced. Checks must pass before commit or E2E.
- **Layers:** This is developer tooling. Application web/Android UI, API, database migrations and source ingestion do not change. Unit orchestration regressions cover the behavior; application E2E cases would not exercise this launcher path.
- **Reusable prompt:** Read AGENTS.md and this record. Repair only failure routing in scripts/sdlc.mjs. Author injected-executor unit regressions for code-to-format transitions, exhausted budgets and replacement error details. Preserve exact E2E selection and all validation gates. Update README, SDLC guidance and TODO. Do not execute deterministic commands or commit; the user-run script owns those steps.
- **Implemented:** Command retries re-enter failure classification with the latest log and shared budget. Two injected-executor regressions cover formatting after the final agent attempt and a subsequent distinct compiler failure. Existing exact-case E2E routing is preserved.
- **Pending:** None for this bounded compiler, formatter or tooling repair; functional stories own their application acceptance.
- **Next action / inputs:** No pickup needed for this recorded repair.
- **Verification:** Actual format/check/unit gates passed in SDLC1789837762812-24470, gated commit4549ca1; see recorded gate acceptance below.

## Recorded gate acceptance — 20 September 2026

Scope: SDLC retry failure reclassification, exhausted repair-budget formatting routing and latest compiler error details.

User-authorized SDLC run `1789837762812-24470` completed formatting and the entire check stage successfully before connected acceptance began. The [check log](../../artifacts/sdlc/1789837762812-24470/02-pnpm-check.log) includes strict application/E2E compilation and contracts/API/tooling unit coverage; its final tooling suite reports72 passes, zero failures. Gated commit `4549ca1` records that source revision. This closes the bounded repair, not all application features or later source revisions. No fabricated E2E matrix is added for a compiler/formatting-only task.
