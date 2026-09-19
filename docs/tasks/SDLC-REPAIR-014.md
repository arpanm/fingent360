# SDLC-REPAIR-014 — E2E compiler repair

- **Status:** Done (verified gate scope)
- **Input (2026-09-16):** User supplied only the E2E TypeScript diagnostics from `pnpm check` exit 2. Authoring and read-only inspection only; no report, execution, commit or delegation. Pickup/input records reviewed; no private input needed.
- **Scope:** Repair the named test/helper type boundaries, missing imports, browser response status access and root ZIP dependency. Preserve assertions, strict validation and real workflow paths.
- **Dependencies:** Existing workspace dependencies; declare the already locked fflate version for root-owned test helpers.
- **Acceptance:** Supplied diagnostics disappear without casts that bypass validation; reconciliation and active consent are required; scenario mutations retain their narrowed family; downloaded evidence remains runtime validated; native fixtures use shared bridge declarations.
- **Layers:** Specification, test fixtures, TypeScript contracts and documentation apply. No product UI/UX, navigation, loading/empty/error/recovery/saved states, database, provenance or automation behavior changes. Keyboard/mobile/visual acceptance and parent feature completion are unchanged.
- **Verification:** Actual format/check/unit gates passed in SDLC1789837762812-24470, gated commit4549ca1; see recorded gate acceptance below.

## Reusable prompt

Repair only the supplied E2E compiler failures. Inspect the named tests and direct dependencies, fix their root causes and strengthen meaningful regression assertions. Update README, TODO, catalog and coverage documentation. Do not run deterministic commands, read suite reports, commit, delegate or start another task.

## Manual acceptance

### Formatting follow-up — 2026-09-16

The next supplied `pnpm check` failure stopped at Prettier warnings for the offline bond-evidence and corporate-rating cases and TODO.md. This scoped follow-up repairs assertion wrapping and task-row padding only; no expression, assertion, runtime schema or fixture changes are needed. README and this record document the repair. All broader compiler and feature verification remains pending.

- **SDLC-REPAIR-014-FMT-A:** User runs `pnpm exec prettier --check tests/e2e/cases/offline/bond-evidence.spec.ts tests/e2e/cases/offline/corporate-rating.spec.ts TODO.md README.md docs/tasks/SDLC-REPAIR-014.md`; expect exit 0 without warnings.
- **SDLC-REPAIR-014-FMT-B:** Review the repair diff to confirm E2E-OFFLINE-1980/1982 and E2E-OFFLINE-1960 retain all withdrawal, receipt integrity, export and private-state assertions. Only assertion layout changes; no new executable case is warranted for whitespace.

Existing installed dependencies suffice for this formatting check. No services, migration, UI URL, project selection or provider input is needed. Report the command, exit status and flagged-file diagnostics on failure. The parent owns the exact `pnpm check` retry. No deterministic commands, suite reports, commits or delegation are permitted for this attempt; existing HEAD and unrelated work remain preserved.

After the user runs `pnpm install --frozen-lockfile` to link the declared root dependency, the smallest compiler gate is `pnpm e2e:typecheck`. Expect exit 0 without the supplied diagnostics. No services, migration, UI URL or E2E project selection is needed for compilation. The parent retries `pnpm check`; report exact command, exit status and compiler diagnostics on failure, without private data.

## Implementation and remaining gaps

Authored fixes cover optional allocation reconciliation, the missing analytical-context database import, nested consent records, literal cohort parser identity, browser numeric response status, captured string IDs, bodyless fetch options, unknown offline evidence and scenario-family narrowing across callbacks. ZIP helpers keep their real fflate implementation; the root manifest and importer now declare the existing 0.8.3 lock entry. Its string return types also restore contextual typing of the two replacement callbacks.

NativeBridge, IOSFeedbackBridge and their Window augmentation now live in a declaration-only shared native-bridge module. Runtime re-exports preserve existing consumers; iOS fixtures import the type and satisfy the actual interface without importing startup code. No permissive ambient replacement or compiler-option relaxation was added.

Regression assertions: API1406 explicitly requires reconciliation before checking allocation dependencies; API1254 requires active private-history consent and uses its recorded version. WEB1881 still requires registration201/save200 and the real calendar navigation. Existing negative scope/value and withdrawal cases remain intact. The synthetic workbook helpers and all original parser/reconciliation assertions remain unchanged.

Affected existing cases: E2E-API-1406,1503–1504,1890–1892,1254; E2E-WEB-1610–1612,1881,1831; E2E-OFFLINE-1980,1960,1920,1270,1890,1990,1433,1380. SBI/Axis helper consumers retain their existing structural workbook regressions. These are API, desktop/mobile and offline cases respectively; compilation selects no Playwright project or tags. No new fixture data, provider calls or database changes are required.

Remaining gap: dependency linking and user/parent validation. No formatting, lint, typecheck, builds, tests, SDLC, installation, services, migrations, ingestion or commit was run. No suite report was read. Existing HEAD `a2c53a0` and extensive pre-existing tracked/untracked work are preserved and remain uncommitted under the explicit boundary. Broader feature/parent statuses remain unchanged.

## Recorded gate acceptance — 20 September 2026

Scope: E2E type-boundary, root locked fflate dependency declaration and shared native bridge declaration repair, preserving runtime assertions.

User-authorized SDLC run `1789837762812-24470` completed formatting and the entire check stage successfully before connected acceptance began. The [check log](../../artifacts/sdlc/1789837762812-24470/02-pnpm-check.log) includes strict application/E2E compilation and contracts/API/tooling unit coverage; its final tooling suite reports72 passes, zero failures. Gated commit `4549ca1` records that source revision. This closes the bounded repair, not all application features or later source revisions. No fabricated E2E matrix is added for a compiler/formatting-only task.
