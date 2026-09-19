# Complete validation inventory repair — 19 September 2026

## Saved run and scope

Inspected SDLC run `1789752953639-97020`, committed by the user workflow as `8b5d817` (Audit all pending validation). Format/check passed in that run. Connected log `06-pnpm-e2e_run.log` records 104 failures, 1188 passes and one skip; offline log `08-pnpm-android_test.log` records 15 failures and 187 passes. The later offline handoff is run `1789760139774-98edc942-99ee-445a-b31e-fb270cec37af`, started 2026-09-18T19:35:39.774Z, with 202 completed attempts. Connected web target was http://127.0.0.1:5176; offline preview was http://127.0.0.1:61142. These historical passes do not verify the new changes.

This failure is not the earlier mixed-revision acceptance-only failure: these are actual failing test attempts. Automatic repair was disabled for the full inventory as requested by the prior handoff. The bugs remain open until an actual successful retry is recorded.

## Root-cause records

- [API and shared helpers](full-audit-api-2026-09-19.md): method-level operator permissions, independent publication prerequisites, encrypted retention fixtures, JSON calendar seed, channel/source handling and related API failures.
- [Connected browser](full-audit-browser-2026-09-19.md): exact accessible controls, current navigation/empty states, isolated source data and real browser authentication.
- [Offline and browser-session follow-up](full-audit-offline-2026-09-19.md): preserved404/503/405 calendar outcomes, actual account deletion gate, broker guide selection, on-device mode and authenticated channel flows.

Feedback encryption maintenance also omitted the POST method, causing fetch to reject its GET-with-body before the API ran. The shared web/app action now sends POST; WEB1256 asserts the real201 response and confirmation reset.

Additional parent-owned causes and changes:

| Cases                              | Evidence and repair                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OFFLINE1502,1394,1020,1021,1470    | The saved Zod errors occur immediately after fixture publication. Event graph nodes were published while linked edges remained candidate. Each affected synthetic fixture now requires nonempty edges and marks them reviewed before strict EventPublicSchema parsing. The production schema and rejection assertions are unchanged.                                                                                                                                                                                         |
| API1850,1851; WEB1850; OFFLINE1850 | The retained original Cleveland chart includes four marker-style fields on actual-value series. The parser rejected the complete document even though it selects the separate model series. Explicit bounded optional fields now admit the observed marker format; unknown fields and malformed styling still fail, and exact value/vintage/tooltip reconciliation remains mandatory. API1851 additionally asserts exact model precision and rejects unknown or invalid marker fields. No source bytes are edited.           |
| API359, companion API360           | A malformed report snapshot raised ZodError inside AccountStore.transaction, which converted it to storage503 before worker classification. The worker now preserves only schema-preparation failures as a safe typed error through that boundary; encryption/ownership/database failures retain storage classification. API359 additionally checks the failed attempt remains queued once with released lease and original snapshot; the existing API360 storage-write failure/retry is included as a companion regression. |

## Manual retry

With the configured migrated databases and current API/web services ready:

```sh
SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016
```

The reviewed matrix contains the 82 case IDs covering all119 failed case/project combinations, plus API360 to guard the worker's storage classification. It executes full gates and a gated local commit, then the selected connected IDs and freshly built selected offline IDs. Current selectors run on their configured projects. This avoids repeating 1375 already-passing cases. It does not certify all functional stories from a subset; their full acceptance matrices and native/external requirements remain intact. No dependencies or migrations are added by this batch.

The existing recorder updates per-story evidence and bug status on actual results. On failure provide the new run ID or ask to read artifacts/e2e/latest.md and the matching SDLC log; no screenshots need copying. New repairs are authored only: no agent format/check/test/build/service/migration execution, commit or push. All prior generated tracker/bug changes are preserved. This file provides explicit RCA links; the general bug recorder still does not enforce a structured RCA for every future failure.
