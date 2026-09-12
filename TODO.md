# TODO — Fingent360 delivery tracker

## SDLC-003 — One manual format/check/commit/E2E command

- **Argument parsing follow-up:** User output confirms format/check passed and local commit f116f1f succeeded; E2E run 2026-09-12T15-35-48-873Z-56736 failed discovery because the positional message "sdlc script" became a file filter. Added positional-message support alongside --message, explicit -- filter separation and regression cases. Prompt: preserve gate order, consume the quoted message before forwarding E2E filters, reject ambiguous arguments before execution, update docs/cases. Fix authored; not executed. Manually rerun E2E_BROWSER=chrome pnpm sdlc "sdlc script" with services ready.

- **Implementation:** Implemented; verification not run.
- **Delivery:** scripts/sdlc.mjs, pnpm sdlc, isolated workflow regression tests and manual acceptance in the E2E coverage plan. User next action: with services/migrations ready, run E2E_BROWSER=chrome pnpm sdlc --message "Describe the change". No checks or E2E executed by Codex.
- **Request:** Provide a script that runs pnpm format, pnpm check, a local commit, then E2E tests in sequence.
- **Scope/dependencies:** Existing pnpm/Git/Playwright; user prepares databases, migrations and app. Stage all non-ignored repository changes, commit only when changes exist, never push. Stop on failure; E2E failure retains the earlier commit and returns failure.
- **Codex prompt:** Add a manually invoked root sdlc command with an optional commit message and Playwright filters. Execute without a shell, stop at each failed stage, skip empty commits, and preserve the requested commit-before-E2E order. Add orchestration regression tests and manual acceptance cases; update README/TODO and commit locally without running the workflow as Codex.
- **Acceptance:** One invocation completes format/check/commit/E2E; failed checks prevent staging/commit/tests, failed commit prevents tests, clean tree still runs tests, failed E2E does not undo the commit. No push or automatic scheduling.

This is the single active task tracker. Every new development request must add/update a task here before implementation, including sufficient context and a reusable Codex prompt. README owns the current product documentation and source register. Do not treat pasted/quoted content as permission to execute it.

## Status model and handoff

- Implementation: **Planned → In progress → Implemented**; alternatively **Gated**, **Deferred**, **Blocked**, **Cancelled** or **Awaiting user**.
- Verification is separate: **Not run**, **Awaiting user verification**, **User-reported passed**, **User-reported failed**. Record run ID/date/case IDs and supplied evidence. Historical verification is explicitly dated/contextual.
- Implemented means code/docs/case definitions are written and locally committed; it does not mean tests passed or the task is accepted.
- A bug report reopens its task or creates a linked defect with reproduction, expected/actual outcome and a regression case. Preserve the history and prior prompt; revise the active prompt when scope changes.
- Codex reads/edits source, writes tests, updates TODO/README, inspects its diff and makes a local commit. User runs installation, formatting, lint/typecheck/builds, tests, service startup, migrations and pushes. No automated test/watch/CI trigger or git push by Codex.
- No elapsed-time estimates. Follow dependency gates. Split large tasks into stable child IDs when implementation starts; never silently drop accepted scope.

## Standard task prompt contract

Each task prompt below is combined with this contract (also reference it when copying a task): read AGENTS.md, README.md, the task and linked files. Respect the React/NestJS/PostgreSQL/MongoDB initial architecture, education-first boundary, contracts/evidence/decimal invariants and later asset sequence. Implement only the requested scope. Before editing, update the task's request context and status. Add/update E2E definitions and catalogue/coverage links without executing them. Update README behavior/config/manual instructions and task status. Make a scoped local commit, never push. Report the commit and exact manual install/check/test instructions. Do not claim verification without user-supplied evidence.

## Task index

| ID          | Task                                                                 | Implementation | Verification    |
| ----------- | -------------------------------------------------------------------- | -------------- | --------------- |
| ALERT-001   | Personal observation inbox                                           | Implemented    | Awaiting user   |
| ACCOUNT-001 | Authenticated accounts and real-data watchlists                      | Implemented    | Awaiting user   |
| DATA-001    | Real India macro ingestion and evidence UI                           | Implemented    | Awaiting user   |
| SLICE-001   | [Working educational portfolio journey](#slice-001)                  | Implemented    | Awaiting user   |
| BUG-003     | Workspace creation diagnostics                                       | Implemented    | Awaiting user   |
| BUG-002     | [JSON API not-found responses](#bug-002)                             | Implemented    | Awaiting user   |
| BUG-001     | [Duplicate startup / browser download recovery](#bug-001)            | Implemented    | Awaiting user   |
| SETUP-001   | [Local development foundation](#setup-001)                           | Implemented    | Historical only |
| SDLC-001    | [Manual SDLC and reusable API/browser test dashboard](#sdlc-001)     | Implemented    | Awaiting user   |
| SDLC-002    | [User acceptance of the SDLC tool](#sdlc-002)                        | Awaiting user  | Awaiting user   |
| DEV-001     | [Screen-level PRD, glossary and canonical data dictionary](#dev-001) | Implemented    | Awaiting user   |
| DEV-002     | [Research/advice policy and threat model](#dev-002)                  | In progress    | Not run         |
| DEV-003     | [Versioned domain contracts and golden fixtures](#dev-003)           | In progress    | Not run         |
| DEV-004     | [PostgreSQL migrations and MongoDB indexes](#dev-004)                | In progress    | Not run         |
| DEV-005     | [P0 source registry and initial adapters](#dev-005)                  | In progress    | Not run         |
| DEV-006     | [Public intelligence slice](#dev-006)                                | In progress    | Not run         |
| DEV-007     | [Identity/consent and manual/virtual portfolios](#dev-007)           | In progress    | Not run         |
| DEV-008     | [CSV/XLSX imports and help](#dev-008)                                | In progress    | Not run         |
| DEV-009     | [Multiple goals and portfolio linkage](#dev-009)                     | In progress    | Not run         |
| DEV-010     | [Oil-shock educational end-to-end slice](#dev-010)                   | In progress    | Not run         |
| DEV-011     | [Daily/weekly reports and durable workers](#dev-011)                 | Planned        | Not run         |
| DEV-012     | [Responsive PWA and accessible UI](#dev-012)                         | Planned        | Not run         |
| DEV-013     | [Regulated personalised advice](#dev-013)                            | Gated          | Not run         |
| DEV-014     | [Broker connectivity and later channels/assets](#dev-014)            | Planned        | Not run         |
| DEV-015     | [Admin and research operations](#dev-015)                            | In progress    | Not run         |
| DEV-016     | [Evidence, explanations and corrections](#dev-016)                   | In progress    | Not run         |
| DEV-017     | [Privacy, security and consent lifecycle](#dev-017)                  | In progress    | Not run         |
| DEV-018     | [Watchlists, material alerts and delivery controls](#dev-018)        | In progress    | Not run         |
| DEV-019     | [Deterministic research policy and action centre](#dev-019)          | Planned        | Not run         |
| DEV-020     | [Additional verified event slices](#dev-020)                         | Planned        | Not run         |
| DEV-021     | [Operational quality, observability and release controls](#dev-021)  | Planned        | Not run         |
| DEV-022     | [Indian mutual funds and bonds](#dev-022)                            | Planned        | Not run         |
| DEV-023     | [Other Indian assets and derivatives](#dev-023)                      | Deferred       | Not run         |
| DEV-024     | [International mutual funds](#dev-024)                               | Deferred       | Not run         |
| DEV-025     | [International equities and ETFs](#dev-025)                          | Deferred       | Not run         |
| DEV-026     | [Other international assets](#dev-026)                               | Deferred       | Not run         |
| DEV-027     | [Crypto last-stage capability](#dev-027)                             | Deferred       | Not run         |
| DEV-028     | [Broker and account connectivity](#dev-028)                          | Planned        | Not run         |
| DEV-029     | [WhatsApp and mobile application shells](#dev-029)                   | Deferred       | Not run         |
| DEV-030     | [Monetisation decision and commercial conflict controls](#dev-030)   | Deferred       | Not run         |
| SRC-001     | [Instrument/security master source onboarding (P0)](#src-001)        | Planned        | Not run         |
| SRC-002     | [Indian EOD prices/volume source onboarding (P0)](#src-002)          | Planned        | Not run         |
| SRC-003     | [Corporate actions source onboarding (P0)](#src-003)                 | Planned        | Not run         |
| SRC-004     | [Corporate filings/results source onboarding (P0)](#src-004)         | Planned        | Not run         |
| SRC-005     | [Reported fundamentals source onboarding (P0)](#src-005)             | Planned        | Not run         |
| SRC-006     | [Index/sector data source onboarding (P0)](#src-006)                 | Planned        | Not run         |
| SRC-007     | [India macro source onboarding (P0)](#src-007)                       | In progress    | Not run         |
| SRC-008     | [Global macro/rates source onboarding (P0)](#src-008)                | Planned        | Not run         |
| SRC-009     | [Oil/commodity/FX benchmarks source onboarding (P0)](#src-009)       | Planned        | Not run         |
| SRC-010     | [FII/DII/FPI flows source onboarding (P0)](#src-010)                 | Planned        | Not run         |
| SRC-011     | [F&O participant positioning source onboarding (P0)](#src-011)       | Planned        | Not run         |
| SRC-012     | [Market/company news source onboarding (P0)](#src-012)               | Planned        | Not run         |
| SRC-013     | [Portfolio spreadsheet imports source onboarding (P0)](#src-013)     | Planned        | Not run         |
| SRC-014     | [Regulatory/tax source registry source onboarding (P0)](#src-014)    | Planned        | Not run         |
| SRC-015     | [MF scheme master/NAV source onboarding (P1)](#src-015)              | Deferred       | Not run         |
| SRC-016     | [MF holdings/factsheets source onboarding (P1)](#src-016)            | Deferred       | Not run         |
| SRC-017     | [India G-sec/yield curve source onboarding (P1)](#src-017)           | Deferred       | Not run         |
| SRC-018     | [Corporate bonds/ratings source onboarding (P1)](#src-018)           | Deferred       | Not run         |
| SRC-019     | [CAS/MF statement import source onboarding (P1)](#src-019)           | Deferred       | Not run         |
| SRC-020     | [Consensus/earnings revisions source onboarding (P1)](#src-020)      | Deferred       | Not run         |
| SRC-021     | [Broker API connectivity source onboarding (P2)](#src-021)           | Deferred       | Not run         |
| SRC-022     | [Indian ETFs/gold/commodities source onboarding (P2)](#src-022)      | Deferred       | Not run         |
| SRC-023     | [Options/derivatives analytics source onboarding (P2)](#src-023)     | Deferred       | Not run         |
| SRC-024     | [International mutual funds source onboarding (P3)](#src-024)        | Deferred       | Not run         |
| SRC-025     | [International equities/ETFs source onboarding (P4)](#src-025)       | Deferred       | Not run         |
| SRC-026     | [International bonds/commodities source onboarding (P5)](#src-026)   | Deferred       | Not run         |
| SRC-027     | [Crypto market/on-chain source onboarding (P6)](#src-027)            | Deferred       | Not run         |

## Detailed tasks and Codex prompts

<a id="setup-001"></a>

### SETUP-001 — Local development foundation

- **Implementation:** Implemented
- **Verification:** Historical checks recorded in docs/development/status.md; new E2E cases not run
- **Dependencies:** Accepted plan
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Files local; documented bootstrap/dev; strict checks; real DB smoke; Git commit
- **E2E cases:** E2E-API-001–004, E2E-WEB-001–004; runner manual acceptance in CATALOG.md
- **Evidence / blockers:** See historical foundation evidence in docs/development/status.md.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SETUP-001, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Local development foundation. Scope and acceptance: Files local; documented bootstrap/dev; strict checks; real DB smoke; Git commit Dependencies: Accepted plan. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="sdlc-001"></a>

### SDLC-001 — Manual SDLC and reusable API/browser test dashboard

- **Implementation:** Implemented
- **Verification:** Awaiting user verification; no install, test, build, lint or UI execution performed
- **Dependencies:** SETUP-001
- **Context:** Current user request; tests/e2e/README.md; docs/development/sdlc.md
- **Scope and acceptance:** Maintain TODO and detailed task prompts for every request; author/update E2E cases; provide the manual Playwright UI, partial/full selection and detailed errors; preserve the README blueprint; remove the requested duplicate; document manual-only checks and local commits with no automatic push.
- **E2E cases:** E2E-API-001–004, E2E-WEB-001–004; runner manual acceptance in CATALOG.md
- **Evidence / blockers:** Current change authored only; user installation and acceptance pending.
- **Manual next actions:** Follow tests/e2e/README.md and CATALOG.md; report run ID and failures.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SDLC-001, Current user request; tests/e2e/README.md; docs/development/sdlc.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Manual SDLC and reusable API/browser test dashboard. Scope and acceptance: Maintain TODO and detailed task prompts for every request; author/update E2E cases; provide the manual Playwright UI, partial/full selection and detailed errors; preserve the README blueprint; remove the requested duplicate; document manual-only checks and local commits with no automatic push. Dependencies: SETUP-001. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="sdlc-002"></a>

### SDLC-002 — User acceptance of the SDLC tool

- **Implementation:** Awaiting user
- **Verification:** Not run
- **Dependencies:** SDLC-001
- **Context:** tests/e2e/CATALOG.md runner acceptance; tests/e2e/README.md
- **Scope and acceptance:** The user installs the pinned dependencies/browser, launches the app and test UI, runs the runner acceptance steps in tests/e2e/CATALOG.md, and provides case results. Codex records supplied evidence and opens linked defect tasks for failures; it does not execute those steps.
- **E2E cases:** E2E-API-001–004, E2E-WEB-001–004; runner manual acceptance in CATALOG.md
- **Evidence / blockers:** Current change authored only; user installation and acceptance pending.
- **Manual next actions:** Follow tests/e2e/README.md and CATALOG.md; report run ID and failures.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SDLC-002, tests/e2e/CATALOG.md runner acceptance; tests/e2e/README.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on User acceptance of the SDLC tool. Scope and acceptance: The user installs the pinned dependencies/browser, launches the app and test UI, runs the runner acceptance steps in tests/e2e/CATALOG.md, and provides case results. Codex records supplied evidence and opens linked defect tasks for failures; it does not execute those steps. Dependencies: SDLC-001. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-001"></a>

### DEV-001 — Screen-level PRD, glossary and canonical data dictionary

- **Implementation:** Implemented
- **Verification:** Awaiting user verification (manual document review)
- **Dependencies:** SETUP-001
- **Context:** User requested starting development after reporting format/check and tests passed and a manual commit/push. Begin the dependency-ordered backlog with screen requirements and domain definitions. README.md sections 3–13, 19–25; docs/product/decisions.md
- **Scope and acceptance:** Public/personal home, event/company, portfolio/goal and action flows; empty/error/stale/conflict states; field units, currency, times and identifiers
- **E2E cases:** DOC-001–DOC-015 in [manual acceptance pack](tests/e2e/plans/dev-001-acceptance.md); convert applicable scenarios to API/browser cases with feature delivery.
- **Evidence / blockers:** Authored [screen PRD](docs/product/first-slice-prd.md), [canonical model](docs/data-dictionary/canonical-model.md) and [glossary](docs/data-dictionary/glossary.md). Requirements are proposed, not working financial features. Policy, source rights and authentication decisions remain downstream dependencies; Gate 0 remains incomplete. No checks executed.
- **Manual next actions:** Review DOC-001–DOC-015 and report omissions by ID. No services, dependency changes or browser runs needed for this documentation task. Optionally run `pnpm format`. Next development task: DEV-002, then DEV-003.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-001, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Screen-level PRD, glossary and canonical data dictionary. Scope and acceptance: Public/personal home, event/company, portfolio/goal and action flows; empty/error/stale/conflict states; field units, currency, times and identifiers Dependencies: SETUP-001. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-002"></a>

### DEV-002 — Research/advice policy and threat model

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-001
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Explicit allowed vocabulary and activation gates; document injection, uploaded PII, tenant access, consent and deletion design
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-002; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-002, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Research/advice policy and threat model. Scope and acceptance: Explicit allowed vocabulary and activation gates; document injection, uploaded PII, tenant access, consent and deletion design Dependencies: DEV-001. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-003"></a>

### DEV-003 — Versioned domain contracts and golden fixtures

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-001, DEV-002
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Instrument, evidence, observation, event/edge, portfolio/lot, goal/profile and policy-result schemas; strict rejection and decimal/reconciliation rules
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-003; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-003, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Versioned domain contracts and golden fixtures. Scope and acceptance: Instrument, evidence, observation, event/edge, portfolio/lot, goal/profile and policy-result schemas; strict rejection and decimal/reconciliation rules Dependencies: DEV-001, DEV-002. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-004"></a>

### DEV-004 — PostgreSQL migrations and MongoDB indexes

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-003
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Repeatable migrations, tenant boundaries and least-privilege application access; versioned observations; transaction-safe jobs/outbox schema
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-004; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-004, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on PostgreSQL migrations and MongoDB indexes. Scope and acceptance: Repeatable migrations, tenant boundaries and least-privilege application access; versioned observations; transaction-safe jobs/outbox schema Dependencies: DEV-003. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-005"></a>

### DEV-005 — P0 source registry and initial adapters

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Terms and freshness recorded; provenance tests, fixtures, quarantine, retries, reconciliation; source status updated honestly
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-005; add stable executable IDs when implemented
- **Evidence / blockers:** DATA-001 delivers a real World Bank India annual GDP/CPI adapter with source evidence, canonical revisions, refresh UI and executable tests. Remaining source families and production acceptance are still open. Runtime not executed by Codex.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-005, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on P0 source registry and initial adapters. Scope and acceptance: Terms and freshness recorded; provenance tests, fixtures, quarantine, retries, reconciliation; source status updated honestly Dependencies: DEV-003, DEV-004. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-006"></a>

### DEV-006 — Public intelligence slice

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-005
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Five/six verified points; event, sector and company details; supporting sources, corrections, stale/unavailable states
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-006; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-006, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Public intelligence slice. Scope and acceptance: Five/six verified points; event, sector and company details; supporting sources, corrections, stale/unavailable states Dependencies: DEV-005. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-007"></a>

### DEV-007 — Identity/consent and manual/virtual portfolios

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-002, DEV-004
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Authenticated ownership, consent, exact quantities/amounts, synthetic demo clearly distinguished
- **Current delivery:** ACCOUNT-001 now provides persisted authenticated accounts and passive real-data watchlists; broader parent acceptance remains open.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-007; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-007, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Identity/consent and manual/virtual portfolios. Scope and acceptance: Authenticated ownership, consent, exact quantities/amounts, synthetic demo clearly distinguished Dependencies: DEV-002, DEV-004. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-008"></a>

### DEV-008 — CSV/XLSX imports and help

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-007
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Platform-specific formats and fixtures; preview/corrections; duplicate detection and source-total reconciliation; private upload handling
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-008; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-008, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on CSV/XLSX imports and help. Scope and acceptance: Platform-specific formats and fixtures; preview/corrections; duplicate detection and source-total reconciliation; private upload handling Dependencies: DEV-007. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-009"></a>

### DEV-009 — Multiple goals and portfolio linkage

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-007
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Repeat goal types, visible editable assumptions; contribution/horizon/risk feasibility; no guaranteed return
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-009; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-009, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Multiple goals and portfolio linkage. Scope and acceptance: Repeat goal types, visible editable assumptions; contribution/horizon/risk feasibility; no guaranteed return Dependencies: DEV-003, DEV-007. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-010"></a>

### DEV-010 — Oil-shock educational end-to-end slice

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-006, DEV-008, DEV-009
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Evidence → factor → sector → company → holding → goal traceable; no-action comparator; stale/conflicting inputs cannot generate confident action
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-010; add stable executable IDs when implemented
- **Evidence / blockers:** SLICE-001 implements the bounded synthetic journey portion; see docs/development/working-journey.md and docs/product/educational-slice-policy.md. Full task acceptance and production dependencies remain open; no tests executed.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-010, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Oil-shock educational end-to-end slice. Scope and acceptance: Evidence → factor → sector → company → holding → goal traceable; no-action comparator; stale/conflicting inputs cannot generate confident action Dependencies: DEV-006, DEV-008, DEV-009. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-011"></a>

### DEV-011 — Daily/weekly reports and durable workers

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-004, DEV-010
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** PostgreSQL idempotent jobs/outbox, retries/leases, freshness-aware reports and material-change notifications
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-011; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-011, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Daily/weekly reports and durable workers. Scope and acceptance: PostgreSQL idempotent jobs/outbox, retries/leases, freshness-aware reports and material-change notifications Dependencies: DEV-004, DEV-010. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-012"></a>

### DEV-012 — Responsive PWA and accessible UI

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-006
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Routing, manifest/icons, installability, offline shell, no caching of sensitive portfolio/API responses, mobile and keyboard validation
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-012; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-012, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Responsive PWA and accessible UI. Scope and acceptance: Routing, manifest/icons, installability, offline shell, no caching of sensitive portfolio/API responses, mobile and keyboard validation Dependencies: DEV-006. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-013"></a>

### DEV-013 — Regulated personalised advice

- **Implementation:** Gated
- **Verification:** Not run
- **Dependencies:** DEV-010 and approved operating model
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Counsel/partner/registration approval, suitability, audit reconstruction, review and kill-switch evidence
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-013; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-013, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Regulated personalised advice. Scope and acceptance: Counsel/partner/registration approval, suitability, audit reconstruction, review and kill-switch evidence Dependencies: DEV-010 and approved operating model. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-014"></a>

### DEV-014 — Broker connectivity and later channels/assets

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** Relevant accepted gates
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Consent/OAuth reconciliation; WhatsApp/mobile controls; each asset's data/calculation/suitability tests
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-014; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-014, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Broker connectivity and later channels/assets. Scope and acceptance: Consent/OAuth reconciliation; WhatsApp/mobile controls; each asset's data/calculation/suitability tests Dependencies: Relevant accepted gates. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-015"></a>

### DEV-015 — Admin and research operations

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-002, DEV-005, DEV-019
- **Context:** README.md section 15
- **Scope and acceptance:** Source registry, job health, data quarantine/entity-resolution review, event merge/split/corrections, causal-edge approvals, policy simulations/releases, complaints and audit search. Add role-controlled review queues and four-eyes approval for material policy/content changes.
- **Current delivery:** DATA-001 provides operator refresh controls and immutable real-source observation/evidence history. Broader research publishing and correction flows remain open.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-015; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-015, README.md section 15, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Admin and research operations. Scope and acceptance: Source registry, job health, data quarantine/entity-resolution review, event merge/split/corrections, causal-edge approvals, policy simulations/releases, complaints and audit search. Add role-controlled review queues and four-eyes approval for material policy/content changes. Dependencies: DEV-002, DEV-005, DEV-019. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-016"></a>

### DEV-016 — Evidence, explanations and corrections

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-005
- **Context:** README.md sections 4, 7, 8, 11, 13
- **Scope and acceptance:** Implement progressive one-line/beginner/portfolio/analytical/source layers; distinguish facts, expectations, scenarios and inference. Every material claim links to entailed source sections/timestamps and exposes freshness, conflicts and revisions. English first with a controlled glossary; no invented citations.
- **Current delivery:** DATA-001 provides operator refresh controls and immutable real-source observation/evidence history. Broader research publishing and correction flows remain open.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-016; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-016, README.md sections 4, 7, 8, 11, 13, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Evidence, explanations and corrections. Scope and acceptance: Implement progressive one-line/beginner/portfolio/analytical/source layers; distinguish facts, expectations, scenarios and inference. Every material claim links to entailed source sections/timestamps and exposes freshness, conflicts and revisions. English first with a controlled glossary; no invented citations. Dependencies: DEV-003, DEV-005. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-017"></a>

### DEV-017 — Privacy, security and consent lifecycle

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-002, DEV-004, DEV-007
- **Context:** README.md section 16
- **Scope and acceptance:** Tenant isolation; granular consent expiry/revocation; PII encryption/retention/export/deletion; broker token vault and least privilege; isolated document parsing; untrusted-document injection tests; audit support access. Never use real private holdings as test fixtures.
- **Current delivery:** ACCOUNT-001 now provides persisted authenticated accounts and passive real-data watchlists; broader parent acceptance remains open.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-017; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-017, README.md section 16, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Privacy, security and consent lifecycle. Scope and acceptance: Tenant isolation; granular consent expiry/revocation; PII encryption/retention/export/deletion; broker token vault and least privilege; isolated document parsing; untrusted-document injection tests; audit support access. Never use real private holdings as test fixtures. Dependencies: DEV-002, DEV-004, DEV-007. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-018"></a>

### DEV-018 — Watchlists, material alerts and delivery controls

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-006, DEV-011
- **Context:** README.md sections 4, 9, 14
- **Scope and acceptance:** Watchlist management, calendar-based context, batching, mute preferences and material-event thresholds. Separate data/account alerts from investment actions; test unchanged/non-material inputs do not cause urgency or repeated notifications.
- **Current delivery:** ACCOUNT-001 now provides persisted authenticated accounts and passive real-data watchlists; broader parent acceptance remains open.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-018; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-018, README.md sections 4, 9, 14, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Watchlists, material alerts and delivery controls. Scope and acceptance: Watchlist management, calendar-based context, batching, mute preferences and material-event thresholds. Separate data/account alerts from investment actions; test unchanged/non-material inputs do not cause urgency or repeated notifications. Dependencies: DEV-006, DEV-011. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-019"></a>

### DEV-019 — Deterministic research policy and action centre

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-008, DEV-009, DEV-016
- **Context:** README.md sections 9, 13, 17, 24
- **Scope and acceptance:** Versioned candidate policies with goal suitability, materiality, taxes/costs/liquidity, concentration bands, cooldowns and turnover budgets. Compare with no action; retain immutable results with size, goal, evidence, timing, downside, alternatives and invalidation. Educational/simulation mode only; no LLM decision or execution.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-019; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-019, README.md sections 9, 13, 17, 24, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Deterministic research policy and action centre. Scope and acceptance: Versioned candidate policies with goal suitability, materiality, taxes/costs/liquidity, concentration bands, cooldowns and turnover budgets. Compare with no action; retain immutable results with size, goal, evidence, timing, downside, alternatives and invalidation. Educational/simulation mode only; no LLM decision or execution. Dependencies: DEV-003, DEV-008, DEV-009, DEV-016. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-020"></a>

### DEV-020 — Additional verified event slices

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-010, DEV-016, DEV-019
- **Context:** README.md section 23
- **Scope and acceptance:** Add RBI/Fed decisions, CPI/GDP surprises, company earnings/guidance, governance/regulatory shocks and FPI/liquidity events as separate child tasks before implementation. Define each source vintage, causal mapping, scenario/actual distinction and golden outcomes.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-020; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-020, README.md section 23, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Additional verified event slices. Scope and acceptance: Add RBI/Fed decisions, CPI/GDP surprises, company earnings/guidance, governance/regulatory shocks and FPI/liquidity events as separate child tasks before implementation. Define each source vintage, causal mapping, scenario/actual distinction and golden outcomes. Dependencies: DEV-010, DEV-016, DEV-019. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-021"></a>

### DEV-021 — Operational quality, observability and release controls

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-002, DEV-011, DEV-017
- **Context:** README.md sections 13, 18, 21
- **Scope and acceptance:** Define SLAs, data-quality dashboards, traces/metrics/structured logs, audit reconstruction, kill switches and rollback/runbooks. Author evaluation, performance/security and reconciliation acceptance plans. User runs deterministic checks; do not claim launch-ready without evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-021; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-021, README.md sections 13, 18, 21, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Operational quality, observability and release controls. Scope and acceptance: Define SLAs, data-quality dashboards, traces/metrics/structured logs, audit reconstruction, kill switches and rollback/runbooks. Author evaluation, performance/security and reconciliation acceptance plans. User runs deterministic checks; do not claim launch-ready without evidence. Dependencies: DEV-002, DEV-011, DEV-017. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-022"></a>

### DEV-022 — Indian mutual funds and bonds

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-009, DEV-019; SRC-015–SRC-019
- **Context:** README.md sections 3, 9, 10 and P1 source gates
- **Scope and acceptance:** Add scheme/share-class identity, NAV/history/mergers, disclosed fund look-through lags, bond clean/dirty price/accrued interest/duration/credit/liquidity, exact XIRR and deposit alternatives. Add asset-specific policy and fixtures before widening recommendations.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-022; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-022, README.md sections 3, 9, 10 and P1 source gates, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Indian mutual funds and bonds. Scope and acceptance: Add scheme/share-class identity, NAV/history/mergers, disclosed fund look-through lags, bond clean/dirty price/accrued interest/duration/credit/liquidity, exact XIRR and deposit alternatives. Add asset-specific policy and fixtures before widening recommendations. Dependencies: DEV-009, DEV-019; SRC-015–SRC-019. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-023"></a>

### DEV-023 — Other Indian assets and derivatives

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-022; SRC-022, SRC-023
- **Context:** README.md sections 3, 10 and P2 gates
- **Scope and acceptance:** Split ETFs, gold/silver, REITs/InvITs, commodities and derivatives into separately accepted child tasks. Handle premiums/spreads, tracking, currency/duties, payoff/margin/expiry and suitability. Beginner derivatives stay educational and gated.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-023; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-023, README.md sections 3, 10 and P2 gates, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Other Indian assets and derivatives. Scope and acceptance: Split ETFs, gold/silver, REITs/InvITs, commodities and derivatives into separately accepted child tasks. Handle premiums/spreads, tracking, currency/duties, payoff/margin/expiry and suitability. Beginner derivatives stay educational and gated. Dependencies: DEV-022; SRC-022, SRC-023. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-024"></a>

### DEV-024 — International mutual funds

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-022; SRC-024
- **Context:** README.md sections 3, 10 and P3 gate
- **Scope and acceptance:** Choose the first supported jurisdiction through an explicit product decision; canonicalise country, currency, share-class/distribution variants, NAV, FX, fees, taxation and fund look-through. Define fixtures and legal/data acceptance before enabling.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-024; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-024, README.md sections 3, 10 and P3 gate, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on International mutual funds. Scope and acceptance: Choose the first supported jurisdiction through an explicit product decision; canonicalise country, currency, share-class/distribution variants, NAV, FX, fees, taxation and fund look-through. Define fixtures and legal/data acceptance before enabling. Dependencies: DEV-022; SRC-024. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-025"></a>

### DEV-025 — International equities and ETFs

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-024; SRC-025
- **Context:** README.md sections 3, 10 and P4 gate
- **Scope and acceptance:** Implement first approved market identity, exchange calendar, corporate actions, entitled EOD prices, issuer filings/fundamentals, FX conversion and tax/suitability. Expand one jurisdiction at a time with approved source rights.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-025; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-025, README.md sections 3, 10 and P4 gate, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on International equities and ETFs. Scope and acceptance: Implement first approved market identity, exchange calendar, corporate actions, entitled EOD prices, issuer filings/fundamentals, FX conversion and tax/suitability. Expand one jurisdiction at a time with approved source rights. Dependencies: DEV-024; SRC-025. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-026"></a>

### DEV-026 — Other international assets

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-025; SRC-026
- **Context:** README.md sections 3, 10 and P5 gate
- **Scope and acceptance:** Create per-country/asset child tasks for bonds, commodities and derivatives; require dedicated price/liquidity/valuation, settlement, risk and regulatory evaluation packs before support is enabled.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-026; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-026, README.md sections 3, 10 and P5 gate, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Other international assets. Scope and acceptance: Create per-country/asset child tasks for bonds, commodities and derivatives; require dedicated price/liquidity/valuation, settlement, risk and regulatory evaluation packs before support is enabled. Dependencies: DEV-025; SRC-026. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-027"></a>

### DEV-027 — Crypto last-stage capability

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-026; SRC-027
- **Context:** README.md sections 3, 10 and P6 gate
- **Scope and acceptance:** Keep deferred until product/regulatory acceptance. Define fragmented venue identity/prices, custody and manipulation risk, on-chain evidence, tax and strict suitability; do not substitute sentiment/on-chain activity for validated policy.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-027; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-027, README.md sections 3, 10 and P6 gate, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Crypto last-stage capability. Scope and acceptance: Keep deferred until product/regulatory acceptance. Define fragmented venue identity/prices, custody and manipulation risk, on-chain evidence, tax and strict suitability; do not substitute sentiment/on-chain activity for validated policy. Dependencies: DEV-026; SRC-027. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-028"></a>

### DEV-028 — Broker and account connectivity

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-008, DEV-017; SRC-019, SRC-021
- **Context:** README.md sections 6, 16 and Gate 6
- **Scope and acceptance:** Add approved broker OAuth, CAS/registrar and eligible Account Aggregator pathways as separate tasks; preserve consent/revocation, sync reconciliation, provider entitlement and format versions. Never collect broker passwords or OTPs.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-028; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-028, README.md sections 6, 16 and Gate 6, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Broker and account connectivity. Scope and acceptance: Add approved broker OAuth, CAS/registrar and eligible Account Aggregator pathways as separate tasks; preserve consent/revocation, sync reconciliation, provider entitlement and format versions. Never collect broker passwords or OTPs. Dependencies: DEV-008, DEV-017; SRC-019, SRC-021. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-029"></a>

### DEV-029 — WhatsApp and mobile application shells

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-012, DEV-017, DEV-018
- **Context:** README.md Gate 7
- **Scope and acceptance:** Implement WhatsApp summaries/deep links and Android/iOS webview shells only after channel acceptance. Preserve secure session boundaries, notification preferences, evidence links and jurisdiction/consent controls across channels.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-029; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-029, README.md Gate 7, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on WhatsApp and mobile application shells. Scope and acceptance: Implement WhatsApp summaries/deep links and Android/iOS webview shells only after channel acceptance. Preserve secure session boundaries, notification preferences, evidence links and jurisdiction/consent controls across channels. Dependencies: DEV-012, DEV-017, DEV-018. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="dev-030"></a>

### DEV-030 — Monetisation decision and commercial conflict controls

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** Explicit user business-model decision
- **Context:** README.md section 22
- **Scope and acceptance:** Keep freemium/subscription/adviser/B2B2C/white-label options open; do not invent pricing or billing behavior. Once selected, separate entitlements and disclosed commercial relationships from suitability/recommendation ranking; log ranking provenance.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#dev-030; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task DEV-030, README.md section 22, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Monetisation decision and commercial conflict controls. Scope and acceptance: Keep freemium/subscription/adviser/B2B2C/white-label options open; do not invent pricing or billing behavior. Once selected, separate entitlements and disclosed commercial relationships from suitability/recommendation ranking; log ranking provenance. Dependencies: Explicit user business-model decision. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-001"></a>

### SRC-001 — Instrument/security master source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 1, P0
- **Scope and acceptance:** Onboard Instrument/security master. Starting public candidates: NSE + BSE + ISIN crosswalk. Paid upgrade candidates: NSE/BSE licensed data; Capitaline/ACE. Next action from the accepted plan: Obtain files, document terms, define canonical ISIN/symbol schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-001; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-001, README.md sections 10.6–10.10, source order 1, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Instrument/security master source onboarding (P0). Scope and acceptance: Onboard Instrument/security master. Starting public candidates: NSE + BSE + ISIN crosswalk. Paid upgrade candidates: NSE/BSE licensed data; Capitaline/ACE. Next action from the accepted plan: Obtain files, document terms, define canonical ISIN/symbol schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-002"></a>

### SRC-002 — Indian EOD prices/volume source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 2, P0
- **Scope and acceptance:** Onboard Indian EOD prices/volume. Starting public candidates: NSE/BSE EOD reports. Paid upgrade candidates: NSE/BSE licensed EOD feed. Next action from the accepted plan: Confirm automated-use rights; build dual-source reconciliation. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-002; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-002, README.md sections 10.6–10.10, source order 2, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Indian EOD prices/volume source onboarding (P0). Scope and acceptance: Onboard Indian EOD prices/volume. Starting public candidates: NSE/BSE EOD reports. Paid upgrade candidates: NSE/BSE licensed EOD feed. Next action from the accepted plan: Confirm automated-use rights; build dual-source reconciliation. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-003"></a>

### SRC-003 — Corporate actions source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 3, P0
- **Scope and acceptance:** Onboard Corporate actions. Starting public candidates: NSE/BSE + issuer filings. Paid upgrade candidates: Exchange corporate-data feed; LSEG/FactSet. Next action from the accepted plan: Build action taxonomy and adjusted-price golden tests. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-003; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-003, README.md sections 10.6–10.10, source order 3, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Corporate actions source onboarding (P0). Scope and acceptance: Onboard Corporate actions. Starting public candidates: NSE/BSE + issuer filings. Paid upgrade candidates: Exchange corporate-data feed; LSEG/FactSet. Next action from the accepted plan: Build action taxonomy and adjusted-price golden tests. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-004"></a>

### SRC-004 — Corporate filings/results source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 4, P0
- **Scope and acceptance:** Onboard Corporate filings/results. Starting public candidates: NSE/BSE + issuer IR. Paid upgrade candidates: Exchange corporate feed; AlphaSense/Capital IQ. Next action from the accepted plan: Build filing registry, hash/version and entitlement policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-004; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-004, README.md sections 10.6–10.10, source order 4, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Corporate filings/results source onboarding (P0). Scope and acceptance: Onboard Corporate filings/results. Starting public candidates: NSE/BSE + issuer IR. Paid upgrade candidates: Exchange corporate feed; AlphaSense/Capital IQ. Next action from the accepted plan: Build filing registry, hash/version and entitlement policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-005"></a>

### SRC-005 — Reported fundamentals source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 5, P0
- **Scope and acceptance:** Onboard Reported fundamentals. Starting public candidates: Filing/XBRL extraction. Paid upgrade candidates: Capitaline/ACE/CMIE. Next action from the accepted plan: Select initial financial schema and 25-company validation set. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-005; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-005, README.md sections 10.6–10.10, source order 5, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Reported fundamentals source onboarding (P0). Scope and acceptance: Onboard Reported fundamentals. Starting public candidates: Filing/XBRL extraction. Paid upgrade candidates: Capitaline/ACE/CMIE. Next action from the accepted plan: Select initial financial schema and 25-company validation set. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-006"></a>

### SRC-006 — Index/sector data source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 6, P0
- **Scope and acceptance:** Onboard Index/sector data. Starting public candidates: NSE Indices/BSE Indices. Paid upgrade candidates: Licensed index feed. Next action from the accepted plan: Validate constituent/history rights and create classification crosswalk. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-006; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-006, README.md sections 10.6–10.10, source order 6, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Index/sector data source onboarding (P0). Scope and acceptance: Onboard Index/sector data. Starting public candidates: NSE Indices/BSE Indices. Paid upgrade candidates: Licensed index feed. Next action from the accepted plan: Validate constituent/history rights and create classification crosswalk. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-007"></a>

### SRC-007 — India macro source onboarding (P0)

- **Implementation:** In progress
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 7, P0
- **Scope and acceptance:** Onboard India macro. Starting public candidates: MoSPI + RBI/DBIE. Paid upgrade candidates: CEIC/Macrobond/CMIE. Next action from the accepted plan: Create release calendar, vintage model and initial series registry. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-007; add stable executable IDs when implemented
- **Evidence / blockers:** DATA-001 delivers a real World Bank India annual GDP/CPI adapter with source evidence, canonical revisions, refresh UI and executable tests. Remaining source families and production acceptance are still open. Runtime not executed by Codex.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-007, README.md sections 10.6–10.10, source order 7, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on India macro source onboarding (P0). Scope and acceptance: Onboard India macro. Starting public candidates: MoSPI + RBI/DBIE. Paid upgrade candidates: CEIC/Macrobond/CMIE. Next action from the accepted plan: Create release calendar, vintage model and initial series registry. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-008"></a>

### SRC-008 — Global macro/rates source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 8, P0
- **Scope and acceptance:** Onboard Global macro/rates. Starting public candidates: FRED, BLS, BEA, Treasury, Fed, ECB. Paid upgrade candidates: Macrobond/Haver/Bloomberg/LSEG. Next action from the accepted plan: Identify minimum India-impact series and official API limits. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-008; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-008, README.md sections 10.6–10.10, source order 8, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Global macro/rates source onboarding (P0). Scope and acceptance: Onboard Global macro/rates. Starting public candidates: FRED, BLS, BEA, Treasury, Fed, ECB. Paid upgrade candidates: Macrobond/Haver/Bloomberg/LSEG. Next action from the accepted plan: Identify minimum India-impact series and official API limits. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-009"></a>

### SRC-009 — Oil/commodity/FX benchmarks source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 9, P0
- **Scope and acceptance:** Onboard Oil/commodity/FX benchmarks. Starting public candidates: EIA, World Bank, RBI/FBIL, official releases. Paid upgrade candidates: ICE/CME/LSEG/Bloomberg. Next action from the accepted plan: Define permissible EOD benchmarks and currency conversion rules. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-009; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-009, README.md sections 10.6–10.10, source order 9, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Oil/commodity/FX benchmarks source onboarding (P0). Scope and acceptance: Onboard Oil/commodity/FX benchmarks. Starting public candidates: EIA, World Bank, RBI/FBIL, official releases. Paid upgrade candidates: ICE/CME/LSEG/Bloomberg. Next action from the accepted plan: Define permissible EOD benchmarks and currency conversion rules. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-010"></a>

### SRC-010 — FII/DII/FPI flows source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 10, P0
- **Scope and acceptance:** Onboard FII/DII/FPI flows. Starting public candidates: NSE + NSDL/CDSL. Paid upgrade candidates: Exchange/depository feed; EPFR. Next action from the accepted plan: Separate provisional cash, total FPI and derivatives measures. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-010; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-010, README.md sections 10.6–10.10, source order 10, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on FII/DII/FPI flows source onboarding (P0). Scope and acceptance: Onboard FII/DII/FPI flows. Starting public candidates: NSE + NSDL/CDSL. Paid upgrade candidates: Exchange/depository feed; EPFR. Next action from the accepted plan: Separate provisional cash, total FPI and derivatives measures. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-011"></a>

### SRC-011 — F&O participant positioning source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 11, P0
- **Scope and acceptance:** Onboard F&O participant positioning. Starting public candidates: NSE participant OI and bhavcopy. Paid upgrade candidates: NSE analytics feed. Next action from the accepted plan: Create positioning metrics and block misleading single-number narratives. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-011; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-011, README.md sections 10.6–10.10, source order 11, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on F&O participant positioning source onboarding (P0). Scope and acceptance: Onboard F&O participant positioning. Starting public candidates: NSE participant OI and bhavcopy. Paid upgrade candidates: NSE analytics feed. Next action from the accepted plan: Create positioning metrics and block misleading single-number narratives. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-012"></a>

### SRC-012 — Market/company news source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 12, P0
- **Scope and acceptance:** Onboard Market/company news. Starting public candidates: Primary filings/releases + permitted reputable links. Paid upgrade candidates: Reuters/LSEG or Dow Jones/Factiva. Next action from the accepted plan: Define link-only/full-text rights and two-source verification policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-012; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-012, README.md sections 10.6–10.10, source order 12, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Market/company news source onboarding (P0). Scope and acceptance: Onboard Market/company news. Starting public candidates: Primary filings/releases + permitted reputable links. Paid upgrade candidates: Reuters/LSEG or Dow Jones/Factiva. Next action from the accepted plan: Define link-only/full-text rights and two-source verification policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-013"></a>

### SRC-013 — Portfolio spreadsheet imports source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 13, P0
- **Scope and acceptance:** Onboard Portfolio spreadsheet imports. Starting public candidates: User CSV/XLSX exports. Paid upgrade candidates: Aggregation/broker partners later. Next action from the accepted plan: Collect sample exports from initial five Indian platforms and build versioned parsers. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-013; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-013, README.md sections 10.6–10.10, source order 13, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Portfolio spreadsheet imports source onboarding (P0). Scope and acceptance: Onboard Portfolio spreadsheet imports. Starting public candidates: User CSV/XLSX exports. Paid upgrade candidates: Aggregation/broker partners later. Next action from the accepted plan: Collect sample exports from initial five Indian platforms and build versioned parsers. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-014"></a>

### SRC-014 — Regulatory/tax source registry source onboarding (P0)

- **Implementation:** Planned
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; Yes
- **Context:** README.md sections 10.6–10.10, source order 14, P0
- **Scope and acceptance:** Onboard Regulatory/tax source registry. Starting public candidates: SEBI, RBI, Income Tax, Finance Ministry. Paid upgrade candidates: Taxmann + counsel/compliance partner. Next action from the accepted plan: Counsel review; effective-dated policy schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-014; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-014, README.md sections 10.6–10.10, source order 14, P0, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Regulatory/tax source registry source onboarding (P0). Scope and acceptance: Onboard Regulatory/tax source registry. Starting public candidates: SEBI, RBI, Income Tax, Finance Ministry. Paid upgrade candidates: Taxmann + counsel/compliance partner. Next action from the accepted plan: Counsel review; effective-dated policy schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; Yes. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-015"></a>

### SRC-015 — MF scheme master/NAV source onboarding (P1)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P1 gate
- **Context:** README.md sections 10.6–10.10, source order 15, P1
- **Scope and acceptance:** Onboard MF scheme master/NAV. Starting public candidates: AMFI. Paid upgrade candidates: Morningstar/CRISIL/Lipper. Next action from the accepted plan: Validate AMFI use terms; map scheme variants and history. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-015; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-015, README.md sections 10.6–10.10, source order 15, P1, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on MF scheme master/NAV source onboarding (P1). Scope and acceptance: Onboard MF scheme master/NAV. Starting public candidates: AMFI. Paid upgrade candidates: Morningstar/CRISIL/Lipper. Next action from the accepted plan: Validate AMFI use terms; map scheme variants and history. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P1 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-016"></a>

### SRC-016 — MF holdings/factsheets source onboarding (P1)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P1 gate
- **Context:** README.md sections 10.6–10.10, source order 16, P1
- **Scope and acceptance:** Onboard MF holdings/factsheets. Starting public candidates: AMC/SEBI disclosures. Paid upgrade candidates: Morningstar/CRISIL/Lipper. Next action from the accepted plan: Choose top AMCs and test portfolio-disclosure parsers. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-016; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-016, README.md sections 10.6–10.10, source order 16, P1, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on MF holdings/factsheets source onboarding (P1). Scope and acceptance: Onboard MF holdings/factsheets. Starting public candidates: AMC/SEBI disclosures. Paid upgrade candidates: Morningstar/CRISIL/Lipper. Next action from the accepted plan: Choose top AMCs and test portfolio-disclosure parsers. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P1 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-017"></a>

### SRC-017 — India G-sec/yield curve source onboarding (P1)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P1 gate
- **Context:** README.md sections 10.6–10.10, source order 17, P1
- **Scope and acceptance:** Onboard India G-sec/yield curve. Starting public candidates: RBI/FBIL/CCIL public reports. Paid upgrade candidates: CCIL/Bloomberg/LSEG. Next action from the accepted plan: Validate benchmark rights and bond calculator inputs. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-017; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-017, README.md sections 10.6–10.10, source order 17, P1, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on India G-sec/yield curve source onboarding (P1). Scope and acceptance: Onboard India G-sec/yield curve. Starting public candidates: RBI/FBIL/CCIL public reports. Paid upgrade candidates: CCIL/Bloomberg/LSEG. Next action from the accepted plan: Validate benchmark rights and bond calculator inputs. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P1 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-018"></a>

### SRC-018 — Corporate bonds/ratings source onboarding (P1)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P1 gate
- **Context:** README.md sections 10.6–10.10, source order 18, P1
- **Scope and acceptance:** Onboard Corporate bonds/ratings. Starting public candidates: NSE/BSE + rating releases. Paid upgrade candidates: CRISIL MI&A/Bloomberg/LSEG. Next action from the accepted plan: Define liquidity, evaluated-price and credit-event policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-018; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-018, README.md sections 10.6–10.10, source order 18, P1, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Corporate bonds/ratings source onboarding (P1). Scope and acceptance: Onboard Corporate bonds/ratings. Starting public candidates: NSE/BSE + rating releases. Paid upgrade candidates: CRISIL MI&A/Bloomberg/LSEG. Next action from the accepted plan: Define liquidity, evaluated-price and credit-event policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P1 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-019"></a>

### SRC-019 — CAS/MF statement import source onboarding (P1)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P1 gate
- **Context:** README.md sections 10.6–10.10, source order 19, P1
- **Scope and acceptance:** Onboard CAS/MF statement import. Starting public candidates: User-uploaded CDSL/NSDL/RTA statements. Paid upgrade candidates: Depository/RTA partner. Next action from the accepted plan: Gather formats; security/privacy review; reconciliation tests. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-019; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-019, README.md sections 10.6–10.10, source order 19, P1, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on CAS/MF statement import source onboarding (P1). Scope and acceptance: Onboard CAS/MF statement import. Starting public candidates: User-uploaded CDSL/NSDL/RTA statements. Paid upgrade candidates: Depository/RTA partner. Next action from the accepted plan: Gather formats; security/privacy review; reconciliation tests. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P1 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-020"></a>

### SRC-020 — Consensus/earnings revisions source onboarding (P1)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; No for P0
- **Context:** README.md sections 10.6–10.10, source order 20, P1
- **Scope and acceptance:** Onboard Consensus/earnings revisions. Starting public candidates: Company guidance only. Paid upgrade candidates: LSEG I/B/E/S/FactSet/Capital IQ. Next action from the accepted plan: Commercial comparison; feature remains unavailable until reliable. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-020; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-020, README.md sections 10.6–10.10, source order 20, P1, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Consensus/earnings revisions source onboarding (P1). Scope and acceptance: Onboard Consensus/earnings revisions. Starting public candidates: Company guidance only. Paid upgrade candidates: LSEG I/B/E/S/FactSet/Capital IQ. Next action from the accepted plan: Commercial comparison; feature remains unavailable until reliable. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; No for P0. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-021"></a>

### SRC-021 — Broker API connectivity source onboarding (P2)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P2 gate
- **Context:** README.md sections 10.6–10.10, source order 21, P2
- **Scope and acceptance:** Onboard Broker API connectivity. Starting public candidates: Official broker APIs. Paid upgrade candidates: Broker/aggregator partnership. Next action from the accepted plan: Prioritise brokers by target-user coverage; OAuth/consent design. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-021; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-021, README.md sections 10.6–10.10, source order 21, P2, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Broker API connectivity source onboarding (P2). Scope and acceptance: Onboard Broker API connectivity. Starting public candidates: Official broker APIs. Paid upgrade candidates: Broker/aggregator partnership. Next action from the accepted plan: Prioritise brokers by target-user coverage; OAuth/consent design. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P2 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-022"></a>

### SRC-022 — Indian ETFs/gold/commodities source onboarding (P2)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P2 gate
- **Context:** README.md sections 10.6–10.10, source order 22, P2
- **Scope and acceptance:** Onboard Indian ETFs/gold/commodities. Starting public candidates: Exchange/AMC/AMFI/EIA/World Bank. Paid upgrade candidates: MCX/ICE/CME/Morningstar. Next action from the accepted plan: Add asset families separately with tracking/liquidity models. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-022; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-022, README.md sections 10.6–10.10, source order 22, P2, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Indian ETFs/gold/commodities source onboarding (P2). Scope and acceptance: Onboard Indian ETFs/gold/commodities. Starting public candidates: Exchange/AMC/AMFI/EIA/World Bank. Paid upgrade candidates: MCX/ICE/CME/Morningstar. Next action from the accepted plan: Add asset families separately with tracking/liquidity models. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P2 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-023"></a>

### SRC-023 — Options/derivatives analytics source onboarding (P2)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P2/P3 gate
- **Context:** README.md sections 10.6–10.10, source order 23, P2
- **Scope and acceptance:** Onboard Options/derivatives analytics. Starting public candidates: NSE EOD reports. Paid upgrade candidates: NSE licensed analytics. Next action from the accepted plan: Suitability and educational-only boundary before implementation. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-023; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-023, README.md sections 10.6–10.10, source order 23, P2, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Options/derivatives analytics source onboarding (P2). Scope and acceptance: Onboard Options/derivatives analytics. Starting public candidates: NSE EOD reports. Paid upgrade candidates: NSE licensed analytics. Next action from the accepted plan: Suitability and educational-only boundary before implementation. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P2/P3 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-024"></a>

### SRC-024 — International mutual funds source onboarding (P3)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P3 gate
- **Context:** README.md sections 10.6–10.10, source order 24, P3
- **Scope and acceptance:** Onboard International mutual funds. Starting public candidates: Issuer/regulator factsheets. Paid upgrade candidates: Morningstar/Lipper. Next action from the accepted plan: Select first jurisdictions and canonical share-class schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-024; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-024, README.md sections 10.6–10.10, source order 24, P3, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on International mutual funds source onboarding (P3). Scope and acceptance: Onboard International mutual funds. Starting public candidates: Issuer/regulator factsheets. Paid upgrade candidates: Morningstar/Lipper. Next action from the accepted plan: Select first jurisdictions and canonical share-class schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P3 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-025"></a>

### SRC-025 — International equities/ETFs source onboarding (P4)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P4 gate
- **Context:** README.md sections 10.6–10.10, source order 25, P4
- **Scope and acceptance:** Onboard International equities/ETFs. Starting public candidates: SEC/issuer filings plus approved EOD source. Paid upgrade candidates: LSEG/Bloomberg/FactSet/ICE/vendor. Next action from the accepted plan: Choose first market, license prices/reference/corporate actions. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-025; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-025, README.md sections 10.6–10.10, source order 25, P4, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on International equities/ETFs source onboarding (P4). Scope and acceptance: Onboard International equities/ETFs. Starting public candidates: SEC/issuer filings plus approved EOD source. Paid upgrade candidates: LSEG/Bloomberg/FactSet/ICE/vendor. Next action from the accepted plan: Choose first market, license prices/reference/corporate actions. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P4 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-026"></a>

### SRC-026 — International bonds/commodities source onboarding (P5)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P5 gate
- **Context:** README.md sections 10.6–10.10, source order 26, P5
- **Scope and acceptance:** Onboard International bonds/commodities. Starting public candidates: Official issuers/central banks/reference sources. Paid upgrade candidates: Bloomberg/LSEG/ICE/CME/S&P Global. Next action from the accepted plan: Add one asset and jurisdiction per policy/evaluation pack. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-026; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-026, README.md sections 10.6–10.10, source order 26, P5, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on International bonds/commodities source onboarding (P5). Scope and acceptance: Onboard International bonds/commodities. Starting public candidates: Official issuers/central banks/reference sources. Paid upgrade candidates: Bloomberg/LSEG/ICE/CME/S&P Global. Next action from the accepted plan: Add one asset and jurisdiction per policy/evaluation pack. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P5 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

<a id="src-027"></a>

### SRC-027 — Crypto market/on-chain source onboarding (P6)

- **Implementation:** Deferred
- **Verification:** Not run
- **Dependencies:** DEV-003, DEV-004, DEV-005; P6 gate
- **Context:** README.md sections 10.6–10.10, source order 27, P6
- **Scope and acceptance:** Onboard Crypto market/on-chain. Starting public candidates: Approved exchange/public blockchain sources. Paid upgrade candidates: Kaiko/Coin Metrics/CCData. Next action from the accepted plan: Regulatory, custody, tax and manipulation-risk design first. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- **E2E cases:** Planned scenarios in tests/e2e/plans/product-coverage.md#src-027; add stable executable IDs when implemented
- **Evidence / blockers:** No implementation or verification evidence yet; dependencies and required product/source approvals remain open.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SRC-027, README.md sections 10.6–10.10, source order 27, P6, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Crypto market/on-chain source onboarding (P6). Scope and acceptance: Onboard Crypto market/on-chain. Starting public candidates: Approved exchange/public blockchain sources. Paid upgrade candidates: Kaiko/Coin Metrics/CCData. Next action from the accepted plan: Regulatory, custody, tax and manipulation-risk design first. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence. Dependencies: DEV-003, DEV-004, DEV-005; P6 gate. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Commit changes locally, never push, and give the user exact manual next actions.

## Scope relationships

DEV-014 is the legacy umbrella for later connectivity/channels/assets. DEV-022–DEV-029 contain its detailed delivery tasks; update the umbrella from child outcomes instead of implementing the same feature twice. DEV-005 is the source-adapter framework; SRC-001–SRC-027 are individual onboarding tasks. Source register operational status remains in README section 10.8 and must be updated when evidence changes it. DEV-019 expands the policy work used by DEV-010; DEV-010 is integration of the first complete slice, not a second policy engine.

## Change log

- 2026-09-12: migrated SETUP-001 and DEV-001–DEV-014 from the legacy backlog; added SDLC tasks, detailed product workstreams and all 27 source onboarding tasks. SDLC-001 source implementation completed; manual verification remains pending. No tests or environment commands executed for this change. Removed the authorized duplicate root plan, preserving the README blueprint and reference copy.

<a id="bug-001"></a>

### BUG-001 — Duplicate development session and stalled browser installation

- **Implementation:** Implemented
- **Verification:** User-reported startup/install failure; fix not run.
- **Context:** A prior Fingent360 dev process still owns 5173 and 4100; the second web process exits and concurrently terminates its sibling processes. Managed Chromium installation remains active after its progress reaches 100%.
- **Scope:** Add a pre-build port check that reports existing listeners without killing them. Allow explicitly selecting installed Google Chrome for browser E2E, without requiring managed Chromium or FFmpeg downloads. Keep default managed Chromium supported.
- **Acceptance:** Duplicate startup gives an actionable error before building; a normal startup remains unchanged. Installed-Chrome mode uses isolated Playwright contexts and does not touch the user's browser profile. No service/process is stopped by Codex.
- **E2E coverage:** tests/e2e/CATALOG.md BUG-001 manual acceptance; existing E2E-WEB-001–004 under both browser choices.
- **Codex prompt:** Read AGENTS.md, README.md and BUG-001. Inspect existing listeners and launcher/config source only. Add an explicit pre-build duplicate-port error without killing/reusing unknown services. Add E2E_BROWSER=chrome using Playwright's installed browser channel and disable video in that mode to avoid FFmpeg download requirements. Document cancelling the old installer and reusing or manually stopping the old dev session. Add manual acceptance cases, update TODO/README and commit locally. Do not install, start/stop services, run checks/tests or push.
- **Manual next actions:** User cancels pending install; reuses existing app or stops its old dev session and restarts. Launch E2E_BROWSER=chrome pnpm e2e:ui and run selected cases. Report actual results.

<a id="bug-002"></a>

### BUG-002 — Unknown API route returns HTML instead of JSON

- **Implementation:** Implemented
- **Verification:** User-reported E2E-API-003 failed parsing HTML after the HTTP 404 assertion passed; fix not run.
- **Context:** Installed NestJS 12 Express adapter mounts its not-found router with the supplied global prefix. The app supplied api/v1 without a leading slash, while normal controller routes are normalized separately.
- **Scope and acceptance:** Use /api/v1 consistently for controller and fallback mounting. Unknown nested API routes must return HTTP 404 with JSON statusCode 404. Keep health/readiness behavior unchanged. Check content type before parsing so regressions identify the response format clearly.
- **Dependencies:** SETUP-001, SDLC-001.
- **Cases:** E2E-API-003 plus API regression tests for JSON not-found responses.
- **Codex prompt:** Read AGENTS.md, README.md and BUG-002. Inspect the installed NestJS router/adapter without executing it. Correct global-prefix mounting, preserve existing health/readiness routes, and add content-type plus JSON assertions to the unknown-route regression cases. Do not weaken the test to accept HTML. Update TODO/README and commit locally. Do not start services, execute checks/tests or push. Give the user exact manual rerun instructions.
- **Manual next actions:** User runs formatting/checks, reloads the development API, then reruns E2E-API-003 and API smoke cases; provide results before marking verified.

## Latest user verification report

- 2026-09-12 user report: `pnpm format`, `pnpm check` and all tests passed; user committed and pushed. No run ID or individual case list supplied; this does not establish completion of the separate outage/runner acceptance scenarios. DEV-001 documents and DOC-001–DOC-015 authored afterward; manual review pending.

<a id="slice-001"></a>

## SLICE-001 — Working educational portfolio journey

- **Implementation:** Implemented
- **Verification:** Awaiting user verification; source and executable cases written, not run.
- **Request:** User clarified that document-only delivery is insufficient and requested end-to-end development.
- **Dependencies:** DEV-001; implement the necessary bounded portions of DEV-002–DEV-010 together without marking their broader production scope complete.
- **Scope:** Synthetic public event/evidence/company details; isolated persisted virtual workspace; strict contracts and exact decimal valuation; manual holdings and standard CSV preview/reconciliation/idempotent confirmation; multiple goals and allocations; deterministic educational review with saved input revision and history; responsive UI; real API/browser E2E cases. No live-source approval, broker formats, XLSX, real-account authentication or regulated advice is implied.
- **Acceptance:** Complete the journey in browser; reload preserves saved data; malformed/duplicate/unreconciled imports never mutate holdings; stale/conflicting inputs block assessment; allocations cannot exceed available capital; another workspace cannot read records; replayed commits do not duplicate; failures render actionable messages.
- **Codex prompt:** Read AGENTS.md, README, DEV-001 artifacts and SLICE-001. Implement a working synthetic educational first slice across contracts, PostgreSQL migration, deterministic domain services, Nest API and responsive React UI. Keep fictional evidence explicit. Use exact integer/decimal arithmetic, validate all boundaries, persist immutable revisions and scope every private query to the workspace capability. Add substantive API/browser cases, document the manual migration/check/test commands, update affected task progress honestly, and commit locally with hooks disabled. Do not execute deterministic checks/services or push.

- **Files:** packages/contracts/src/journey.ts; apps/api/src/journey*.ts; infra/migrations/001_virtual_journey.sql; apps/web/src/Journey.tsx; tests/e2e/cases/{api,browser}/journey.spec.ts.
- **Cases:** E2E-API-010–013, E2E-WEB-010–012 plus domain golden/negative tests. Existing foundation browser case updated to the working landing page.
- **Manual next actions:** Follow [working journey](docs/development/working-journey.md): db:up → format → check → db:migrate → dev; launch Chrome E2E UI and run @SLICE-001 in API/desktop/mobile. Report failures by case/project/trace. No dependency changes. No commands/tests/services executed by Codex; no push.

## BUG-003 — Workspace creation returns an undiagnosed 503

- **Implementation:** Diagnostic improvement implemented; underlying reported failure awaiting diagnosis
- **Verification:** User reported E2E-API-011/012/013 failing at workspace creation (expected 201, received 503); underlying database cause not yet confirmed.
- **Scope:** Replace the generic storage/migration message with safe cause-specific diagnostics; make E2E failure report the response error. Preserve failure status and all assertions. No automatic migrations, services or test execution.
- **Codex prompt:** Inspect the common workspace creation and migration paths. Distinguish schema/authentication/permission/connectivity failures without exposing driver text, SQL or secrets. Update regression cases and README, record that the underlying environment cause remains unconfirmed, commit locally without hooks or push. Ask for the user's migration output and provide manual recovery steps.

- **Cases/evidence:** storage-error.test.mjs covers classification, redaction and transaction rollback; E2E-API-011–013 now display the failed workspace response. No checks/tests/migrations executed.
- **Manual next actions:** format → check → db:migrate; report migration result, then rerun the three API cases after API reload. Do not mark the original failure resolved without a successful rerun.

## DATA-001 — Real India macro ingestion, evidence and public screen

- **Implementation:** Implemented
- **Verification:** Awaiting user execution. User reported manually committing/pushing prior work; no new case-specific pass evidence inferred.
- **Request:** Continue all backlog tasks as end-to-end features, not documents or mocked UI. This increment implements the real-data portion of DEV-003/004/005/006/015/016 and SRC-007 before further dependent financial features.
- **Scope:** World Bank India annual GDP growth and CPI inflation, official allowlisted server fetch, strict provider validation with original decimal lexemes, source rights/attribution, Mongo raw snapshots, PostgreSQL canonical revisions and sync records, operator-protected manual refresh, public values/history/source details, responsive UI and executable API/browser tests. No fabricated defaults if upstream or storage fails.
- **Acceptance:** User can refresh real provider data in UI, inspect years/units/source timestamps, reload persisted values, inspect revisions and source status; failed/invalid ingestion never replaces accepted data; repeated refresh deduplicates values; unauthorized refresh rejects; upstream error and stale-cache states are explicit.
- **Codex prompt:** Read AGENTS/README/TODO and implement DATA-001 contracts first through real adapter, additive migration, persistence, API, React screen and meaningful unit/API/browser cases. Preserve decimal tokens, nulls, revisions and raw-source hashes. Use a configured local operator key for writes; never expose credentials or permit arbitrary fetch URLs. No synthetic application data, automatic background refresh or automatic tests/migrations. Update all task/source progress honestly, commit locally with hooks disabled, never push. Continue dependent feature work without seeking routine reconfirmation; leave actual provider/production gates explicit.

- **Delivery:** packages/contracts/src/macro.ts; World Bank adapter, macro service/controller, additive 002 migration, Mongo source snapshots, Macro.tsx and local research-key setup tool. E2E-API-020/021 and E2E-WEB-020 plus parser precision/quarantine tests authored. See docs/development/real-data.md for manual setup and expected outcomes.
- **Scope remaining:** Other sources, real equity holdings, regulated advice and real user accounts are not delivered by this macro feature. No startup sync, automatic execution or push performed.

## ACCOUNT-001 — Authenticated accounts and real-data watchlists

- **Implementation:** Implemented
- **Verification:** Not run; manual execution remains required.
- **Dependencies:** DATA-001, bounded DEV-007/017/018 implementation.
- **Request:** Continue end-to-end backlog development beyond synthetic data.
- **Scope:** Username/password registration and login, explicit storage consent, server-side expiring sessions with HttpOnly cookie, origin checks and rate limiting, persisted per-user macro watchlists, personal real-data view, logout and password-confirmed account deletion. No email/broker identity claim or production deployment.
- **Acceptance:** Register, choose real indicator subscriptions, reload, logout/login and retain choices; independent accounts cannot see each other's choices; bad login/origin/body rejects; deletion revokes sessions and removes private rows; no keys in browser storage.
- **Codex prompt:** Implement shared strict schemas, additive auth/watchlist migration, password/session/ownership services, API and React account flow with real macro data. Use asynchronous salted scrypt and hashed random sessions, bounded work, origin/CSRF checks, cookie-only private access and explicit account deletion. Author API/browser acceptance for positive/negative paths; do not run tests/migrations/services. Update README/TODO and commit locally, never push. Do not mark broader production auth or financial advice complete.

- **Delivery:** Strict account schemas; 003 migration; scrypt/Origin/session/rate-limit service and account API; account/watchlist UI; E2E-API-030/031 and E2E-WEB-030; password/origin/session unit cases. Follow docs/development/accounts.md for manual verification.
- **Remaining:** Production account recovery/MFA/households, real equity portfolios and active alert delivery remain open in parent tasks. Authored end-to-end implementation is not a test-pass claim.

## ALERT-001 — Personal observation inbox and revision acknowledgments

- **Implementation:** Implemented
- **Verification:** Not run.
- **Scope:** An authenticated user's followed real indicators produce an in-app latest-observation inbox. Read receipts bind to exact observation IDs; a later revision remains unread. No email/push, invented materiality threshold or investment action.
- **Acceptance:** Real source values flow into personal inbox, acknowledgment persists across reload/login, another account retains independent read state, non-followed observations cannot be acknowledged, stale-source state and corrections are explicit.
- **Codex prompt:** Extend ACCOUNT-001/DATA-001 with strict inbox contracts, additive read-receipt storage, ownership-scoped GET and Origin-protected acknowledgment API, actionable React inbox and real-data API/browser cases. Do not fabricate events or run tests/services/migrations. Update TODO/README and commit locally, never push.

- **Delivery:** 004 inbox migration, strict shared contracts, session-owned inbox and acknowledgment endpoints, account UI and E2E-API-040/E2E-WEB-040. Source values come from DATA-001, not fixtures. No tests, migrations or service actions executed. Manual: format → check → db:migrate, then run @ALERT-001 in API/desktop/mobile with provider access.

## BUG-004 — New E2E files fail discovery

- **Implementation:** Implemented; awaiting user verification
- **Verification:** User reports no tests in UI; no runner executed by Codex.
- **Cause:** Six account/macro/inbox spec files set worker-scoped trace/video/screenshot options inside test.describe. Installed Playwright fixtures.js explicitly rejects this during collection.
- **Codex prompt:** Move the capture-disable test.use declarations to file scope in all six affected specs. Preserve credential protection and test assertions. Update README/catalogue, inspect source, commit locally without hooks or push. User manually reopens the UI and verifies discovery and selected execution.

- **Manual next actions:** Reopen E2E UI, clear filters, verify all case groups list. Run selected cases manually. No dependency, database or app changes required. No checks run or push performed.

## BUG-005 — Missing method brace prevents API compilation

- **Implementation:** Implemented; manual verification pending.
- **Evidence:** User's pasted output shows Prettier syntax error at accounts.ts:99 before remove(). Source inspection confirms acknowledge() lacked its closing brace. Operator setup and both databases succeeded; dev startup was separately blocked by existing listeners.
- **Codex prompt:** Restore the missing method delimiter, preserve user formatting changes, record the failure and recovery in TODO/README/catalogue, commit only the scoped fix. Do not run format/check/build/tests/services or push. Existing compilation and account/inbox E2E cases provide regression coverage; do not add a test that merely counts braces.
- **Manual next actions:** Stop the existing dev terminal, run pnpm format and pnpm check successfully, then pnpm db:migrate and pnpm dev. The migration executed before this successful build may have used old dist output; rerun it after compilation. Run account/inbox cases in the manual UI; report the first failing step if any.

## SDLC-002 — Complete change handoffs and readable manual test evidence

- **Commit completion follow-up:** User explicitly requests committing the remaining working-tree changes. Reviewed the pending source diff and included the existing API/web/contracts/scripts/test formatting edits in a local commit without running hooks or checks. Prompt: preserve and commit all remaining tracked changes, update this record and README, confirm Git status, and never push. No new runtime behavior or test cases authored for this commit-only request; existing checks and acceptance cases remain pending manual execution.

- **Implementation:** Implemented; manual verification pending.
- **Request/context:** User reports missing commits/SDLC steps and difficulty copying Playwright UI failures. Existing fixes are committed as 8cb2a1d, 1e6adab and d596552; remaining working-tree edits require review and preservation.
- **Scope:** Audit local change records; correct stale testing documentation; add a local Markdown reporter for manually initiated UI/CLI test runs, retaining per-run evidence and a latest-result pointer. No automatic tests, uploads, pushes or service actions.
- **Dependencies:** Existing Playwright runner and local artifact directory; no new packages.
- **Acceptance:** Every manual run records selected cases, outcomes, failures, locations and run identity; repeat runs do not present old failures as current; sensitive configuration values are redacted; imports/discovery do not create artifacts. User can ask Codex to read the latest report without copying browser errors. Source changes, cases, README and TODO are committed locally.
- **Codex prompt:** Inspect Git history and pending changes without executing gates. Implement a reusable Playwright reporter that writes human-readable failure evidence during manual execution, covers pass/fail/skip/interruption/global errors, preserves historical run files and publishes a latest summary. Avoid attachments/response dumps and redact known secrets. Add isolated reporter tests and manual UI acceptance cases, update coverage and SDLC guidance, inspect the diff, and commit scoped work without hooks or push. Keep authored and verified statuses separate; report remaining working-tree changes explicitly.
- **Manual next actions:** pnpm format, pnpm check, reopen E2E UI, manually run selected cases, then ask Codex to read artifacts/e2e/latest.md. Verify the acceptance cases linked in CATALOG.md.
- **Delivery/evidence:** Added handoff reporter, isolated regression definitions and SDLC-UI-001–005/SDLC-DOC-001 acceptance cases; corrected stale port/report guidance and clarified commit audits. No tests, formatting, builds or services run. Pre-existing app/API/contracts and other test/script edits remain outside this scoped change; they are preserved, not claimed committed by this task.

## DEV-PORTS-001 — Automatic local port selection and dependency propagation

- **Restart follow-up:** User reports EADDRINUSE on 4101 after node watch restarts. The old API dev command reloads the shared env file, allowing a legacy session to adopt another session's selected port. Implementation: API dev wrapper snapshots env before watch starts and preserves root-selected environment values across restarts. Prompt: isolate each API watch session from subsequent .env changes without changing production start or migrations; preserve free-port selection and dependent configuration, document legacy-watcher restart, and commit locally. Verification pending; no services or checks executed. Stop pre-fix dev watchers once, then manually verify two new sessions retain distinct ports after a source edit.

- **Lint follow-up:** User reports formatting passed but ESLint rejected two side-effect ternaries in local-ports.mjs. Replaced them with explicit if/else branches, preserving process signaling and exit handling. Reusable prompt: fix the two no-unused-expressions violations without changing launcher behavior or weakening lint rules; update documentation and commit locally. Verification remains pending; manually rerun pnpm format and pnpm check.

- **Implementation:** Implemented; manual verification pending
- **Request:** User wants occupied ports resolved automatically for services and dependents informed, instead of manually killing listeners.
- **Scope:** Root dev launcher selects free API/web ports; local Compose wrapper reuses owned running DB mappings or selects available bindings and updates database URLs. Persist selections in .env; Vite proxy/API Origin checks/migrations/smoke/test targets consume these settings. E2E UI/report choose available listener ports. Never terminate unrelated listeners. Existing app/test sessions retain their launch configuration; new sessions use the latest selection.
- **Codex prompt:** Implement reusable bounded loopback port selection, process-group cleanup of spawned processes, managed Compose mapping detection, selective env updates preserving secrets, and dynamic test/config consumers. Author meaningful port/env regression cases and manual end-to-end acceptance; do not execute services, tests, migrations or port probes as Codex. Preserve existing user edits. Update README/TODO and commit locally without hooks or push.
- **Manual acceptance:** With the existing app running, pnpm dev must start on free app ports and reuse existing DB containers; new E2E UI targets those ports. A second E2E UI uses a different UI port. Auth registration remains valid on shifted web ports. Occupied non-project DB ports must cause different local bindings with corresponding URI changes. No volumes deleted or unrelated listeners stopped.

- **Cases:** tests/unit/local-ports.test.mjs covers occupied-port selection without stopping listeners, distinct assignments, URI preservation and env updates. Existing API/browser account/foundation cases verify dependency propagation on the chosen ports. No tests/format/build/port probes/container actions executed by Codex.
