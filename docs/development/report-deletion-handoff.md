# REPORTS-002 integration handoff

Authored in isolated `codex/reports-002` worktree from0a91aff. No tests, checks, formatting, builds, migrations, services, installs or commits executed by this agent.

## Files and layers

- `packages/contracts/src/reports.ts`: strict confirmed deletion input, metadata-only receipt, capacity and export/list shape.
- `infra/migrations/021_report_deletions.sql`, `apps/api/src/migrate.ts`: additive account-owned tombstones and bounded request counter. No deployment-time deletion of existing reports.
- `apps/api/src/reports.ts`: owned transactional delete, replay protection, physical cascade deletion, account/request/job locking, new-request100/hour bound. Existing worker finalization checks job/lease and cannot recreate missing jobs.
- `apps/web/src/Reports.tsx`: terminal-report action, accessible confirmation/keep/Escape/error/result, slot usage, authoritative sequenced polling and local deletion fence. Remote deletion removes selected reader; old request failures do not override newer state.
- `apps/web/src/offline/reports.ts`, `offline/accounts.ts`: local tombstones/budget and global local-ID ownership checks; account deletion removes these maps. Export helpers provide metadata-only receipts without extra privacy-controller changes.
- `docs/product/report-deletion.md`: scope, limits, retained data and operation.
- `tests/e2e/cases/{api,browser,offline}/report-deletion.spec.ts`: API224–226, WEB223–224, OFFLINE263–264 under@REPORTS-002.

## Acceptance and review

API224 asserts actual snapshot/job/output removal, owner replay, stale version, foreign denial, reclaimed capacity, privacy redaction and account-cascade deletion. API225 covers concurrent deletion after a controlled running lease/cancel and absence of an issuable job/output. API226 injects an exhausted counter only in the owned fixture to prove deletion/duplicate retries remain available. Browser/offline cases cover mobile keyboard confirmation/cancel/reload and an explicitly delayed old list after independent same-origin deletion. API225 now calls the actual compiled ReportsStore.finish with its captured original lease after deletion, using a real isolated database transaction. API226 uses explicitly synthetic100-row capacity setup in the owned schema and expires only its owned rate window to cover100→99→100. Browser/offline tests explicitly release a held old list after a newer deletion read and await delivery/render before asserting absence. Offline setup waits for On-device mode and covers zero outbound API requests, own410/foreign404 replay and private export scrubbing.

No dependencies added. Parent should integrate this slice before migrations022+ from other worktrees, run format/check and relevant prior reports/privacy/account cases plus all@REPORTS-002 API/desktop/mobile cases. Rebuild dedicated Android assets then select OFFLINE263–264 and earlier report/privacy cases with existing offline UI, watch off. Existing service URLs are launcher-selected; use their printed web and test-UI addresses. Native acceptance must separately verify confirmation/Back/export-copy warning on a phone; browser tests do not establish that.

Expected: deleted reports remain absent after reload and request replay, private content is absent from PostgreSQL and exports, capacity decreases, source goals/holdings are untouched, and no queued/running report is deleted without prior cancellation. Failures should include saved run timestamp, case/project, redacted failure text and current build identity. Never include financial exports or credentials. Parent owns rootTODO/README/status/catalog/coverage updates and gated local commit; no push.

## Parent integration evidence

Integrated with additional populated-record preservation, plain Node invocation of the real late worker, contrasting destructive confirmation actions and accessible focus after removal. WEB225 additionally proves overlapping slow reads do not starve updates; completed responses are drained before teardown. Actual connected/offline results, failed-harness history, resource cleanup and migration preservation are recorded in status.md. Final format/check gates precede the scoped local commit. Root README/TODO/catalogue/coverage/data dictionary/CTA/privacy docs are updated. APK rebuild follows the shared feature batch.
