# EVENT-LINEAGE-001 authoring handoff

Authored in the shared working tree; verification and local commit are pending the user's manual SDLC run. No dependency, provider, test, format/check, build, migration, service or commit execution was performed. Last inspected local commit: `b5cfcd0` (`pending features`); no new commit was made. Numerous pre-existing and parallel changes remain uncommitted; this handoff does not claim ownership of all working-tree changes.

## Manifest

New feature files: `packages/contracts/src/event-lineage.ts`, `infra/migrations/046_event_lineage.sql`, `apps/api/src/event-lineage.ts`, `apps/web/src/EventLineageOperations.tsx`, `EventLineagePlanView.tsx`, `EventLineage.tsx`, `event-lineage.css`, `scripts/event-lineage-snapshot.mjs`, this document and `docs/product/event-lineage.md`.

Additive seams: contracts index; NamedOperatorStore.require and OperatorStore.permission optional current-client admission (avoids nested same-pool checkout while preserving wall-clock authorization); API events ordinary save/review supersession guards and public evidence helper; named-operators contract union, publication-proposals creation/approval, ProposalInspection; public Events component; offline/events and optional offline/types bundle field; offline-snapshot capture. Parent registered API controller/provider, migration046 and Operations guarded component. Preserve all other concurrently authored source, consent, report and financial changes when reviewing the diff.

The separately requested ECB FX named seams are also saved in the three named contract/controller/inspection files: kind `ecb-fx`, target `ecb-reference-fx`, `ECB_FX_STORE`/`EcbFxStore`, actual head version/edition plus unused request identity checks. Source agent owns045/provider/source cases.

## Cases and manual actions

New API830–835, WEB830–831, OFFLINE830–831 all carry `@EVENT-LINEAGE-001`. Files: API `event-lineage.spec.ts`, `event-lineage-named.spec.ts`; browser/offline `event-lineage.spec.ts`; helper `event-lineage.ts`; contract `event-lineage.test.mjs`; unit `event-lineage-snapshot.test.mjs`.

No new dependencies. With PostgreSQL/MongoDB and the configured API/web prerequisites available, the user runs `pnpm build`, `pnpm db:migrate` to apply registered additive migrations through046, and `pnpm dev` as needed. Select these IDs in the connected API/desktop/mobile runner. For device-only cases first run `pnpm android:web`, then `pnpm android:test --grep @EVENT-LINEAGE-001`. Web workflow starts at the printed web URL `/#ops` → Merge/split events; public routes are `/#events/:id`. Snapshot propagation is the existing user-run offline snapshot/Android build workflow; no claim is made that the current packaged APK contains this new feature.

The focused connected command is `E2E_BROWSER=chrome pnpm sdlc "Implement reviewed event merge and split" -- --grep @EVENT-LINEAGE-001`. It owns format/check, the gated commit and selected E2E; inspect its selected files before committing the larger shared worktree. Expected outcomes are exact immutable replay, all-or-nothing publication, original history preservation, distinct-ID named approval, safe unavailable target display, usable review/Back/401 recovery and no offline API traffic. Report run ID, selected projects/cases and redacted error-context on failure; operator credentials must not be included in artifacts.

Plan rejection is handled by existing named decisions; reopening is an explicit new request, not mutation of the rejected decision. No new lineage-specific held source-lock expiry case has been executed or claimed. Public restructuring reasons are intentionally reviewed public text; source bodies and operator metadata are not copied into public relation payloads. Private exports remain unchanged because lineage stores no account-owned data and never migrates existing private references.

Peer corrections add strict plan/receipt and public membership consistency, known-change snapshot refusal, and API835’s actual three-client protected read gate with complete response draining. Snapshot and contract goldens are definitions, not verification evidence.

`EventStore.saveIn(client, id, body, authorize)` exposes the unchanged normal draft body for the adjacent extraction receipt transaction; `save` remains its transaction wrapper. This helper never publishes and retains supersession, exact source/identity and final admission checks.
