# GOAL-SCENARIOS-001 integrated handoff

Parent integrated the complete feature and additive025, applied format/check, and verified actual API/database, desktop/mobile and packaged offline behavior. All27 selected connected scenarios have passing evidence across correction runs;4/4 selected offline cases passed. Exact run IDs, the corrected StrictMode fault harness, inspected screenshots, record/resource audits and final gate logs are in [status](status.md). Initial gates passed109 unit tests; commit requires final gates. Existing APKcode5 still needs the batch rebuild/reinstall. No push.

The authoring notes below are historical, not the current verification status.

# GOAL-SCENARIOS-001 handoff

Authored only in codex/goal-scenarios-001 worktree from dec6d47. No deterministic gates/services/migrations/installation/commits were run by agent. Parent owns serial integration and verification.

## Integration manifest

New contracts goal-scenarios.ts and index export; migration025_goal_scenarios.sql; API goal-scenarios.ts/controller/migration registration; GoalScenarios.tsx plus Goals comparison link, App route #comparisons, navigation money section and AccountGate return allowlist; offline goal-scenarios.ts/dispatch and account deletion; API/offline privacy exports and schema. Existing goal history and allocation review consume normal adopted goal revisions unchanged. No new dependencies.

Saved comparisons and adoption receipts use per-account localGoalScenarios; localGoals gets its normal appended revision on adoption. API tables app_goal_comparisons and app_goal_adoptions carry FK account cascades and immutable-trigger protection. Lock account and recheck authentication after waiting before every private operation; source/baseline comes from owned saved goals. Client comparison UUID and adoption request UUID make exact requests replayable, mismatched reuse409. Historical replay does not imply current state: UI explicitly reloads and disables adoption when current fetch fails.

## Authored cases and manual gates

API280 exact upper-range money/1200months, baseline unchanged, repeated create, owned isolation, simultaneous adoption replay, unrelated goal preservation, allocation review, export/delete; API281 conflicting UUID body/stale/deleted baseline. WEB280 real save/adoption with simulated subsequentGET503 verifies historical receipt and disabled further adoption; WEB281 guest return, keyboard/mobile, review Back, dirty navigation/cancel. OFFLINE320 exercises worker-free exact local comparison, save/adopt/reload/export/delete and noAPI network. Contract unit tests exercise exact extremes and rejected return assumptions/extra alternatives.

Parent: pnpm format → pnpm check → pnpm db:migrate (additive025) → pnpm dev. E2E_BROWSER=chrome pnpm e2e:ui, select @GOAL-SCENARIOS-001 API/desktop/mobile, watch off. E2E_BROWSER=chrome pnpm android:test:ui selects OFFLINE320 after rebuilding offline assets. Services: configured PostgreSQL/Mongo plus compiled API. Follow printed UI URL. Expected: exact comparison persistence, no goal mutation until confirmed adoption, idempotent edition2 once, stale/removed visible, privacy exports all owned receipts. Share actual run ID and artifacts/e2e/latest.md for failures. Physical device and screen-reader acceptance remain separate from authored cases.

Limit:100 immutable saved comparisons per account; receipts cannot be selectively rewritten/deleted. Account deletion removes all. No growth/return/inflation/tax assumption, recommendation, broker connection or provider data is introduced. Root merges concurrent shared privacy/migration/controller/route exports without dropping existing TEAM003 fields. Additions do not close broad DEV009/019 gates.

API282 additionally holds only its fixture account row lock, observes the actual API transaction waiting through pg_blocking_pids, revokes that account's sessions, commits, and asserts401/no comparison inserted. Production ownership recheck includes clock_timestamp expiry after the wait, not transaction-start now(). No fixtures touch the user's main schema.

### AUTH-WAIT integration finalized

Parent main now supplies AccountStore.find clock_timestamp. Removed this feature's duplicate token/expiry SQL and imports; retained AccountStore.require after the account lock and added require after adoption's final goal-row lock. Merge AUTH-WAIT first; the isolated base itself predates that shared change. No source/provider lock exists in this feature. Existing API282 covers admitted account wait revocation; API280 covers duplicate adoption receipt, and WEB280 covers historical receipt after failed current-state refresh. No test execution by agent.

### Initial-load and saved-comparison replay correction

The bounded follow-up changes only `apps/web/src/GoalScenarios.tsx`, `tests/e2e/cases/browser/goal-scenarios.spec.ts`, this handoff and `docs/product/goal-scenarios.md`. All other pre-existing feature edits remain untouched, including the final goal-lock authorization recheck and removed duplicate expiry SQL. Worktree HEAD remains `dec6d47`; the full feature and this correction are uncommitted awaiting parent gates.

- Initial unavailable/unreadable responses now show Retry comparisons outside the data gate. Loading, empty, saved-goal selection and keyboard interaction reuse the existing screen.
- A validated comparison save or idempotent replay immediately marks current goal context unavailable, retains the historical comparison and refreshes the authoritative list. Refresh failure leaves adoption disabled and offers Retry comparisons. Successful retry still disables adoption if the goal baseline changed or was removed.
- WEB282 covers first-load503 and malformed JSON as explicit transport faults, followed by keyboard retry to the actual isolated API without a page reload. It verifies the real saved goal is available to choose.
- WEB283 forwards and commits the actual PUT, aborts only its browser response, edits the actual goal, and retries the identical comparison ID/body. A simulated GET503 then leaves the saved baseline visible and adoption disabled. Restoring GET and retrying shows the changed-goal warning; the persisted comparison is identical, the goal is edition2 and no adoption exists. No valid successful response is fabricated.

No dependency, schema, API, financial calculation, offline transport or authorization change is introduced by this correction. The shared React correction applies on device; existing OFFLINE320 remains the local persistence/zero-network acceptance. No tests, formatting, builds, services, migrations or commits were executed. Parent retains shared TODO/README/status/catalogue/matrix ownership.

After integrating the full feature and its migration025, with configured PostgreSQL/MongoDB and the local web app running (normally `http://127.0.0.1:5173/#comparisons`, otherwise the printed `pnpm dev` URL), parent/user verification is:

```bash
pnpm format
pnpm check
E2E_BROWSER=chrome pnpm e2e:run --project=desktop --project=mobile --grep 'E2E-WEB-28[23]'
```

Expected targeted selection:4 passing executions, WEB282/283 in desktop and mobile. Keep existing WEB280/281 and OFFLINE320 in the broader feature run. Manual acceptance: fail the initial request and use Retry with keyboard; retry an uncertain saved comparison after editing its goal elsewhere, verify the historical baseline cannot be adopted while context is unavailable or changed, then create a fresh comparison from the current goal. Include360px layout, text zoom and focus visibility. For failures provide `artifacts/e2e/latest.md` or the historical run handoff with timestamp, test/project, configured targets and safe assertion text; no credentials or private exports. A passing authored assertion is not claimed until parent executes it.
