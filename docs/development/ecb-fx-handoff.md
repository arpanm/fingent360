# ECB-FX-001 handoff

Authored in the shared main checkout over `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`, frozen for integration and user verification. [Specification and primary-source evidence](../product/ecb-fx.md). Scope is the fixed ECB rolling 90-day USD/EUR and INR/EUR reference file, plus a separately marked exact INR/USD calculation. Other currencies, Indian EOD prices and financial consumers are outside this child.

No tests, formatting, lint, type checks, builds, dependency installation, migrations, service actions, provider ingestion or commits were run by the agents. The expressly authorised exception was read-only source-format research into an ignored file, described below. No successful production observation, provider compatibility run, browser validation or gate pass is claimed.

## Exact manifest

1. `packages/contracts/src/ecb-fx.ts` — fixed source, exact positive source decimals, reduced rational/eight-place reconstruction, rolling comparison, edition/head/run/review/public/history/evidence contracts.
2. `packages/contracts/src/ecb-fx-parser.ts` — strict source-bound XML, matched pairs, bounded syntax/namespace/date/currency parsing.
3. `packages/contracts/src/index.ts` — two FX exports only.
4. `packages/contracts/test/fixtures/ecb-fx.json` — clearly synthetic two-month XML and independently stated expected exact values.
5. `packages/contracts/test/ecb-fx.test.mjs` — 11 parser/contract units.
6. `infra/migrations/045_ecb_fx.sql` — source head, immutable editions/observations/review receipts and protected completed capture outcomes.
7. `apps/api/src/ecb-fx-provider.ts` — fixed HTTPS XML transport, bounded complete UTF-8 capture, preserved BOM and contextual receipt hash.
8. `apps/api/src/ecb-fx.ts` — real Mongo/PostgreSQL capture/quarantine, independent numeric/text reconciliation, rolling comparison, source admission, idempotency, publication/withdrawal and controllers.
9. `apps/api/src/app.ts` — two FX controllers and one provider registration only.
10. `apps/api/test/ecb-fx-provider.test.mjs` — two synthetic transport units with no live request.
11. `apps/web/src/EcbFx.tsx` — public inputs/marked calculation, reported month selection, history/method/evidence, Back and request generations; authored by parent.
12. `apps/web/src/EcbFxOperations.tsx` — current-head review, capture, named proposal/bootstrap confirmation, cancellation, uncertain-request recovery, historical receipts and protected XML/Close/401 fencing.
13. `apps/web/src/ecb-fx.css` — responsive original/derived cards, contained tables/XML and keyboard focus; authored by parent.
14. `apps/web/src/App.tsx` — More entry, keyed reference-fx route and nested title only.
15. `apps/web/src/Macro.tsx` — reference-FX contextual link only.
16. `apps/web/src/Operations.tsx` — FX section with the shared guarded request and proposal callback only.
17. `apps/web/src/RetentionOperations.tsx` — one paragraph in the existing offline Operations explanation.
18. `apps/web/src/offline/ecb-fx.ts` — actual local public handler, strict bundle admission and connected-only operational routes.
19. `apps/web/src/offline/types.ts` — three optional FX bundle fields only.
20. `apps/web/src/offline/index.ts` — FX handler import/registration only.
21. `scripts/ecb-fx-snapshot.mjs` — explicit consistent collector with admission, pagination and source-change guards.
22. `scripts/offline-snapshot.mjs` — collector import/call only; no automatic execution.
23. `tests/unit/ecb-fx-snapshot.test.mjs` — three snapshot/admission/withdrawal/race units.
24. `tests/e2e/helpers/ecb-fx.ts` — actual owned fixture routing, schema/Mongo ownership checks, lazy synthetic XML and isolated store/SQL setup.
25. `tests/e2e/cases/api/ecb-fx.spec.ts` — API810–822.
26. `tests/e2e/cases/browser/ecb-fx.spec.ts` — WEB810–814.
27. `tests/e2e/cases/offline/ecb-fx.spec.ts` — OFFLINE810–811.
28. `docs/product/ecb-fx.md` — design, source evidence, exact arithmetic, revision and layer acceptance.
29. `docs/development/ecb-fx-handoff.md` — this handoff.

Three coordinated named-proposal hunks are also required: `packages/contracts/src/named-operators.ts`, `apps/api/src/publication-proposals.ts`, `apps/web/src/ProposalInspection.tsx`. The named-operator author added kind `ecb-fx`, target `ecb-reference-fx`, version/edition/unused-request admission, actual `/ops/reference-fx` inspection and atomic `EcbFxStore.review(authorize, complete)` dispatch. The provider above satisfies its constructor injection. Parent registered migration 045 exactly once before 046 and added the reference-fx diagnostics family/omission assertions separately. Preserve concurrent oil/event/lineage/consent/material and other edits in all shared files; integrate these narrow additions rather than replacing shared files wholesale.

## Source, precision and bounded behavior

Only the fixed URL `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml` is fetched by explicit capture. No key, arbitrary URL, redirect or automatic retry is supported. Official ECB statistical/copyright pages permit accurate attributed reuse and explicitly marked user calculations. Public pages link the free original and terms; no third-party series, logo or source narrative is copied.

The authorised research copy was retrieved at **2026-09-14T10:39:41.257018Z**, HTTP 200/text XML, 70,606 bytes, SHA-256 `ff101c1ad068c15091dbd4ca1c77a320a4728f69933b73e039d66ee7cba18054`. It and `format-receipt.json` remain only in ignored `artifacts/source-research/ecb-fx/`. Existing XML libraries inspected its envelope, root namespace bindings and Cube/date/currency/rate structure. It contained 65 reported days, both selected currencies and 2–4 decimal-place source inputs. No numerical rows were copied into goldens; no application parser/store/bundle consumed it. TLS validation was retained.

Limits: 1 MB UTF-8, 20,000 XML tags, 32 nesting levels, 92 dates within a 100-day span, 60 currencies per day; original positive inputs up to 12 integer/8 fractional digits. The parser is pure and permits only matched reported dates; the edition/store additionally rejects dates after the actual retrieval day in Europe/Berlin. It strips an optional BOM only in its local parse copy; the provider's original text/hash remains unchanged. Other currencies are syntax-validated and discarded. No inferred provider calendar or missing-day carry-forward is used.

BigInt integer/scale division reduces the same-day ratio and rounds half away from zero to exactly eight decimals. Original input strings, source metadata and explicit calculation method remain distinct. Precision-only revisions create a new source edition even when the derived ratio is unchanged. Rolling-window added/changed/absent lists persist with each edition. An absent day is not a provider withdrawal. Historical known-at times are null; there is no as-of-vintage or continuous-freshness claim.

Mongo original retention precedes PostgreSQL numerical writes; failed capture outcomes expose only safe categories and an operator-only linked raw receipt. Edition and observation changes roll back atomically. Source-wide withdrawal retires all earlier public history/evidence; a new publication admits only explicitly reviewed post-withdrawal editions. Same-request replay returns the durable old result without reapplying publication. Independent named approval consumes the proposal atomically. Source and final-write waits are followed by actual authorization checks.

The provider deadline is 10 seconds. New request pacing is 60 seconds, guarded across instances by an advisory lock. There is no background provider worker. Public/review history pages hold 50 records, run history exposes the latest 50 with a truthful more-available indication, and offline export refuses more than 500 admitted editions or a changing source. An old disconnected bundle does not learn later withdrawal until updated. No new private financial schema, account-export category, account-deletion cleanup or financial mutation is introduced.

## Authored acceptance

**20 E2E definitions:** 13 API, 5 browser and 2 offline. **16 unit definitions:** 11 parser/contracts, 2 provider transport and 3 snapshot. Select `@ECB-FX-001`; synthetic inputs/faults also carry `@TEST-SIMULATION`, and API820 covers the named-operator branch. Automatic private traces/screenshots/video are disabled. WEB810 intentionally records only a synthetic public screenshot.

| Cases      | Expected behavior                                                                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API810     | Synthetic fixed transport → actual Mongo original → exact PostgreSQL reconciliation → review/public/evidence; private original and immutable review receipt.                                                          |
| API811     | Complete invalid XML produces retained parse failure; no accepted values; replay without another fetch; publication rejected.                                                                                         |
| API812     | Actual capture omits the oldest synthetic baseline day; adds an explicit absent-date comparison, preserves the prior public edition, then publishes both immutable history records; mutation triggers reject changes. |
| API813     | Equal selected lexical data reuse the original edition/evidence and advance checked time; same-ID replay makes one transport call total; a new paced request conflicts.                                               |
| API814     | Publish1 → withdraw → publish2 keeps old public history/evidence unavailable, including after an old review replay; changed same-ID input conflicts.                                                                  |
| API815     | Anonymous/Origin denial; exact source-head waiter with owned PID → real operator expiry →401/no values; fresh login recovers.                                                                                         |
| API816     | Two actual store instances contend for capture admission; second conflicts before transport while the admitted first completes.                                                                                       |
| API817     | Real observation INSERT trigger rejection rolls back edition/facts while retaining a failed-storage raw receipt.                                                                                                      |
| API818     | Explicit synthetic 51-edition population proves 50-item integer pages, continuation, strict query rejection and unchanged receipt counts.                                                                             |
| API819     | Actual final review INSERT blocked by an owned advisory trigger → real session expiry →401 and rollback of head/receipt.                                                                                              |
| API820     | Actual named-mode capture/durable replay → proposal → distinct approver → public read; direct/same-author denial, atomic receipt and approval replay.                                                                 |
| API821     | A actual capture after a synthetic A/B baseline appends a new immutable edition/raw receipt while earlier editions and publication stay unchanged until review.                                                       |
| API822     | Lexical source precision changes append a new immutable edition and changed-date receipt while exact ratio output remains identical.                                                                                  |
| WEB810     | More/history/edition/month/full-window/method/evidence/Back with keyboard focus, separate inputs and eight-place calculation, mobile overflow and synthetic visual artifact.                                          |
| WEB811     | Cancel review draft; actual committed review with lost reply → same-ID replay → authoritative GET failure keeps a historical receipt but disables new mutations → explicit Retry and durable history.                 |
| WEB812–813 | Held actual private200 cannot reopen after Close or after a real session revoke/next401; intercepted requests and ordinary API requests are drained.                                                                  |
| WEB814     | Initial public503 retries to an actual empty state without invented data.                                                                                                                                             |
| OFFLINE810 | Actual packaged data or honest empty state; evidence/Back when available; connected Operations explanation and zero API requests.                                                                                     |
| OFFLINE811 | Actual local handler preserves rolling comparison, excludes retired bytes, removes all history after withdrawal and leaves personal state unchanged.                                                                  |

## User-only next actions

Existing locked dependencies are reused; no new installation is required if dependencies and Playwright browsers are present. Connected cases need PostgreSQL/MongoDB, compiled contracts/API and migration 045. All test mutations/cleanup target the fixture's validated owned schema and Mongo database. Wait observers use a separate autocommit pool rather than a single held client. No import/discovery performs source or database work. Watch mode remains off.

Commands below are for the user, never an instruction for an agent to execute:

```bash
pnpm format
pnpm check
pnpm build
# Only if the existing local services are stopped:
pnpm db:up
pnpm db:migrate
pnpm dev
# Separate terminal:
pnpm e2e:run --project=api --grep @ECB-FX-001
pnpm e2e:run --project=desktop --project=mobile --grep @ECB-FX-001
pnpm android:web
pnpm android:test --grep @ECB-FX-001
```

For a parser-only investigation after compiling contracts, the user may run `node --test packages/contracts/test/ecb-fx.test.mjs` (11 expected cases). The user may instead use `pnpm e2e:ui` to select the feature or invoke `pnpm sdlc` after reviewing the entire pending working-tree scope. That workflow gates its commit; it does not start services or apply migrations. No agent commit is permitted before the user's successful format/check evidence.

Open the URL printed by `pnpm dev` at `#reference-fx` or `#ops` → Reference exchange rates. Last known root targets are `http://127.0.0.1:5175` for web and `http://127.0.0.1:4103` for API; launcher output is authoritative. The optional E2E UI prints its selected port, normally 9323 or the next free port.

Actual provider acceptance is a separate explicit user action: Operations → **Capture fixed ECB reference XML** → inspect success/failure, source inputs, dates, rolling comparison and retained receipt against the linked original → publish the exact accepted head, or propose it and have a different named reviewer approve. An HTTP response or retained parse failure does not establish accepted numerical onboarding. Live parser compatibility remains unverified. After real publication, the user may explicitly run `pnpm android:snapshot`, then `pnpm android:web` and the offline cases. Authoring leaves the existing bundle unchanged and contains no fabricated live rates.

Review WEB810's desktop/mobile screenshot and manually verify touch, keyboard, focus, observation-month/full-window selection, narrow-screen scrolling, source links and nested Back. Inspect both original and derived labels. Exercise withdrawal and confirm older public links fail while protected operator receipts remain readable. A DOM assertion is not visual or phone acceptance.

For failure evidence provide command, timestamp/run ID, project, stable case ID and first safe assertion from `artifacts/e2e/latest.md`; include the exact owned schema annotation for fixture startup/cleanup problems. Exclude credentials, cookies and private source/session details. Git status and HEAD were inspected before handoff: `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b` remains the local commit. Existing root regressions, imports, goals, named operators, ECB rates, oil, events, material alerts, consent, quality and documentation changes remain uncommitted and preserved because user-run gates are pending. No verification is inferred from their presence or prior commits.
