# DATA-001 real macro data

This feature calls the real World Bank API from the backend, stores source JSON in MongoDB and exact decimal observations in PostgreSQL, then exposes them through the API and the default React screen. There is no application fixture fallback. Source ingestion happens only when a user clicks Refresh or runs a selected E2E case.

## Manual setup

No dependencies changed. With the existing .env and databases:

```bash
pnpm research:setup
pnpm db:up
pnpm format
pnpm check
pnpm db:migrate
pnpm dev
```

Stop the existing dev terminal before restarting it to load the newly generated operator key. `research:setup` adds a random RESEARCH_ADMIN_TOKEN to .env without printing it and preserves an existing valid key. The API defaults to loopback. This operator key is a local administrative control, not end-user account authentication or a production deployment design.

Open http://localhost:5173/#macro. Expand Source refresh controls and enter RESEARCH_ADMIN_TOKEN from your local .env (never share it). Click each source's Refresh button. You should see real annual values with observation years, last successful check, attribution and source status. Expand annual observations, inspect revision history and stored source JSON, then reload to confirm persistence. No hardcoded expected live values are used.

```bash
E2E_BROWSER=chrome pnpm e2e:ui
```

In http://127.0.0.1:9323 filter @DATA-001, select api/desktop/mobile and manually click Run. Tests read the local operator key only while executing and make real upstream requests. Traces/video/screenshots are disabled for these cases to avoid recording the key. If a case fails, share its ID/project and safe error message, not the key or .env. A provider outage should fail these cases visibly; it must not silently pass with a fixture.

## Data and failure semantics

- Only the two allowlisted World Bank India annual percentage indicators can be fetched; redirects and arbitrary URLs are rejected. Requested years span 2000 through the current year, up to 100 records; incomplete pagination rejects rather than partially publishing.
- Source numeric tokens are preserved via Node's JSON reviver source context. Decimal exponent expansion uses string arithmetic. PostgreSQL NUMERIC(48,30) stores canonical numbers. Null stays unavailable; no default zero.
- Accepted raw JSON is persisted before a transaction promotes observations. If promotion fails, unreferenced source JSON may remain for diagnosis; no partial canonical batch becomes visible. Invalid provider schemas are quarantined in MongoDB, never exposed as accepted evidence.
- Refreshes serialize per indicator using a PostgreSQL session advisory lock. Identical values keep their revision/ID; changed or withdrawn values append revisions referencing their predecessors. Every refresh has a durable status record. A process interruption is recorded as failed at the next refresh. A successful fetch within 60 seconds is reused to limit repeated provider calls.
- A successful source check becomes due after seven days. This cache-check rule is independent of annual observation age; “recently checked” never means a fresh monthly release. Observation-level provider update and retrieval timestamps are retained. Original release/known-at times are not inferred, so these data are not point-in-time backtesting inputs.
- A failed refresh leaves previous accepted observations visible together with the failed run status. No notification worker, retry loop, cron, automatic startup sync or LLM is involved.
- Canonical observation evidence links are checked against PostgreSQL before serving MongoDB raw content; quarantined or unreferenced documents are not public. Bodies render as plain text.

## Source evidence and bounds

Reviewed 2026-09-12: [GDP growth, India](https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=IN) and [consumer-price inflation, India](https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=IN) each identify CC BY 4.0. The implementation displays their source attribution and links to [World Bank dataset terms](https://data.worldbank.org/summary-terms-of-use), which also cover API access and additional conditions. No World Bank endorsement is claimed. [API documentation](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures) informs the adapter.

This completes a bounded real-source feature, not all of SRC-007 or the product. RBI/MOSPI monthly releases, live Indian equity prices, security master, portfolio valuation from real sources, authenticated real accounts and broader source approvals remain their original tasks. Do not promote those tasks to complete because this source is implemented. Runtime verification remains manual and pending.
