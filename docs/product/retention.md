# Explicit expired-record cleanup — RETENTION-001

An operator can preview bounded counts of already-expired records, review the existing rules, confirm cleanup, and reopen its recorded result. Opening Operations, reading history or creating a preview does not delete business data. There is no timer, worker, provider access or automatic cleanup run introduced by this feature. This is a child of DEV-017/021; backup retention, encryption/key management and production release acceptance remain separate.

## Fixed policy

Policy `expired-records-v1` accepts no caller-supplied table, predicate, cutoff, account identifier or retention period. PostgreSQL supplies a cutoff when a preview is created. Each execution uses that saved cutoff, so later-expiring records require a new preview. Normal lifecycle operations may have already removed some eligible rows between preview and execution; results report only rows actually changed.

| Scope                         | Existing rule at the saved cutoff                                          | Maximum per execution |
| ----------------------------- | -------------------------------------------------------------------------- | --------------------- |
| Account sessions              | `app_sessions.expires_at <= cutoff`                                        | 100                   |
| Operations sessions           | `operator_sessions.expires_at <= cutoff`                                   | 100                   |
| Account sign-in counters      | `app_login_limits.reset_at <= cutoff`                                      | 100                   |
| Operations sign-in counters   | `operator_login_limits.reset_at <= cutoff`                                 | 100                   |
| Recovery counters             | `app_recovery_limits.reset_at <= cutoff`                                   | 100                   |
| Feedback content              | `feedback_reports.deleted_at IS NULL AND expires_at <= cutoff`             | 20                    |
| Feedback rate counters        | `feedback_rate_limits.window_start < cutoff - 2 days`                      | 100                   |
| Unconfirmed holdings previews | `app_holdings_previews.confirmed_version IS NULL AND expires_at <= cutoff` | 100                   |

Revocation already removes sessions immediately; there is no retained revoked-session flag to reinterpret. The cleanup does not remove accounts, holdings/goal/allocation histories, issued reports, recovery credentials, public source documents or evidence, source refresh histories, audits, current sessions or unexpired data. Confirmed holdings preview receipts are retained so confirmation replay can still return its original saved revision. Ordinary API/device preview creation now preserves those receipts too, and its twenty-preview capacity counts only unconfirmed drafts.

Feedback cleanup physically clears text, context, attachment metadata and bytes, setting deletion/update times. It keeps report ID, receipt-token hash, payload hash, receipt status/version, receipt dates and audit records. These tombstones prevent an old outbox or request ID from resurrecting deleted feedback. Existing feedback operations retain their current opportunistic expiry behavior; the preview/history path never calls that mutating code. Previously downloaded files and database backups are outside this cleanup.

## Workflow and durable state

`POST /api/v1/ops/retention/previews` accepts only `{requestId}`. The UUID identifies the durable preview; repeating it returns the same record even if it was later completed. `POST /api/v1/ops/retention/runs/:id/execute` accepts only `{confirm:true}`. Operators may reopen a record with GET `/runs/:id`, and GET `/runs` provides a bounded, cursor-paginated history. All reads require an operations session; both mutations additionally require configured Origin. Account sessions do not grant access.

Each preview and result includes exactly eight count rows, one per fixed scope. Preview `count` is capped at the batch limit and `moreAvailable` means additional eligible rows existed at that read. Result `count` is the number changed by that execution and `moreAvailable` means eligible rows remain at the same cutoff after the batch. These are dated observations, not live totals or guarantees that another actor will leave rows unchanged. No row contents, usernames, tokens, addresses, account IDs or private attachment data appear in responses or count audits.

A schema-scoped PostgreSQL advisory lock serializes maintenance operations. Execution also locks its durable preview. Each batch locks eligible rows and rechecks its expiry predicate before changing them. Cleanup and its completed result/audit commit in one transaction. A completed request is a no-op on every replay, including another authenticated operator or a lost response. Repeating a different saved preview may clean the remaining eligible rows.

A savepoint rolls back every category on a storage error; a generic failed record and count-only audit may then commit, allowing Retry on that same preview. A connection loss/process crash rolls back the whole uncommitted transaction and leaves the preceding durable preview/result available. No running job is claimed and no background retry is scheduled. An unavailable database may prevent recording the failure itself; the UI keeps the same request identity and offers reload/retry.

## Experience acceptance

Operations → Expired data cleanup → Preview expired records → Review cleanup → Confirm cleanup. The confirmation shows the saved cutoff, fixed caps and preservation boundaries. Cancel closes confirmation without executing. Loading, empty, saved preview, failed/retry, completed, remaining-rows and unavailable states have explicit controls. History can reopen earlier previews/results and paginate; reloading retains durable records. Keyboard focus, Escape/Back, narrow screens and no page-level horizontal overflow need separate acceptance from API correctness.

An expired operations session returns to sign-in. After sign-in, the operator can reopen the same durable preview or completed result from history. A lost preview response retries its original request ID while the page remains open; a lost execution response offers Check saved cleanup result before another confirmed attempt.

On-device Operations explains that cleanup targets a connected server and links to App settings and reading. It has no cleanup control and makes no API network request. The server retention API is unavailable to the local transport. Local financial records are never synchronized or cleaned by this feature. The incidental confirmed-preview receipt preservation applies to local holdings too.

Implementation and tests are authored in an isolated worktree. No gates, migrations, services or cleanup run were executed by the implementation agent. The parent records real verification and integrates a scoped gated commit. See `docs/development/retention-handoff.md` for the manifest and exact acceptance cases.

## Authored acceptance cases

API250 covers all eight scopes, fresh data, feedback scrub/tombstone replay, an actually issued report, confirmed receipts and durable count-only history. API251 rejects account-only access, missing/untrusted Origin and unknown/caller-controlled policy fields. API252 covers concurrent operators, duplicate preview/execution identity, capped totals and expiry after a saved cutoff. API253 injects a later-category SQL failure and verifies complete rollback/retry. API254 covers ordinary preview receipt preservation/capacity and history pagination. API255 interrupts only the owned fixture backend during cleanup and verifies transaction rollback. API256 races existing automatic feedback expiry with cleanup. API257 fills every scope past its batch limit, including the twenty-report attachment limit, and checks truthful remainder counts.

WEB250 covers loading, cancel, keyboard confirmation, saved result/history and narrow-layout overflow; WEB251 covers unavailable/empty recovery; WEB252 drops actual committed response delivery and checks replay; WEB253 covers real failed-batch retry; WEB254 covers expired-session sign-in/reopen. OFFLINE280 verifies the connected requirement, navigation, zero API network requests and unchanged device workspace; OFFLINE281 preserves confirmed local holdings receipts across expiry, draft capacity and reload. These cases are authored, not execution evidence.
