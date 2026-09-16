# SDLC-REPAIR-015 — Reclassify failures after agent repair

- **Status:** Implementation complete; validation pending
- **Scope:** Fix the user-operated SDLC recovery path that sends formatting failures introduced by a code repair back to an agent. Preserve check-before-commit ordering and exact-case E2E retries.
- **Evidence:** Run `1789527818860-12801`, stages 04/05, failed Prettier on offline bond/credit cases. Repair attempt 3 manually edited whitespace and exhausted the budget. The bundled Codex CLI launched successfully. Root `fflate` is declared but its local dependency link is absent.
- **Acceptance:** Reclassify every failed command retry; use scoped Prettier before another agent, including when the agent budget is exhausted. A subsequent compiler error must supply its own latest details. Cancellation, the shared attempt limit and bounded formatting drift remain enforced. Checks must pass before commit or E2E.
- **Layers:** This is developer tooling. Application web/Android UI, API, database migrations and source ingestion do not change. Unit orchestration regressions cover the behavior; application E2E cases would not exercise this launcher path.
- **Reusable prompt:** Read AGENTS.md and this record. Repair only failure routing in scripts/sdlc.mjs. Author injected-executor unit regressions for code-to-format transitions, exhausted budgets and replacement error details. Preserve exact E2E selection and all validation gates. Update README, SDLC guidance and TODO. Do not execute deterministic commands or commit; the user-run script owns those steps.
- **Implemented:** Command retries re-enter failure classification with the latest log and shared budget. Two injected-executor regressions cover formatting after the final agent attempt and a subsequent distinct compiler failure. Existing exact-case E2E routing is preserved.
- **Pending:** User-operated validation; no new passing run claimed.
- **Next action / inputs:** No product decision needed. User runs `pnpm install --frozen-lockfile`, then `pnpm sdlc "Complete source workflows" --affected`. Existing API/databases and E2E browser prerequisites apply to selected application tests.
- **Verification:** Saved logs and source inspected only. No new checks, tests, migrations or commits run. On failure provide the failed stage log and repair handoff from the new artifacts/sdlc run.
