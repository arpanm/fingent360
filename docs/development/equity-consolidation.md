# Reviewed cash-equity consolidation bridges

Specification dated 2026-09-15, SRC-003 / EQUITY-COVERAGE-001. Implementation and acceptance are authored; no validation or source activation is claimed.

## Verified source family and scope

The actual Vertoz action demonstrates why an inverse-split regex is insufficient. [NSE CML68640](https://nsearchives.nseindia.com/content/circulars/CML68640.pdf) suspends trading from 25 June 2025, after the 24 June close. [NSE CML69016](https://nsearchives.nseindia.com/content/circulars/CML69016.pdf) resumes trading on 11 July 2025 with face value10, new ISIN INE188Y01031 and BE series. The [issuer's record-date notice](https://vertoz.com/ir/wp-content/uploads/2025/06/RD_sd.pdf) identifies old ISIN INE188Y01023 and record date25 June. These are cash-equity listing documents, not derivatives adjustment rules.

Record date, suspension date and first new-security trading date are distinct fields. Issuer annual-report descriptions of the new ISIN's effective date differ between published copies; they must not override exchange trading dates. A reviewer verifies the retained original suspension, resumption and issuer notices, exact terms, source permission and both admitted identity/price records. Uploaded document bytes are retained with hashes; field transcription is explicitly manual and independently reviewed, not represented as automatic PDF extraction.

The initial family is a pure fully-paid consolidation with a higher new face value, unchanged total nominal capital, exact old/new security identities and no additional consideration. Historical per-share prices are scaled by new face value / old face value using rational arithmetic; only an illustrative comparison of the last old close and first new close is produced. It is not a daily return, economic valuation, total return or adjusted exchange quote. The suspension interval makes this bridge ineligible for daily-return calibration. Other actions during the transition, capital reductions, mixed consideration and conflicting identities/prices block publication. Existing simple action windows remain separate.

No holdings, quantity, tax lot, fractional entitlement, election or cash-in-lieu is changed. Users see the security change and source dates and retain control of their actual broker-reconciled portfolio import. Public display/offline rights require independent attestation; public availability alone grants no permission. Capture is manual; automated acquisition and other complex action families remain separate gaps.

## Required implementation layers

- Versioned strict source/term contract, retained original PDFs and immutable receipt/review records.
- Source re-admission and deterministic reconstruction at publication/public reads; changed or withdrawn underlying editions hide the bridge.
- Named preparer/independent publisher, idempotent owner-bound request IDs, explicit withdrawal.
- Shared Operations capture/review, company-reader dates/nominal comparison/source links and offline snapshot validation.
- Authored isolated API, actual Operations submission, public reader and offline rejection cases1780–1789 as used in the handoff.

## Manual acceptance

Upload permitted original notices, select the old/new admitted security identifiers and exact trading dates, enter verified fully-paid face values and confirm the limited family. A different named publisher verifies all originals and publishes. Both company pages must show identical bridge terms and distinct raw/nominal comparison. Withdrawing an underlying edition or the bridge removes it from connected public reads. A suspension spanning a proposed daily-calibration window cannot become an ordinary adjacent-day observation. No portfolio balance changes.

No tests, builds, formatting, services or migration were run by the agent. Migration110 requires the user's normal database/migration workflow. Use the final task handoff's filtered `pnpm sdlc` command; no live provider retrieval is needed for synthetic acceptance fixtures.

### API1783 prerequisite regression — 2026-09-18

The synthetic old-security edition is declared effective on24 June2025 and the new-security edition on11 July2025, matching their respective identity and boundary-price observations. The shared acceptance helper asserts each imported edition and both of its observations retain that exact date before independent review. This preserves the production rule that an observation after its declared source date is rejected; it does not relax admission or replace the retained-source path.

The supplied API1783 retry then verifies the independently published bridge blocks only windows crossing the suspension transition for both ISINs, while a wholly pre-suspension old-ISIN window and wholly post-resumption new-ISIN window remain unblocked. This repair is authored and has not been executed.

The subsequent user-operated `pnpm check` reached E2E typechecking and reported that the destructured fixture date could be `undefined`. The rows are now declared as immutable tuples, which preserves their exact five required string fields under `noUncheckedIndexedAccess`. The response-date assertions remain the runtime regression; `pnpm e2e:typecheck` is the smallest static validation. Neither validation has been rerun for this edit.
