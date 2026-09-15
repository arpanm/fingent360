# BROKER-PARSERS-002 handoff

Implementation: authored capability catalogue, connected five-broker guidance/fallback and public capability endpoint. Verification: not run. Named export parsers: 0/5 supported; missing primary complete layouts/cost semantics, detailed in ../../product/broker-parsers.md. Do not mark DEV-008 complete. Parent root trackers must say partial/evidence pending.

## Root integration

Add `export * from './broker-parsers.js';` to packages/contracts/src/index.ts. No controller registration: existing HoldingsController gains GET broker-capabilities. No migration050 or migration registry change. No offline handler needed: shared UI reads its bundled strict catalogue and uses existing mapped editor/device preview/save. No direct provider call or UI request to the new public endpoint. Existing main Holdings navigation remains. Rebuild/reinstall Android manually to receive shared UI changes.

Files: contracts/src/broker-parsers.ts; contracts/test/broker-parsers.test.mjs; web/src/BrokerImportGuide.tsx and Holdings.tsx; api/src/holdings.ts; tests/e2e/helpers/broker-parsers.ts; API/browser/offline broker-parsers.spec.ts; product/broker-parsers.md and this handoff.

CATALOG and coverage-plan additions: API930 public five-broker strict catalogue; API931 unknown claimed format rejected with no saved revision; WEB930 all five guides and normal map transition on desktop/mobile; OFFLINE930 same route with zero API network. Tag @BROKER-PARSERS-002. Existing mapped/supplemental cases remain necessary for storage/reconciliation regression. No new broker-shaped financial fixture was invented; rejection fixture is explicit synthetic standard CSV under a fabricated format claim.

## Exact manual actions

No dependencies changed. User-owned services: PostgreSQL/MongoDB and current pnpm dev; use its printed web URL → #holdings. Run `pnpm sdlc "Add broker capability admission and guided imports" -- --grep '@BROKER-PARSERS-002'` after root integration. Offline cases use the separately documented offline build/server setup in tests/e2e/README.md; rebuild the APK for device testing. Expected: five guides clearly unsupported, source links and mapped continuation work, invented formats rejected with version0, offline guide makes zero API requests. For failures send artifacts/e2e/latest.md run ID, exact case/project/error and saved failure context; do not paste holdings or broker credentials. Formatting/check/test/build/install/migrations/services/ingestion/commit/push were not run by this agent. Base local HEAD at start: efd28d3; shared parent work remains uncommitted under user-owned gates.
