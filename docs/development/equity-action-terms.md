# Reviewed rights and stock-swap merger source terms

## Specification — 2026-09-15

SRC003 explicitly requires corporate-action taxonomy and adjusted-price goldens. Add typed rights and merger terms to original source ingestion, independent review, exact dated company binding and public/downloaded reconstruction. This is distinct from free-text announcement display and from private investor election/accounting.

Rights: exact new-for-existing ratio, fully payable subscription amount in INR, record/ex/open/close/renunciation dates and original fraction treatment. Use an actual admitted last cum-rights close and compute the theoretical fully-subscribed per-share value `(existing shares × cum close + new shares × subscription amount) / total shares`. Preserve the exact rational expression and decimal display. This is an explicitly conditional capital arithmetic comparison, not an exchange quotation, actual entitlement, price forecast or calibrated return.

Stock-swap merger: exact transferor/transferee identities, effective/record/ex dates, fully paid new-for-old ratio, stated zero fixed cash consideration, and source fractional treatment. On a single common pre-event price date retain both independent companies' traded closes, convert transferor close into transferee share units and display the transferee close separately. Never splice either company's history or claim value conservation across two independent businesses. Nonzero cash/multi-leg/debt/partly-paid schemes are outside this policy and fail closed.

Both require original source file/hash, publication date, page/section and exact transcription, explicit source storage/display/offline permission, named independent review, immutable receipts, source re-admission, paginated Operations, withdrawal, error/retry, keyboard/mobile reader and offline mutation refusal. Neither sets adjusted=true or authorizes empirical daily calibration. Generic rights/merger action windows remain blocked by existing normalization. No user holdings or lots change.

## Primary source research

- [Max India original offer,25 April2025](https://nsearchives.nseindia.com/corporates/offerdocument/rights/MAXIND_LOF_25042025.pdf): INE0CG601016,19 new for100 existing,₹150 fully payable;29April record,7May open,16May on-market renunciation,22May close. Original terms, not personal entitlement records.
- [HDFC Bank original merger announcement](https://www.hdfc.bank.in/press-release/2023/q2/hdfc-ltd-to-merge-into-hdfc-bank-effective-july-1-2023): effective1July2023, record13July2023,42 fully-paid bank shares for25 HDFC shares. Transferor/transferee are independent histories, not an ISIN rename.
- [HDFC original fractional-distribution filing](https://nsearchives.nseindia.com/corporate/HDFCBANK_19102023184408_Intimation_Fractional_Entitlement.pdf): a trustee sold pooled fractional shares and distributed net proceeds; therefore fractions cannot be rounded into an automatic investor cash amount. The implementation records the source policy without importing shareholder personal data or inferred individual proceeds.
- [NSE cash-market price-band clarification](https://archives.nseindia.com/content/circulars/cmtr5699.htm) expressly distinguishes complex reorganizations where theoretical price cannot be calculated. No F&O adjustment formula is adopted as a cash-equity quotation rule.

Source public access is not production permission. Full originals are supplied only by authorized Operations, retained privately, and never bundled publicly. Test original files are clearly synthetic factual transcriptions; no full shareholder document is committed.

## Acceptance and execution

API1930–1932, WEB1930 and OFFLINE1930 are reserved for actual persistence/review/reconstruction, exact arithmetic and unsupported combinations, real Operations file submission, reader and downloaded reconstruction. No tests, gates, builds, migrations, provider jobs or services are run by the agent. Migration122 is user applied; source activation and physical native acceptance remain manual.

## Implementation and source boundaries

Authored strict rights/stock-swap contracts, retained original-file Mongo records, immutable PostgreSQL122 draft/review/receipt tables, independent named publication, company source re-admission and20-row keyset Operations. Terms require an already admitted corporate-action row with matching identity/ex-date/record date. Source quote transcription must carry the exact ratio and subscription values; this is transparent human-reviewed extraction, not an asserted automated PDF parser. Latest retained pre-ex-date reference closes must be unambiguous. A newly admitted later close or revised bound source makes the prior receipt unavailable until newly prepared/reviewed. Historical documents may be acquired later; publication date and acquisition remain separate.

[Original NSE HDFC suspension circular CML57423](https://archives.nseindia.com/content/circulars/CML57423.pdf),4July2023, confirms13July2023 trading suspension for amalgamation. The reference fixture uses genuine ratio/date/identity facts but **synthetic INR2800/1700 closes**; its1666.666666666667 per-share-unit conversion is an arithmetic golden, not a historical market quote. The rights fixture likewise uses **synthetic INR200 cum-price** with real19:100/INR150 terms;22850/119 =192.016806722689 is conditional theoretical full subscription. No investment return is inferred from either.

Rights elections, cash-in-lieu settlements and tax lots remain separate owner-record work. Multi-leg mergers, nonzero fixed cash/debt consideration, partly-paid subscriptions and compound actions are unsupported additional variants. The initial named corporate-action taxonomy now has split, bonus, cash-dividend, fully-paid rights and pure stock-swap merger treatments, with the previously authored pure consolidation bridge; unsupported numerical histories stay explicitly ineligible. No issuer histories are spliced and no raw quote is overwritten.

Manual prerequisites: existing API/PostgreSQL/MongoDB/web and user-applied migration122. No dependency change. Run:

```sh
pnpm db:migrate
pnpm sdlc "Validate reviewed rights and merger terms" -- --grep "E2E-(API-193[0-2]|WEB-1930|OFFLINE-1930)"
```

Open the dev URL printed by `pnpm dev` → Operations → Rights and mergers; after independent review open either company page. Expect exact rational/displayed conditional values, visible source dates and exclusions, unchanged holdings and withdrawal removing connected publications. Offline accepts only matching downloaded company bindings and refuses source mutations. Report failing test ID/project, actual response/assertion and artifact run path. No format/check/test/build/service/migration/provider activation or commit was run. HEAD `a2c53a0`; concurrent authoring remains for the manual gated commit.
