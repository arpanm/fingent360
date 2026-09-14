# EVIDENCE-LAYERS-001 handoff

Authored on main baseline b5cfcd0; no tests, format/check, builds, browser verification, dependency installation, providers, services, database actions or commit. Existing pending BEA regression edits and other authors' files were preserved. This child implements available progressive evidence reading; DEV-016 remains partial for authoritative causal mappings, validated expectations/scenarios and independently entailed portfolio-impact claims.

## Exact manifest

- packages/contracts/src/evidence-explanations.ts; packages/contracts/test/evidence-explanations.test.mjs; additive export in packages/contracts/src/index.ts.
- apps/api/src/evidence-explanations.ts; additive controller import/registration in apps/api/src/app.ts. Preserve concurrent GoalFeasibility/SourceQuality registrations.
- apps/web/src/EvidenceExplanation.tsx; apps/web/src/evidence-explanations.css; additive Reader import/component in apps/web/src/Discovery.tsx.
- apps/web/src/offline/content.ts: explanation action in the existing actual content handler. Preserve other handlers and highest non-draft publication semantics.
- tests/e2e/cases/api/evidence-explanations.spec.ts; tests/e2e/cases/browser/evidence-explanations.spec.ts; tests/e2e/cases/offline/evidence-explanations.spec.ts.
- docs/product/evidence-layers.md and this handoff.

No migration or dependency. Existing immutable discovery editions/indexes, source admission locks, private connection/revision store, account export/deletion, dated bundle and local bridge are reused. The explanation is derived per read; it has no independent private persistence or worker.

## Behavior and boundaries

GET /api/v1/discovery/items/:id/explanation?expectedVersion=N rejects missing/noncanonical/duplicate/unknown query inputs, checks the current non-draft publication under source SHARE admission and returns404 for unavailable/withdrawn or409 for a different edition. A preceding non-draft edition supplies minimal revision metadata and changed fields; a withdrawn predecessor supplies no compared text or field differences. The transaction retains source admission through result construction/commit and has a5-second query deadline. It reads no private accounts; the existing bounded AccountStore transaction/pool supplies connection lifecycle and retryable503 behavior.

Strict output binds exact complete nonempty title/summary/body fields to immutable edition identity and UTF-16 offsets. Recorded statements are explicitly not independently verified facts. Original response hash and edition-field reference scopes are visible. Unsupported expectations, scenarios, causal inference and quantified portfolio impact remain unavailable, and cross-source conflict assessment is not-assessed. No new provider request, fuzzy security matching, inferred connection, financial arithmetic or instruction following from source text is introduced.

Reader displays One line and native expandable Beginner, Portfolio, Analytical and Sources sections. Basis controls open the Sources disclosure and focus the referenced text without changing the app hash route. Existing original evidence/history/glossary actions are connected. Refresh/retry and current-edition conflicts have explicit controls. Scoped CSS wraps hashes, source text and narrow-screen controls. Private connection reads are lazy, strictly parsed, cleared before retry/session change, and stale responses are discarded. A typed401 clears displayed connection notes and the Reader's saved-library state. Existing source/version/target mismatch reasons are shown; saved personal notes never become measured effects.

Local projection uses the highest reviewed bundle edition, identical strict output and explicit bundle date. It rejects a newer withdrawal or stale requested edition without changing original bundle or financial records. It cannot infer later server changes while disconnected. Private notes continue to export/delete through their existing owned connection store. This UI adds no public content snapshot or APK build.

## Authored acceptance

- API620: actual dated bundled Fed edition in owned PostgreSQL, exact excerpt/source preservation, unsupported-analysis states and unchanged original row.
- API621: strict queries, later draft excluded, revision conflict, withdrawal and republication with minimal withdrawn predecessor.
- API622: actual source-row lock; queued read observes committed withdrawal and exposes no old title, original version retained.
- API623: actual owned table lock causes bounded503; released storage supports exact unchanged retry.
- WEB620: genuine source, keyboard Basis/focus without route change, five layers/source dates, narrow-screen overflow, anonymous sign-in and Back.
- WEB621: explicitly simulated503/malformed response rejected, actual retry sees edition conflict and Refresh opens the new actual edition.
- WEB622: actual owned goal connection, source-version review reason, unchanged holdings/goals and actual session expiry clearing notes.
- WEB623: genuine held private200 from first account, real logout/new account, normal session invalidation signal, new account read and drained old response cannot restore prior notes.
- OFFLINE620: actual dated bundle, real local account/connection, durable reload, unchanged holdings, privacy export/deletion and zero outgoing API requests.
- OFFLINE621: actual local handler with explicitly simulated revision/draft/withdrawal history, exact precedence, stale/duplicate query failures and unchanged bundle/state.
- Three contract units: exact field entailment/strictness, revision/withdrawal projection, strict edition query.

Counts:4 API +4 browser IDs on desktop/mobile =12 connected project selections;2 offline scenarios;3 units. No execution/pass is claimed. All simulations are tagged separately from genuine stored reading. API/browser fixtures use owned schema/API; browser route.fetch explicitly targets feedbackSandbox.apiOrigin, all held responses drain before final assertions/teardown, and sensitive automatic artifacts are disabled in the new browser spec.

## Exact user next actions

Dependencies/migrations are unchanged. Existing PostgreSQL/MongoDB and API4103/web5175 services are required for connected E2E; user restart/rebuild only if required by the existing development workflow. Open http://127.0.0.1:5175/#today → a published item → Understand this reading. Keep automatic watch/testing off. Run the user-owned format/check/commit gates through the registered pnpm sdlc workflow, then select this feature (or use its tag in the test UI):

```bash
pnpm e2e:run --project=api --project=desktop --project=mobile --grep='@EVIDENCE-LAYERS-001'
```

After the user rebuilds packaged offline web assets using the existing documented offline workflow, select OFFLINE620–621 in the offline project. Physical phone/rebuilt APK, visual inspection and keyboard acceptance remain separate from API correctness. Verify clear unavailable analysis, readable dates/hashes at normal widths, Basis focus, private-note sign-in/retry and source update/withdrawal behavior. Report run ID/time, API/web targets, case/project, first assertion and error-context path for failures; exclude passwords, cookies and private source/portfolio text.

Root owns TODO/README/status/catalog/coverage integration, exact user evidence and eventual gated commit. These files are authored and frozen for integration; current baseline remains b5cfcd0 with unrelated concurrent work uncommitted.
