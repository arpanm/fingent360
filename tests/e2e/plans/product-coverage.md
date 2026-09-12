# Planned end-to-end coverage

These are scenario requirements, not executed tests. Link each case to TODO. Implement runnable cases when the matching behavior exists; do not create skipped placeholders that make coverage appear complete. For document-only work, the user reviews the listed acceptance artifacts.

<a id="dev-001"></a>

## DEV-001 — Screen-level PRD, glossary and canonical data dictionary

- Task: [TODO DEV-001](../../../TODO.md#dev-001)
- Prerequisites: SETUP-001.
- Authored manual cases: [DOC-001–DOC-015](dev-001-acceptance.md), linked to the screen PRD and canonical dictionary. Awaiting user document review.
- Acceptance coverage: Public/personal home, event/company, portfolio/goal and action flows; empty/error/stale/conflict states; field units, currency, times and identifiers
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-002"></a>

## DEV-002 — Research/advice policy and threat model

- Task: [TODO DEV-002](../../../TODO.md#dev-002)
- Prerequisites: DEV-001.
- Acceptance coverage: Explicit allowed vocabulary and activation gates; document injection, uploaded PII, tenant access, consent and deletion design
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-003"></a>

## DEV-003 — Versioned domain contracts and golden fixtures

- Task: [TODO DEV-003](../../../TODO.md#dev-003)
- Prerequisites: DEV-001, DEV-002.
- Acceptance coverage: Instrument, evidence, observation, event/edge, portfolio/lot, goal/profile and policy-result schemas; strict rejection and decimal/reconciliation rules
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-004"></a>

## DEV-004 — PostgreSQL migrations and MongoDB indexes

- Task: [TODO DEV-004](../../../TODO.md#dev-004)
- Prerequisites: DEV-003.
- Acceptance coverage: Repeatable migrations, tenant boundaries and least-privilege application access; versioned observations; transaction-safe jobs/outbox schema
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-005"></a>

## DEV-005 — P0 source registry and initial adapters

- Task: [TODO DEV-005](../../../TODO.md#dev-005)
- Prerequisites: DEV-003, DEV-004.
- Acceptance coverage: Terms and freshness recorded; provenance tests, fixtures, quarantine, retries, reconciliation; source status updated honestly
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-006"></a>

## DEV-006 — Public intelligence slice

- Task: [TODO DEV-006](../../../TODO.md#dev-006)
- Prerequisites: DEV-005.
- Acceptance coverage: Five/six verified points; event, sector and company details; supporting sources, corrections, stale/unavailable states
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-007"></a>

## DEV-007 — Identity/consent and manual/virtual portfolios

- Task: [TODO DEV-007](../../../TODO.md#dev-007)
- Prerequisites: DEV-002, DEV-004.
- Acceptance coverage: Authenticated ownership, consent, exact quantities/amounts, synthetic demo clearly distinguished
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-008"></a>

## DEV-008 — CSV/XLSX imports and help

- Task: [TODO DEV-008](../../../TODO.md#dev-008)
- Prerequisites: DEV-007.
- Acceptance coverage: Platform-specific formats and fixtures; preview/corrections; duplicate detection and source-total reconciliation; private upload handling
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-009"></a>

## DEV-009 — Multiple goals and portfolio linkage

- Task: [TODO DEV-009](../../../TODO.md#dev-009)
- Prerequisites: DEV-003, DEV-007.
- Acceptance coverage: Repeat goal types, visible editable assumptions; contribution/horizon/risk feasibility; no guaranteed return
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-010"></a>

## DEV-010 — Oil-shock educational end-to-end slice

- Task: [TODO DEV-010](../../../TODO.md#dev-010)
- Prerequisites: DEV-006, DEV-008, DEV-009.
- Acceptance coverage: Evidence → factor → sector → company → holding → goal traceable; no-action comparator; stale/conflicting inputs cannot generate confident action
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-011"></a>

## DEV-011 — Daily/weekly reports and durable workers

- Task: [TODO DEV-011](../../../TODO.md#dev-011)
- Prerequisites: DEV-004, DEV-010.
- Acceptance coverage: PostgreSQL idempotent jobs/outbox, retries/leases, freshness-aware reports and material-change notifications
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-012"></a>

## DEV-012 — Responsive PWA and accessible UI

- Task: [TODO DEV-012](../../../TODO.md#dev-012)
- Prerequisites: DEV-006.
- Acceptance coverage: Routing, manifest/icons, installability, offline shell, no caching of sensitive portfolio/API responses, mobile and keyboard validation
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-013"></a>

## DEV-013 — Regulated personalised advice

- Task: [TODO DEV-013](../../../TODO.md#dev-013)
- Prerequisites: DEV-010 and approved operating model.
- Acceptance coverage: Counsel/partner/registration approval, suitability, audit reconstruction, review and kill-switch evidence
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-014"></a>

## DEV-014 — Broker connectivity and later channels/assets

- Task: [TODO DEV-014](../../../TODO.md#dev-014)
- Prerequisites: Relevant accepted gates.
- Acceptance coverage: Consent/OAuth reconciliation; WhatsApp/mobile controls; each asset's data/calculation/suitability tests
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-015"></a>

## DEV-015 — Admin and research operations

- Task: [TODO DEV-015](../../../TODO.md#dev-015)
- Prerequisites: DEV-002, DEV-005, DEV-019.
- Acceptance coverage: Source registry, job health, data quarantine/entity-resolution review, event merge/split/corrections, causal-edge approvals, policy simulations/releases, complaints and audit search. Add role-controlled review queues and four-eyes approval for material policy/content changes.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-016"></a>

## DEV-016 — Evidence, explanations and corrections

- Task: [TODO DEV-016](../../../TODO.md#dev-016)
- Prerequisites: DEV-003, DEV-005.
- Acceptance coverage: Implement progressive one-line/beginner/portfolio/analytical/source layers; distinguish facts, expectations, scenarios and inference. Every material claim links to entailed source sections/timestamps and exposes freshness, conflicts and revisions. English first with a controlled glossary; no invented citations.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-017"></a>

## DEV-017 — Privacy, security and consent lifecycle

- Task: [TODO DEV-017](../../../TODO.md#dev-017)
- Prerequisites: DEV-002, DEV-004, DEV-007.
- Acceptance coverage: Tenant isolation; granular consent expiry/revocation; PII encryption/retention/export/deletion; broker token vault and least privilege; isolated document parsing; untrusted-document injection tests; audit support access. Never use real private holdings as test fixtures.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-018"></a>

## DEV-018 — Watchlists, material alerts and delivery controls

- Task: [TODO DEV-018](../../../TODO.md#dev-018)
- Prerequisites: DEV-006, DEV-011.
- Acceptance coverage: Watchlist management, calendar-based context, batching, mute preferences and material-event thresholds. Separate data/account alerts from investment actions; test unchanged/non-material inputs do not cause urgency or repeated notifications.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-019"></a>

## DEV-019 — Deterministic research policy and action centre

- Task: [TODO DEV-019](../../../TODO.md#dev-019)
- Prerequisites: DEV-003, DEV-008, DEV-009, DEV-016.
- Acceptance coverage: Versioned candidate policies with goal suitability, materiality, taxes/costs/liquidity, concentration bands, cooldowns and turnover budgets. Compare with no action; retain immutable results with size, goal, evidence, timing, downside, alternatives and invalidation. Educational/simulation mode only; no LLM decision or execution.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-020"></a>

## DEV-020 — Additional verified event slices

- Task: [TODO DEV-020](../../../TODO.md#dev-020)
- Prerequisites: DEV-010, DEV-016, DEV-019.
- Acceptance coverage: Add RBI/Fed decisions, CPI/GDP surprises, company earnings/guidance, governance/regulatory shocks and FPI/liquidity events as separate child tasks before implementation. Define each source vintage, causal mapping, scenario/actual distinction and golden outcomes.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-021"></a>

## DEV-021 — Operational quality, observability and release controls

- Task: [TODO DEV-021](../../../TODO.md#dev-021)
- Prerequisites: DEV-002, DEV-011, DEV-017.
- Acceptance coverage: Define SLAs, data-quality dashboards, traces/metrics/structured logs, audit reconstruction, kill switches and rollback/runbooks. Author evaluation, performance/security and reconciliation acceptance plans. User runs deterministic checks; do not claim launch-ready without evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-022"></a>

## DEV-022 — Indian mutual funds and bonds

- Task: [TODO DEV-022](../../../TODO.md#dev-022)
- Prerequisites: DEV-009, DEV-019; SRC-015–SRC-019.
- Acceptance coverage: Add scheme/share-class identity, NAV/history/mergers, disclosed fund look-through lags, bond clean/dirty price/accrued interest/duration/credit/liquidity, exact XIRR and deposit alternatives. Add asset-specific policy and fixtures before widening recommendations.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-023"></a>

## DEV-023 — Other Indian assets and derivatives

- Task: [TODO DEV-023](../../../TODO.md#dev-023)
- Prerequisites: DEV-022; SRC-022, SRC-023.
- Acceptance coverage: Split ETFs, gold/silver, REITs/InvITs, commodities and derivatives into separately accepted child tasks. Handle premiums/spreads, tracking, currency/duties, payoff/margin/expiry and suitability. Beginner derivatives stay educational and gated.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-024"></a>

## DEV-024 — International mutual funds

- Task: [TODO DEV-024](../../../TODO.md#dev-024)
- Prerequisites: DEV-022; SRC-024.
- Acceptance coverage: Choose the first supported jurisdiction through an explicit product decision; canonicalise country, currency, share-class/distribution variants, NAV, FX, fees, taxation and fund look-through. Define fixtures and legal/data acceptance before enabling.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-025"></a>

## DEV-025 — International equities and ETFs

- Task: [TODO DEV-025](../../../TODO.md#dev-025)
- Prerequisites: DEV-024; SRC-025.
- Acceptance coverage: Implement first approved market identity, exchange calendar, corporate actions, entitled EOD prices, issuer filings/fundamentals, FX conversion and tax/suitability. Expand one jurisdiction at a time with approved source rights.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-026"></a>

## DEV-026 — Other international assets

- Task: [TODO DEV-026](../../../TODO.md#dev-026)
- Prerequisites: DEV-025; SRC-026.
- Acceptance coverage: Create per-country/asset child tasks for bonds, commodities and derivatives; require dedicated price/liquidity/valuation, settlement, risk and regulatory evaluation packs before support is enabled.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-027"></a>

## DEV-027 — Crypto last-stage capability

- Task: [TODO DEV-027](../../../TODO.md#dev-027)
- Prerequisites: DEV-026; SRC-027.
- Acceptance coverage: Keep deferred until product/regulatory acceptance. Define fragmented venue identity/prices, custody and manipulation risk, on-chain evidence, tax and strict suitability; do not substitute sentiment/on-chain activity for validated policy.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-028"></a>

## DEV-028 — Broker and account connectivity

- Task: [TODO DEV-028](../../../TODO.md#dev-028)
- Prerequisites: DEV-008, DEV-017; SRC-019, SRC-021.
- Acceptance coverage: Add approved broker OAuth, CAS/registrar and eligible Account Aggregator pathways as separate tasks; preserve consent/revocation, sync reconciliation, provider entitlement and format versions. Never collect broker passwords or OTPs.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-029"></a>

## DEV-029 — WhatsApp and mobile application shells

- Task: [TODO DEV-029](../../../TODO.md#dev-029)
- Prerequisites: DEV-012, DEV-017, DEV-018.
- Acceptance coverage: Implement WhatsApp summaries/deep links and Android/iOS webview shells only after channel acceptance. Preserve secure session boundaries, notification preferences, evidence links and jurisdiction/consent controls across channels.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="dev-030"></a>

## DEV-030 — Monetisation decision and commercial conflict controls

- Task: [TODO DEV-030](../../../TODO.md#dev-030)
- Prerequisites: Explicit user business-model decision.
- Acceptance coverage: Keep freemium/subscription/adviser/B2B2C/white-label options open; do not invent pricing or billing behavior. Once selected, separate entitlements and disclosed commercial relationships from suitability/recommendation ranking; log ranking provenance.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-001"></a>

## SRC-001 — Instrument/security master source onboarding (P0)

- Task: [TODO SRC-001](../../../TODO.md#src-001)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Instrument/security master. Starting public candidates: NSE + BSE + ISIN crosswalk. Paid upgrade candidates: NSE/BSE licensed data; Capitaline/ACE. Next action from the accepted plan: Obtain files, document terms, define canonical ISIN/symbol schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-002"></a>

## SRC-002 — Indian EOD prices/volume source onboarding (P0)

- Task: [TODO SRC-002](../../../TODO.md#src-002)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Indian EOD prices/volume. Starting public candidates: NSE/BSE EOD reports. Paid upgrade candidates: NSE/BSE licensed EOD feed. Next action from the accepted plan: Confirm automated-use rights; build dual-source reconciliation. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-003"></a>

## SRC-003 — Corporate actions source onboarding (P0)

- Task: [TODO SRC-003](../../../TODO.md#src-003)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Corporate actions. Starting public candidates: NSE/BSE + issuer filings. Paid upgrade candidates: Exchange corporate-data feed; LSEG/FactSet. Next action from the accepted plan: Build action taxonomy and adjusted-price golden tests. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-004"></a>

## SRC-004 — Corporate filings/results source onboarding (P0)

- Task: [TODO SRC-004](../../../TODO.md#src-004)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Corporate filings/results. Starting public candidates: NSE/BSE + issuer IR. Paid upgrade candidates: Exchange corporate feed; AlphaSense/Capital IQ. Next action from the accepted plan: Build filing registry, hash/version and entitlement policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-005"></a>

## SRC-005 — Reported fundamentals source onboarding (P0)

- Task: [TODO SRC-005](../../../TODO.md#src-005)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Reported fundamentals. Starting public candidates: Filing/XBRL extraction. Paid upgrade candidates: Capitaline/ACE/CMIE. Next action from the accepted plan: Select initial financial schema and 25-company validation set. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-006"></a>

## SRC-006 — Index/sector data source onboarding (P0)

- Task: [TODO SRC-006](../../../TODO.md#src-006)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Index/sector data. Starting public candidates: NSE Indices/BSE Indices. Paid upgrade candidates: Licensed index feed. Next action from the accepted plan: Validate constituent/history rights and create classification crosswalk. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-007"></a>

## SRC-007 — India macro source onboarding (P0)

- Task: [TODO SRC-007](../../../TODO.md#src-007)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard India macro. Starting public candidates: MoSPI + RBI/DBIE. Paid upgrade candidates: CEIC/Macrobond/CMIE. Next action from the accepted plan: Create release calendar, vintage model and initial series registry. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-008"></a>

## SRC-008 — Global macro/rates source onboarding (P0)

- Task: [TODO SRC-008](../../../TODO.md#src-008)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Global macro/rates. Starting public candidates: FRED, BLS, BEA, Treasury, Fed, ECB. Paid upgrade candidates: Macrobond/Haver/Bloomberg/LSEG. Next action from the accepted plan: Identify minimum India-impact series and official API limits. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-009"></a>

## SRC-009 — Oil/commodity/FX benchmarks source onboarding (P0)

- Task: [TODO SRC-009](../../../TODO.md#src-009)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Oil/commodity/FX benchmarks. Starting public candidates: EIA, World Bank, RBI/FBIL, official releases. Paid upgrade candidates: ICE/CME/LSEG/Bloomberg. Next action from the accepted plan: Define permissible EOD benchmarks and currency conversion rules. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-010"></a>

## SRC-010 — FII/DII/FPI flows source onboarding (P0)

- Task: [TODO SRC-010](../../../TODO.md#src-010)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard FII/DII/FPI flows. Starting public candidates: NSE + NSDL/CDSL. Paid upgrade candidates: Exchange/depository feed; EPFR. Next action from the accepted plan: Separate provisional cash, total FPI and derivatives measures. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-011"></a>

## SRC-011 — F&O participant positioning source onboarding (P0)

- Task: [TODO SRC-011](../../../TODO.md#src-011)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard F&O participant positioning. Starting public candidates: NSE participant OI and bhavcopy. Paid upgrade candidates: NSE analytics feed. Next action from the accepted plan: Create positioning metrics and block misleading single-number narratives. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-012"></a>

## SRC-012 — Market/company news source onboarding (P0)

- Task: [TODO SRC-012](../../../TODO.md#src-012)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Market/company news. Starting public candidates: Primary filings/releases + permitted reputable links. Paid upgrade candidates: Reuters/LSEG or Dow Jones/Factiva. Next action from the accepted plan: Define link-only/full-text rights and two-source verification policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-013"></a>

## SRC-013 — Portfolio spreadsheet imports source onboarding (P0)

- Task: [TODO SRC-013](../../../TODO.md#src-013)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Portfolio spreadsheet imports. Starting public candidates: User CSV/XLSX exports. Paid upgrade candidates: Aggregation/broker partners later. Next action from the accepted plan: Collect sample exports from initial five Indian platforms and build versioned parsers. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-014"></a>

## SRC-014 — Regulatory/tax source registry source onboarding (P0)

- Task: [TODO SRC-014](../../../TODO.md#src-014)
- Prerequisites: DEV-003, DEV-004, DEV-005; Yes.
- Acceptance coverage: Onboard Regulatory/tax source registry. Starting public candidates: SEBI, RBI, Income Tax, Finance Ministry. Paid upgrade candidates: Taxmann + counsel/compliance partner. Next action from the accepted plan: Counsel review; effective-dated policy schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-015"></a>

## SRC-015 — MF scheme master/NAV source onboarding (P1)

- Task: [TODO SRC-015](../../../TODO.md#src-015)
- Prerequisites: DEV-003, DEV-004, DEV-005; P1 gate.
- Acceptance coverage: Onboard MF scheme master/NAV. Starting public candidates: AMFI. Paid upgrade candidates: Morningstar/CRISIL/Lipper. Next action from the accepted plan: Validate AMFI use terms; map scheme variants and history. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-016"></a>

## SRC-016 — MF holdings/factsheets source onboarding (P1)

- Task: [TODO SRC-016](../../../TODO.md#src-016)
- Prerequisites: DEV-003, DEV-004, DEV-005; P1 gate.
- Acceptance coverage: Onboard MF holdings/factsheets. Starting public candidates: AMC/SEBI disclosures. Paid upgrade candidates: Morningstar/CRISIL/Lipper. Next action from the accepted plan: Choose top AMCs and test portfolio-disclosure parsers. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-017"></a>

## SRC-017 — India G-sec/yield curve source onboarding (P1)

- Task: [TODO SRC-017](../../../TODO.md#src-017)
- Prerequisites: DEV-003, DEV-004, DEV-005; P1 gate.
- Acceptance coverage: Onboard India G-sec/yield curve. Starting public candidates: RBI/FBIL/CCIL public reports. Paid upgrade candidates: CCIL/Bloomberg/LSEG. Next action from the accepted plan: Validate benchmark rights and bond calculator inputs. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-018"></a>

## SRC-018 — Corporate bonds/ratings source onboarding (P1)

- Task: [TODO SRC-018](../../../TODO.md#src-018)
- Prerequisites: DEV-003, DEV-004, DEV-005; P1 gate.
- Acceptance coverage: Onboard Corporate bonds/ratings. Starting public candidates: NSE/BSE + rating releases. Paid upgrade candidates: CRISIL MI&A/Bloomberg/LSEG. Next action from the accepted plan: Define liquidity, evaluated-price and credit-event policy. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-019"></a>

## SRC-019 — CAS/MF statement import source onboarding (P1)

- Task: [TODO SRC-019](../../../TODO.md#src-019)
- Prerequisites: DEV-003, DEV-004, DEV-005; P1 gate.
- Acceptance coverage: Onboard CAS/MF statement import. Starting public candidates: User-uploaded CDSL/NSDL/RTA statements. Paid upgrade candidates: Depository/RTA partner. Next action from the accepted plan: Gather formats; security/privacy review; reconciliation tests. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-020"></a>

## SRC-020 — Consensus/earnings revisions source onboarding (P1)

- Task: [TODO SRC-020](../../../TODO.md#src-020)
- Prerequisites: DEV-003, DEV-004, DEV-005; No for P0.
- Acceptance coverage: Onboard Consensus/earnings revisions. Starting public candidates: Company guidance only. Paid upgrade candidates: LSEG I/B/E/S/FactSet/Capital IQ. Next action from the accepted plan: Commercial comparison; feature remains unavailable until reliable. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-021"></a>

## SRC-021 — Broker API connectivity source onboarding (P2)

- Task: [TODO SRC-021](../../../TODO.md#src-021)
- Prerequisites: DEV-003, DEV-004, DEV-005; P2 gate.
- Acceptance coverage: Onboard Broker API connectivity. Starting public candidates: Official broker APIs. Paid upgrade candidates: Broker/aggregator partnership. Next action from the accepted plan: Prioritise brokers by target-user coverage; OAuth/consent design. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-022"></a>

## SRC-022 — Indian ETFs/gold/commodities source onboarding (P2)

- Task: [TODO SRC-022](../../../TODO.md#src-022)
- Prerequisites: DEV-003, DEV-004, DEV-005; P2 gate.
- Acceptance coverage: Onboard Indian ETFs/gold/commodities. Starting public candidates: Exchange/AMC/AMFI/EIA/World Bank. Paid upgrade candidates: MCX/ICE/CME/Morningstar. Next action from the accepted plan: Add asset families separately with tracking/liquidity models. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-023"></a>

## SRC-023 — Options/derivatives analytics source onboarding (P2)

- Task: [TODO SRC-023](../../../TODO.md#src-023)
- Prerequisites: DEV-003, DEV-004, DEV-005; P2/P3 gate.
- Acceptance coverage: Onboard Options/derivatives analytics. Starting public candidates: NSE EOD reports. Paid upgrade candidates: NSE licensed analytics. Next action from the accepted plan: Suitability and educational-only boundary before implementation. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-024"></a>

## SRC-024 — International mutual funds source onboarding (P3)

- Task: [TODO SRC-024](../../../TODO.md#src-024)
- Prerequisites: DEV-003, DEV-004, DEV-005; P3 gate.
- Acceptance coverage: Onboard International mutual funds. Starting public candidates: Issuer/regulator factsheets. Paid upgrade candidates: Morningstar/Lipper. Next action from the accepted plan: Select first jurisdictions and canonical share-class schema. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-025"></a>

## SRC-025 — International equities/ETFs source onboarding (P4)

- Task: [TODO SRC-025](../../../TODO.md#src-025)
- Prerequisites: DEV-003, DEV-004, DEV-005; P4 gate.
- Acceptance coverage: Onboard International equities/ETFs. Starting public candidates: SEC/issuer filings plus approved EOD source. Paid upgrade candidates: LSEG/Bloomberg/FactSet/ICE/vendor. Next action from the accepted plan: Choose first market, license prices/reference/corporate actions. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-026"></a>

## SRC-026 — International bonds/commodities source onboarding (P5)

- Task: [TODO SRC-026](../../../TODO.md#src-026)
- Prerequisites: DEV-003, DEV-004, DEV-005; P5 gate.
- Acceptance coverage: Onboard International bonds/commodities. Starting public candidates: Official issuers/central banks/reference sources. Paid upgrade candidates: Bloomberg/LSEG/ICE/CME/S&P Global. Next action from the accepted plan: Add one asset and jurisdiction per policy/evaluation pack. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.

<a id="src-027"></a>

## SRC-027 — Crypto market/on-chain source onboarding (P6)

- Task: [TODO SRC-027](../../../TODO.md#src-027)
- Prerequisites: DEV-003, DEV-004, DEV-005; P6 gate.
- Acceptance coverage: Onboard Crypto market/on-chain. Starting public candidates: Approved exchange/public blockchain sources. Paid upgrade candidates: Kaiko/Coin Metrics/CCData. Next action from the accepted plan: Regulatory, custody, tax and manipulation-risk design first. Document actual access/usage rights, effective/retrieval times, units, revisions, fixtures, quarantine and reconciliation. Source register currently says Not started; never mark production without user-provided approval and validation evidence.
- Failure coverage: reject missing/invalid inputs, unavailable dependencies and unauthorized/cross-user access where applicable; do not silently treat incomplete/stale/conflicting evidence as valid. For documentation tasks, review completeness, source traceability and unresolved decisions instead of issuing requests.
- Expected evidence: named assertions/steps with expected versus actual values and task/case IDs; use synthetic fixtures. No execution or passing result yet.
- On implementation: author concrete API/browser cases and add them to CATALOG.md; preserve the manual-only execution rule.
