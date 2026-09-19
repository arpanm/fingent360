# SDLC-REPAIR-012 — API compiler boundary repair

- **Status:** Done (accepted scope)
- **Input (2026-09-16):** User supplied only the `pnpm check` API TypeScript failure (exit 2). No suite report is needed or read. No new private input is needed.
- **Scope:** Preserve decoded identity row fields; repair optional GDP/holdings/fetch types, monitoring counter types, sovereign original inference, nullable evidence binding and WhatsApp request/key boundaries. Preserve strict schemas, ownership, signatures and provenance.
- **Dependencies:** Existing installed workspace dependencies; no installation or migration.
- **Acceptance:** All supplied diagnostics disappear without assertions, compiler relaxation or suppressed errors. Missing source hashes never trigger an unscoped context lookup; missing phone lookup keys fail closed; identity decoding retains authentication fields.
- **Layers:** API/contracts and boundary workflow affected. No UI, UX, navigation, keyboard/mobile/visual, database schema, provider activation or automation changes required. Existing runtime paths remain in use.
- **Verification:** Pending; no deterministic execution or commit authorized. Existing unrelated edits and HEAD a2c53a0 must be preserved.

## Reusable prompt

Repair only the supplied API compiler diagnostics; inspect relevant code, author meaningful boundary regressions, and update README/TODO/documentation. Do not run checks, tests, formatting, services or ingestion; do not commit or delegate. Return control to the parent for its exact `pnpm check` retry.

## Implemented and remaining gaps

Identity decoding now preserves its generic row type, retaining password, consent and creation fields at every caller. GDP series accepts the explicit undefined produced by optional Zod fields without changing its public schema. Monitoring and sovereign originals use explicit existing types; archive GET requests omit absent bodies. Holdings provenance handles legacy previews without import metadata. Research governance returns no bound contexts for a null hash rather than querying unscoped policies. WhatsApp uses structural HTTP types consistent with existing controllers and explicitly rejects a missing identity key before hashing.

Authored four API unit regressions in `apps/api/test/compiler-boundaries.test.mjs`: real encrypted identity decode with metadata preservation and lookup mismatch rejection, no storage access for hashless context lookup, absent/undefined GDP originals, and missing WhatsApp key rejection. E2E-API-1600 now checks the real HTTP handshake's plaintext response and invalid-token rejection using the existing synthetic channel fixture; its delivery/encryption/STOP assertions remain intact. Existing monitoring receipt retry coverage remains unchanged. No real provider calls or data were added.

Manual acceptance SDLC-REPAIR-012-A: `pnpm typecheck` must eliminate all supplied diagnostics with existing dependencies and no services. This is the smallest existing root command that refreshes contract declarations before checking API consumers. SDLC-REPAIR-012-B: the parent retries `pnpm check`, including the new unit cases after compilation. No gate is claimed passed.

Optional connected regression: `pnpm e2e:run --project=api --grep E2E-API-1600`, with the existing documented database prerequisites and fixture-managed API. No browser URL/project is needed for this API-only change. No dependency, migration, UI or deployment changes. On failure report the command, exit status and exact diagnostic or selected-case failure; omit credentials and private artifacts.

All verification remains pending. No execution, formatting, installation, service action or commit was performed. HEAD remains `a2c53a0`; the extensive pre-existing tracked and untracked work remains uncommitted and preserved. Parent feature acceptance is unchanged; this task repairs only the supplied compiler failure.

## Current acceptance review — 20 September 2026

Reviewed scope: Repair API compiler boundaries while preserving generic encrypted identity metadata, GDP optional originals, hashless governance context refusal, key-required WhatsApp identity and real HTTP verification response semantics. Existing unit boundary regressions remain mandatory under pnpm check. This bounded repair does not complete wider feature parents.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Passed — automated acceptance. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789848189876-42077.
<!-- sdlc-validation:end -->
