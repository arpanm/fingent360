# INDEX-LEVELS-001 — Reviewed daily Nifty price-index history

Status: authored; user validation pending. Child of SRC-006 and EQUITY-COVERAGE-001. No source activation or permission is inferred.

## Input and primary evidence — 20 September 2026

The old original-format availability blocker is resolved by independent primary-source research. The official [Daily Reports listing](https://www.niftyindices.com/reports/daily-reports) names18September2026 and17September2026 snapshots. Ordinary HTTPS download of [NSE archive original](https://archives.nseindia.com/content/indices/ind_close_all_18092026.csv) returned200, text/csv,17,449bytes,166data rows. SHA-256 of original bytes: `16e77c60ff230e92573f887d6bb78a6823dfc4f620e45d7ef664772635db8047`. Raw research copy retained at `/tmp/f360-indexarchive1809.csv`; it is not redistributed as a repository fixture or added to the offline bundle. The nsearchives alternative returned HTTP/2 INTERNAL_ERROR; the archive host succeeded without cookies, alternate identities or access-control workarounds. The ordinary Nifty host download timed out after20seconds with zero bytes.

Verified header: `Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%),Volume,Turnover (Rs. Cr.),P/E,P/B,Div Yield`. Supported original names: Nifty50 (source spelling `Nifty 50`), `Nifty Bank`, `Nifty IT`. Dates areDD-MM-YYYY; source numbers use decimal points with variable scale and leading-dot fractions in change/ratios. Every inspected row has13columns. Header explicitly identifies turnover as Rs.Cr.; OHLC values are index levels, not rupee security prices. Selected rows have populated OHLC and auxiliary metrics; unsupported selected missing values reject rather than being guessed. This parser does not claim a historical format prior to the inspected grammar.

[Provider terms](https://www.niftyindices.com/terms-of-use) and [disclaimer](https://www.niftyindices.com/disclaimer) retain dataset-use licensing constraints. Source visibility is not permission for storage/display/offline redistribution. Production capture requires a recorded actual permission basis and a different named reviewer's verification. Existing agreement question remains separate; no repeat user question is needed for format research.

## Specification and acceptance

Contracts first: strict original dated filename/allowlisted URL, exact13-column CSV, distinct source names/date agreement, exactly the three supported indices, positive reconciled OHLC, decimal strings and integer volume. Preserve SHA-256 of raw CSV and retained original capture with immutable editorial permission evidence. Unsupported originals are retained in quarantine and cannot be published.

Workflow: protected Operations upload → raw Mongo retention → immutable PostgreSQL capture → independent named review → public dated history. Replaying a request is exact/idempotent; mismatched replay rejects. Corrections create new captures; newest explicitly published edition wins per date. Withdrawal removes that published date without resurrecting an older edition. No automatic acquisition, startup work or provider calls in application code.

UI/UX: source upload/reset attestations, loading/empty/error/retry/saved states, retained-original download and publication/withdrawal; public responsive index/day history with provenance, explicit unit/price-return caveat,20-date continuation and keyboard-readable details. Source rows remain individually labeled. Existing React/mobile shell shares the UI; offline snapshot uses the same strict payload and date pagination, with connected-only editing and no private metadata/raw redistribution.

Database: additive124 creates immutable captures/reviews; existing Mongo/PG infrastructure and runtime grants are reused. Automation: manual source capture and existing snapshot command only. Tests: reserve API1950–1953, WEB1950–1952, OFFLINE1950/1951 for capture/quarantine/replay/independence/correction/withdrawal, pagination and actual UI/offline paths. Synthetic numerical fixtures derive only their layout from original evidence; they are not live index observations.

Reusable prompt: complete this bounded price-index snapshot workflow using the documented actual original grammar and existing independent review patterns. Preserve exact decimals, source identity/date/hash, immutable revisions and source rights gates. Never equate constituent classifications, total-return indices or security prices with these observations. Author API/browser/offline acceptance and root integration notes; no deterministic execution, services, migrations or commit.

## Authored implementation and handoff

Implemented contracts/parser,124immutable capture/review migration and registration, Mongo originals with reconstruction check, protected queue/evidence/capture/review with20capture continuation using exact PostgreSQL microsecond timestamp+UUID and previous/next Operations controls, actor-bound replay, strict UTF-8 byte limit, named independent rights review, latest published edition per date and withdrawal without old-edition resurrection. Public history pages20dates; snapshot cap1000dates is explicit and export refuses partial/changed publication. Captured source hash is SHA-256 of the exact CSV text bytes; internal capture fingerprint also binds filename/URL/permission evidence/request identity. No BSE identity or official four-tier taxonomy claim is added.

Shared web/native-shell UI is linked from More and Sources → Daily price-index history. Operations → Daily index history uploads originals, resets permission confirmation after changed input, downloads retained capture evidence and independently publishes/withdraws. Public details label all three source index names, exact decimal strings, OHLC, change, volume, turnover units, valuations, dates, source link/hash and price-index limitations. Empty/error/loading/retry states are explicit. Offline registry/types and `scripts/index-levels-snapshot.mjs`/existing snapshot command preserve reviewed numerical snapshots only; editing is connected-only and absent/incomplete installed history fails explicitly.

Authored cases (not run): E2E-API-1950(actor-bound capture/review replay, independent rights gate, exact raw hash, public/private separation, correction and withdrawal); E2E-API-1951(strict header/date/identity/missing-value/OHLC quarantine, original retention, unsupported URL and UTF-8 byte limit); E2E-API-1952(21date continuation and complete snapshot); E2E-API-1953(real capture requests with tied microsecond timestamps, exact continuation and invalid cursor rejection); E2E-WEB-1950(Sources navigation, explicit outage/retry, keyboard detail, provenance and narrow layout); E2E-WEB-1951(actual original upload, permission reset, different reviewer publish/withdraw and reader empty state); E2E-WEB-1952(actual Operations previous/next discovery of older unreviewed originals); E2E-OFFLINE-1950(exact installed provenance, pagination, connected-only edits and incomplete/missing snapshot rejection with unchanged local account state); E2E-OFFLINE-1951(actual installed Sources navigation, available/empty/no-cache handling and zero API network). Tags: `@INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION`.

User manual action after integrating authoring changes into the normal checkout: apply additive124with `pnpm db:migrate` using the configured migration role, then start/restart existing API/web through the user's normal `pnpm dev` workflow if needed. PostgreSQL/MongoDB and the updated API/web must be available. No new dependencies; no install needed for this slice. Use the printed web URL → `/#sources` → Daily price-index history, or `/#ops` → Daily index history. Named Operations accounts with separate preparer/reviewer roles are required for publication. Actual deployment capture still requires an applicable permission basis; the acceptance fixtures assert none.

Focused validation command (prefer the parent's consolidated command when validating the whole batch):

```bash
SDLC_AUTO_REPAIR=0 pnpm sdlc "Validate reviewed daily index history" --story INDEX-LEVELS-001
```

Expected results are the authored assertions above, successful normal format/check gates and immutable originals/reviews. Rebuild/install the offline bundle only through the user's normal snapshot/app commands after reviewed permitted data exists; no private rights attestation or original CSV is distributed in that public bundle. Physical-device/screen-reader/large-text acceptance remains separate from browser emulation. Report SDLC run ID, failing case/project, saved report/log, response status and capture ID/parser policy when a gate fails; exclude private rights documents and credentials.

No tests, parser execution against provider data, formatting/checks/builds, services, migrations, source ingestion or commit were run by the agent. Research-only original download/inspection occurred as documented. HEAD remains `c7874a5`; this source slice and other agents' independent authoring changes remain uncommitted pending user-run gates. Parent SRC-006/EQUITY-COVERAGE remains partial for broader index/constituent history, official taxonomy, rights and activation.

## Integration handoff — 20 September 2026

Continuation is reconciled in the unwatched `fingent360-continuation-20260920`
checkout against user commit `c99d62b` and newer saved validation records. The
main checkout and those records are preserved. Use the continuation-only patch
and commands in [the current handoff](../development/nondeferred-authoring-2026-09-20.md).
No new tests/gates/migrations/services or commit were run by the agent. Earlier
base hashes above identify authoring history, not the current integration base.

The final shared-app review routes retained-evidence download through the existing
native/web `saveDownload` bridge, with disabled in-flight control and actionable
result/error text. WEB1951 authors exact downloaded JSON source/permission checks;
the existing native file-picker implementation is reused. Installed device
acceptance remains separate. Late unmounted submission results do not start a new
queue load. No validation was executed for these integration edits.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->
