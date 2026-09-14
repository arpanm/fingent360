# Roadmap audit handoff

**Current update:** DELIVERY-RECONCILE-002 completed the explicitly authorized local setup: runtime role configured/active,035/036 applied, and API readiness200. [Actual activation and current user command](local-database-activation.md). Earlier authoring-only statements below describe the initial handoff, not the present local state.

ROADMAP-AUDIT-001 reconciles implementation status against original acceptance. It does not certify every roadmap feature complete. TODO is authoritative; roadmap-gaps.md records evidence and unfinished acceptance. Partial means working children plus named missing implementation, not active coding or a generic external block. Implemented means authored acceptance is present; validation and commit remain separate.

## Delivered changes

DEV001/002 documentation now describes the existing account, import, reading, Operations and private-data workflows, with a current threat model and explicit remaining protections. DOMAIN-CONTRACTS-002 fills DEV003's reusable schema/golden-fixture categories without pretending to implement real event/company/policy consumers. PUBLISHING-QUEUE-001 adds the stored-data API and responsive 20-head queue, strict filters/cursors, exact review continuity and offline connected-only behavior. DB-LEAST-PRIVILEGE-001's separate handoff describes migration-owner versus application credentials and the explicit provisioning procedure.

Earlier pending SourceReview, BEA recovery/migration035, operator read-admission and legacy fixture isolation changes are preserved. Integration updates WEB484/521 to observe the new queue, and WEB501 to retry its error then recover the durable staging receipt. WEB501 keeps the fault active until observed rather than racing StrictMode's mount reads. API520 compares stable feed content while separately accepting a newly evaluated timestamp; it still compares all substantive feed fields.

## User-run validation and commit

No dependencies changed. No formatter, lint/typecheck, unit/E2E test, build, migration, service operation, role provisioner, APK build or commit was run for this audit. Existing HEAD remains 6f2b508. The working tree includes both this request and the preceding pending integration; pnpm sdlc stages all non-ignored changes after format/check pass, so review that whole batch before invoking it. No push.

Use existing configured PostgreSQL/MongoDB and app. Build and apply the pending migration before validation, as user-run commands:

```bash
pnpm build
pnpm db:migrate
```

To enable separate runtime credentials, follow database-least-privilege-handoff.md and privately configure the two URLs; preview then apply via pnpm db:roles. Existing fallback credentials remain compatible but are not least-privilege deployment. Dedicated role cases need owner CREATE ROLE and CREATE SCHEMA permission; they provision only their owned fixture role/schema. No real environment file was changed by the author.

Start/restart pnpm dev yourself if needed and use its printed URL at /#ops. The last reported web URL was http://127.0.0.1:5175, not a freshly verified running target. In Publishing review filters/pages/keyboard/recovery and exact saved receipts. Then run the gated workflow with the relevant selection:

```bash
E2E_BROWSER=chrome pnpm sdlc "Complete roadmap audit and pending integrations" -- --grep 'PUBLISHING-QUEUE-001|DB-LEAST-PRIVILEGE-001|SOURCE-REVIEW-DIFF-001|BEA-QUARANTINE-001|OPS-READ-ADMISSION-001|LEGACY-FIXTURE-ISOLATION-001|E2E-WEB-484'
```

This runs format → check → local commit → selected E2E. It never pushes; an E2E failure retains the completed commit. Pure contract golden cases run through check. Keep watch/eye mode off. Expected behavior and case IDs are recorded in each child handoff and CATALOG, not inferred test passes.

Device-only queue coverage is OFFLINE550. Use the existing user-run packaged offline workflow after rebuilding; an installed APK remains unchanged until rebuilt/reinstalled. No phone result is claimed. On failure share artifacts/e2e/latest.md and the first safe assertion/case/project; never share keys or connection strings.

## Remaining product work

Verified event/company traces, real evidence policy/explanations, materiality/calendar alerts, broader source data, risk-feasibility, security/operations hardening and platform-specific import dialects remain explicit Partial/Planned work. Deferred assets/channels and gated advice retain their accepted sequence. The five initial platform names/authorized formats are still requested; standard CSV/XLSX support is already credited. Do not relabel those parents complete because these foundational gaps were closed.
