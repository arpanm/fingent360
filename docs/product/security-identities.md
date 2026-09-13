# Indian equity identity directory

## Outcome and scope

An investor can look up an Indian ISIN in stored source-backed identities, inspect its name/ticker/FIGI and dated evidence, and return to their holdings. Operators explicitly request public identifiers; investor holdings are never sent to a provider automatically. Unavailable, ambiguous and stale records are visible. Identity is not proof of ownership, a market price or an exchange's current listing status.

## Source decision, checked 2026-09-13

[OpenFIGI API documentation](https://www.openfigi.com/api/documentation) describes free unauthenticated identifier mapping. Use one job per request, fixed ID_ISIN + INR + IN + Equity filters, bounded timeout/size and conservative server pacing. Documentation has inconsistent batch limits; one job avoids that ambiguity. [Official FAQ](https://www.openfigi.com/about/faq) permits storing and redistributing FIGI symbology and its open metadata. [Terms](https://www.openfigi.com/docs/terms-of-service), last updated2018-11-27, dedicate identifiers to public use and disclaim accuracy. Attribute OpenFIGI without implying endorsement. These statements support this bounded metadata adapter; they do not grant rights to other providers' data.

An actual unauthenticated request for public ISIN INE002A01018 returned HTTP200 with RELIANCE INDUSTRIES LIMITED, ticker RELIANCE and FIGI BBG000BKVP93. Retrieval evidence is produced by the implemented operator workflow; this probe alone is not stored application data or comprehensive coverage.

[NSE's data policy](https://www.nseindia.com/static/market-data/nse-data-policy) covers identifiers, EOD and corporate data, with redistribution governed by agreement. Its [EOD subscription page](https://www.nseindia.com/static/market-data/eod-historical-data-subscription) describes paid provision. No recorded Fingent360 agreement grants exchange EOD/corporate-action redistribution to web or APK. SRC-002/003 therefore remain gated for these feeds; do not scrape around restrictions or relabel unofficial data as verified prices.

## Contracts and persistence

Bounded refresh takes at most five distinct checksum-valid Indian ISINs and a client request UUID. Operator authentication and Origin checks precede provider calls. Fixed source URL and mapping filters prevent SSRF. Fetches are sequential, bounded and never include account IDs, costs or quantities. Durable refresh state stores attempted identifiers and individual outcomes; retrying the same request returns its existing state, while explicit new refresh can revise data.

MongoDB stores the raw response and retrieval time. Its SHA-256 receipt hash covers ISIN, retrieval time and raw response separated by newlines, so a later return to an earlier provider payload has its own immutable receipt. PostgreSQL stores immutable canonical editions per ISIN, source filters, candidate metadata, hash, retrieval time and resolution (one common-stock match, ambiguous, or no match). Identical valid data reuses its edition while recording last successful check; failures retain prior evidence and never claim a fresh match. Unknown response fields fail validation. Private provider credentials are unnecessary.

Public reads use stored data only. A directory search is bounded; detail includes all candidate identities, last successful check, original retrieval time, source link, immutable revisions and raw evidence. A dated public bundle supports the same offline reading, while refresh remains a connected operator action.

## UX and acceptance

More → Security directory → search/ISIN → detail → source/history → Back. Holdings can link to identity lookup without changing saved quantities/cost. Use plain unresolved/ambiguous language, loading/empty/error/retry states, normal links/buttons, responsive cards and keyboard operation. Operations has a separate refresh panel with explicit progress/results/retry. No automatic whole-market polling, recommendation or price display.

API/browser/offline cases cover actual refresh/evidence and unchanged replay, input/auth/Origin denial, stored search/details/reload, synthetic malformed/multiple/no-match adapter cases, mobile/keyboard navigation, dated offline data and absence of outbound API requests in device mode. Existing account records are untouched. Root status records actual execution separately from authored acceptance.

## Authored acceptance cases

- `E2E-API-230` requests the actual public Reliance ISIN through the owned API and the fixed OpenFIGI adapter. It reconstructs the stored canonical identity from MongoDB evidence, verifies the SHA-256 receipt over `ISIN + newline + retrievedAt + newline + original body`, checks PostgreSQL immutable editions, and proves replay and a second unchanged refresh preserve evidence while advancing only the successful check time.
- `E2E-API-231` verifies that investor cookies cannot authorize operations, missing/foreign Origins and unknown/private/provider fields are rejected, no provider pacing or run row is created for rejected input, and the owned account watchlist remains intact. `E2E-API-233` covers bounded literal search, invalid checksums, missing identities and evidence ownership.
- `E2E-API-232` first stores a real source edition, then explicitly simulates cooldown and an interrupted run only in the test-owned schema. The failed refresh must retain the identity, dates and original evidence, while interrupted history stays readable with a valid finished timestamp. This simulated failure is separate from live provider-success evidence.
- `E2E-WEB-230` exercises the real Operations refresh, public search, source dates, identity/history/evidence, reload, keyboard activation, Back and holdings navigation in both desktop and mobile projects. `E2E-WEB-231` simulates a failed browser read, then retries the actual empty API and verifies a missing-identity recovery path and guest operations gate. No API success is mocked.
- `E2E-OFFLINE-270–271` require the dated bundle containing at least five actual identities. They reconstruct identity from original bundled evidence, verify the receipt hash, navigate with keyboard/Back/reload, reject unsupported writes and confirm that no `/api/` network requests leave device mode. Bundled evidence remains dated reference data.
- `apps/api/test/securities.test.mjs` uses explicitly synthetic fixtures for ambiguous/no-match/malformed/foreign responses, duplicate identifiers, strict input bounds, fixed request filters, failed-source preservation and replay/cooldown without provider calls. These fixtures never establish live source coverage.

Connected cases reuse the per-case actual application fixture: owned PostgreSQL schema, owned MongoDB database, real migrations and API process, deterministic cleanup. Browser account and identity calls and operations are forwarded to that API; secondary request clients use its exact origin. No credentials, private recovery code, database URL or authentication trace is retained in test artifacts. Discovery creates no fixtures or source traffic. New execution evidence belongs in the root status record; authored cases are not claimed as passes.

Manual visual acceptance, separate from automated API correctness: at 390px and a desktop width, read the source-date text and long original evidence, verify controls remain reachable without page-level horizontal scrolling, check visible keyboard focus and return navigation, and inspect loading, empty, source-failure/retry and saved-edition states. If the identity is older than seven days, the dated-reference notice must remain visible. A physical Android phone must also demonstrate search/history/evidence and Back in airplane mode after installing the updated bundle; automated browser passes do not establish physical-device acceptance.
