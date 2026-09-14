# EVENT-EXTRACTION-001 handoff

Authored in the shared main checkout over `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`. All feature surfaces and acceptance cases are authored and frozen for user verification. [Specification](../product/event-extraction.md).

No tests, format/check/lint/typecheck/build, installation, migration, service operation, provider call, app-browser verification or commit was run by the agents. User validation and the conditional local commit are pending. No successful extraction from a live provider is claimed.

## Exact feature manifest

1. `packages/contracts/src/event-extraction.ts` — strict source/request/method/selection/candidate/decision/view/history contracts and exact Unicode-safe material helpers.
2. `packages/contracts/test/event-extraction.test.mjs` —11 contract/excerpt goldens, all synthetic and side-effect free.
3. `packages/contracts/src/index.ts` — extraction export only.
4. `infra/migrations/047_event_extraction.sql` — request lifecycle, immutable decisions and bounded remote allowance.
5. `apps/api/src/event-extraction.ts` — actual retained publication admission, request replay/quota, bounded existing-provider dispatch, safe outcomes, atomic standard draft decisions and protected controllers.
6. `apps/api/src/app.ts` — one extraction controller and one provider registration only.
7. `apps/web/src/EventExtraction.tsx` — root-authored paginated source preview, explicit method, human context, confirmations, status/retry/history and private response barriers.
8. `apps/web/src/event-extraction.css` — root-authored responsive excerpts/forms, touch targets and keyboard focus.
9. `apps/web/src/EventOperations.tsx` — entry button and actual stored draft-opening callback with Close/generation fencing; bounded initial workspace and deferred ordinary source/identity choices; preserves identity-selection edits.
10. `apps/web/src/RetentionOperations.tsx` — one paragraph in the existing local Operations explanation.
11. `apps/web/src/offline/events.ts` — extraction route503 guard before existing published-event handling; no bundle or financial changes.
12. `tests/e2e/helpers/event-extraction.ts` — lazy actual owned storage and explicitly synthetic isolated dispatch setup.
13. `tests/e2e/cases/api/event-extraction.spec.ts` — API850–862.
14. `tests/e2e/cases/browser/event-extraction.spec.ts` — WEB850–855.
15. `tests/e2e/cases/offline/event-extraction.spec.ts` — OFFLINE850–851.
16. `docs/product/event-extraction.md` — final source entitlement, bounds, workflow and per-layer scope.
17. `docs/development/event-extraction-handoff.md` — this record.

Coordinated integration prerequisites: root registered047 exactly once in `apps/api/src/migrate.ts` before048. The event author exposed `EventStore.saveIn` in `apps/api/src/events.ts` without changing ordinary save semantics and added optional-current-client auth in named/operator stores. Extraction reuses that helper; it does not replace the concurrently authored identity-selection or lineage logic. Root owns TODO/README/status/CATALOG/coverage. Preserve all other main-checkout changes; never replace shared files wholesale with an older copy.

## Acceptance inventory

**21 E2E definitions:13 API,6 browser and2 offline. Eleven contract unit definitions** cover bounded exact material, template selection and truncation, Unicode, malicious/unknown selector output, range/overlap rules, truthful provider/outcome pairing, decision reconstruction and unknown context. These are authored expectations, not test passes.

API850–862 uses actual isolated HTTP/storage and explicitly synthetic injected provider transport. Only explicit `template` is used by HTTP/browser test preparations: the ordinary owned API can inherit real configured keys, so selecting `auto` there would be inappropriate for deterministic tests. Direct-store provider cases remove every real key/model before installing labelled synthetic configuration and transport. No test fixture imports perform work.

| Cases      | Expected behavior                                                                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API850     | Actual source template → explicit ordinary draft → separate publication; populated owned holdings/goals plus related allocation/report storage remain unchanged.                                                                                            |
| API851     | Immutable preparation/decline replay, conflicting reuse and exactly one decision without event creation.                                                                                                                                                    |
| API852     | Actual source withdrawal preserves a protected historical receipt, refuses draft/new preparation and permits decline.                                                                                                                                       |
| API853     | 21 actual attempts yield20+1 UUID-keyset pages; anonymous/Origin/unknown-input/duplicate-cursor rejection with unchanged counts.                                                                                                                            |
| API854     | Real decision INSERT failure rolls back event head, revision and both request receipts; exact retry succeeds; immutable records reject mutation.                                                                                                            |
| API855     | Exact observed source-row wait with owned blocker PID → real session expiry →401 and no attempt/event.                                                                                                                                                      |
| API856     | Exact observed final decision INSERT wait → real expiry →401 and complete draft/decision rollback; fresh sign-in retries the same decision.                                                                                                                 |
| API857     | A fresh no-key direct-store configuration never dispatches; explicit crash-state simulation reconciles to immutable interrupted without redispatch.                                                                                                         |
| API858     | Injected model selects exact ordered two excerpts; alternate real substring/reordering/omission fails400; actual immutable replay dispatches once; unknown output/transport error is labelled template fallback.                                            |
| API859     | Two real store instances prove same-ID/global remote409 exclusion; template/no-key remain independent, bounded quota429 creates no request and an expired window resets to one.                                                                             |
| API860     | Actual source withdrawal while injected dispatch waits prevents any candidate/event; failed source-change receipt replays without another dispatch.                                                                                                         |
| API861     | Actual final candidate-write failure persists a safe immutable failure outcome and no partial event.                                                                                                                                                        |
| API862     | Real named prepare/draft → proposal → distinct authorized publisher; direct and same-author publication rejected; extraction decision stays historical revision1.                                                                                           |
| WEB850     | Actual retained source preview; keyboard selection, unknown required context, title-only dirty Back cancellation, confirmation/cancel, atomic ordinary draft,404 before publication, separate explicit publication, public reading/Back and mobile width.   |
| WEB851     | Actual committed template preparation and decision with lost replies; same request identities/body on retry; a deliberately mismatched decision-request delivery remains unconfirmed, then actual replay recovers; saved receipt survives failed draft GET. |
| WEB852     | Held actual successful draft GET does not reopen an editor after Back; all intercepted and ordinary requests drain.                                                                                                                                         |
| WEB853     | Held actual successful draft GET followed by real owned operator-session deletion/next401 cannot restore private extraction/editor data.                                                                                                                    |
| WEB854     | Setup503 retry; authoritative source-status503 disables acceptance while preserving human input; actual source withdrawal then historical decline/reopening without draft creation.                                                                         |
| WEB855     | Actual committed preparation reply loss → labelled simulated busy409 → same ID retained → actual saved receipt recovery; no fabricated successful response.                                                                                                 |
| OFFLINE850 | Connected-only Operations explanation, local503, cold reload of real packaged reviewed events and zero API network traffic.                                                                                                                                 |
| OFFLINE851 | Local read/prepare/decision refusal leaves account state and source bundle byte-for-byte unchanged and calls no network.                                                                                                                                    |

Automatic trace, video and screenshots are disabled for private operator cases. No feedback upload is made. Keyboard/mobile DOM acceptance is authored; visual review remains manual.

## Operational bounds and limitations

Only already-admitted retained discovery sources can be prepared. The source picker reuses20-item published queue pages/filter-bound cursors. Exact material is200/1600/4000 UTF-16 units (title/summary/body),24KiB JSON;1–2 excerpts are8–800 units and never split surrogate pairs. Existing transport is12 seconds/64KiB; strict extraction selection JSON is8KiB. Remote requests share one cross-instance advisory slot and20-start hourly allowance. Templates bypass both.

Completed attempts and decisions are immutable. Same request/input replays without provider work; changed reuse conflicts; abandoned running requests reconcile to interrupted. Missing provider, remote error and invalid selection have distinct visible template-fallback outcomes. Source changes before dispatch or final admission prevent a candidate. Exact ordered candidate citations are required for the first ordinary event revision. Acceptance/decision persistence is atomic, source/session checks follow blocking locks and final writes, and a decline never creates an event. Existing independent publication remains separate.

There is no new provider setup, dependency, secret, account data model, financial mutation, automatic extractor, policy calculation, source ingestion or local candidate copy. Operator history pages are UUID ordered, not a frozen chronological export. Protected historical excerpts can survive source withdrawal for review; public output follows existing event/source admission. External live-provider quality and visual acceptance remain unverified.

## User-only verification and handoff

Existing locked dependencies are reused. If dependencies and Playwright browsers are already installed, no installation step is needed. Connected cases require compiled contracts/API, running local PostgreSQL/MongoDB and the existing operator bootstrap setup. All test writes, sessions, artificial blockers/triggers and cleanup belong to the fixture's validated isolated schema. No main app quota, source or account data is reset.

Review the complete pending working-tree scope first. The following commands are for the user only:

```bash
# User owns the format/check/gated-commit/E2E workflow; this stages all pending scope.
E2E_BROWSER=chrome pnpm sdlc "Complete source-bound event drafting" -- --grep @EVENT-EXTRACTION-001
```

That command does not start services or apply migrations. If prerequisites need preparation, use the existing README workflow before it:

```bash
# Only when local services are stopped:
pnpm db:up
pnpm build
pnpm db:migrate
pnpm dev
# Separate terminal: invoke the focused SDLC command above after prerequisites.
# Package and verify the existing on-device bundle; no new source ingestion needed:
pnpm android:web
E2E_BROWSER=chrome pnpm android:test --grep @EVENT-EXTRACTION-001
```

Migration047 requires the configured migration-owner URL. Runtime DML roles receive the existing additive default grants. No role/configuration change is part of this feature. For focused contract investigation after compiling contracts, `node --test packages/contracts/test/event-extraction.test.mjs` should select11 definitions. Alternatively `pnpm e2e:ui` lists the feature without running it; keep watch/eye mode off.

Open the web URL printed by `pnpm dev`, then `#ops` → Event review → Prepare event from a source. Last known local targets are `http://127.0.0.1:5175` for web and `http://127.0.0.1:4103` for API; launcher output is authoritative. The optional E2E UI normally selects9323 or the next free port. Start with Exact source template; no external provider configuration is needed. Inspect a retained source, enter explicit human metadata, cancel once, accept, then open its actual ordinary event draft. Publication must remain a distinct step; named mode requires another authorized identity.

Manually inspect desktop and narrow mobile source previews/excerpts, visible focus, keyboard radios/selects/confirmation, title-only departure guard, long unbroken text, saved receipt, failed-status recovery and nested Back. Verify a candidate is never described as independently verified or already published. API/DOM assertions cannot establish visual usability or factual editorial review.

For failures report the command, run timestamp/ID, project, stable case ID and first safe assertion from `artifacts/e2e/latest.md`. For fixture startup/teardown include only its exact owned schema annotation; omit credentials, connection strings, cookies and private drafts. HEAD remains `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`; existing regression, source, import, consent, material, named-operator, event/lineage, identity and aggregate documentation changes remain uncommitted and preserved while the user gates the full scope. No commit or prior run implies verification of this feature.
