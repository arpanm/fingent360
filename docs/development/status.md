# Current implementation and verification status

## UX-001 — current correction

Implemented and verified for the existing account workflows. The new authenticated overview read model joins saved goals, holdings, watchlist and inbox under one repeatable-read transaction. Responsive navigation and guided forms connect overview, account, holdings, goals, research/inbox and privacy. Runtime schema validation, exact money, ownership and provenance remain enforced. Migrations001–009 are reused; no dependency installation or new migration was required. Documentation specifies all delivery layers and audits every DEV/SRC parent's remaining scope.

`pnpm format` and `pnpm check` passed, including 40 unit tests, lint, type checks and builds. Full `pnpm e2e:run` artifact ID `2026-09-12T17-03-42-614Z-70343` (handoff ID `1789232623309-12af3cff-d986-401e-b6ae-5361b97a0c11`, started 2026-09-12T17:03:43Z): 69 selected/completed executions, 68 passed, zero failed, one intentional E2E-API-004 outage skip. Projects: API, desktop and mobile. Targets: web http://127.0.0.1:5175, API http://127.0.0.1:4103. Reports remain under artifacts/e2e; latest.md is overwritten by future runs. No hosted CI or deliberate database outage was run for UX-001.

Browser inspection covered guest/populated overview, goal cards/editor, holdings, macro context and account at desktop and narrow mobile widths. WEB111 verifies keyboard/menu/skip-link/route-focus/header clearance and viewport containment. Integration testing found and corrected stale initial-load overwrites and delayed goal autofocus; WEB063/093 hold real API responses to test those races. WEB110 verifies real registration → goal → holdings → saved overview. These checks establish the tested behavior, not full WCAG certification or user design acceptance. Broader roadmap work remains explicitly open.

## Implemented baseline before UX-001

Source modules provide NestJS/React contracts and persistence for accounts/watchlists, real World Bank annual India GDP/CPI observations and raw evidence, inbox receipts/mutes, user-entered holdings/CSV, saved contribution-only goals, privacy exports/sessions, source registry revisions and a neutral offline fallback. Migrations001–009 and a checksum ledger support their relational data. The separate synthetic journey remains explicitly fictional. API health/readiness and user-invoked SDLC/E2E tools exist.

Historical TEAM-001 run `2026-09-12T16-09-40-894Z-64656`: 51 passed, zero failed, one intentional manual database-outage skip; format/check passed with 40 unit tests. Migrations001–009 and repeat ledger application were verified in that batch. This evidence predates current UX edits and cannot verify them. Historical BUG-006 run `2026-09-12T15-42-10-408Z-58293`: 32 passed, zero failed, one outage skip, covering the earlier responsive macro-table correction. Source/task history in TODO retains earlier authored and user-reported states; those entries are not current runtime assertions.

## Remaining scope

See [full delivery audit](delivery-matrix.md) for all DEV-001–030 and SRC-001–027 parents. Main gaps: verified Indian security master/prices/actions, real portfolio valuation, broader sources and event/company intelligence, durable jobs/reports, complete educational policy and operational/identity hardening. Full PWA/accessibility acceptance remains broader than the minimal offline worker. Advice requires legal/operating-model approval; brokers require actual provider entitlement/consent; later assets/channels and monetization have explicit gates. Many engineering tasks remain implementable independently and must not all be described as externally blocked.

## Verification rules

A committed change is not proof of tests or user acceptance. Format/check must pass before commit. Default command execution is manual; current UX-001 has explicit parent testing authorization. Handoffs state exactly what ran and did not run, run IDs/cases/targets, migration impact, commit scope and remaining uncommitted work. Do not carry old localhost ports forward: use current launcher output. No automatic push.

## Historical foundation context

The initial foundation was tested locally on Node26.7.0/pnpm11.23.0 before later SDLC changes. That included bootstrap preservation, health/readiness and basic desktop/mobile connectivity; it was not evidence for current feature completeness. CI's Node24 baseline and workflow definition are not proof of a hosted CI run. The repository was created from reviewed requirements rather than importing the earlier chat's blocked bundle. Historical market figures were never accepted as live facts.
