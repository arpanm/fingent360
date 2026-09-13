# REPORTS-002 — private report deletion

An owner may permanently delete an issued, failed or cancelled report after explicit confirmation. Queued/running work must first be cancelled. Deletion removes the job snapshot and issued JSON in one transaction and reclaims one of the 100 active-history slots. It never deletes goals, holdings or allocations. Copies already downloaded remain outside the application's control.

Retain only request UUID, owner UUID and deletion time until account deletion. No report label, financial content or payload hash remains in the tombstone. Repeating owned deletion returns the same receipt; retrying its original create UUID returns 410. Foreign and unknown IDs return 404. Expected-version conflicts return409 before deletion, but successful deletion retries do not require the former version. There is no automatic expiry of these tombstones or financial reports.

Create/delete share account→request advisory→job locking. Worker issuance still requires the existing running job and matching valid lease, so cancellation/deletion fences late completion. New successful requests are bounded to100/account/hour; duplicates, deleted-ID replays, cancellation and deletion never consume that budget. Failed capacity checks consume nothing. This bounds retained tombstone growth without blocking privacy deletion. Account deletion cascades tombstones and counters.

The list exposes active capacity; privacy export includes active reports and metadata-only deletion receipts. The same rules apply to local account storage, with no network requirement. The UI requires a focused confirmation, supports cancel/Escape/native Back, shows loading/error/result and refreshed capacity. Authoritative sequenced list reads replace missing cards; older reads cannot restore deleted content.

Ordinary list reads return at most100 active jobs and an empty `deletions` array; they do not repeatedly transfer lifetime tombstones. Privacy export explicitly includes all minimal deletion receipts. This export grows with lifetime deletions, bounded in creation rate rather than silently truncated. No snapshot is retained to support a receipt. Both connected and offline request UUIDs reject another account's active/deleted UUID with404.

Test-only delayed list responses and simulated running leases are labelled timing fixtures. They do not imply a real provider or financial event. Execution evidence is separate from authoring.
