# Publishing queue

PUBLISHING-QUEUE-001 / DEV-015. Implementation complete for the bounded queue; user validation and commit are pending.

Operations requests at most 20 actual stored heads per page, with explicit source, publication-status and title/summary text filters. Protected originals remain available to authorized operators, including withdrawn heads. No new publication, provider refresh, generated interpretation or storage mutation occurs while browsing.

## Contract and ordering

`GET /api/v1/ops/discovery/queue` accepts optional `source`, `status`, `q` and `cursor` fields only. Sources are the eight classifications already produced by `sourceIdFor`: Fed, ECB press/statistics, PIB, BEA, World Bank, authored glossary and other. Status is draft/published/withdrawn. Text is trimmed, nonempty, at most120characters, matched literally within title or summary; SQL wildcard characters have no special meaning. Repeated/unknown fields, unsupported sources, client page-size/offset controls, malformed/altered cursors and changed filters with an old cursor reject.

Pages use current-edition creation time descending, then item ID descending under PostgreSQL C collation, fixed20rows and a signed next cursor. PostgreSQL microseconds are preserved in the ordering tuples. The first row bounds the traversal; each cursor binds the original filters, opening time, upper tuple and previous last tuple. A page selects only current heads at the time its statement runs. This is not an immutable snapshot: a head can change status/title/version, move above the traversal, disappear from a filter or enter it between pages. Reset opens a fresh boundary and shows newly changed heads first. There is no claimed total or completeness guarantee under concurrent changes. Retry repeats the same request but may truthfully return changed current results.

The result contains strict validated head editions with their change dates, applied filters, page size, opening/evaluation times, upper tuple, next cursor and at most one existing latest refresh receipt. Existing `/ops/discovery/items` remains compatible for older clients and source-review recovery. Additive migration036 adds ordering indexes on immutable editions and discovery runs, without changing existing rows. No dependency is added. SQL bounds result rows before application parsing; no full-head array is loaded to implement pagination. Search rejects embedded control characters before PostgreSQL, including NUL.

The edition index matches `v.created_at DESC, v.item_id COLLATE "C" DESC` and includes the version for the current-head join. The latest-run index matches its one-row lookup. These provide available ordered access paths; filter selectivity and accumulated history still affect work. Source/status/text filtering can require scanning candidates, and text remains a literal substring rather than a full-text index. No measured latency or production-scale performance claim is made without a user-run query-plan/representative-data check.

Initial operator authorization precedes storage reads. A final session row SHARE lock and wall-clock expiry query follow all potentially waiting storage reads and hold through transaction commit. Expired/revoked callers receive401 without protected rows. The queue reuses the shared Operations request generation barrier, including late401 after leaving a tab and suppression of old-session failures after a new login.

## Workflow and UI

Publishing keeps Source refresh/status separate above an extracted queue. Choose filters, Apply, Next page, Previous page, Retry exact failed page or Reset queue. Loading replaces old actionable rows; empty and unavailable states are distinct. Applied filters remain visible separately from an unsent filter draft; Retry and navigation use the applied selection. Invalid cursor400 directs Reset without a futile same-request retry. Malformed responses produce a plain recovery message. Counts say how many are on this page and the navigation page number, never a dataset total. Labels, keyboard form controls, busy state, focus on page changes, wrapping cards and the existing mobile layout support the same workflow. Closing a saved review returns focus to the queue heading if refresh removed the original trigger.

Selecting a row opens the existing exact-ID/version SourceReview dialog. Its protected retained/evidence/media controls remain. Saving a review invalidates the queue and refreshes the first page of the applied filters without closing/remounting the dialog or clearing its historical saved receipt. SourceReview's existing stale-head409/reload rules remain authoritative. A failed refresh leaves no stale head actionable and exposes Retry. Source refresh and BEA recovery also invalidate the queue without triggering another provider request.

## Layer acceptance

- Specification/contracts: strict filters/cursors/pages; source classification agrees with existing research classification; unknown/repeated input rejects.
- API/database: real current stored heads, deterministic20-row pages, filter-bound signed cursor, unchanged immutable versions and financial records, latest-run reuse, final post-wait session admission. Existing PG tables and controller DI are reused; Mongo/provenance originals remain unchanged.
- UI/UX: filter→page→exact review→save→dated receipt and refreshed queue; loading/empty/503/retry/reset, Back/keyboard/mobile, source refresh unaffected, no old-session restoration.
- Automation/data: read-only user action, no worker/timer/provider/new data. Explicitly synthetic stored fixtures exercise order/faults; existing stored source editions retain their dates, hash and attribution.
- Offline: Operations remains connected-only; direct queue bridge access returns the existing connected-required response without API traffic. No local publication editor or bundle change.
- Documentation/testing: real isolated API560+ and desktop/mobile WEB560+ cases, strict contract units and OFFLINE550; exact manifest and user-run instructions in the handoff. No author execution or verification claim. Physical-device and visual acceptance remain separate.
