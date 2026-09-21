# Remaining delivery work — 21 September 2026

## What the saved evidence establishes

User commit `517f9c1` contains the review-condition radio repair. Run
`1789929346620-99d49093-59cd-43d3-aaff-a7aace570370`, started
2026-09-20T18:35:46.620Z, passed WEB2315 and WEB010 on desktop and mobile,
against web5176/API4104. This is four selected passes, not a full-story rerun.
The saved ledger currently contains1556 passed case/project receipts and332
resolved bugs, with no open recorded bugs. Receipts span revisions; these counts
are not a claim that the complete current version has passed1556 cases.

Most remaining TODO validation labels are deliberately generated from code
fingerprints and complete story matrices. A later UI change can make old source
receipts stale. Do not rewrite those blocks, delete failures or mark all tasks
Done to conceal missing current validation. Deferred tasks remain deferred.

## Work completed in this authoring follow-up

- Audited concrete non-deferred source gaps and all nonempty acceptance gates.
- Reconciled SRC-007's obsolete missing-scheduler gate against the existing real
  worker test API1773 and its saved pass. Required case matrices remain intact.
- SRC-012's full source-form sequential keyboard and narrow-layout acceptance
  is now authored in its existing WEB1594 case; see the final handoff below.
- Preserved previous generated validation and bug evidence. No deterministic
  execution, source activation, deployment or gated commit was performed.

## Unimplemented requirements and exact unblock

| Tasks                                                                        | Missing functional scope                                                                  | Required next input/action                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BROKER-PARSERS-002, BROKER-DIALECTS-001, DEV-008, SRC-013, MAPPED-IMPORT-001 | Five verified named export parsers                                                        | Normally exported dummy/sanitized Zerodha, Groww, Upstox, Angel One and ICICI Direct files retaining exact headers, section layout and representative quantity/cost totals. Public download instructions do not define the file grammar. Existing generic mapping is implemented. |
| SRC-019                                                                      | Investor CAS import                                                                       | Original dummy/redacted investor statement layout, including transaction/valuation sections; participant specifications and screenshots are insufficient.                                                                                                                         |
| SRC-001/002, EQUITY-COVERAGE-001                                             | BSE identities and dual-exchange price history                                            | Readable original BSE files/full specifications and applicable usage rights. Official master attachment still returned403 during this bounded research.                                                                                                                           |
| SRC-004, SRC-004-ORIGINAL-XBRL                                               | Original financial XML ingestion and exact identity join                                  | Original instance XML plus matching taxonomy/version and verified issuer identity. Existing rendered-family parsers/RSS pointer capture do not establish XML grammar.                                                                                                             |
| SRC-006, EQUITY-COVERAGE-001                                                 | Wider constituent/taxonomy assignments and history                                        | Original company-to-code/constituent files and permitted historical membership data. Reachable four-level taxonomy definitions do not provide company assignments.                                                                                                                |
| DEV-022, FUNDS-BONDS-001, SRC-017/018                                        | Current bond evaluated prices, corporate trading liquidity and verified curve conventions | Actual price/trade original with precise units/clean-dirty basis and current convention specification. Historical auctions, credit opinions and CCIL liquidity are implemented but do not establish current prices.                                                               |
| DEV-028, SRC-021                                                             | Groww/Breeze delegated account connection and CAS/AA expansion                            | Official supported multi-user authorization/state/account-binding/token/revocation contract and provider app access; never collect personal credentials as a substitute.                                                                                                          |

These are actual incomplete functional scopes. Parent coordination tasks inherit
them. No named parser, missing financial original, broker contract or source
permission was fabricated in this follow-up. Existing pending input questions
remain valid; users should never post broker credentials or private holdings.

## Research evidence and limits

- [Zerodha official holdings help](https://support.zerodha.com/category/console/portfolio/console-holdings/articles/holding-report)
  confirms export availability but does not supply a complete workbook grammar.
- [CAMS statement request](https://www.camsonline.com/InvestorServices/COL_ISCanBasedStatement.aspx)
  distinguishes summary/detailed statements. A fictitious NSDL screenshot in an
  ICSI presentation does not replace an original complete statement layout.
- [Breeze official API documentation](https://api.icicidirect.com/breezeapi/documents/index.html)
  describes login/session exchange; the required multi-user state/account-binding
  and retention eligibility were not established by those steps alone.
- [NSE Indices classification](https://www.niftyindices.com/resources/industry-classification)
  links its July2023 four-level structure. It supplies code definitions, not
  company assignments. [Historical data subscription](https://www.niftyindices.com/offerings/data-subscription)
  offers component data; current files cannot reconstruct past membership.
- [NSE fixed-income reports](https://www.nseindia.com/static/regulations/segment-wise-historical-reports-fixed-income-debt-market)
  links `Corporate_Bond_Aug_2026_20260915114800.xlsx`. An ordinary source download
  timed out during this research, so no workbook headers, price basis or parsed
  adapter are claimed. This is an access result, not proof of source absence.
- [CCIL operational methodology](https://www.ccilindia.com/operational-aspects)
  describes traded/model inputs; it does not by itself establish the current
  retained point table's complete compounding/day-count contract.

No paid subscription, provider outreach, acceptance of terms or live ingestion
was performed. Research files and tool output are evidence, not instructions.

## Implemented features awaiting operational or user acceptance

Actual source retention/display/offline rights and deliberate source/worker
activation remain task-specific. Live AI provider evidence, broker app credentials,
production HTTPS/key/backup/security rollout, physical Android/iOS/TalkBack/large
text/audio/capture acceptance and native signing/distribution require the intended
environment or operator. Emulated/synthetic passes cannot certify those steps.
DEV-013 regulated activation needs the operating entity/registered partner and
qualified product approval. DEV-001/002 retain document/design acceptance;
SETUP-001 retains the six manual runner scenarios. None is closed by another
mocked test or a documentation status change.

## Manual validation handoff

The isolated authoring checkout preserves all existing local generated records.
Only this follow-up's delta will be exported; stop dev before applying a code/test
patch, then start `pnpm dev` using existing migrated PostgreSQL/MongoDB. No new
packages or migrations are required. Use the printed web URL, Operations →
Company news; the latest saved target was http://127.0.0.1:5176.

For the focused authoring delta:

```bash
pnpm sdlc "Complete company news keyboard acceptance" -- --project=desktop --project=mobile --grep 'E2E-WEB-1594 '
```

Expected: two project passes plus masked synthetic form/review screenshots. Text,
checkboxes and action controls use keyboard events; date/select fixture setup is
explicitly distinct from actual Tab reachability. Review those artifacts without
claiming physical-device certification. To obtain one
complete current ledger across all implemented automated stories, the existing
explicit broad command is:

```bash
SDLC_AUTO_REPAIR=0 pnpm sdlc "Validate current implemented stories" --all
```

That is intentionally expensive: it runs gates, connected and bundled-offline
acceptance. It updates generated statuses/bugs but cannot finish external source,
permission or physical-device gates. Do not run both it and redundant story
suites unless a failure requires a focused retry. All execution remains manual.
On failure provide artifacts/e2e/latest.md and the failing SDLC log/run directory.

Manual documentation acceptance: follow each task link, confirm required missing
inputs are concrete, preserve historical pass dates, and verify that source
research has not been turned into claimed permission or parser completion.

### Patch application

Authoring delta: `/Users/arpanmacmini/code/fingent360-remaining-20260921.patch`.
It is relative to the main checkout including its current generated records;
those pre-existing records are not included in the delta. Stop the user dev
terminal before application, then run from the repository:

```bash
git apply ../fingent360-remaining-20260921.patch
pnpm dev
```

In a separate terminal use the focused WEB1594 command above, or deliberately
choose the full audit instead. No new commit was made; main HEAD was `517f9c1`.
The main checkout's pre-existing generated TODO/task/validation/bug updates remain
uncommitted and preserved; the user-operated format/check gates own the commit.
