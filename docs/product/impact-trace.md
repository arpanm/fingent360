# Reviewed evidence to portfolio context

Task IMPACT-TRACE-001 contributes to DEV-006/010/016. Implementation authored; execution, migrations, keyboard/mobile visual acceptance and APK rebuild pending.

## Specification and acceptance

A signed-in reader selects an actually published reviewed event, a reviewed sector, an instrument already in their holdings, and one of their saved goals. The sector and instrument links must cite the same retained source excerpt. The event family is the explicitly labelled editorial economic context, not a separately established causal factor. The UI presents six connected stages: retained evidence, editorial factor/context, sector inference, company inference, owned holding record, and explicitly selected goal. No holding allocation or trade is created.

All citations, source hashes/versions, publication/effective/retrieval times, reviewed event, current identity, exact holding and goal snapshots, and the final rendered view data are retained in an immutable private receipt. When exchange equity coverage is available the receipt also stores every admitted company record in the bounded company window (maximum 1000), with exact edition IDs/hashes. Conflicting same-key/effective-date equity observations generate a visible warning; no conflicting price is selected. The UI fetches these company receipts for preview and the API re-admits the exact reviewed edition set at save. Missing equity coverage is explicit; it is never replaced by fabricated data.

Existing independently reviewed source/event and security-identity admission supplies the real data. This feature makes no external provider calls or LLM calls; no new model-log table is applicable. It stores the final trace receipt needed to reconstruct what the reader saw. The broader data/LLM/evaluation worker owns model execution logging.

## Financial semantics

Quantity stays the original decimal string. Acquisition cost remains integer INR paise. The no-action goal comparator is exactly saved amount + monthly contribution × horizon, calculated with BigInt by the existing no-growth-nominal-v1 policy. Gap is max(target - projected, 0). No return, valuation, tax, liquidation, sensitivity, probability or loss magnitude is inferred from editorial links. A selected goal is context, not proof of earmarked assets.

Source text being retained is a fact about the source, not an assertion that an expectation/scenario inside it has happened. Each event retains fact/expectation/scenario/inference classification; sector/company links remain reviewed inferences. The interface explicitly states that associations do not prove causation and the source set is not an exhaustive contrary-evidence search.

## Storage, API and concurrency

Migration 051_impact_trace.sql adds app_impact_traces, account-cascade ownership, request fingerprint and payload-deletion tombstones. Database trigger forbids editing issued receipts except explicit owned deletion. Creation serializes on the owner row and rechecks authentication after waits. Current event, evidence, identities and applicable equity editions are re-admitted under row locks. A merged/split original cannot start a new trace. Maximum 100 live receipts per owner makes the bounded list/export complete.

- GET /api/v1/account/impact-traces/choices?after=UUID: at most 50 candidate events and owner holdings/goals; next page cursor follows scanned events, including empty filtered pages.
- GET /api/v1/account/impact-traces: retained receipts with dynamically evaluated review reasons.
- PUT /api/v1/account/impact-traces/:id: strict input; exact event, holdings, goal and equity bindings; consent/limits acknowledgement. Same-ID/same-input replay returns the original receipt. Changed-input reuse is 409; deleted receipt reuse is 410.
- DELETE /api/v1/account/impact-traces/:id: removes private payload with retained replay tombstone. Another account receives 404.
- Existing privacy export includes impactTraces. Account deletion cascades all receipt/tombstone rows.

Withdrawn/unavailable/superseded events, changed source/identity admission, changed holdings/goals and changed company evidence produce review reasons on read. Immutable historical receipts are preserved until the owner deletes them. Source publications older than 30 days are labelled historical; missing effective time and future timestamps are explicit warnings. This review-window policy is versioned educational context, not an investment signal.

## Web, Android and offline

Route #impact-traces is available from the existing account navigation. Loading, empty prerequisites, error/retry, preview, explicit consent, save, reload, deletion and return navigation are present. Accessible labels, native selects, 44px targets, responsive overflow handling and keyboard focus indicators apply to web and the shared Android UI. Voice, image generation and swipe gestures are not required to choose or review a financial trace.

The offline handler uses existing admitted bundled events/identities/lineage, local holdings/goals and optional equity snapshot. Private receipts remain under localImpactTraces per owner. Writes are serialized by the existing local gateway; identical requests replay, deleted receipts cannot return, privacy export/deletion includes this bucket, and no network/cloud synchronization occurs. Bundle dates remain visible. Installed APKs require rebuild/reinstallation to receive code/bundle changes.

## Actual completion boundary

This is a usable evidence-to-owned-context trace, not completion of the entire causal-impact parents. It does not create or prove transmission edges, quantify event-to-company elasticities, perform exhaustive textual contradiction detection, establish company-sector classification from every provider, or estimate tax/liquidity-aware goal actions. These require explicitly reviewed causal policies and validated scenarios; the action-centre and event-scenario work must integrate their own policy receipts. Do not mark DEV-006/010/016 or the real oil-shock analytical engine complete solely from this child.

## Acceptance authoring

API960: actual isolated retained source/review/identity → immutable owned receipt, exact quantity/comparator, idempotency, ownership, privacy and deletion. API961: stale version rejection and actual event withdrawal invalidate new/current traces while preserving original receipt.

WEB960 (desktop/mobile): connected selections, six stages, explicit storage consent, real API save/reload/delete and return navigation. OFFLINE960: installed source/event/identity plus synthetic private finance; zero-network save/replay/withdrawal/delete and unchanged financial records. OFFLINE961: golden exact contradictory equity observations, edition-binding mismatch rejection and no fabricated magnitude. Fixtures explicitly identify synthetic identities/links/finances; retained source evidence comes from existing permitted fixtures/bundle.

Manual acceptance: keyboard-only route entry, select/review/save/delete and source links; phone portrait and landscape with large text; TalkBack labels and feedback announcements; installed offline APK after rebuild; fresh connected sign-in expiry while loading/saving; no real personal records in test fixtures. None executed by the author.
