# DB-LEAST-PRIVILEGE-001 handoff

**Current update:** DELIVERY-RECONCILE-002 completed the explicitly authorized local setup: runtime role configured/active,035/036 applied, and API readiness200. [Actual activation and current user command](local-database-activation.md). Earlier authoring-only statements below describe the initial handoff, not the present local state.

Authored only in `codex/db-least-privilege-001`, base `6f2b508`. No dependencies installed, format/check/build/tests/provisioning/migrations/services/provider calls or commit/push executed. No real `.env` or root tracker edits. Parent integrates; the user invokes all deterministic actions.

## Interface and integration

`DATABASE_URL` stays runtime. Optional `MIGRATION_DATABASE_URL` selects the same PostgreSQL database/schema with the existing owner; missing setting preserves legacy behavior and does not claim least privilege. `migrationDatabaseUrl` validates paired targets. `readConfig` still omits the migration setting from application config. The owner migration path calls `refreshRuntimeGrants` in its existing transaction after migrations. Preserve all main migration registrations, specifically pending `035_bea_quarantine.sql`; this worktree does not copy or remove that migration.

Manual `pnpm db:roles` previews, `pnpm db:roles --apply` provisions. It requires explicit paired loopback URLs, distinct users, an existing schema directly owned by the migration user, database owner/superuser grant authority and CREATE ROLE for a new role. New passwords use a SCRAM verifier in SQL, never raw passwords; identifiers and URL options are constrained. A role is bound by a marker to exact database/schema/owner catalog IDs. Unknown existing roles, memberships, ownership, excessive current/default/PUBLIC grants and executable security-definer functions fail closed. The tool never changes another role, a PUBLIC grant, ownership, files or data. Existing marked-role passwords are not rotated; a fresh connection validates their configured credential before repeat apply.

Runtime gets CONNECT, schema USAGE, table SELECT/INSERT/UPDATE/DELETE and sequence USAGE. Schema migration ledger gets SELECT only. Persistent schema/table DDL, role/database management, trigger changes and TRUNCATE remain denied. PostgreSQL's inherited PUBLIC TEMP privilege is explicitly reported and unchanged; do not claim all DDL is prohibited. Default privileges are scoped to the migration owner and application schema; every subsequent owner migration refreshes grants and protects the ledger atomically. A failure rolls back the migration or provisioning transaction. Changing the API back to owner credentials is never an automatic recovery action.

The API dev/start wrappers strip `MIGRATION_DATABASE_URL`, `POSTGRES_USER` and `POSTGRES_PASSWORD` from runtime children. This separates ordinary launch credentials, not a production secret vault or a filesystem sandbox; administrators and local code running as the developer can still read their private `.env`. The local port helper preserves and updates both URLs without merging their identities. Remote or mismatched targets are refused before rewriting local ports.

The existing real fixture now obtains owner credentials from `MIGRATION_DATABASE_URL ?? DATABASE_URL`; its explicitly owned migration URL always overrides the normal schema. Its API580–586-only `leastPrivilege:true` option creates a unique marked runtime role, passes that role to the actual app, and returns optional `runtimeDatabaseUrl/runtimeRole` to the private helper. Existing `databaseUrl` remains the owner URL for labelled fixture setup. Default `leastPrivilege:false` preserves ordinary test behavior. Teardown closes the API, drops only its owned schema, revokes that runtime role's CONNECT and drops the exact newly created role. Existing manual-worker behavior is preserved.

## Exact manifest

New:

- `apps/api/src/database-roles.ts`
- `scripts/db-roles.mjs`
- `scripts/runtime-env.mjs`
- `scripts/api-start.mjs`
- `tests/e2e/helpers/database-role-fixture.ts`
- `tests/e2e/cases/api/database-roles.spec.ts`
- `tests/unit/database-roles.test.mjs`
- `docs/product/database-least-privilege.md`
- `docs/development/database-least-privilege-handoff.md`

Modified:

- `.env.example` (comments only; current defaults preserved)
- `package.json` (`db:roles` entry; preserve unrelated parent/package changes)
- `apps/api/package.json` (safe start wrapper)
- `apps/api/src/migrate.ts` (owner URL and transactional grants only)
- `apps/api/src/storage-error.ts` (safe owner/runtime instructions)
- `scripts/api-dev.mjs` (runtime environment)
- `scripts/local-ports.mjs` (paired URL preservation)
- `tests/e2e/helpers/feedback-fixture.ts` (default-off option and optional private result fields)
- `tests/e2e/helpers/feedback-api-process.mjs` (owned owner/runtime separation and cleanup)

## Authored acceptance

Seven API cases, four units; no browser/offline case is needed for this infrastructure-only change. Existing responsive account/holdings/source screens, strict API contracts and readiness are reused. There is no user-visible feature, new business dataset, API route, provider, recurring automation, migration file or package dependency. Device-only storage is unchanged.

- API580: actual app registration/goals/holdings/readiness and source creation under runtime; immutable source revision rejects runtime UPDATE and stays unchanged.
- API581: actual CREATE TABLE/SCHEMA/ROLE, ALTER TRIGGER, TRUNCATE, migration-ledger DELETE and owner SET ROLE denied; role/database/schema privileges inspected, TEMP reported honestly.
- API582: actual owner `applyMigration` plus runtime-grant refresh, new table/sequence DML, denied ALTER/ledger writes; independent later owner table uses default grants immediately.
- API583: read-only repeat preview, repeat apply, fresh authentication with unchanged credentials, rejected incorrect password and unchanged actual holdings.
- API584: unknown existing role stays untouched; intentionally unsafe CREATE grant on only the owned schema is refused and not silently revoked, then exact test grant is cleaned up.
- API585: real failing owner migration rolls back its table and ledger entry while the actual runtime API keeps the prior holdings.
- API586: actual new-role provisioning reaches the exact GRANT blocked by an owned table lock; fresh-statistics/PID observation then cancels only that owned query. Role and partial grants roll back and runtime holdings remain unchanged. Failure cleanup validates the exact role marker before revoking only that test role's grants.

Units cover rejected URL/identifier/target input before any connection, legacy/explicit migration URL selection, omission from runtime config, preservation of owner/runtime credentials during local port changes, and removal of owner credentials from API child environments.

## Exact user-run next actions

No install or dependency change. Existing PostgreSQL16 and MongoDB7, Node24–26/pinned pnpm and the user's operator key are required for the real fixture/API cases. The owner used by the fixture must CREATE SCHEMA and CREATE ROLE; API586 also cancels one query belonging to that same owner. No normal database table or PUBLIC privilege is modified by these tests.

1. Inspect the integrated diff and private configuration. Keep the existing working owner connection available. User runs `pnpm format` and `pnpm check`, or the requested `pnpm sdlc "Separate runtime database privileges" -- --project=api --grep @DB-LEAST-PRIVILEGE-001` once services/migrations are ready. SDLC does not provision roles or start services. Do not commit until user gates pass.
2. For an existing database, user first runs `pnpm db:migrate` with the existing owner setup. Privately copy that URL to `MIGRATION_DATABASE_URL`; choose a distinct lowercase runtime role and private24–256 printable ASCII-character password, then configure `DATABASE_URL` for that runtime identity using the exact same host/port/database/schema. Do not put credentials in shell arguments or shared output.
3. User runs `pnpm db:roles`, reviews the safe role/schema plan and TEMP disclosure, then explicitly `pnpm db:roles --apply`. If unsafe PUBLIC grants/ownership/defaults are reported, stop and have the administrator review those exact permissions; the helper will not rewrite them. On failure the original owner remains usable; correct the private configuration and retry. An existing role password mismatch needs explicit administrator rotation or a corrected URL, never an automatic overwrite.
4. User runs `pnpm db:migrate` again with both URLs and restarts the API using the normal launcher. Open the printed web URL (`/#account`, `/#holdings`, `/#ops`) and verify existing sign-in/save/read workflows. `/api/v1/ready` must report ready. The app must use runtime; migrations must use owner. `pnpm db:up` may update both local ports while preserving credentials.
5. User opens `pnpm e2e:ui` and selects API580–586 / `@DB-LEAST-PRIVILEGE-001` in the API project, with watch off. Existing fixture regression selections and local-port units should remain in the ordinary `pnpm check`/user SDLC run. No physical-device acceptance is newly required by this infrastructure change.

For failure, report run ID/time, case/project, safe first assertion and the owned schema annotation. Never share URLs, passwords, salts/verifiers, cookies or `.env`. Pending changes have no verification claim and no new commit; the local base hash remains `6f2b508` until the user's gated commit.

API586 lint follow-up: role identity/identifier checks now throw from an explicit cleanup helper outside finally. The finalizer still rolls back, settles provisioning and closes both connections even on refusal. The existing actual cancellation/rollback case is preserved; user reruns format/check and selected cases via pnpm sdlc. No execution or new commit is claimed.

API586 typecheck follow-up: observer now uses typed ownedRetentionDatabase; databaseRoleTools explicitly types its lazy module exports, and the body uses a definite provisioning promise while teardown retains the optional reference. User reports lint and app typechecks passing before this correction; E2E typecheck still needs the user rerun. No execution or commit by the agent.

REGRESSION-011 / API586: target-table locking did not block GRANT's catalog ACL write. The case now holds an uncommitted SELECT revoke on only the owned fixture role's app_users ACL, cancels the exact blocked GRANT, rolls back the blocker and compares original ACL/runtime access plus unchanged holdings and absent candidate role. No revoked privilege is committed; marker cleanup remains. Baseline b5cfcd0 failed the old observation; correction awaits user execution.
