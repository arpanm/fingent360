# IDENTITY-ADJUDICATION-001 handoff

Authoring in the shared main working tree; verification remains pending. No tests, builds, format/check, install, migration, provider request, service action or commit was executed. Last inspected HEAD is `b5cfcd0`; pre-existing and parallel changes remain uncommitted and must be reviewed separately by the user-run SDLC command.

## Files and integrations

New contracts `packages/contracts/src/identity-selection.ts`, migration `048_identity_adjudication.sql`, API `identity-selection.ts`, web `IdentitySelectionOperations.tsx`/`IdentitySelection.tsx`, snapshot helper `scripts/identity-selection-snapshot.mjs`, product spec and this handoff. Parent registers the API controllers/provider, migration and Operations tab. No dependencies changed.

Additive shared seams: contracts index, event instrument-link receipt/runtime reconstruction, named proposal schema/dispatch/target inspection, EventStore evidence admission, EventOperations candidate choices/explicit judgement display, Securities detail, public Events disclosure, offline securities/events/types and snapshot event/selection capture. Preserve adjacent extraction, lineage, numerical sources, consent, reports and financial changes when reviewing these shared files. `EventStore.saveIn` remains the shared normal-draft transaction path.

No private export/deletion schema changes: these records are public editorial identity decisions, contain no investor account fields and never migrate private data. Existing raw OpenFIGI records/resolution remain unchanged.

## Authored acceptance

API870: real isolated ambiguous provider fixture → select/replay → event using selected second candidate → withdraw → event unavailable, provider unchanged. API871: fabricated candidate/stale provider refusal. API872: competing approvals consume one base. API873: empty unresolved result refusal. API874: named different-identity approval/direct/self denial/replay. API875: actual provider-head lock wait followed by session expiry,401 and rollback. WEB870: guided candidate review/Back/save/apply and separate public provider/judgement/history; WEB871: actual revoked operator clears protected panel. WEB872: real held200 history response shows bounded loading and explicit empty-state recovery. WEB873: real competing decision forces explicit discard/reload, then a usable new-base plan. OFFLINE870: direct actual local handlers preserve raw ambiguity and unrelated owned state; withdrawal makes selected event unavailable without fetch. OFFLINE871: packaged route cold reload and connected-only operation refusal, zero API traffic. Two contract goldens and two snapshot goldens cover binding and inconsistent/changed capture.

All cases carry `@IDENTITY-ADJUDICATION-001`. Fixtures are clearly synthetic candidates stored only in isolated test databases; they are not production provider evidence. Cases are authored, not executed or claimed passing.

## Exact manual next actions

No install needed for this child. With the existing PostgreSQL/MongoDB setup, run `pnpm build`, `pnpm db:migrate`, then `pnpm dev`. This applies the pending registered additive migrations through048 with the configured migration owner. Open the printed web URL → `/#ops` → Identity selections. Use `/#securities/:ISIN` for the public provider/selection distinction; Event review explicitly shows selected editorial identity basis.

Run `E2E_BROWSER=chrome pnpm sdlc "Implement reviewed identity candidate selection" -- --grep IDENTITY-ADJUDICATION-001`. This runs format/check, the gated local commit and API870–875 plus WEB870–873 on desktop/mobile. Inspect the broader working tree first because SDLC stages all nonignored changes. For packaged offline acceptance, run `pnpm android:web`, then `E2E_BROWSER=chrome pnpm android:test --grep IDENTITY-ADJUDICATION-001` for OFFLINE870–871. Snapshot/APK propagation uses the existing manual capture/build/reinstall workflow, not an automatic runtime update. No agent execution or push.

Expected: raw ambiguous identity remains ambiguous, no invented candidate, explicit independent named decision, stale/withdrawn selections cannot admit events, receipts/history survive, no private financial changes, and no offline network. For failure report run ID, chosen IDs/projects and redacted error-context; never copy operator credentials or private statements.
