# Account authorization after lock waits — AUTH-WAIT-001

Recovery changes the account password and revokes every server session while holding the account row lock. A private request that waits behind that reset must validate its session again after acquiring the lock. Authentication before a wait identifies the account; it does not authorize work after a reset has committed.

Session expiry uses the database wall clock (`clock_timestamp()`), rather than the transaction-start clock (`now()`). A session that expires while its transaction waits is unauthorized when the lock becomes available, even if no recovery reset occurred.

## Ordering and boundaries

Holdings preview/confirm, goal create/update/delete, allocation current/save and report request/delete retain their existing account locks and recheck the same cookie immediately after acquisition, before private reads, idempotent replay or writes. Holdings confirmation, goal changes and report actions recheck again after their later preview/record/job locks; reports also recheck after request advisory locks before early replay returns. This catches natural expiry during a later wait even though the account lock prevents recovery from overtaking an admitted operation. A revoked or expired request returns the existing401 sign-in response and its transaction makes no private changes. A request admitted after its last blocking lock can finish; recovery waits for its account lock before revoking the session. There is no partial financial mutation.

Report cancel/retry acquires the account lock, rechecks authorization, then acquires the report job lock. The order remains account → request advisory lock where applicable → report job. Background report workers remain independent of browser sessions: recovery does not cancel already authorized preparation or erase issued reports.

Existing ownership, Origin checks, version conflicts, input/output contracts, exact amounts, immutable revisions, report deletion receipts and same-request replay remain unchanged. Replay requires current authorization even though it returns a previously committed receipt. Workbook parsing retains its early authentication and its separate transaction; the final transaction additionally rechecks after waiting for the account lock. Existing expiry cleanup predicates are not changed by this correction.

No table, migration, provider call, permission, scheduled job or financial policy is added. This correction covers the identified account/report row-lock waiters, not a redesign of all in-flight reads or logout/session semantics.

## User experience and local mode

The existing401 handling clears private state, opens the sign-in route and allows the user to sign in with the recovered password. Loading, error, retry, saved, empty and draft controls reuse the existing planning screens. Failed authorization must never display a successful save or discard persisted financial history. A browser regression uses actual recovery and an actual failed private request, followed by sign-in and a successful positive save.

On-device mode uses serialized local state rather than independent PostgreSQL transactions and row-lock waiters. Its existing recovery/session checks continue to apply; no local handler or network behavior changes. Physical-phone/keyboard appearance and existing recovery flows remain manual acceptance, separate from API correctness.

## Acceptance

- API300–309 use the actual isolated API and an owned PostgreSQL schema. Real registration, recovery-code creation and reset establish the authorization state. Test-owned row locks and observed `pg_blocking_pids` coordinate the race; no fake successful responses or arbitrary sleep establishes ordering.
- Recovery derives the replacement password before opening its row-locking transaction. The lock observer therefore allows a bounded recovery-admission window and identifies the waiter from its relationship to the owned blocker, not from an exact `pg_stat_activity.query` string. Private-operation lock observation retains its shorter deadline, so a missing application wait still fails promptly.
- Reset is queued first, then the old-session operation. Releasing the account blocker lets reset commit before the old request is admitted. Expect reset200 and private request401, with unchanged owned previews, financial revisions, report jobs/content, deletion receipts and request budgets. Cover fresh writes and holdings/report/delete replay branches.
- Cancel and retry additionally hold a report row in a separate fixture transaction. Release the account blocker, await reset completion, then release the report blocker; the revoked operation cannot change the job.
- API309 observes real waits on account, holdings-preview, goal, report-job and report-advisory locks, including request/deletion replay. It sets only the owned session's expiry strictly after the waiting request's transaction start and before the current database time. Releasing each blocker must produce401. This distinguishes wall-clock expiry from transaction-start expiry and proves rechecks after later locks without sleeping.
- Positive controls use the recovered account's new session and verify the same legitimate operation or replay succeeds. Existing Origin/foreign-user/version cases remain applicable.
- WEB300 uses desktop/mobile projects for an actual recovery → revoked save → sign-in → successful save and retained-history journey. Browser trace/video/screenshots are disabled for recovery-code handling. Manual acceptance also checks keyboard focus, narrow-screen sign-in recovery, and no misleading saved announcement.
- All fixture blockers are released and pending HTTP requests drained before isolated API teardown, including assertion failures. Connection strings, passwords, recovery codes and cookies must not be attached to artifacts.

Implementation and verification are separate. Authored tests are not evidence of execution; parent integration owns the gates, shared trackers and scoped commit.
