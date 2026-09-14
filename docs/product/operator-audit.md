# Operator audit activity — OPS-AUDIT-001

## Outcome and limits

An authenticated maintainer opens Operations → Audit activity, filters recorded activity by fixed event/module and UTC calendar dates, reads older pages, resets to a new window and returns to Publishing. This is a read-only view of existing immutable `operator_audit` rows. It does not establish a named actor, approval separation, complete operational coverage or current source/worker state.

Discovery refresh/review, macro refresh, source create/update, media generation and identity refresh are recorded **requests**, including requests whose downstream validation or execution failed. Retention rows record a preview, completed batch or failed batch; those labels describe the stored event, not current cleanup eligibility. The screen points to the relevant existing Operations section for its own results/history, without joining or inventing a corresponding receipt. Worker controls and feedback reviews have separate ledgers and are not included here.

## Projection, contracts and pagination

Only audit row UUID, exact UTC recorded timestamp, fixed event code and fixed module are returned. Raw action strings outside the allowlist become `other`; raw targets, actor hashes, session identifiers, credentials, URLs, request bodies, source titles, feedback and financial data are never selected or returned. No actor correlation is introduced. Dates are recorded request/event times, not completion times unless the event itself explicitly records completion.

`GET /api/v1/ops/audit` accepts strict optional `module`, `event`, `from` and `through` filters. Dates are real UTC calendar dates, inclusive at both calendar-day boundaries. Module/event combinations must agree. Pages contain at most50 rows, descending by `(recorded_at,id)`, preserving PostgreSQL microseconds in the cursor. A server-authenticated opaque cursor binds the filters, first page's upper tuple and last returned tuple. Subsequent requests accept only the cursor. Unknown/repeated fields, malformed dates, inverted ranges and altered cursors are400. There is no OFFSET, lifetime cap or total-count claim.

The upper tuple stays fixed while browsing; Reset starts a new window. This is a chronological browse, not a retained database snapshot or complete export: an earlier transaction committing a backdated row after a page was read can become visible on a later read. The UI makes no as-of completeness claim. Existing immutable rows are not copied. A query timeout returns a safe retryable503; no schema/dependency is added merely to optimize an unmeasured workload.

## Authorization and storage

Use the existing operator credential/session and PostgreSQL transaction infrastructure. Authenticate initially, read the bounded projected rows, then acquire the operator session row `FOR SHARE` and recheck expiration using `clock_timestamp()` after that wait. A sign-out committed before final session admission denies disclosure; an admitted read may finish before a subsequent sign-out. Natural expiry during any prior storage wait denies the response. No source/account/financial row locks or writes are needed; session admission is last. Preserve immutable audit triggers and all original rows. No personal-account export/deletion changes apply to this operator-only existing ledger. Responses are private/no-store.

## UI and device behavior

The extracted component validates every response; no raw backend text is rendered as HTML. Filters have separate labels, dates explicitly say UTC, results retain their original UTC precision and show a fixed label. Initial/older-page failures expose Retry. Previously loaded immutable rows can remain during a non-authentication error, with an explicit incomplete-page message. Filter changes, Reset, Back, unmount and sign-out invalidate older reads. Any audit401 immediately clears audit and protected Operations state and invalidates pending parent reads before presenting sign-in. Parent-owned publication/evidence and source-registry/refresh reads share this barrier; pre-existing independent modules retain their own workflows. No automatic polling, background work or provider requests are added.

Loading/empty/invalid/filter-applied/error/retry/end-of-history states are explicit. Older results receive focus after pagination; section heading receives focus on entry. Keyboard and390px browser acceptance are authored separately from physical-device/user design acceptance. Device Operations explains the connected-only requirement; direct local audit calls return503 without network or local record mutation. No audit copy enters the public content bundle.

## Acceptance and delivery

Author isolated actual PostgreSQL/API tests for real operator request records (including a downstream failure), safe unknown projection, strict filters, tied microseconds, stable upper pages, exact retry, unchanged originals and immutable triggers, unavailable storage recovery, and deterministic expiry/revocation behind real locks. Browser cases cover navigation, filters/pages/reload, malformed/failed reads, late success after401/sign-out and mobile/keyboard. Offline cases use the installed local bridge after On-device mode readiness, asserting zero API traffic and durable unchanged private records. Synthetic rows/faults are explicitly labelled; no live provider calls are needed.

Implementation is authored pending parent gates and selected runs. Root owns TODO/README/catalogue/coverage/matrix and integration. No automatic execution, migration, deployment or commit is performed by the author.
