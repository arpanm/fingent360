# Connected product experience — UX-001

The user subsequently rejected this mobile experience. [UX-002 mobile product plan](mobile-experience-plan.md) now defines the target navigation, reader, discovery and complete feature flows. This document records the implemented UX-001 scope and historical acceptance criteria; it does not establish user acceptance or completion of UX-002. Existing persistence/provenance guarantees remain applicable.

## Purpose and honest boundaries

Help an Indian beginner understand their saved information and reported economic evidence, then choose a concrete next step. The product currently supports education, manual record keeping and contribution-only planning. Cost basis is what the user entered, not market value; macro observations are annual reported history, not real-time prices. A source registry entry records review metadata, not a functioning adapter. No recommendation or trade follows automatically from a macro change.

## Complete workflow

| Stage              | User question                               | Required experience and persisted outcome                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview           | What can I do here and what have I saved?   | Clearly separate public research from signed-in account summaries. Reflect real API state, label missing information, and link to the next incomplete step. Never fill empty cards with synthetic holdings or returns.                                         |
| Account            | How do I save privately?                    | Explain consent before registration; make sign-in and registration distinct; show errors next to relevant actions; identify the signed-in account and expose sign-out. No password/token in URLs or exports.                                                   |
| Holdings           | What investments have I recorded?           | Guided manual entry or supported CSV preview → validation → confirmation → persisted records. Explain ISIN, quantity and cost basis, row errors, duplicates, revisions and deletion. Confirm saved data after reload. No inferred valuation.                   |
| Goals              | What am I saving toward?                    | Repeated goal types with distinct names, editable amounts/horizons, visible contribution assumptions and linked holding choices where supported. Explain shortfalls without promising returns. Preserve revisions and make archive/recovery behavior explicit. |
| Research and inbox | What evidence changed and what have I read? | Distinguish annual provider observations from personal unread status. Show effective/retrieval times, freshness, source and revisions. Follow/mute/acknowledge operate on the same saved account state. Operator refresh controls stay secondary.              |
| Privacy            | What is stored and who can access it?       | Explain export contents, session revocation and account deletion before irreversible actions. Preserve keyboard focus and give honest completion/failure feedback. Never expose another account's records.                                                     |

The synthetic learning exercise is a separately labelled activity, not the primary account portfolio or overview. Source administration is separate from ordinary investor actions.

## Interaction and visual acceptance

Every form has a clear primary action, understandable labels, examples where format matters, relevant validation and a saved-state confirmation. Loading and empty states distinguish no records from failed retrieval. Failed operations preserve user input where safe and give a retry or correction route. Navigation has a visible current location and meaningful page title. Displayed amounts include currency/units; dates identify their meaning.

Keyboard users can reach all controls in a logical order, see focus, submit forms, leave expandable panels, and operate confirmations without a pointer. Status/error updates are announced without ambiguous duplicate live regions. Responsive views retain readable text, usable touch targets and table containment; no obscured controls or page-wide horizontal overflow. At least desktop and narrow mobile views must be visually reviewed, including expanded evidence, long labels and error states. API passes alone cannot establish these properties.

## Per-feature review record

### Implemented overview contract and data model

`GET /api/v1/account/overview` returns the authenticated account's current goals, holdings snapshot, watchlist and observation inbox under a PostgreSQL repeatable-read, read-only transaction. It reuses migrations001–009; no new persisted onboarding flags, duplicate financial totals or migration are needed. Strict shared `OverviewSchema` validates the response at both server and browser boundaries. The session cookie and no-store policy match existing account endpoints. Goal projections and holding totals retain exact integer paise. The overview never sums goal balances as net worth, allocates holdings, or presents cost basis as valuation.

Four setup steps are derived from saved state: account, at least one active goal, at least one confirmed holding, and a nonempty watchlist. Removing those records reopens the corresponding step. Each navigation back to overview reads the latest database state. Annual market context loads independently from the public macro API; missing/private storage produces explicit error/retry states, not invented zeros. Rounded headline percentages and charts are display-only; exact observations, missing values, provenance and revisions remain accessible in Market context. Chart paths break at missing annual values.

The existing manual test UI and `pnpm sdlc` are the automation for this workflow: no LLM calls at test runtime, no automatic user-data creation, and no background test/watch triggers. API110 and browser110–112 cover the read model and connected paths. WEB033/062/092 cover return routing and failure/draft behavior. Existing cases cover real provider refresh, ownership, mutations, import conflicts, privacy and persistence.

For each task record specification, UI, UX, API/contracts, business workflow, database/migrations, real-data/provenance, automation, tests and documentation. State what was implemented, what is reused, what is not applicable and why, and what remains. Automation means a defined repeatable workflow with an owner/trigger and failure behavior; it is not permission to add unsolicited background actions. Keep user-invoked checks and tests as the default.

## UX-001 manual acceptance scenarios

- UX-DOC-001: A newcomer can follow overview → account → holdings → goals → research/inbox → privacy using visible navigation, without developer instructions or synthetic account data.
- UX-DOC-002: Review one task end to end across every delivery layer. A missing layer has a justified not-applicable or an explicit remaining item; screenshots/docs alone cannot mark it complete.
- UX-DOC-003: With an empty account and a populated account, inspect desktop/mobile and keyboard-only interaction. Check readable amounts, focus, empty/loading/error/saved states, and no clipped action controls.
- UX-DOC-004: Confirm source rights, real-data limits, advice gates and retained historical test evidence agree across TODO, README, delivery matrix and current status.
- UX-DOC-005: Force a format/check failure in a disposable working copy when manually verifying the SDLC tool; no commit may occur. Review the actual commit and report scope/evidence separately.

These document-review cases supplement executable UX cases. For UX-001, source/document review covered the full-layer record and DEV/SRC audit (UX-DOC-002/004); browser inspection and WEB110/111 covered the implemented navigation and selected desktop/mobile states (parts of UX-DOC-001/003). User design acceptance and a comprehensive accessibility audit remain open. UX-DOC-005's disposable-copy manual gate exercise was not run; existing SDLC orchestration unit tests passed. Exact runtime evidence is recorded in docs/development/status.md. WEB063/093 additionally protect against late initial-load response races.
