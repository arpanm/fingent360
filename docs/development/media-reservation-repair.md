# SDLC-REPAIR-008 — media reservation fixture

The supplied September15 `pnpm check` output reports105 passing API unit cases and one failure at media.test.mjs:175: the second preparation did not reject. This evidence applies only to the supplied run; no suite report was read and no new validation was executed.

The existing test replaces the PostgreSQL pool with a fixture exposing only connect/end. Media generation now calls the real evaluation recorder, which requires pool.query before invoking the provider. That missing method throws; generation catches it and saves its source-template fallback. The second request then returns the existing asset, so the concurrent409 assertion fails. This is a stale fixture interface, not evidence that the production reservation should be relaxed.

The repair supplies pool.query on that existing fixture and records its statements. The real MediaStore, evaluation recorder and provider response parser remain exercised. All original assertions remain. Added assertions cover the evaluation insert before provider invocation, source/version/provider/model binding, absence of an asset while generation is pending, raw and selected output under one call ID, and replay without another recording or charged call. The fixture remains synthetic and does not establish real PostgreSQL concurrency or provider availability.

## Manual validation

From the repository root, using the compiled API already produced by the failed check:

```sh
pnpm --filter @fingent360/api exec node --test --test-name-pattern='^durable prepare reservation prevents a second charged call and reuses immutable asset$' test/media.test.mjs
```

Expect the selected case to pass, including409 for concurrent preparation, exactly one provider invocation and three recording statements with no replay writes. Existing dependencies suffice; no install, database, service, migration, provider credentials or UI URL is needed. If compiled code has changed since the failure, the parent/user-owned `pnpm check` rebuilds it and retries the reported gate. No SDLC invocation or commit is required by this repair handoff.

On failure, report the exact command, exit status and selected assertion/stack only. Formatting, checks, builds and tests remain unrun by the repair agent. No new product behavior, API/browser E2E case, contract, schema, automation or UI/keyboard/mobile/visual change is involved; existing integration coverage remains separate and is not claimed as passing.
