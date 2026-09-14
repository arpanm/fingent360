# EVENT-REVIEW-001 authoring handoff

Authored against main base `b5cfcd0`, with other pending feature changes preserved. No tests, formatter, lint, type checks, builds, installation, migrations, services, providers, Git commit or push executed. Parent owns root TODO/README/status/catalogue/coverage entries and migration041 registration. A working-tree implementation is not a verified release.

## Product/layer coverage

- `docs/product/event-review.md`: event versus claim/inference, exact quote admission, editorial sector context, retained instrument identity, unknown direction/horizon, named identity publication, public/private history and snapshot boundary.
- `packages/contracts/src/events.ts`: strict authored input, immutable revision/review/public/list/history schemas, actual discovery string-ID→UUID document/evidence adapter, complete graph reconstruction checks, source/identity revision linkage. Additive index export. `domain-records.ts` allows `horizon:null`; existing quantified horizon validation remains.
- `infra/migrations/041_reviewed_events.sql`: heads, immutable drafts/revisions and save/review receipts. No account/portfolio/goal mutation or private investor rows.
- `apps/api/src/events.ts`: actual PostgreSQL operations and public controllers/store. Request replay and optimistic versions; each review advances the head, so old competing reviews conflict. Sorted retained source/security locks; post-wait operator authorization; actual published source field substring and full admitted source/identity equality before disclosure. Public filters are applied after source admission, avoiding withdrawn-context inference. Public history contains reviewed publication/withdrawal revision metadata; Operations history includes drafts. Query integer bounds reject invalid continuations.
- Named integration: `named-operators.ts` contract adds event proposal; `publication-proposals.ts` locks exact event head/unused request, calls `EventStore.review(...,complete)` so publication and independent decision commit atomically. `ProposalInspection.tsx` reads the actual bound saved editorial graph. Bootstrap direct event review remains explicitly available; direct review is blocked by named permission metadata. Existing named-source-create receipt identity correction is a separately documented shared change.
- `EventOperations.tsx`: actual source choices, explicit exact excerpts, optional editorial sector/retained-instrument context, explicit rebind after refreshing choices, excerpt removal with dependent-link confirmation/reindexing, save/retry/version conflict, review/proposal, internal revision history and current-revision reload. Draft state is guarded before router or Operations tab departure. Old receipt survives a failed current read.
- `Events.tsx`: responsive public list/detail, cited source and sector/family/instrument navigation, publication history, unknown effect/horizon language, loading/empty/unavailable/retry/Back. `App.tsx`, `navigation.ts` and `Operations.tsx` add routes/tab adjacent to frozen ECB edits.
- `offline/events.ts`, dispatcher/types: zero-network reading of actual installed event records; every read revalidates full source/identity bindings against its installed corpus. Connected-only editing. No fabricated local events or investor persistence.
- `scripts/event-snapshot.mjs` and `offline-snapshot.mjs`: user-run bounded public capture. Strictly advancing cursors, at most1000 records/history entries (otherwise explicit whole-export failure), full history capture, final event material-state reread, and exact captured source/security reconciliation. It is a dated best-effort snapshot, not a cross-service atomic or continuously fresh view. No operators/credentials in export.

## Authored cases

Tag `@EVENT-REVIEW-001`:

- API700: actual source draft, domain graph, explicit review, exact retry receipt, head advancement, public sector context, draft-private versus public-reviewed history, oversized history query, source withdrawal suppression and unchanged retained revisions.
- API701: invented excerpt, unknown retained identity, stale draft and immutable-history rejection.
- API702 (`@NAMED-OPERATORS-001` too): distinct named identity approval, direct review/self-review denial, actual published record and exact decided proposal replay.
- API703: owned real source row blocks publication; observe exact SELECT, expire only its operator session, release and assert401/rollback; requests drained before teardown.
- API704: actual identity from the public captured bundle is inserted in isolated storage, bound to an explicit synthetic contextual link, then an explicitly synthetic identity revision invalidates public disclosure.
- WEB700 desktop/mobile: real UI author/save/review/read/Back, actual excerpt, unknown impact and no horizontal overflow.
- WEB701 desktop/mobile: undo excerpt addition, refresh choices without losing draft, cancel tab departure, explicit close/discard.
- OFFLINE700: actual installed empty/populated snapshot UI and connected-only operation with zero API network requests.
- OFFLINE701: real local handler with actual bundled source plus explicit synthetic editorial record; changed/withdrawn source suppresses content and leaves private state unchanged.
- `packages/contracts/test/events.test.mjs`: actual captured-source adapter, graph/identity mismatch checks, unknown horizon, invalid refs/citation/extra impact field.
- `tests/unit/event-snapshot.test.mjs`: publication changes during history capture fail export; mismatched captured source excludes body; backward cursor rejected.

Case fixtures are lazy. Connected cases use the existing isolated application fixture with an added exact public `/events` forwarding route; no discovery-time database setup. Operator credentials are excluded from trace/video/screenshot artifacts. Synthetic editorial labels remain explicit; actual stored source text and retained public identity records are not claimed as synthetic provider integrations.

## Manual acceptance and remaining gates

No dependency added. User runs the current SDLC workflow after reviewing all integrated changes: `pnpm sdlc "Add reviewed source-bound events"` (format/check precede commit, then selected tests), or the documented individual manual build/migration/dev commands. Migration038 and040 dependencies plus041 must be registered/applied by the user before API startup. Open the printed web URL at `/#ops` for Event review, or `/#events` for public reading. Start `E2E_BROWSER=chrome pnpm e2e:ui`, leave watch/eye mode off, and select the above IDs/tag in API/desktop/mobile/offline projects. Rebuild the actual offline snapshot/APK manually for new reviewed event content; an older bundle truthfully starts with no event records.

Expected behavior: zero public event before explicit review; independent named ID approval when enabled; no stale source/identity body after admission failure; no price/advice/causal inference; preserved drafts and dated receipts; public history excludes candidate revisions; offline never calls providers. Report run ID, exact failed case and `artifacts/e2e/latest.md` if a user-run gate fails. No commit hash for this authored feature is claimed.

This child delivers editorial event/entity exploration. It does not finish DEV006's future extraction pipeline, DEV010's numerical causal/policy goal, automatic sector classification, market pricing, licensed feeds, regulated suitability or advice. Distinct login IDs are enforced; administration governs whether they represent separate people. Source rights remain an external approval/evidence boundary.

Root reader integration formats captured/effective/announced dates for the reader, identifies the cited publisher, and keeps raw hashes/field names in expandable exact-evidence details. Source data and timestamps remain unchanged.

The reader adds events.css for bounded long-evidence wrapping, quotation treatment and visible keyboard focus; WEB700 opens the evidence disclosure using Enter.
