# ECB-RATES-001 handoff

Authored in main over `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`. Files are frozen for parent integration. No tests, checks, formatting, build, installation, migration, service action, provider ingestion or commit were executed. Primary ECB documentation was read; no live numerical response was captured into the product. All changes remain uncommitted for user-run gates. Existing REGRESSION-011, mapped imports and concurrent named operator/material-alert/event changes are preserved; root owns trackers and the eventual conditional commit.

## Exact manifest

1. `packages/contracts/src/ecb-rates.ts` — fixed source/series, exact numerical editions, heads, refresh/review receipts, public/history/retained contracts and effective-date selection.
2. `packages/contracts/src/ecb-rate-parser.ts` — bounded SDMX data-only parser; QNames/root-only namespace binding validation before prefix normalization.
3. `packages/contracts/src/index.ts` — two ECB exports only; preserve concurrent exports.
4. `packages/contracts/test/fixtures/ecb-policy-rates.xml` — explicitly synthetic documented-schema XML; not a captured provider response.
5. `packages/contracts/test/ecb-rates.test.mjs` — five parser/contract goldens.
6. `infra/migrations/040_ecb_rates.sql` — immutable canonical/relational records, head, refresh runs and publication receipts.
7. `apps/api/src/ecb-rate-provider.ts` — fixed URL/HTTPS/redirect denial,10-second/1MB UTF8 transport and retrieval-context hash.
8. `apps/api/src/ecb-rates.ts` — real Mongo/PostgreSQL capture/reconciliation/quarantine/replay, review/withdrawal and protected/public controllers.
9. `apps/api/src/app.ts` — ECB controller/provider registration only; preserve other children.
10. `apps/api/test/ecb-rate-provider.test.mjs` — two transport fixture units with no real network.
11. `apps/web/src/EcbRates.tsx` — public current/effective-date/history/evidence route and keyboard Back/focus.
12. `apps/web/src/EcbRateOperations.tsx` — explicit capture/review/proposal, cancel/retry, current-state validation, paged historical reviews and retained raw inspection/401/Close fencing.
13. `apps/web/src/ecb-rates.css` — responsive numeric/read/review styles.
14. `apps/web/src/App.tsx` — More entry and keyed policy-rates route/title only.
15. `apps/web/src/Macro.tsx` — contextual policy-rates link only.
16. `apps/web/src/Operations.tsx` — ECB tab/import and guarded request/named-proposal integration only.
17. `apps/web/src/RetentionOperations.tsx` — one ECB paragraph in the existing connected-only offline Operations notice.
18. `apps/web/src/offline/ecb-rates.ts` — actual local handler, admitted-edition retirement and connected-only controls.
19. `apps/web/src/offline/types.ts` — three optional ECB bundle fields only.
20. `apps/web/src/offline/index.ts` — handler import/registration only.
21. `scripts/ecb-rate-snapshot.mjs` — user-invoked consistent bounded public snapshot collector; no import-time work.
22. `scripts/offline-snapshot.mjs` — collector import/call only; preserve source/event collectors.
23. `tests/unit/ecb-rate-snapshot.test.mjs` — three capture/admission/race units.
24. `tests/e2e/helpers/ecb-rates.ts` — owned schema/real API routing, explicit synthetic transport and real store/SQL fixtures; lazy dependencies anchored to API package.
25. `tests/e2e/cases/api/ecb-rates.spec.ts` — API680–691.
26. `tests/e2e/cases/browser/ecb-rates.spec.ts` — WEB680–684.
27. `tests/e2e/cases/offline/ecb-rates.spec.ts` — OFFLINE680–681.
28. `docs/product/ecb-rates.md` — full layer specification, cited sources, limits and parent boundary.
29. `docs/development/ecb-rates-handoff.md` — this handoff.

No new dependency. Existing fast-xml-parser and exact decimal strings/PostgreSQL numeric are used. Root separately owns the single migration040 registration in `apps/api/src/migrate.ts`. Named operators own `ecb-rates` proposal contracts/dispatcher and exact-head/unused-request checks in their manifest; preserve those integration hunks. Shared app and offline registrations also contain event changes by another author: do not replace entire files from an older checkout.

## Authored acceptance

**19 E2E definitions:** 12 API, 5 browser selected once per desktop/mobile project, 2 offline. **10 unit definitions:** 5 contracts/parser, 2 transport, 3 exporter. Private automatic screenshots/video/traces are off. WEB680 explicitly captures only the labelled synthetic public numerical page for human visual review.

| Cases      | Expected result                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API680     | Synthetic fixed transport through actual parser→Mongo raw receipt→PostgreSQL exact records→authorized review→public/current/evidence; raw XML is operator-only.                                           |
| API681     | Malformed complete raw response produces real failed parse/quarantine receipt; replay performs no provider request and publication cannot occur.                                                          |
| API682     | Missing accepted date rejects a truncated edition, preserves reviewed values and actual immutable observation/review triggers.                                                                            |
| API683     | Unchanged canonical observations retain original edition/evidence while checked time advances; same request returns exact receipt, new paced request409.                                                  |
| API684     | Publish1→withdraw→capture/publish2 leaves edition1/history/evidence retired; old review replay stays historical and changed same-ID input409.                                                             |
| API685     | Anonymous/Origin denial; actual exact source-row lock wait, then real session expiry gives401 after release and preserves source; new sign-in works.                                                      |
| API686     | Two actual store instances: admitted first transport is held, competing claim409 with zero second transport calls, then first completes.                                                                  |
| API687     | Actual observation INSERT trigger failure rolls back edition and numerical rows while retaining linked raw evidence and failed storage receipt.                                                           |
| API688     | Explicit synthetic immutable51-edition/review population exercises50-item integer paging, truthful continuation, unknown/duplicate query rejection and unchanged counts.                                  |
| API689     | Actual final review INSERT blocked by owned trigger/advisory lock; expire operator, release, receive401 and observe rolled-back head/receipt.                                                             |
| API690     | Named isolated mode: actual captured draft/run replay→proposal→different publisher approval→public read and atomic receipt replay. Direct and same-author review denied.                                  |
| API691     | Explicit synthetic A/B baseline followed by actual capture of A creates edition3 with new retrieval receipt; original editions stay immutable, published1 stays current until explicit review publishes3. |
| WEB680     | Keyboard More→rates→retrieval history→edition→evidence→nested Back, exact signed/seven-decimal values/future-date language and mobile screenshot/overflow.                                                |
| WEB681     | Cancel draft; actual committed PUT with lost reply→same-ID replay→503 authoritative read retains only historical receipt and disables mutation→real reload/reopen saved history.                          |
| WEB682–683 | Hold an actual retained-evidence200; Close or real session deletion/next401 fences late private content. All held routes and active API requests drain.                                                   |
| WEB684     | Initial503 (explicit fault only) retries into actual empty isolated source with no fabricated numbers.                                                                                                    |
| OFFLINE680 | Real packaged current snapshot or honest empty/withdrawn state, evidence/Back if published, connected-only Operations explanation and zero API requests.                                                  |
| OFFLINE681 | Actual local handler against explicitly synthetic bundle containing retired bytes exposes only admitted edition2, then nothing after withdrawal; local state unchanged.                                   |

## User-only next actions

No installation is needed when locked dependencies and the browser are already available. Connected cases require compiled contracts/API, existing loopback PostgreSQL and MongoDB, migration040 and the actual isolated application fixture. The user controls all commands below; watch/eye mode stays off.

```bash
pnpm format
pnpm check
pnpm build
# If existing services are not running:
pnpm db:up
# Apply registered migrations with the configured migration-owner URL:
pnpm db:migrate
pnpm dev
# Separate terminal, or choose the tag in pnpm e2e:ui:
pnpm e2e:run --project=api --grep @ECB-RATES-001
pnpm e2e:run --project=desktop --project=mobile --grep @ECB-RATES-001
pnpm android:web
pnpm android:test --grep @ECB-RATES-001
```

Open the web URL printed by `pnpm dev` at `#policy-rates` or `#ops` → ECB policy rates. The current root targets while authoring were web `http://127.0.0.1:5175` and API `http://127.0.0.1:4103`; current `.env`/launcher output is authoritative. The optional E2E dashboard prints its own URL, usually port9323 or a free alternative.

Actual-provider acceptance is a separate explicit user action: sign in to connected Operations, choose **Refresh fixed ECB source**, inspect the run/raw response and all three reconciled numerical histories, compare effective dates/units against the linked free ECB original, then explicitly review the captured head (in named mode propose and have a different approver approve). New refreshes have60-second pacing. Do not publish if the provider shape, attribution or date interpretation fails review. A rejected complete response stays inspectable as a failed parse receipt. No current production numbers are claimed before that step.

After an actual publication, the user can run `pnpm android:snapshot`, then `pnpm android:web` and the selected offline cases to validate a real dated numerical bundle. This authoring task leaves the checked-in bundle untouched and invents no offline rate seed. Inspect the deliberate desktop/mobile synthetic image and manually use keyboard/touch/Back on a phone; DOM assertions alone do not establish visual/device acceptance.

For failure evidence report the command, date/run ID, project/case ID and first safe assertion from `artifacts/e2e/latest.md`. Include the exact owned schema annotation for fixture setup/cleanup issues. Do not share credentials, cookies or raw private application data. Local HEAD remains `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`; this child has no commit and no verification claim. A scoped commit follows successful user-run format/check gates only.

## Limits and status

The initial three-series numerical onboarding is authored end to end. These facilities provide euro-area policy context, not an India-impact estimate; an India causal/portfolio model is separate policy work, not an invented consequence of ECB levels. Additional candidate providers or paid macro families are not necessary to complete this deliberately small initial family. No API key or paid licence is needed for the selected public source, but real payload compatibility, rights/attribution review and deterministic/visual verification are still user tasks.

All effective dates are source-reported dates. `retrievedAt` and immutable edition numbers describe this application's retrievals; response `Prepared` is retained separately and original known-at/publication time stays null. No historical as-of vintage is reconstructed. A24-hour stale-check reminder is a product cue, not an ECB schedule guarantee. A withdrawal retires all earlier public reviews; republishing admits only that explicit edition. Already distributed offline bytes cannot be recalled until the bundle is replaced.

Bounds: fixed three series from2008-10-15;7 decimal places;500 observations per series/1,500 total;1MB input/20,000 XML tags/32 nesting levels;10-second fetch;60-second new-run pacing;50-item public edition and operator review pages; latest50 safe run outcomes; maximum500 admitted snapshot editions. Statement and Mongo deadlines bound storage calls; numerical rows are inserted as one batch. Full publication history and operator raw records remain durable; no personal/financial deletion or new provider scheduler is introduced.
