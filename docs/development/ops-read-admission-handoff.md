# OPS-READ-ADMISSION-001 handoff

Authored in codex/ops-read-admission-001 at6f2b508. No tests/build/format/install/services/provider/migration/commit/push execution. Root owns integration and documentation only. The user now runs deterministic gates and commit through pnpm sdlc; no agent execution is authorized.

Modified only apps/api/src/discovery.ts (OpsDiscoveryController.items/runs) and apps/api/src/ops-legacy.ts (source list/history): await unchanged store result, call operator.require(cookie) again, return only after successful final admission. Preserve pending SOURCE-REVIEW/BEA additions when applying these tiny hunks.

New product spec docs/product/ops-read-admission.md; tests/e2e/cases/{api,browser,offline}/ops-read-admission.spec.ts; this handoff.

Layer acceptance: existing strict response contracts/data queries/public projections are reused unchanged; no migration or dataset; controllers gain final wall-clock admission after storage. Existing shared Operations request/session generation handles401 and late responses; same existing sign-in/UI/workflow reused. Local notice unchanged and makes zeroAPI calls. No provider/automation changes.

API520–523 each hold a real isolated table ACCESS EXCLUSIVE lock and run the matching protected SELECT, expire then revoke actual operator sessions in two independent cycles, release the lock, assert401, sign in anew and assert identical original result. Source revision remains byte-equivalent. WEB520/521 exercise real Source registry/Publishing storage-wait expiry, immediate sign-in and fresh session recovery. OFFLINE530 asserts connected-only/server controls absent/noAPI. Operator specs disable traces/video/screenshots to avoid retaining real key values.

Manual user verification: existing PostgreSQL/MongoDB and operator key; pnpm format; pnpm check; pnpm dev; E2E_BROWSER=chrome pnpm e2e:ui select @OPS-READ-ADMISSION-001 api/desktop/mobile, watch off. Rebuild device web assets and run OFFLINE530. No new dependencies/migration. URL /#ops on printed web origin. Report latest.md run ID/time/selected project/case and first safe failure; never share operator key/cookies/database URLs. Full production roles and hardware acceptance remain separate.

WEB522 additionally holds an actual successful protected registry response, signs out through the real API/UI, releases/drains the old200 and verifies the signed-out surface cannot be restored; a new sign-in remains usable. No fabricated success payload is used.

Latest user boundary: after parent integration, the user runs `pnpm sdlc "Fix final operator read admission"`; commit must happen only after formatting/check success. Selected API520–523, WEB520–522 and OFFLINE530 remain authored/unexecuted. No agent-triggered services, provider requests, tests or gates.

Peer harness corrections before freeze: wait observers now match each endpoint's exact SQL and the owned blocker PID, not any SELECT. Browser initial requests settle before acquiring locks and every outstanding request drains after release/finally. API discovery controls ingest the actual captured BEA fixture and assert nonempty typed outputs; API520 additionally preserves a real owned goal and actual published public feed across both expiry/revocation cycles. WEB522 holds all matching initial registry reads, drains them and ordinary requests, then verifies fresh sign-in. No execution.

REGRESSION-011 / WEB521: use the queue opening join plus actual waiting relation OID/blocker PID instead of its long SQL LIMIT tail, which may be truncated in pg_stat_activity. Same real storage-lock expiry/relogin assertions, no timeout changes. Baseline b5cfcd0 failed this observation on desktop/mobile; user rerun pending.
