# EIA daily crude spot source

## Specification and primary research — 2026-09-15

Original https://www.eia.gov/dnav/pet/PET_PRI_SPT_S1_D.htm retrieved18,802bytes through an ordinary read-only request. Verified HTML has six `Series5` MM/DD/YY headers, exact WTI Cushing/Brent Europe row labels, `DataB`/`Current2` cells, daily RWTC/RBRTE history links, dollars-per-barrel crude heading, source release and next-release dates. Blank/NA/withheld cells are not prices. Two-digit years must resolve against the explicit four-digit release year, within the preceding year only; ambiguous/future dates fail closed. Source release time is day precision, not a live quote or intraday timestamp. Missing rows/layouts reject the capture without changing prior published evidence.

https://www.eia.gov/dnav/pet/TblDefs/pet_pri_spt_tbldef2.asp attributes spot data to Refinitiv, an LSEG business. https://www.eia.gov/about/copyrights_reuse.php excludes privately contributed protected material from the general government-data reuse statement. Therefore acquisition and publication require a stored explicit permission reference covering contributor retention, display and offline use; the source gate defaults disabled. No live activation or claim of free redistribution is made.

Contracts first, Mongo original bytes/hash, PostgreSQL immutable capture/review editions and gate; named independent publication, source-specific raw reconstruction and bounded history; Operations permission/capture/review and shared web/native date/value/source reading with retry/empty/stale states; downloaded exact captures and connected-only mutations. Existing source worker may acquire drafts only under an enabled source schedule and current permission. History means retained daily page editions, not a claim of complete historical XLS coverage. Source dates, retrieval times and review dates remain distinct. API/browser/offline1940–1949 authored only; migration123 manual.

## Authored implementation and manual handoff

`eia-spot.ts` validates exactly the two crude series and six original daily columns, positive or negative lexical two-decimal quotes, missing-value tokens and release-day dates. Data from products priced per gallon never enters this contract. Fixed-origin bounded fetch has no redirects. Raw originals and failed-layout attempts remain in Mongo; immutable successful parsed captures/reviews are in123 PostgreSQL. Stored permission starts disabled; disabling hides connected public data and prevents acquisition. Changed permission prevents publication of old-scope captures until newly captured/reviewed. Protected evidence inspection remains available for review/withdrawal.

The existing research worker has an `eia-daily-spot` schedule inserted disabled. Its actual tick branch invokes the source capture helper; the helper locks gate then schedule before and after source I/O, checks unchanged permission and current enabled state, stages only a draft, and avoids duplicate unchanged bodies. No automatic publication permission is introduced. Current raw hash and current permission jointly identify automatic reuse; a newly granted scope must have its own reviewed capture. Worker retry/run history is inherited from the existing durable research worker.

Operations → Daily oil source permits actual source permission, file/fetch, inspect and independent review. Shared `#daily-oil` shows edition selection, dates/units, blanks as Not reported, stale expected-release warning, original-source attribution and retry. Downloaded native/web snapshots keep only their included edition; missing history and all source mutations refuse clearly. No native binary was built.

Authored API1940 covers default denial, gate/capture/review, changed editions and missing cells, failed-layout original retention and withdrawal/disable. API1941 rejects weekly/wrong identity/unit/date/cell layouts. API1942 invokes the actual ResearchAutoStore.tick and configuration endpoint with only the upstream HTTP response simulated; it checks no duplicate non-due run and permission withdrawal during acquisition. WEB1940 submits the actual permission/capture/review forms before reading; OFFLINE1940 checks downloaded-only history/missing units/mutation refusal. Fixtures reconstruct the verified HTML grammar with explicitly synthetic prices, not licensed source data or fabricated historical captures.

Manual prerequisites: configured PostgreSQL/MongoDB/API/web, migration123. No dependency changes. Keep live contributor gate and schedule disabled until actual permission exists. Test fixtures use explicitly synthetic permission text only. Run:

```sh
pnpm db:migrate
pnpm sdlc "Validate permitted daily crude source" -- --grep "E2E-(API-194[0-2]|WEB-1940|OFFLINE-1940)"
```

Open the URL printed by `pnpm dev`, Operations → Daily oil source and `#daily-oil`. Expected results: source disabled until explicit gate, independently published retained daily cells, no substitution of zero for missing and no claims of live quotes. Report failing test ID/project, saved artifact run path and response/assertion. No tests, format/check/build/migration/service/source activation or commit ran. HEAD `a2c53a0`; concurrent authoring remains uncommitted for the user-run gates. Longer historical EIA XLS archives and other petroleum products remain additional coverage, not this initial daily WTI/Brent scope.

Related worker admission fix: monthly commodity acquisition now locks its permission gate before its schedule, both `FOR SHARE`, matching configuration order and holding the admitted permission through capture commit. The existing scheduled commodity API acceptance also changes permission during source acquisition and requires rejection with no added capture. This is authoring only; include the existing scheduled-commodity case when manually validating shared worker admission.

### Edition navigation correction

`#daily-oil?edition=<UUID>` now owns selection. Browser Back and same-component hash changes reload the exact selected original; a failed selection retains its target for retry. Only an explicit user selection/Back/retry moves focus to the result heading or error summary; initial rendering does not steal focus. Loading announces busy state, latest has an explicit action, and monthly commodities has a connected Back link. WEB1943 authors two actually retained/reviewed API editions plus a single simulated transport failure, exact retry, browser Back and narrow viewport assertions. Manual focused command: `pnpm sdlc "Validate daily oil history navigation" -- --grep E2E-WEB-1943` (desktop/mobile). No execution or new migration.
