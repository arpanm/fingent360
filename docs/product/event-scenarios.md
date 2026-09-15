# Source-bound event scenarios

EVENT-SCENARIOS-001 implements a shared reviewed-measurement workflow for DEV-020. Code and acceptance cases are authored; no tests, source ingestion, migrations or live-provider acceptance have been executed.

## Family-specific contracts

Seven families have separate strict schemas and visible forms:

- Monetary policy: RBI policy rate, or Federal Reserve target lower/upper bound or primary credit rate. Explicit percent values; no ambiguous single Federal Reserve policy rate.
- Inflation: headline/core CPI; annual/monthly basis; seasonal adjustment.
- GDP: real annual, quarterly, annualized quarterly or nominal annual growth; advance/second/third/revised vintage.
- Earnings: reviewed company ISIN; revenue/PAT/EPS; consolidated/standalone; INR/lakh/crore/per-share scale. EPS requires per-share units.
- Guidance: reviewed company identity; revenue growth, margin or revenue. Growth/margin use percent; revenue requires currency scale. Guidance remains forward-looking.
- Governance/regulatory: authority, enforcement/rule/disclosure category, actual retained excerpt, explicit editorial interpretation, inherited reviewed effective date. No numerical or legal effect is invented.
- FPI/liquidity: FPI/FII/DII and provisional cash equity/total equity/debt/derivatives segments; exact INR-crore units. Different scopes are never automatically combined.

Every draft binds a currently admitted reviewed event ID/version. Numeric values must appear as exact standalone tokens in the chosen retained event citation. A substring such as 2 inside 2.9 is rejected; comma-grouped and fractional representations are not silently normalised. The explicit source excerpt, source document/hash/version, effective/publication/retrieval context, family metadata, original input and deterministic final view are retained together. Family/period/unit interpretation requires independent editorial review; token matching alone does not establish semantic correctness.

## Reference and arithmetic policy

Reference choices are sourced prior observation, earlier published expectation, explicit hypothetical assumption, or no reference. A prior publication used as an expectation must predate the observed release and concern the same declared period. Later-published prior-period vintages are disclosed as not known at the observed release time. No supplied expectation is promoted to market-wide consensus.

Observed minus reference is calculated using signed BigInt decimals with eight places and canonical decimal output. Percent differences are percentage points, not relative percentage returns. No reference produces no numerical difference. Regulatory outcomes expose only reviewed effective-time status. Direction means the measure rose/fell/was unchanged; it does not classify stocks or advice. Every outcome includes a no-action statement: no portfolio/goal change is calculated or executed.

Source publications older than 30 days are labelled historical; current public reads re-evaluate this warning. Event claim kind is retained, and an inference/scenario is not promoted to observed fact. Source withdrawals, changed source/identity/event versions or event supersession make the public scenario unavailable until a new explicit review.

## Storage and independent review

Migration053_event_scenarios.sql adds mutable scenario heads plus immutable version/review ledgers. Preparation saves draft editions; publication/withdrawal requires an approve-capable actor. Named mode forbids the original draft author from publishing their own edition. Bootstrap mode remains the existing explicitly configured local administration mode. Actor identity is hashed before storage; no bootstrap key is retained.

Preparation and review request IDs are idempotent, serialized with advisory/row locks; changed-input reuse409, stale version409. Actor permission is rechecked after waits. Each draft/result is validated by reconstructing it from retained event/model snapshots. Published content is separately re-admitted on each read; retained history is not silently overwritten.

API: public GET /event-scenarios (after/eventId filters), /:id, /:id/history (before), /snapshot. Protected GET /ops/event-scenarios; PUT /ops/event-scenarios/:id; POST /ops/event-scenarios/:id/review. Every path is under /api/v1. Public history exposes published edition identifiers/timestamps, not unreviewed drafts. Current scenario details connect back to the actual reviewed event. History metadata does not imply that old content is still valid for current use.

The public snapshot rejects over1000 items or over4MiB; it never silently drops current scenarios to fit the app. Each history page contains at most50 published edition metadata records with an explicit older cursor. The installed snapshot cannot retrieve earlier history outside its bundled window and gives an explicit recovery message. No private user data is introduced, so account privacy export is not applicable. Scenario receipts themselves retain all final display data; this deterministic feature makes no LLM calls.

## UI and offline

Public #event-scenarios lists scenarios with pagination; #event-scenarios/:id shows family, measure/reference, exact delta, uncertainty, source excerpts/versions, historical warning, publication history and reviewed-event navigation. Loading/empty/unavailable/error/retry states are explicit. Operations provides actual family-specific controls, source citation selectors, draft revision, inspection and independent publish/withdraw. Parent Operations request handling owns session-denial navigation. Inputs are labelled, keyboard-operable and44px minimum; long source text wraps on mobile. Web and Android use the same React code.

Offline bundles retain public scenario snapshots. The handler reuses existing local event/source/identity/lineage admission before showing any receipt. Changed/withdrawn evidence is hidden, not silently trusted from an older scenario snapshot. Public local reads need no account/network and do not change local finances. Preparing/reviewing requires connected Operations. APK rebuild/reinstallation is still required for code/data updates.

## Historical evidence and goldens

Read-only official research on 2026-09-14 checked the BLS July2024 CPI release. Table4 US city average gives July annual CPI-U2.9 and June3.0; the golden difference is -0.1 percentage point, a prior-observation change. This is not consensus surprise and is not an executed BLS ingestion acceptance. [Official BLS release](https://www.bls.gov/news.release/archives/cpi_08142024.htm).

Also consulted the [Federal Reserve September18,2024 implementation note](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a1.htm). Its fractional-rate representation illustrates why the parser must not silently treat source fractions as decimal tokens. No Federal Reserve numerical adapter acceptance is claimed by this scenario module.

API1020: real isolated retained event→draft→review→public receipt/history→source-event withdrawal; replay/conflict. API1021: unsupported numeric token and stale event rejection. WEB1020 desktop/mobile: actual Operations preparation/publication and public detail/history/event return. OFFLINE1020: no-network retained event admission/withdrawal. OFFLINE1021: all seven family golden arithmetic, no-reference/hypothetical labels, ambiguous substring rejection, and rejection of same-release expectations. OFFLINE1022: official historical CPI arithmetic and exact decimal precision. Nonhistorical fixture measurements/identities/interpretations are explicitly synthetic and never seed production data.

## Remaining DEV-020 scope

This implements family-specific reviewed descriptive comparisons, not automatic verified-live onboarding for all requested providers. Actual RBI/MoSPI/company filings/FPI capture, release-calendar completion, multi-provider reconciliation, representative provider format fixtures and causal-policy/portfolio transmission acceptance remain dependencies. Only the BLS historical arithmetic golden was independently sourced here; other family golden values are synthetic. Do not mark all real event packs or causal outcomes verified because these schemas/UI/API exist. Numerical surprises need a legitimate earlier published expectation; no source means no surprise.

Manual acceptance pending: keyboard/touch/TalkBack, large text/portrait/landscape, actual named independent review denial, source supersession during review, rebuilt offline APK and current-source onboarding per family.

## SDLC-REPAIR-006 — callback narrowing

OFFLINE1021 captures the model in a local constant before checking for numeric observations. This preserves TypeScript narrowing inside deferred assertion callbacks, where narrowing of the mutable input.model property was lost. The regulatory union remains unchanged; no type assertions or schema relaxation are used. Existing synthetic fixtures and rejection paths are retained, with a final original-input comparison asserting that invalid variants did not mutate the fixture.

Authored, not verified. Smallest manual compiler validation: `pnpm e2e:typecheck`; expect exit 0 with no diagnostics. No services, UI URL, migrations or dependency changes are required. The parent owns the exact `pnpm check` retry. Existing E2E-OFFLINE-1021 / @EVENT-SCENARIOS-001 runtime acceptance remains pending; this compiler repair does not establish browser, API or offline runtime passes. Report the failing command, exit code and compiler diagnostics if the retry fails.
