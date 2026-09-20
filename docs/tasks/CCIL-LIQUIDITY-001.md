# CCIL-LIQUIDITY-001 — historical government-security liquidity evidence

## Specification before implementation — 2026-09-20

Child scope of FUNDS-BONDS-001 / SRC-017, authorized for isolated authoring only.
The official [CCIL tracker](https://www.ccilindia.com/g-sec-market-liquidity-tracker)
links an original July2026 XLSX, inspected on2026-09-20, with8,266 observations
and13 columns. This is historical order-book liquidity evidence, not executable
prices, a traded-price history, investment advice or a portfolio valuation.
No ISIN is supplied: retain literal security description and instrument type;
never infer a holding match. Coupon cells can contain a floating-rate description.
Missing `-` metrics remain null, accompanied by the exact source depth comment.
Numeric metric lexemes remain strings, including scientific notation; units and
formula conventions beyond the source column label remain undeclared.

Verified original:
https://www.ccilindia.com/documents/43866/556182201/G-Sec%20Market%20Liquidity%20Tracker-2026-07-31_1786434003843.xlsx
643,535 bytes, SHA256 `f8e46613522a3fb4b7dfd4b65de5290cf45fe4aa50c97d516b7152b31256c935`.
One worksheet `Sheet 1`,1900 date system,13 exact columns A:M; first trade date
2026-07-01, final2026-07-31, settlement can cross intoAugust. Source instrument
labels are literally `CENTRAL GOVERMENT` / `STATE GOVERMENT`.
Full source remains outside repository; small numeric facts are reconstructed in
explicit test workbooks. Public access is not commercial permission.

## Acceptance and delivery layers

- Contracts/parser: bounded ZIP/XML, exact header/row shape, source date window,
  calendar serials, duplicate identity rejection, literal decimals, null missing
  values, no formulas/macros/external links; unknown layouts quarantine.
- Data/API: unchanged original bytes hashed and retained in Mongo; immutable
  parsed editions and independent named reviews inPostgreSQL; idempotent request
  identity, conflicts, retained-evidence reconstruction before publication.
- Permission: default-off server gate and written retention/web/offline reference;
  unavailable rights never inferred from the research download. Disabled data
  stays private but can be inspected/withdrawn by authorized operators.
- UI/UX: connected Funds/Bonds reader and Operations import/fetch/review,
  source/capture/review timestamps and hash, bounded row pages, keyboard controls,
  mobile containment, loading/empty/failure/retry and safe screenshot coverage.
- Offline: complete reviewed snapshot or explicit bound failure, preserve frozen
  source dates and non-price labels; reject all offline mutations.
- Tests: dedicatedAPI2320–2329 range (only authored cases listed on handoff),
  desktop/mobile and offline companions; actual storage and namedreview flow,
  synthetic workbook container clearly labeled. No mocked successful API state.
- Automation: operator-controlled bounded fixed-original fetch only. No new
  scheduler, auto activation, security matching or source rights assumed.
- Documentation: this specification and parent links; source terms and curve
  convention uncertainty stay open inSRC-017. Current `.xls` zero-yield original
  was retrieved but not decoded; do not claim its conventions are absent.

## Reusable prompt

Implement the verified CCIL historical liquidity XLSX workflow using contracts,
immutable raw/structured retention, separately named publication, connected reader
and Operations plus offline parity. Preserve exact source labels, nulls and
numeric lexemes; do not create executable-price or ISIN matching claims. Keep
source permissions off by default. Author meaningful API/browser/offline cases
using reconstructed source facts and actual storage. Do not execute deterministic
validation or alter shared task trackers without coordinating with the root agent.

## Verification

Authoring in isolated unwatched worktree only. No tests, formatting, checking,
builds, migrations, services or commits run. External commercial permission,
current source activation, curve conventions and physical-device review remain.

## Authored implementation and exact user handoff — 2026-09-20

- Contracts `packages/contracts/src/ccil-liquidity.ts` and dedicated bounded
  `ccil` profile in `sbi-portfolio-parser.ts`: no existing portfolio limit changes.
  TwoMB compressed, sixMB/entry, eightMB expanded, at most ten allowlisted parts,
  no provider formulas or external relationships. Raw metric lexemes are not
  rounded or converted through floating point. Runtime schema rechecks source
  month, settlement order/window, source-row ordering, duplicate identity and
  edition/review state consistency at API/UI/offline boundaries.
- `apps/api/src/ccil-liquidity.ts`: fixed-original fetch or exact-byte import;
  Mongo raw retention and migration129 immutable PostgreSQL editions/reviews.
  Different named publisher and current permission required. Capture/review
  retries bind to the original actor; import/fetch modes cannot reuse identity.
  Committed fetch retry returns retained receipt even if provider is unavailable.
  Public/Operations history is two editions/page. Complete offline export permits
  at most three full editions and fails503 instead of silently truncating.
- `apps/web/src/CcilLiquidity.tsx`: Funds and bonds historical reader, source-label
  search,25-row table pages, original link/hash/times and mobile-scrollable table;
  Operations capture/evidence/publication/withdrawal and recovery. Generation and
  session guards protect late capture/file-read/review results. File selection
  retry preserves original request identity after lost acknowledgement.
- Offline handler, registry/type and snapshot wiring preserve only reviewed
  records and refuse mutations. Actual installed-reader acceptance adapts to the
  installed permitted source; absent permission remains explicitly disabled.
- Opt-in disposable test process intercepts only the fixed CCIL URL and returns a
  reconstructed workbook. Its test-only control row can disable transport and
  counts requests. It does not seed application editions or reviews, enable a
  production source, change ordinary fixture defaults or simulate an API success.

Exact authored cases (not run):

| Project         | IDs              | Acceptance                                                                                                                                    |
| --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| api             | E2E-API-2320     | Original lexical facts, missing depth, malformed/header/formula/date/identity rejection                                                       |
| api             | E2E-API-2321     | Default permission gate, no retention/public disclosure                                                                                       |
| api             | E2E-API-2322     | Real bytes/hash, immutable capture, actor-bound replay, independent review, quarantine, withdrawal                                            |
| api             | E2E-API-2323     | Origin/authentication, fixed source, canonical/oversize bytes, edition state rules                                                            |
| api             | E2E-API-2324     | Complete pagination, snapshot capacity and withdrawal recovery                                                                                |
| api             | E2E-API-2325     | Actual fetch handler/storage, synthetic upstream, no-network committed replay, unavailable new fetch                                          |
| desktop, mobile | E2E-WEB-2320     | Actual file→independent review→reader→withdrawal, keyboard search/paging,360px screenshot                                                     |
| desktop, mobile | E2E-WEB-2321     | Pending permission controls, error/retry, actual lost response and one retained capture, reader recovery                                      |
| offline-package | E2E-OFFLINE-2320 | Frozen exact source/nulls, paging, withdrawal/disabled exclusion, rejection of writes/altered schema                                          |
| offline-package | E2E-OFFLINE-2321 | Actual installed Sources→Funds reader, available-data search/paging/nulls or honest absent state, keyboard/narrow screenshot, zeroAPI network |

Manual next action from the final integrated checkout: no dependency change.
PostgreSQL and MongoDB are required for the isolated real-storage fixtures;
apply additive migration129 through the normal user-operated bootstrap before
starting the integratedAPI. Follow printed dev URLs (`/#ops`, `/#funds-bonds`)
and enable no real CCIL source without the actual written grant. `.env.example`
sets `CCIL_LIQUIDITY_ENABLED=false`; leave its permission reference unset until
activation, then provide the genuine retention/web/offline grant reference.

User commands, not run by the agent:

```bash
pnpm db:up
pnpm bootstrap
pnpm dev
# Separate terminal, final integrated checkout:
pnpm sdlc "Add reviewed CCIL historical liquidity workflow" --story CCIL-LIQUIDITY-001
```

Expected: format/check and gated local commit, then selected acceptance receipts
forAPI2320–2325,WEB2320–2321 desktop/mobile andOFFLINE2320–2321. Default deployment
still displays disabled source; fixture publication is explicitly synthetic.
For failures report run ID, case/project, saved assertion/error-context and trace
artifact path, plus migration filename if setup failed. Do not share credentials,
private production documents or the whole `.env`. Review attached synthetic or
public-source region screenshots separately; physical Android acceptance remains.

No gates or execution were run, no source activated, no new commit created.
Authoring base inspected: `c7874a5304f2d2c20d05e94ab9216cd957fa0abb`.
Other agents' pre-existing/uncommitted changes remain untouched except coordinated
narrow shared wiring. Parent owns tracker, README, catalogue and manifest updates.

## Primary-source convention follow-up — 2026-09-20

The official analytics listing also exposes [Tenor Wise Zero Coupon Yield,
18September2026](https://www.ccilindia.com/documents/43866/1209607/Tenor%20Wise%20Zero%20Coupon%20Yield-2026-09-18_1789739837573.xls).
Read-only research retrieved56,320bytes, SHA256
`4a9fdc530eb4096dfcfd3dd82c8c4c6d31e9ea484ea08e888ee4a707e299cc9d`.
The OLE `Workbook` stream is46,374bytes. Immediately after its BIFF BOF record,
the stream contains `FilePass` (record0x002F,length54), whose encryption type is
0x0001. [Microsoft's FilePass specification](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-xls/cf9ae8d5-4e8c-40a2-95f1-3b31f16b5529)
defines this as encrypted workbook content with RC4 metadata. No encrypted cells
were interpreted, no password was guessed and no convention was inferred from
unreadable values. The inspected public listing supplied no password instruction.
A documented accessible current convention declaration or authorized readable
original is still needed to close sovereign-curve compounding/unit assumptions.
The OIS PVBP method's A/365 and semiannual conventions are a different instrument
and must not be transferred to sovereign NSS. Liquidity ingestion does not close
that separate gap or the authenticated trade-by-trade price download boundary.

## Integration handoff — 20 September 2026

Continuation is reconciled in the unwatched `fingent360-continuation-20260920`
checkout against user commit `c99d62b` and newer saved validation records. The
main checkout and those records are preserved. Use the continuation-only patch
and commands in [the current handoff](../development/nondeferred-authoring-2026-09-20.md).
No new tests/gates/migrations/services or commit were run by the agent. Earlier
base hashes above identify authoring history, not the current integration base.

## Scoped check repair — 2026-09-20

- **Input:** User-supplied `pnpm check` exit 1 at ESLint only:
  `apps/api/src/ccil-liquidity.ts:40:38`, unused `_url` parameter. The saved E2E
  handoff inspected only for run metadata was run
  `1789923192185-b2f206d2-22d5-430b-ae33-da4f08c3c7f3`, started
  2026-09-20T16:53:12.185Z, two selected API cases against API port 4104 and web
  port 5176; it predates this repair and is not validation for it.
- **Cause:** The local `parseOriginal` wrapper was copied with an optional source
  URL even though the CCIL parser consumes only exact workbook bytes. Both capture
  and publication reconstruction passed the unused value, obscuring the intended
  boundary and triggering `@typescript-eslint/no-unused-vars`.
- **Implementation:** Removed the dead parameter and both arguments. The edition
  still retains and validates the fixed source URL as provenance; workbook parsing
  and reconstruction remain byte-derived. API2322 now asserts both facts before
  and after independent publication. Catalogue and coverage-plan descriptions are
  updated; contracts, schema, migration, UI/UX, offline behavior, automation,
  source activation and dependencies are unchanged.
- **Reusable repair prompt:** Given only the reported no-unused-vars diagnostic,
  remove the unused CCIL parser URL parameter and its call-site arguments, preserve
  source URL provenance on editions, and strengthen API2322 to assert byte-derived
  data plus URL metadata across publication. Do not execute validation or commit.
- **Verification:** Authored only. No formatting, lint, typecheck, build, test,
  service, migration, ingestion or commit was run. The parent script owns the exact
  failed-check retry. Source permission and physical-device gates remain open.
- **Smallest validation:** `pnpm exec eslint apps/api/src/ccil-liquidity.ts
tests/e2e/cases/api/ccil-liquidity.spec.ts`. Expected: no lint diagnostic in
  either edited TypeScript file. The exact parent retry remains `pnpm check`.
  If it fails, report the command, exit status and first diagnostic only; do not
  include credentials or private artifacts.

### E2E helper type-contract follow-up

- **Input:** The next user-operated `pnpm check` passed formatting, lint and the
  application typechecks, then stopped in `pnpm e2e:typecheck` at API2322 line139
  with TS2345: the edition's `capture.id` string was not assignable to the helper's
  inferred UUID template-literal parameter. No suite report or unrelated failure
  was inspected. The saved E2E handoff metadata above remains historical and does
  not validate this repair.
- **Cause:** `captureLiquidity` omitted an explicit type for its optional `id`
  parameter. Because its default is `randomUUID()`, TypeScript inferred the narrow
  UUID template-literal return type even though callers also reuse IDs obtained
  from the runtime-validated `CcilLiquidityEditionSchema`, whose public field type
  is `string`. Runtime API UUID validation was not the failing boundary.
- **Implementation and regression:** Declare the helper input as `string`, matching
  the request payload and parsed edition contract while retaining the UUID default.
  API2322 names the parsed edition ID as a string and replays the same real import;
  it must still return the exact captured edition, so idempotency and storage paths
  are not mocked or weakened. Production contracts, validation and behavior are
  unchanged; no dependency, migration, UI, offline or source-permission change is
  involved.
- **Reusable repair prompt:** Given only TS2345 at API2322's idempotent replay,
  align the CCIL test helper's request-ID parameter with the parsed edition's
  public string contract, retain UUID generation as the default and preserve the
  exact real-storage replay assertion. Do not loosen production validation, run
  checks or commit.
- **Verification:** Authored only. No formatting, lint, typecheck, build, test,
  service, migration, ingestion or commit was run. The parent script owns the
  exact failed-command retry. Source permission and physical-device gates remain
  open. Smallest validation for this supplied failure: `pnpm e2e:typecheck`.
  Expected: the TS2345 diagnostic at API2322 line139 is absent and the command
  exits successfully. If it fails, report the command, exit status and first
  diagnostic only; do not include credentials or private artifacts.

## Scoped reader recovery repair — 2026-09-20

- **Input:** User-supplied E2E-WEB-2321 desktop failure from saved run
  `1789927022541-d96af7ff-cfac-46ba-8451-555a61cf5d3e`, started
  2026-09-20T17:57:02.541Z against API port4104 and web port5176. The reader
  alert was absent after the test aborted its first public-liquidity request.
- **Cause:** `CcilLiquidityReader` started its request synchronously inside the
  mount effect. React development StrictMode invoked the effect, immediately
  cleaned up that discarded mount, and invoked it again. The discarded request
  consumed the one-shot transport failure; its abort was correctly ignored,
  while the active request succeeded and therefore rendered no recovery alert.
- **Implementation:** Defer request setup to a microtask and check the effect's
  abort signal before starting it. StrictMode cleanup can now cancel the
  discarded setup without network traffic. Real failures from the surviving
  mount remain visible and the existing button performs the explicit retry.
- **Regression:** E2E-WEB-2321 now counts the real public-reader requests: one
  active request must expose the alert, and activating retry must issue exactly
  one additional request and render the independently reviewed edition. The
  real API/storage path and transport failure remain in use.
- **Unchanged boundaries:** Contracts, API, database, migration129, offline
  snapshot behavior, source activation and permission gates are unchanged.
  Source permission and physical-device acceptance remain open.
- **Verification:** Authored only. No format, lint, typecheck, build, test,
  service, migration, ingestion, commit or browser automation was run. The
  parent script owns the exact desktop case retry.
- **Smallest validation:**
  `pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/ccil-liquidity\.spec\.ts' --project=desktop --grep 'E2E-WEB-2321 liquidity pending permissions and actual response loss recover without duplicate capture @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION$'`.
  Expected: the reader shows the first failure, retry renders `05.74 GS 2026`,
  and the case passes with one initial reader request plus one retry. On failure,
  report the run ID, project, assertion/error context and trace path without
  credentials or private artifacts.

## Mobile reader recovery follow-up — 2026-09-20

- **Input:** The parent rerun passed the desktop instance recorded in
  `artifacts/e2e/latest.md` as run
  `1789927329576-2e833b83-fbb4-4595-8a30-1bd80ace29ea`, started
  2026-09-20T18:02:09.576Z against API port4104 and web port5176. The supplied
  mobile rerun then failed at WEB2321 line279 because the expected reader alert
  was absent. The saved report covers desktop only and is not evidence for this
  mobile repair.
- **Corrected cause:** The one-shot route fault was coupled to an assumed count
  of React development mount requests. A discarded or superseded StrictMode
  mount could consume that one synthetic failure, allowing the surviving mount
  to load successfully and leaving no alert. Deferring the reader request by a
  microtask did not define a reliable lifecycle boundary across both projects.
  This was a test fault-injection race, not evidence that the reader ignored a
  failure from its surviving request.
- **Implementation:** Restore the reader's ordinary abortable effect. In
  WEB2321, keep aborting public-reader requests until the surviving mount renders
  its alert. Then disable the injected fault, activate the real recovery button
  and require exactly one additional request to return the independently
  reviewed edition from the actual API/storage path.
- **Regression value:** The case still requires visible failure and explicit
  user recovery, does not mock a successful response, and detects duplicate
  requests after retry. It no longer treats development-only discarded mounts
  as user-visible failures or relies on their timing/count.
- **Unchanged boundaries:** Contracts, API, database, migration129, production
  UI behavior, offline snapshots, source activation and permission gates are
  unchanged. Source permission and physical-device acceptance remain open.
- **Verification:** Authored only. No format, lint, typecheck, build, test,
  service, migration, ingestion, commit or browser automation was run. The
  parent script owns the exact mobile case retry.
- **Smallest validation:**
  `pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/ccil-liquidity\.spec\.ts' --project=mobile --grep 'E2E-WEB-2321 liquidity pending permissions and actual response loss recover without duplicate capture @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION$'`.
  Expected: the surviving reader displays its alert, the explicit retry renders
  `05.74 GS 2026`, and only one request is added after recovery is activated. On
  failure report the run ID, project, assertion/error context and trace path;
  do not include credentials or private artifacts.

## Saved user-run receipts — 20 September 2026

SDLC run `1789926953092-78982` recorded API2320–2325 and WEB2320 passes.
WEB2321 initially failed on both projects; the script's focused repair reruns
passed desktop in `08-pnpm-e2e_run.log` and mobile in `10-pnpm-e2e_run.log`.
`12-pnpm-android_test.log` records both OFFLINE2320/2321 passes. The two WEB2321
bugs are resolved by saved receipts. These are recorded passes across successive
repair revisions, not a fresh full acceptance matrix for the final revision.
The stale generated validation state must be reconciled by the user-run story
command; source permission and actual production activation remain separate gates.
No further CCIL code changes or agent execution were needed in this diagnosis.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->
