# Historical Cleveland Fed CPI model comparison

## Specification and acceptance

Preserve a dated original Cleveland Fed headline monthly CPI model estimate and compare it with the first original BLS release for the same month, seasonal basis and nonannualized percentage measure. Keep full fetched source bytes in the existing Mongo original store; retain exact selection and reviewed projection in existing PostgreSQL editions/reviews/views. No migration is needed. Fetch/import is operator initiated, independently published, idempotent by source plus selection; no automatic source activation. Withdrawal removes comparisons from the connected public projection. Downloaded web/native snapshots preserve the vintage and retrospective limitation and cannot publish.

A historical date does not prove an exact publication timestamp or that this app held the estimate before release. Historical comparisons are model errors, not market consensus surprises, causal impacts, or investment recommendations. Daily current snapshots retain their existing separate availability check.

## Primary research — 2026-09-15

- [Cleveland Fed original indicator page](https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting) embeds its monthly archive at `https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en`. Its chart declares month-over-month percentage changes and a [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license. Attribution: Federal Reserve Bank of Cleveland calculations using BLS, BEA, EIA, Financial Times and Haver Analytics inputs. This chart declaration does not grant arbitrary upstream input redistribution rights; only the selected published chart excerpt is checked in. Production operators must confirm storage/display/offline scope.
- Original archive downloaded only for format research: 7,596,504 bytes; SHA256 `cbda3ac91a105526600e7c01d8757a8236720e353ff0d08acd3b3720ea22c618`. The checked-in fixture is one exact January 2025 chart object extracted from that archive, wrapped in an array; its serialization differs from the full original. Production retains the complete supplied/fetched bytes and its actual URL-bound hash. No test fixture is claimed to be a full provider response or historical app capture.
- The archive generation label `2026-09-14 00:00` is not a historical publication timestamp. Target chart `2025-1`, model day `02/11`, CPI estimate `0.242424629147151` is a dated historical model vintage. Marker categories are not data rows; the parser excludes them before joining. Blank model cells on release days are rejected, and the distinct Actual CPI Inflation series is never substituted.
- [BLS first January 2025 release](https://www.bls.gov/news.release/archives/cpi_02122025.htm), February 12, 2025, reports headline monthly seasonally adjusted CPI change of 0.5%. Actual minus prior model is exactly 0.257575370852849 percentage points. The BLS fixture reconstructs only required original header/factual text; it is explicitly not full original HTML.

## Implementation and limits

`cleveland-cpi-history.ts` validates original chart shape, target month, selected date, exact tooltext/value, units and date alignment. Unknown fields/layouts fail closed. Only target and following-month dates are admitted; no guessed year rollover. Exact BigInt decimal subtraction preserves up to 18 fractional places. The existing capture schema adds optional historical metadata without changing older receipts. Server review reconstructs the selection from original bytes, and request replay distinguishes selections. The public shared web/app reader labels the vintage, later acquisition and unknown exact publication time. Operations accepts HTML/JSON, requires an explicit month/day, resets permission confirmation on selection edits and preserves error/retry and independent review.

No worker automatically acquires historical archives; this scope is operator-selected historical evidence, not a recurring current-nowcast subscription. Broader expectation vintages and true survey consensus remain separate source scopes.

## Authored acceptance and manual execution

API1850 retains/reviews the real excerpt and exact BLS comparison, checks original access and withdrawal; API1851 rejects blank actual-day cells, wrong dates/measure and altered values. WEB1850 submits the actual Operations file/selection, independently reviews it and opens the reader. OFFLINE1850 retains exact comparison and rejects changed vintage metadata. Existing WEB1672 label updated for HTML/JSON.

No tests, gates, services, migrations, builds, source jobs or commits were run. With normal configured API/PostgreSQL/MongoDB and named test operators available, manually run:

```sh
pnpm sdlc "Validate historical CPI model evidence" -- --grep "E2E-(API-185[01]|WEB-1850|OFFLINE-1850|WEB-1672)"
```

Use the dev URL printed by `pnpm dev`, Operations → CPI model expectations, then Research calendar. Expect exact model error and explicit retrospective wording, never consensus labeling. Report failing case/project, response details and saved artifact run ID. Native device acceptance remains user-run; the shared downloaded projection is authored, not device verified.
