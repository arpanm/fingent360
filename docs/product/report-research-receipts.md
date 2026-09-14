# Research receipts in saved record reports — REPORTS-003

An investor may explicitly include up to 20 of their active research connections in a private saved-record review. The selection is optional and unchecked initially. Reports without a selection remain the exact v1 format. Reports with selected connections use policy `saved-record-review-v2`; existing jobs, snapshots and issued reports are never rewritten.

## Workflow and boundaries

Reports → Include research connections → load current owned connections → select exact connection revisions → inspect personal reasons, dated source receipts and current review warnings → consent → review selection → capture. A separate consented report snapshot retains the selected private notes even if a connection is later removed. Delete that report to remove its copy; account deletion removes both. Source receipts contain source identity, URL, edition/hash and effective/publication/retrieval dates only. No article title/body/summary, sector or price claim, financial impact or new inference is included. Goal, holdings and allocation arithmetic is unchanged.

A session-denial response from capture, report reads or the connection selector immediately clears private workspace and draft state and shows sign-in; old delayed responses cannot restore it.

The request uses unique connection ID/version pairs, canonicalized by ID. Up to20 selections bound report size. Unknown/duplicate/empty/oversized fields are rejected; foreign or removed connections return404; a changed connection revision returns409 so the investor can reload and review. A connection whose source or target changed may still be intentionally captured, together with actual review warnings. Source withdrawal retains only the minimal existing receipt. A newer source edition is recorded separately as context at capture and never silently replaces the investor's selected binding.

The account row is locked before private reads and session validity is rechecked after any wait. Selected source rows are locked in ID order before their latest non-draft publication editions are read. Financial snapshots, selected connection revisions and source/target context are captured consistently. Session validity is checked again after the source-lock wait and before storage, using the shared current-clock expiry check. No provider query is made. Job retries and issuance use only this stored snapshot, even when a source is withdrawn or a target changes after capture. Reports label the context as evaluated at capture, and always state that present-day publication/record status is unknown from an issued report. They do not offer source-reader or original-site links based on historical publication state; investors can open their connections workspace to check current context explicitly.

## Storage and processing

The existing JSONB snapshot/report columns accept a strict v1/v2 schema union. V2 adds a bounded `researchConnections` capture containing its evaluation time, optional on-device bundle generation date, and selected immutable receipts with review reasons plus source/target context at capture. No migration026 is needed. V1 serialized shape, policy, financial calculation and caveats remain unchanged.

Request replay compares the original label and canonical ID/version selection, before capacity or new-request quota checks. Altering either under the same request ID returns409; an identical retry returns the original stored job without recapture. The existing 100-report capacity,100 new requests/hour, owner/request deletion tombstones, cancellation, bounded worker leases and late-worker deletion fences remain. Individual deletion removes the whole v2 snapshot/report; the tombstone retains no notes/source data. Private exports reuse the report schema union, and account cascade removes snapshots, issued reports, limits and deletion receipts.

On-device mode uses the actual dated bundle and owned local connections through the existing local handler. It captures the same shape and processes the stored snapshot on report reads, with serialized durable storage and zero network. Bundle dates remain visible and never imply freshness. Rebuilding the app does not alter prior issued reports.

## Acceptance

API290–299 use real isolated API/PostgreSQL ownership and exact stored published evidence: v1/v2 reconstruction, same/different selection replay, foreign/stale/bounded inputs, capture/issue lifecycle changes, cancellation/lease/deletion fences, quotas, privacy/cascade and unchanged financial records. Test-only source corrections and worker fault states are explicitly synthetic; provider calls are unnecessary.

WEB290–299 and WEB301 cover opt-in selection and review, queued/issued/open/JSON/print, same-request recovery, empty/error/retry/conflict/cancel states, removal, historical-context wording, keyboard/360px navigation and inert note text. Technical source hashes/URLs and connection identifiers sit behind keyboard-accessible disclosures; source dates, versions and personal reasons remain readable. Printable copies expand every retained receipt automatically. Report actions distinguish Print from secondary downloads/close. Print uses the selected immutable report only. Web opens a private print window; a downloadable self-contained HTML copy supports printing from a browser without network. Native Android uses the existing save-file bridge to save that HTML, which the investor opens in a browser for print/PDF; it does not claim a native printer integration. Screenshots and emulated print do not establish physical-printer or phone acceptance.

OFFLINE330–339 cover the equivalent actual bundled reading/owned-record flow, storage reload, exact replay, deletion/privacy and no outgoing API requests. Wait for On-device mode after every navigation/reload before direct fetch. Manual acceptance includes native Back, TalkBack/text zoom, portrait/landscape, print preview/PDF, and user visual/design approval.

Implementation, authoring and verification are recorded separately in the feature handoff. Root controls integration, gates and the local commit; no execution is implied by these authored cases.
